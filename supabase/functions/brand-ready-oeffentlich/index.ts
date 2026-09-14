import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/* Oeffentlicher Abruf eines geteilten Brand-Ready-Stands.
   Ohne Anmeldung erreichbar, deshalb gilt: es geht NUR heraus, was auf der
   Seite auch wirklich gezeigt wird -- Punktestand, die zwei bis drei Saetze
   und der Stichtag. Die Kriterienliste, die Eigenangaben des Creators und
   jede Zahl aus der Analyse bleiben im Haus. */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' },
    status
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const url = new URL(req.url)
    const token = (url.searchParams.get('token') || '').trim()
    if (!token || token.length < 10 || token.length > 40) return json({ fehler: 'unbekannt' }, 404)

    const { data: frei } = await supabase
      .from('brand_ready_freigaben')
      .select('id, platform, punkte, max_punkte, saetze, stichtag, anzeigename, profilbild, expires_at, revoked_at, aufrufe')
      .eq('token', token).maybeSingle()

    /* Abgelaufen, zurueckgezogen und gar nicht vorhanden antworten absichtlich
       gleich: sonst verraet die Seite, dass es diesen Link einmal gab. */
    if (!frei || frei.revoked_at || new Date(frei.expires_at) < new Date()) {
      return json({ fehler: 'abgelaufen' }, 404)
    }

    // Aufrufe zaehlen, ohne die Antwort davon abhaengig zu machen.
    supabase.from('brand_ready_freigaben')
      .update({ aufrufe: (frei.aufrufe ?? 0) + 1, zuletzt_gesehen: new Date().toISOString() })
      .eq('id', frei.id).then(() => {}, () => {})

    return json({
      plattform: frei.platform === 'tiktok' ? 'TikTok' : 'Instagram',
      anzeigename: frei.anzeigename,
      profilbild: frei.profilbild,
      punkte: frei.punkte,
      max_punkte: frei.max_punkte,
      saetze: Array.isArray(frei.saetze) ? frei.saetze : [],
      stichtag: frei.stichtag
    })
  } catch (err: any) {
    console.error('brand-ready-oeffentlich:', err.message)
    return json({ fehler: 'unbekannt' }, 404)
  }
})
