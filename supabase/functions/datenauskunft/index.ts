import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * Datenauskunft nach Art. 15 DSGVO.
 *
 * AGB 7.4 sagt zu: "Vor Löschung kann der Nutzer einen Datenexport anfordern."
 * Bis 14.09.2026 gab es dafuer weder Knopf noch Adresse -- eine zugesagte und
 * nicht erbrachte Leistung.
 *
 * Die Anfrage geht an den Anbieter, nicht an den Nutzer. Eine JSON-Datei mit
 * Datenbankzeilen ist fuer den Betroffenen keine brauchbare Auskunft; der
 * Rohexport haengt hier als Arbeitsgrundlage an, aufbereitet und verschickt
 * wird von Hand. Der Nutzer sieht in der App den Hinweis auf 48 Stunden.
 * Die DSGVO-Frist (ein Monat, Art. 12 Abs. 3) ist damit deutlich unterboten.
 *
 * verify_jwt bleibt aus (CORS-Preflight), der Token wird hier geprueft.
 */

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || ''
const FROM = 'viuno <noreply@viuno.de>'
const AN_ANBIETER = 'kontakt@stradauno.de'

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

/** Vollstaendige Zeilen: alles, was der Nutzer selbst eingegeben oder erzeugt hat. */
const TABELLEN: Array<[string, string]> = [
  ['users', 'id'],
  ['biolink_settings', 'user_id'],
  ['biolink_viuno', 'user_id'],
  ['biolink_custom_links', 'user_id'],
  ['mediakit_viuno', 'user_id'],
  ['mediakit_brands', 'user_id'],
  ['mediakit_content_offers', 'user_id'],
  ['creator_analytics', 'user_id'],
  ['platform_accounts', 'user_id'],
  ['analytics_settings', 'user_id'],
  ['analysis_runs', 'user_id'],
  ['analyse_stats', 'user_id'],
  ['analyse_ki', 'user_id'],
  ['analyse_freigaben', 'user_id'],
  ['analysis_purchases', 'user_id'],
  ['withdrawal_consents', 'user_id'],
  ['user_goals', 'user_id'],
  ['competitor_accounts', 'owner_user_id'],
  ['digest_email_log', 'user_id'],
]

