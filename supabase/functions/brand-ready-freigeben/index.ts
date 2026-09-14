import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// @ts-ignore -- dasselbe Regelwerk, das die SPA laedt; siehe Kommentar unten
import { brBerechnen, brSaetze } from 'https://cdn.jsdelivr.net/gh/StradaUno/bioseiten@893a36a84c9f81aaeb855996871cab7465ab97ac/public/app/brand-ready-regeln.js'

/* Erzeugt oder nimmt einen oeffentlichen Link auf den Brand-Ready-Stand zurueck.

   WICHTIG, und der Grund fuer den ungewoehnlichen Import oben:
   Der Browser schickt hier NUR die Plattform, niemals die Punktzahl. Gerechnet
   wird in dieser Function, auf denselben Zeilen, die auch die App liest. Auf der
   geteilten Seite steht "powered by viuno" -- viuno darf nicht mit seinem Namen
   fuer eine Zahl buergen, die der Creator in seinen DevTools setzen konnte.
   Damit es das Regelwerk trotzdem nur einmal gibt, laedt diese Function dieselbe
   Datei, die die SPA laedt -- ueber jsDelivr, weil der Supabase-Bundler nur von
   erlaubten CDNs importiert und viuno.de keines davon ist.

   Der Import ist auf einen COMMIT-SHA festgenagelt, nicht auf @main. Damit ist
   nachtraeglich beweisbar, nach welchen Regeln eine Freigabe gerechnet wurde,
   und ein Push kann die Rechnung nicht unbemerkt aendern.
   **Wer public/app/brand-ready-regeln.js aendert, muss pushen und diese
   Function danach mit dem neuen SHA neu deployen** -- sonst rechnet die
   Freigabe weiter nach den alten Regeln, waehrend die App die neuen zeigt.

   Geteilt wird ausschliesslich Punktestand und die zwei bis drei Saetze. Die
   Kriterienliste, die Eigenangaben und die Analyse-Rohzahlen bleiben im Haus --
   sie sind das bezahlte Produkt. */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status })

/* Ohne I, l, O und 0: der Token landet in Nachrichten und wird abgetippt.
   22 Zeichen aus 58 Moeglichkeiten sind rund 129 Bit -- nicht erratbar. */
const ALPHABET = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ123456789'
function neuerToken(laenge = 22): string {
  const bytes = new Uint8Array(laenge)
  crypto.getRandomValues(bytes)
  let s = ''
  for (const b of bytes) s += ALPHABET[b % ALPHABET.length]
  return s
}

async function fehlerMelden(nachricht: string) {
  try {
    await supabase.rpc('log_error', { function_name: 'brand-ready-freigeben', error_message: nachricht })
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

    const body = await req.json().catch(() => ({}))
    const platform = String(body.platform || '')
    const aktion = String(body.aktion || 'erzeugen')
    if (platform !== 'instagram' && platform !== 'tiktok') {
      return json({ success: false, error: 'platform fehlt' }, 400)
    }

    if (aktion === 'zuruecknehmen') {
      await supabase.from('brand_ready_freigaben')
        .update({ revoked_at: new Date().toISOString() })
        .eq('user_id', user.id).eq('platform', platform)
      return json({ success: true, zurueckgenommen: true })
    }

    /* ── Dieselben Zeilen, die auch die App liest ── */
    const uid = user.id
    const [statsQ, profilQ, blQ, mkQ, brandsQ, offersQ, preiseQ, angabenQ, nischeQ] = await Promise.all([
      supabase.from('analyse_stats').select('*').eq('user_id', uid).order('created_at', { ascending: false }),
      supabase.from('users').select('bio,contact_email,impressum_text,niche_category,niche_custom,bio_active,mediakit_active,display_name,profile_image_url').eq('id', uid).maybeSingle(),
      supabase.from('biolink_settings').select('is_active,impressum_text').eq('user_id', uid).maybeSingle(),
      supabase.from('mediakit_viuno').select('*').eq('user_id', uid).maybeSingle(),
      supabase.from('mediakit_brands').select('id', { count: 'exact', head: true }).eq('user_id', uid),
      supabase.from('mediakit_content_offers').select('offer_type').eq('user_id', uid),
      supabase.from('mediakit_preise').select('offer_type,preis_von').eq('user_id', uid),
      supabase.from('brand_ready_angaben').select('kriterium,wert,zahl').eq('user_id', uid),
      supabase.from('niche_mappings').select('keyword,niche_category')
    ])

    const alle = statsQ.data || []
    const neueste: any[] = []
    for (const r of alle) if (!neueste.some((x: any) => x.platform === r.platform)) neueste.push(r)
    const st = neueste.find((x: any) => x.platform === platform)
    if (!st) return json({ success: false, error: 'Für diesen Kanal gibt es noch keine Analyse' }, 400)

    const pq = await supabase.from('apify_daten')
      .select('caption').eq('analysis_run_id', st.analysis_run_id).eq('platform', platform)

    const angaben: Record<string, any> = {}
    for (const a of (angabenQ.data || [])) angaben[a.kriterium] = { wert: a.wert, zahl: a.zahl }

    const r = brBerechnen({
      platform,
      stats: st,
      statsPrev: alle.filter((x: any) => x.platform === platform)[1] || null,
      posts: pq.data || [],
      profil: profilQ.data || {},
      bl: blQ.data || {},
      mk: mkQ.data || {},
      brands: brandsQ.count || 0,
      offers: (offersQ.data || []).length,
      preise: (preiseQ.data || []).filter((x: any) => x.preis_von !== null).length,
      nischen: (nischeQ.data || []).filter((x: any) => x.keyword),
      angaben
    })
    const saetze = brSaetze(r)

    const jetzt = new Date()
    const laeuftAb = new Date(jetzt.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString()

    /* Ein Link je Kanal. Ein frueher zurueckgezogener Eintrag wird
       wiederbelebt -- mit NEUEM Token, damit der alte, weitergereichte Link
       nicht ploetzlich wieder funktioniert. */
    const { data: vorhanden } = await supabase.from('brand_ready_freigaben')
      .select('*').eq('user_id', uid).eq('platform', platform).maybeSingle()

    const aktiv = vorhanden && !vorhanden.revoked_at && new Date(vorhanden.expires_at) > jetzt
    const token = aktiv ? vorhanden.token : neuerToken()

    const zeile = {
      token, user_id: uid, platform,
      punkte: r.punkte, max_punkte: r.max, saetze,
      stichtag: st.created_at,
      anzeigename: profilQ.data?.display_name ?? null,
      profilbild: profilQ.data?.profile_image_url ?? null,
      expires_at: aktiv ? vorhanden.expires_at : laeuftAb,
      revoked_at: null,
      aufrufe: aktiv ? vorhanden.aufrufe : 0,
      created_at: aktiv ? vorhanden.created_at : jetzt.toISOString()
    }

    const { error } = await supabase.from('brand_ready_freigaben')
      .upsert(zeile, { onConflict: 'user_id,platform' })
    if (error) throw new Error(error.message)

    return json({ success: true, token, expires_at: zeile.expires_at, aufrufe: zeile.aufrufe,
                  punkte: r.punkte, max_punkte: r.max, neu: !aktiv })
  } catch (err: any) {
    console.error('brand-ready-freigeben:', err.message)
    await fehlerMelden(err.message)
    return json({ success: false, error: err.message }, 400)
  }
})
