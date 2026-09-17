import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/* analyse-bilder — Vorschaubilder fuer die Beitragskarten der Analyse.
 *
 * Die Analyse-Seite zeigt Beitraege als Karten mit Bild: Top, Flop und
 * Kommentar-Rangliste, je bis zu sechs. Instagram-Vorschaulinks tragen einen
 * Ablaufstempel und sind rund vier Tage nach dem Abruf tot. Deshalb werden
 * genau die Bilder kopiert, die eine Rangliste braucht -- sonst nichts -- und
 * nach acht Wochen wieder geloescht (Vorgabe 18.09.2026).
 *
 * Aufruf: der Trigger bilder_bei_analyse (nach analyse_stats-Insert, Links sind
 * dann frisch) ueber viuno_cron_post mit x-schluessel, oder die App mit dem
 * JWT des Creators fuer einen eigenen Lauf. Die Rangfolge wird hier genauso
 * gebildet wie in der App (Resonanz = Likes je 1.000 Aufrufe; ohne Aufrufe
 * nach Likes). */

const SB_URL   = Deno.env.get('SUPABASE_URL')!
const SR       = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const supabase = createClient(SB_URL, SR)

const BUCKET = 'beitragsbilder'
const JE_LISTE = 6
const BEHALTEN_TAGE = 56
const MAX_BYTES = 2 * 1024 * 1024

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-schluessel',
}
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { headers: { ...cors, 'Content-Type': 'application/json' }, status: s })

/* Wer darf: Service-Role, Cron-Schluessel, oder der Creator selbst (dann nur eigene Laeufe). */
async function wer(req: Request): Promise<{ intern: boolean; uid: string | null }> {
  const kopf = req.headers.get('Authorization') || ''
  const bearer = kopf.startsWith('Bearer ') ? kopf.slice(7) : kopf
  if (SR && bearer === SR) return { intern: true, uid: null }
  const wert = req.headers.get('x-schluessel') || ''
  if (wert) {
    const { data } = await supabase.rpc('schluessel_pruefen', { p_zweck: 'cron_schluessel', p_wert: wert })
    if (data === true) return { intern: true, uid: null }
  }
  if (bearer) {
    const { data } = await supabase.auth.getUser(bearer)
    if (data?.user) return { intern: false, uid: data.user.id }
  }
  return { intern: false, uid: null }
}

const res = (p: any) => p.views > 0 ? (p.likes ?? 0) / p.views * 1000 : null
const kom = (p: any) => p.views > 0 ? (p.comments ?? 0) / p.views * 1000 : null

/* Dieselbe Auswahl wie in der App: bei mindestens drei Beitraegen mit Aufrufen
   nach Resonanz und Kommentarrate, sonst nach Likes. */
export function rangliste(posts: any[]): Set<string> {
  const mit = posts.filter(p => p.views > 0)
  const ids = new Set<string>()
  if (mit.length >= 3) {
    const r = [...mit].sort((a, b) => res(b)! - res(a)!)
    r.slice(0, JE_LISTE).forEach(p => ids.add(p.post_id))
    r.slice(-JE_LISTE).forEach(p => ids.add(p.post_id))
    ;[...mit].sort((a, b) => kom(b)! - kom(a)!).slice(0, JE_LISTE).forEach(p => ids.add(p.post_id))
  } else {
    const l = [...posts].sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0))
    l.slice(0, JE_LISTE).forEach(p => ids.add(p.post_id))
    l.slice(-JE_LISTE).forEach(p => ids.add(p.post_id))
  }
  return ids
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const w = await wer(req)
    if (!w.intern && !w.uid) return json({ success: false, error: 'nicht_erlaubt' }, 403)

    const body = await req.json().catch(() => ({}))
    const runId = String(body.analysis_run_id || '')
    const platform = String(body.platform || '')
    if (!runId || (platform !== 'instagram' && platform !== 'tiktok')) return json({ success: false, error: 'analysis_run_id und platform fehlen' }, 400)

    const { data: run } = await supabase.from('analysis_runs').select('id, user_id').eq('id', runId).maybeSingle()
    if (!run) return json({ success: false, error: 'Lauf unbekannt' }, 404)
    if (!w.intern && run.user_id !== w.uid) return json({ success: false, error: 'nicht_erlaubt' }, 403)
    const uid = run.user_id

    const { data: posts } = await supabase.from('apify_daten')
      .select('post_id, thumbnail_url, likes, comments, views')
      .eq('analysis_run_id', runId).eq('platform', platform)
    if (!posts?.length) return json({ success: true, gesichert: 0, grund: 'keine Beitraege' })

    const noetig = rangliste(posts)
    const { data: schon } = await supabase.from('analyse_beitragsbilder')
      .select('post_id').eq('user_id', uid).eq('platform', platform)
    const vorhanden = new Set((schon ?? []).map((x: any) => x.post_id))

    let gesichert = 0, uebersprungen = 0, abgelaufen = 0
    for (const p of posts) {
      if (!noetig.has(p.post_id)) continue
      if (vorhanden.has(p.post_id)) { uebersprungen++; continue }
      if (!p.thumbnail_url) continue
      try {
        const r = await fetch(p.thumbnail_url)
        const typ = r.headers.get('content-type') || ''
        if (!r.ok || !typ.startsWith('image/')) { abgelaufen++; continue }
        const bytes = new Uint8Array(await r.arrayBuffer())
        if (!bytes.length || bytes.length > MAX_BYTES) { abgelaufen++; continue }
        const endung = typ.includes('png') ? 'png' : typ.includes('webp') ? 'webp' : 'jpg'
        const pfad = `${uid}/${platform}-${p.post_id}.${endung}`
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(pfad, bytes, { contentType: typ, upsert: true })
        if (upErr) throw new Error(upErr.message)
        await supabase.from('analyse_beitragsbilder').upsert({
          user_id: uid, platform, post_id: p.post_id, analysis_run_id: runId, pfad, gesichert_am: new Date().toISOString(),
        }, { onConflict: 'user_id,platform,post_id' })
        gesichert++
      } catch (_) { abgelaufen++ }
    }

    /* Acht Wochen, dann weg -- je Konto, bei jedem Lauf. */
    const grenze = new Date(Date.now() - BEHALTEN_TAGE * 86400000).toISOString()
    const { data: alt } = await supabase.from('analyse_beitragsbilder')
      .select('id, pfad').eq('user_id', uid).lt('gesichert_am', grenze)
    let geloescht = 0
    if (alt?.length) {
      await supabase.storage.from(BUCKET).remove(alt.map((a: any) => a.pfad))
      await supabase.from('analyse_beitragsbilder').delete().in('id', alt.map((a: any) => a.id))
      geloescht = alt.length
    }

    return json({ success: true, gesichert, uebersprungen, abgelaufen, geloescht, noetig: noetig.size })
  } catch (err: any) {
    console.error('analyse-bilder:', err.message)
    try { await supabase.rpc('log_error', { function_name: 'analyse-bilder', error_message: err.message }) } catch (_) {}
    return json({ success: false, error: err.message }, 400)
  }
})
