import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/* abo-wochenanalyse — der Sonntagslauf fuer Abo-Konten (pg_cron 03:00 UTC).
 *
 * Das Abo (4,99 EUR/Monat, seit 17.09.2026) verspricht: jede Woche eine
 * Analyse, automatisch. Diese Function legt dafuer je Abo-Konto und je
 * hinterlegtem Kanal (Instagram, TikTok) eine Freischaltung an
 * (analysis_purchases, grund 'abo', 0 EUR) und stoesst start-analysis mit
 * dem Service-Role-Key an -- start-analysis nimmt seit v20 auch diesen Weg
 * und liest die user_id dann aus dem Body.
 *
 * Nicht doppelt: lief fuer den Kanal in den letzten fuenf Tagen schon eine
 * Analyse (egal ob Abo oder Willkommen), wird uebersprungen. Liegt schon
 * eine unverbrauchte Freischaltung da, wird keine zweite angelegt.
 *
 * Zwei Schloesser wie bei kanal-puls: Service-Role-Key als Bearer oder
 * cron_schluessel im Header x-schluessel. Mit body.user_id laeuft es fuer
 * genau ein Konto (Nachholen, Test). */

const SB_URL   = Deno.env.get('SUPABASE_URL')!
const SR       = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const supabase = createClient(SB_URL, SR)

const MIN_ABSTAND_TAGE = 5

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-schluessel',
}
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { headers: { ...cors, 'Content-Type': 'application/json' }, status: s })

async function darfLaufen(req: Request): Promise<boolean> {
  const kopf   = req.headers.get('Authorization') || ''
  const bearer = kopf.startsWith('Bearer ') ? kopf.slice(7) : kopf
  if (SR && bearer === SR) return true
  const wert = req.headers.get('x-schluessel') || ''
  if (!wert) return false
  const { data } = await supabase.rpc('schluessel_pruefen', { p_zweck: 'cron_schluessel', p_wert: wert })
  return data === true
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    if (!(await darfLaufen(req))) return json({ error: 'nicht_erlaubt' }, 403)
    const body   = await req.json().catch(() => ({}))
    const nurEin = typeof body.user_id === 'string' ? body.user_id : null

    const { data: abos, error } = await supabase
      .from('subscriptions').select('user_id, expires_at')
      .eq('plan', 'abo').eq('is_active', true)
    if (error) throw error

    const karenz = Date.now() - 3 * 86400000
    const konten = (abos ?? [])
      .filter(a => !a.expires_at || new Date(a.expires_at).getTime() > karenz)
      .filter(a => !nurEin || a.user_id === nurEin)

    const ergebnis: any[] = []
    for (const a of konten) {
      const { data: u } = await supabase.from('users')
        .select('id, instagram_handle, tiktok_handle, deleted_at').eq('id', a.user_id).maybeSingle()
      if (!u || u.deleted_at) continue

      for (const platform of ['instagram', 'tiktok'] as const) {
        const handle = platform === 'instagram' ? u.instagram_handle : u.tiktok_handle
        if (!handle || !String(handle).replace(/^@/, '').trim()) continue

        const { data: letzte } = await supabase.from('analysis_runs')
          .select('started_at, status').eq('user_id', u.id).eq('platform', platform)
          .in('status', ['scraping', 'analyzing', 'done'])
          .order('started_at', { ascending: false }).limit(1).maybeSingle()
        if (letzte && Date.now() - new Date(letzte.started_at).getTime() < MIN_ABSTAND_TAGE * 86400000) {
          ergebnis.push({ user: u.id, platform, grund: 'zu_frisch' }); continue
        }

        const { data: offen } = await supabase.from('analysis_purchases')
          .select('id').eq('user_id', u.id).eq('platform', platform).is('consumed_at', null).limit(1).maybeSingle()
        if (!offen) {
          const { error: insErr } = await supabase.from('analysis_purchases')
            .insert({ user_id: u.id, platform, amount_paid: 0, currency: 'eur', grund: 'abo' })
          if (insErr) { ergebnis.push({ user: u.id, platform, fehler: insErr.message }); continue }
        }

        const res = await fetch(SB_URL + '/functions/v1/start-analysis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + SR },
          body: JSON.stringify({ user_id: u.id, platform }),
        })
        const d = await res.json().catch(() => ({}))
        ergebnis.push({ user: u.id, platform, gestartet: res.ok && d.success === true, antwort: d.error || d.status || null })
      }
    }
    return json({ ok: true, konten: konten.length, ergebnis })
  } catch (err: any) {
    console.error('abo-wochenanalyse:', err.message)
    try { await supabase.rpc('log_error', { function_name: 'abo-wochenanalyse', error_message: err.message }) } catch (_) {}
    return json({ error: 'server_error', message: err.message }, 500)
  }
})
