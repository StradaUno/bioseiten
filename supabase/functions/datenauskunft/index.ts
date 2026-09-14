import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * Datenauskunft nach Art. 15 DSGVO.
 *
 * AGB 7.4 sagt zu: "Vor Löschung kann der Nutzer einen Datenexport anfordern."
 * Bis 14.09.2026 gab es dafuer weder Knopf noch Adresse -- eine zugesagte und
 * nicht erbrachte Leistung.
 *
 * Der Export geht als JSON-Anhang per Mail an die Login-Adresse, nicht als
 * Download-Link. Damit muss niemand ueber Ablaufzeiten, Tokens oder oeffentlich
 * erreichbare Dateien nachdenken, und die Auskunft landet nachweislich beim
 * Kontoinhaber.
 *
 * verify_jwt bleibt aus (CORS-Preflight), der Token wird hier geprueft.
 */

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || ''
const FROM = 'viuno <noreply@viuno.de>'

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
    const ziel = user.email || profil?.email
    if (!ziel) return json({ success: false, error: 'Keine E-Mail-Adresse am Konto' }, 400)

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
      .or(`user_id.eq.${uid},email.eq.${String(ziel).toLowerCase()}`)
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
<body style="margin:0;padding:0;background:#f5f4f2;font-family:-apple-system,BlinkMacSystemFont,'Inter',Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f4f2;padding:32px 14px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;background:#ffffff;border:1px solid #e4e4e2;border-radius:14px;">
<tr><td style="padding:28px 26px 24px;">
  <div style="width:26px;height:26px;border-radius:7px;background:#111110;text-align:center;line-height:26px;font-size:13px;font-weight:800;color:#fff;margin-bottom:18px;">v</div>
  <h1 style="margin:0 0 10px;font-size:20px;font-weight:700;color:#111110;letter-spacing:-0.03em;">Deine Datenauskunft</h1>
  <p style="margin:0 0 16px;font-size:14px;color:#7a7975;line-height:1.6;">Hallo ${name}, im Anhang findest du alles, was wir zu deinem viuno-Konto gespeichert haben — als JSON-Datei.</p>
  <p style="margin:0 0 16px;font-size:14px;color:#7a7975;line-height:1.6;">Die Datei enthält dein Profil, deine BioLink- und Media-Kit-Daten, deine Analysen samt Auswertungen, deine Käufe und deine Einwilligungen. Reine Zähldaten (Seitenaufrufe) sind nur als Anzahl enthalten, weil sie keinen Personenbezug haben.</p>
  <p style="margin:0;font-size:12px;color:#a8a6a3;line-height:1.6;">Du hast das nicht angefordert? Dann melde dich bitte bei kontakt@stradauno.de — jemand hatte womöglich Zugriff auf dein Konto.</p>
</td></tr>
<tr><td style="padding:0 26px 24px;">
  <p style="margin:0;font-size:11px;color:#a8a6a3;line-height:1.6;border-top:1px solid #e4e4e2;padding-top:14px;">
    <a href="https://viuno.de/legal/#impressum" style="color:#a8a6a3;">Impressum</a> &middot;
    <a href="https://viuno.de/legal/#datenschutz" style="color:#a8a6a3;">Datenschutz</a>
  </p>
</td></tr>
</table></td></tr></table></body></html>`

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM, to: [ziel],
        subject: 'Deine viuno-Datenauskunft',
        html,
        attachments: [{ filename: `viuno-datenauskunft-${datum}.json`, content: anhang }],
      }),
    })
    if (!res.ok) throw new Error('Resend: ' + (await res.text()))

    return json({ success: true, gesendet_an: ziel })
  } catch (err: any) {
    console.error('datenauskunft:', err.message)
    try { await supabase.rpc('log_error', { function_name: 'datenauskunft', error_message: err.message }) } catch (_) {}
    return json({ success: false, error: 'Hat gerade nicht geklappt' }, 400)
  }
})