/** Nur Anzahl: Aufruf-Zaehler sind anonym und koennen sehr viele Zeilen sein. */
const NUR_ANZAHL: Array<[string, string]> = [
  ['biolink_aufrufe', 'user_id'],
  ['mediakit_aufrufe', 'user_id'],
  ['page_views', 'user_id'],
  ['apify_daten', 'user_id'],
]

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ success: false, error: 'nur POST' }, 405)

  try {
    const authHeader = req.headers.get('Authorization') || ''
    if (!authHeader.startsWith('Bearer ')) return json({ success: false, error: 'Nicht angemeldet' }, 401)
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.slice(7))
    if (authError || !user) return json({ success: false, error: 'Sitzung abgelaufen' }, 401)
    const uid = user.id

    if (!RESEND_API_KEY) throw new Error('Kein RESEND_API_KEY gesetzt')

    const { data: profil } = await supabase
      .from('users').select('email, contact_email, display_name').eq('id', uid).maybeSingle()
    /* Bewusst die Login-Adresse, nicht contact_email: die Auskunft gehoert dem
       Kontoinhaber, nicht dem Postfach, das auf dem Media Kit steht. */
    const anfragende_adresse = user.email || profil?.email
    if (!anfragende_adresse) return json({ success: false, error: 'Keine E-Mail-Adresse am Konto' }, 400)

    const export_: Record<string, unknown> = {
      hinweis: 'Auskunft nach Art. 15 DSGVO über alle zu deinem viuno-Konto gespeicherten Daten.',
      erstellt_am: new Date().toISOString(),
      konto_id: uid,
      anmeldung: {
        email: user.email,
        angelegt_am: user.created_at,
        letzte_anmeldung: user.last_sign_in_at,
        email_bestaetigt_am: (user as any).email_confirmed_at ?? null,
      },
    }

    for (const [tabelle, spalte] of TABELLEN) {
      const { data, error } = await supabase.from(tabelle).select('*').eq(spalte, uid)
      export_[tabelle] = error ? { fehler: error.message } : (data ?? [])
    }
    for (const [tabelle, spalte] of NUR_ANZAHL) {
      const { count, error } = await supabase.from(tabelle).select('id', { count: 'exact', head: true }).eq(spalte, uid)
      export_[tabelle] = error ? { fehler: error.message } : { anzahl_zeilen: count ?? 0, hinweis: 'Zähldaten ohne Personenbezug, deshalb nur die Anzahl.' }
    }

    // Newsletter haengt an der Adresse, nicht nur an der Konto-ID.
    const { data: nl } = await supabase
      .from('newsletter_subscribers').select('*')
      .or(`user_id.eq.${uid},email.eq.${String(anfragende_adresse).toLowerCase()}`)
    export_['newsletter_subscribers'] = nl ?? []

    const { data: consents } = await supabase.from('user_consents').select('*').eq('user_id', uid)
    export_['user_consents'] = consents ?? []

    const inhalt = JSON.stringify(export_, null, 2)
    /* Nicht per Spread in String.fromCharCode: bei einer grossen Auskunft
       sprengt das den Argument-Stack. */
    const bytes = new TextEncoder().encode(inhalt)
    let binaer = ''
    bytes.forEach((b) => (binaer += String.fromCharCode(b)))
    const anhang = btoa(binaer)
    const name = profil?.display_name || 'Creator'
    const datum = new Date().toISOString().slice(0, 10)

    const html = `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:24px;background:#f5f4f2;font-family:-apple-system,BlinkMacSystemFont,'Inter',Arial,sans-serif;color:#111110;">
  <h1 style="margin:0 0 14px;font-size:18px;font-weight:700;">Datenauskunft angefordert</h1>
  <table cellpadding="0" cellspacing="0" style="font-size:14px;color:#111110;line-height:1.7;">
    <tr><td style="padding-right:14px;color:#7a7975;">Username</td><td><strong>${name}</strong></td></tr>
    <tr><td style="padding-right:14px;color:#7a7975;">Login-Adresse</td><td>${anfragende_adresse}</td></tr>
    <tr><td style="padding-right:14px;color:#7a7975;">Konto-ID</td><td style="font-family:ui-monospace,monospace;font-size:12px;">${uid}</td></tr>
    <tr><td style="padding-right:14px;color:#7a7975;">Angefordert</td><td>${new Date().toLocaleString('de-DE', { timeZone: 'Europe/Berlin', dateStyle: 'long', timeStyle: 'short' })} Uhr</td></tr>
  </table>
  <p style="margin:18px 0 0;font-size:14px;color:#7a7975;line-height:1.6;">
    Der Nutzer hat in der App den Hinweis bekommen, dass die Auskunft <strong>innerhalb von 48 Stunden</strong> kommt.
    Der Rohexport haengt als JSON an — bitte aufbereiten und an die Login-Adresse schicken.
  </p>
</body></html>`

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM, to: [AN_ANBIETER], reply_to: anfragende_adresse,
        subject: `Datenauskunft angefordert: ${name} (${anfragende_adresse})`,
        html,
        attachments: [{ filename: `datenauskunft-${name}-${datum}.json`, content: anhang }],
      }),
    })
    if (!res.ok) throw new Error('Resend: ' + (await res.text()))

    return json({ success: true, frist_stunden: 48 })
  } catch (err: any) {
    console.error('datenauskunft:', err.message)
    try { await supabase.rpc('log_error', { function_name: 'datenauskunft', error_message: err.message }) } catch (_) {}
    return json({ success: false, error: 'Hat gerade nicht geklappt' }, 400)
  }
})
