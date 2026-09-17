import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/* Erzeugt oder nimmt einen oeffentlichen Link auf den Brand-Ready-Stand zurueck.

   Seit 18.09.2026 rechnet die Freigabe mit derselben Quelle wie die App:
   viuno_profilcheck() in Postgres (zehn Kriterien, Punkte und Prozent). Vorher
   lud die Function das aeltere Regelwerk brand-ready-regeln.js ueber jsDelivr,
   und die geteilte Seite zeigte eine andere Zahl als die App.

   Der Browser schickt hier NUR die Plattform (sie ist der Schluessel der
   Zeile), niemals die Punktzahl. Auf der geteilten Seite steht "powered by
   viuno" -- viuno darf nicht mit seinem Namen fuer eine Zahl buergen, die der
   Creator in seinen DevTools setzen konnte.

   Geteilt wird ausschliesslich Punktestand und zwei bis drei Saetze. Die
   Kriterienliste mit ihren Begruendungen bleibt im Haus. */

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

/* Zwei bis drei Saetze aus dem Profilcheck. Nur Titel erfuellter Kriterien,
   keine Begruendungen -- die enthalten Zahlen aus der Analyse. */
function saetzeAus(pc: any, name: string): string[] {
  const teile: any[] = Array.isArray(pc.teile) ? pc.teile : []
  const erfuellt = teile.filter(t => t.zustand === 'erfuellt').map(t => String(t.titel))
  const offen = teile.filter(t => t.zustand === 'offen' || t.zustand === 'teilweise').length
  const saetze = [`${name} ist zu ${pc.prozent} % kooperationsbereit: ${pc.punkte} von ${pc.max} Punkten im Brand-Ready-Check von viuno.`]
  if (erfuellt.length) {
    const liste = erfuellt.slice(0, 4).join(', ') + (erfuellt.length > 4 ? ' und mehr' : '')
    saetze.push(`Erfüllt: ${liste}.`)
  }
  if (offen > 0) saetze.push(`Noch offen: ${offen} ${offen === 1 ? 'Punkt' : 'Punkte'}.`)
  else saetze.push('Alle bewertbaren Punkte sind erfüllt.')
  return saetze
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
    const platform = String(body.platform || 'instagram')
    const aktion = String(body.aktion || 'erzeugen')
    if (platform !== 'instagram' && platform !== 'tiktok') {
      return json({ success: false, error: 'platform fehlt' }, 400)
    }
    const uid = user.id

    if (aktion === 'zuruecknehmen') {
      await supabase.from('brand_ready_freigaben')
        .update({ revoked_at: new Date().toISOString() })
        .eq('user_id', uid).eq('platform', platform)
      return json({ success: true, zurueckgenommen: true })
    }

    /* Brand Ready ist Teil des Abos -- ohne Abo keine Freigabe. */
    const { data: abo } = await supabase.rpc('abo_aktiv', { p_user: uid })
    if (abo !== true) return json({ success: false, error: 'Brand Ready ist Teil des Abos' }, 402)

    /* Dieselbe Rechnung wie in der App. */
    const { data: pc, error: pcErr } = await supabase.rpc('viuno_profilcheck', { p_user: uid })
    if (pcErr || !pc) throw new Error('Profilcheck: ' + (pcErr?.message ?? 'leer'))

    const { data: profil } = await supabase.from('users')
      .select('display_name, profile_image_url').eq('id', uid).maybeSingle()
    const name = profil?.display_name || 'Dieser Creator'
    const saetze = saetzeAus(pc, name)

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
      punkte: pc.punkte, max_punkte: pc.max, saetze,
      stichtag: pc.stichtag || jetzt.toISOString(),
      anzeigename: profil?.display_name ?? null,
      profilbild: profil?.profile_image_url ?? null,
      expires_at: aktiv ? vorhanden.expires_at : laeuftAb,
      revoked_at: null,
      aufrufe: aktiv ? vorhanden.aufrufe : 0,
      created_at: aktiv ? vorhanden.created_at : jetzt.toISOString()
    }

    const { error } = await supabase.from('brand_ready_freigaben')
      .upsert(zeile, { onConflict: 'user_id,platform' })
    if (error) throw new Error(error.message)

    return json({ success: true, token, expires_at: zeile.expires_at, aufrufe: zeile.aufrufe,
                  punkte: pc.punkte, max_punkte: pc.max, prozent: pc.prozent, neu: !aktiv })
  } catch (err: any) {
    console.error('brand-ready-freigeben:', err.message)
    await fehlerMelden(err.message)
    return json({ success: false, error: err.message }, 400)
  }
})
