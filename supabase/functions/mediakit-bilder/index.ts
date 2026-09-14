import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/* Sichert die Vorschaubilder der staerksten Beitraege in viunos eigenen
   Speicher, damit sie im Media Kit gezeigt werden koennen.

   WARUM KOPIEREN UND NICHT VERLINKEN: apify_daten.thumbnail_url traegt bei
   Instagram einen Ablaufstempel (Parameter `oe`) und ist rund VIER TAGE nach
   der Analyse tot. Ein Media Kit steht Monate online -- verlinkte Bilder
   waeren dort nach einer Woche kaputt.

   NICHT SKALIERT, mit Absicht: die Vorschaubilder sind rund 100 kB gross,
   das ist fuer eine Kit-Seite in Ordnung. Skalieren in einer Edge Function
   ist hier ohnehin nicht moeglich -- imagescript dekodiert JPEG nach RGBA
   und sprengt das Speicherlimit schon bei 1 MB (siehe News-Bilder).

   Aufgerufen wird die Function aus der App: nach einer fertigen Analyse und
   beim Oeffnen des Media Kits. Die Analyse-Pipeline selbst wird NICHT
   angefasst -- sie ist das bezahlte Produkt und laeuft. Der Preis dafuer:
   wer sein Kit erst Wochen nach der Analyse anfasst, findet abgelaufene
   Links vor. Die Function sagt das dann klar, statt still nichts zu tun. */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const BUCKET = 'mediakit-beitraege'
const PRO_PLATTFORM = 6      // gesichert werden sechs, gezeigt werden drei
const MAX_BYTES = 2 * 1024 * 1024

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status })

async function fehlerMelden(nachricht: string) {
  try {
    await supabase.rpc('log_error', { function_name: 'mediakit-bilder', error_message: nachricht })
  } catch (_) { /* Logging darf den Lauf nicht zusaetzlich kippen */ }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const authHeader = req.headers.get('Authorization') || ''
    if (!authHeader) throw new Error('Kein Authorization Header')
    const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt)
    if (authError || !user) throw new Error('Auth fehlgeschlagen')
    const uid = user.id

    const { data: stats } = await supabase.from('analyse_stats')
      .select('platform, analysis_run_id, created_at')
      .eq('user_id', uid).order('created_at', { ascending: false })

    const neueste: any[] = []
    for (const r of (stats || [])) {
      if (!neueste.some((x: any) => x.platform === r.platform)) neueste.push(r)
    }
    if (!neueste.length) return json({ success: true, gesichert: 0, grund: 'keine Analyse' })

    let gesichert = 0, uebersprungen = 0, abgelaufen = 0
    const ergebnis: any[] = []

    for (const lauf of neueste) {
      /* Sortiert wird nach dem, was die Plattform selbst hervorhebt:
         auf TikTok Aufrufe, auf Instagram Likes. */
      const spalte = lauf.platform === 'tiktok' ? 'views' : 'likes'
      const { data: posts } = await supabase.from('apify_daten')
        .select('post_id, post_url, thumbnail_url, likes, comments, views, posted_at')
        .eq('analysis_run_id', lauf.analysis_run_id).eq('platform', lauf.platform)
        .order(spalte, { ascending: false, nullsFirst: false })
        .limit(PRO_PLATTFORM)

      const { data: schon } = await supabase.from('mediakit_beitraege')
        .select('post_id, bild_pfad').eq('user_id', uid).eq('platform', lauf.platform)
      const vorhanden = new Map((schon || []).map((x: any) => [x.post_id, x.bild_pfad]))

      let pos = 0
      for (const p of (posts || [])) {
        pos++
        if (vorhanden.get(p.post_id)) { uebersprungen++; continue }
        if (!p.thumbnail_url) continue

        let pfad: string | null = null
        try {
          const res = await fetch(p.thumbnail_url)
          const typ = res.headers.get('content-type') || ''
          if (!res.ok || !typ.startsWith('image/')) { abgelaufen++; continue }
          const bytes = new Uint8Array(await res.arrayBuffer())
          if (!bytes.length || bytes.length > MAX_BYTES) { abgelaufen++; continue }

          const endung = typ.includes('png') ? 'png' : typ.includes('webp') ? 'webp' : 'jpg'
          pfad = `${uid}/${lauf.platform}-${p.post_id}.${endung}`
          const { error: upErr } = await supabase.storage.from(BUCKET)
            .upload(pfad, bytes, { contentType: typ, upsert: true })
          if (upErr) throw new Error(upErr.message)
          gesichert++
        } catch (e) {
          /* Ein einzelnes totes Bild darf den Lauf nicht kippen -- die
             uebrigen Beitraege sollen trotzdem gesichert werden. */
          abgelaufen++
          continue
        }

        await supabase.from('mediakit_beitraege').upsert({
          user_id: uid, platform: lauf.platform, post_id: p.post_id,
          post_url: p.post_url, bild_pfad: pfad,
          likes: p.likes, comments: p.comments, views: p.views,
          posted_at: p.posted_at, position: pos,
          gesichert_am: new Date().toISOString()
        }, { onConflict: 'user_id,platform,post_id' })

        ergebnis.push({ platform: lauf.platform, post_id: p.post_id })
      }
    }

    if (abgelaufen > 0 && gesichert === 0 && uebersprungen === 0) {
      return json({ success: true, gesichert: 0, abgelaufen,
        grund: 'Die Vorschaubilder deiner letzten Analyse sind abgelaufen. Sie werden bei deiner nächsten Analyse gesichert.' })
    }
    return json({ success: true, gesichert, uebersprungen, abgelaufen, beitraege: ergebnis })
  } catch (err: any) {
    console.error('mediakit-bilder:', err.message)
    await fehlerMelden(err.message)
    return json({ success: false, error: err.message }, 400)
  }
})
