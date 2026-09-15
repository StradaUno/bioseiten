import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/* Vertragsbestaetigung in Textform.

   Das ist die dritte Bedingung aus § 356 Abs. 5 BGB, die bisher komplett fehlte:
   (1) ausdrueckliche Zustimmung zum sofortigen Beginn -- Checkbox in der App,
   (2) Bestaetigung der Kenntnis des Rechtsverlusts -- Text der Checkbox,
   (3) Bestaetigung des Vertrags MIT Hinweis auf das Erloeschen in Textform -- diese Mail.
   Der Stripe-Beleg erfuellt (3) nicht, weil er den Hinweis nicht enthaelt.

   Repo-Kopie seit dem Launch-Check (15.09.2026); deployed wird aus dem Dashboard. */

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || ''
const FROM_EMAIL = 'noreply@viuno.de'
const FROM_NAME = 'viuno'
// Antworten landen bei der Support-Adresse aus dem Impressum.
const REPLY_TO = 'office@viuno.de'
const APP_LINK = 'https://viuno.de/app/#/analytics'
/* Die Einzelseiten /agb/, /widerruf/ usw. leiten auf /legal mit Anker weiter. */
const LEGAL = 'https://viuno.de/legal'

const INTERNAL_SECRET = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

const PLATFORM_LABEL: Record<string, string> = { instagram: 'Instagram', tiktok: 'TikTok' }

function esc(s: string) { return String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' } as any)[c]) }

function euro(cent: number, currency: string): string {
  const v = (cent / 100).toFixed(2).replace('.', ',')
  return currency?.toLowerCase() === 'eur' ? `${v} €` : `${v} ${String(currency).toUpperCase()}`
}

function zeile(label: string, wert: string): string {
  return `<tr>
    <td style="padding:7px 0;font-size:12.5px;color:#7a7975;width:42%;vertical-align:top;">${esc(label)}</td>
    <td style="padding:7px 0;font-size:12.5px;color:#111110;font-weight:600;vertical-align:top;">${esc(wert)}</td>
  </tr>`
}

Deno.serve(async (req) => {
  try {
    const auth = req.headers.get('Authorization') || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : auth
    if (!INTERNAL_SECRET || token !== INTERNAL_SECRET) {
      return new Response(JSON.stringify({ success: false, error: 'unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
    }

    const body = await req.json().catch(() => ({}))
    const sessionId = body.stripe_checkout_session_id
    if (!sessionId) throw new Error('stripe_checkout_session_id fehlt')

    const { data: kauf, error: kaufErr } = await supabase
      .from('analysis_purchases')
      .select('user_id, platform, amount_paid, currency, purchased_at, stripe_checkout_session_id')
      .eq('stripe_checkout_session_id', sessionId)
      .maybeSingle()
    if (kaufErr || !kauf) throw new Error('Kauf nicht gefunden fuer Session ' + sessionId)

    const { data: user, error: userErr } = await supabase
      .from('users').select('display_name, full_name, email, contact_email').eq('id', kauf.user_id).single()
    if (userErr || !user) throw new Error('User nicht gefunden')
    const toEmail = user.contact_email || user.email
    if (!toEmail) throw new Error('Keine E-Mail-Adresse fuer User')
    const name = user.display_name || user.full_name || 'Creator'

    const label = PLATFORM_LABEL[kauf.platform] || kauf.platform
    const datum = new Date(kauf.purchased_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const betrag = euro(kauf.amount_paid ?? 0, kauf.currency ?? 'eur')
    const subject = `Deine Freischaltung: viuno Analyse – ${label}`

    const html = `<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#f5f4f2;font-family:-apple-system,BlinkMacSystemFont,'Inter',Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f4f2;padding:28px 14px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">

<tr><td style="padding:4px 8px 20px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="vertical-align:middle;"><div style="width:26px;height:26px;border-radius:7px;background:#111110;display:inline-block;text-align:center;line-height:26px;font-size:13px;font-weight:800;color:#fff;">v</div></td>
<td style="padding-left:8px;vertical-align:middle;"><span style="font-size:15px;font-weight:700;color:#111110;letter-spacing:-0.02em;">viuno</span></td>
</tr></table>
</td></tr>

<tr><td style="padding:0 8px 18px;">
<h1 style="margin:0 0 4px;font-size:21px;font-weight:700;color:#111110;letter-spacing:-0.03em;">Danke für deinen Kauf</h1>
<p style="margin:0;font-size:14px;color:#7a7975;line-height:1.5;">Hallo ${esc(name)}, deine ${esc(label)}-Analyse ist freigeschaltet. Dies ist deine Vertragsbestätigung.</p>
</td></tr>

<tr><td style="padding:0 8px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border:1px solid #e4e4e2;border-radius:12px;">
<tr><td style="padding:16px 18px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${zeile('Leistung', `viuno Analyse – ${label}`)}
${zeile('Umfang', 'Eine einmalige Auswertung dieses Kanals')}
${zeile('Betrag', betrag)}
${zeile('Datum', datum)}
${zeile('Beleg-Nr.', String(kauf.stripe_checkout_session_id).slice(-12))}
</table>
<p style="margin:12px 0 0;font-size:11.5px;color:#a8a6a3;line-height:1.6;">Kleinunternehmer gemäß § 19 UStG – es wird keine Umsatzsteuer ausgewiesen. Deine Rechnung schickt dir Stripe in einer separaten E-Mail.</p>
</td></tr>
</table>
</td></tr>

<tr><td style="padding:0 8px 18px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fdf8ec;border:1px solid #f0e3c4;border-radius:12px;">
<tr><td style="padding:16px 18px;">
<div style="font-size:10px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#8a6d25;margin-bottom:7px;">Wichtig: Widerrufsrecht</div>
<p style="margin:0;font-size:12.5px;color:#5c4a1c;line-height:1.65;">Du hast vor dem Kauf ausdrücklich zugestimmt, dass wir sofort mit der Ausführung beginnen, und bestätigt, dass du dadurch dein Widerrufsrecht verlierst. Mit dem Beginn der Ausführung ist dein <b>Widerrufsrecht erloschen</b> (<a href="${LEGAL}#widerruf" style="color:#5c4a1c;">§ 356 Abs. 5 BGB</a>).</p>
</td></tr>
</table>
</td></tr>

<tr><td style="padding:0 8px 22px;text-align:center;">
<a href="${APP_LINK}" style="display:inline-block;padding:13px 26px;background:#111110;border-radius:10px;font-size:13px;font-weight:600;color:#ffffff;text-decoration:none;">Analyse jetzt starten</a>
<p style="margin:10px 0 0;font-size:12px;color:#7a7975;line-height:1.6;">Der Lauf dauert etwa 1–2 Minuten. Du bekommst eine E-Mail, sobald das Ergebnis bereit ist.</p>
</td></tr>

<tr><td style="padding:16px 8px 0;border-top:1px solid #e4e4e2;">
<p style="margin:0 0 6px;font-size:11px;color:#a8a6a3;line-height:1.6;">Fragen? Antworte einfach auf diese E-Mail oder schreib an office@viuno.de.</p>
<p style="margin:0;font-size:11px;color:#a8a6a3;"><a href="${LEGAL}#impressum" style="color:#a8a6a3;text-decoration:underline;">Impressum</a> &middot; <a href="${LEGAL}#agb" style="color:#a8a6a3;text-decoration:underline;">AGB</a> &middot; <a href="${LEGAL}#widerruf" style="color:#a8a6a3;text-decoration:underline;">Widerruf</a> &middot; <a href="${LEGAL}#datenschutz" style="color:#a8a6a3;text-decoration:underline;">Datenschutz</a></p>
</td></tr>

</table>
</td></tr>
</table>
</body></html>`

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: `${FROM_NAME} <${FROM_EMAIL}>`, reply_to: REPLY_TO, to: [toEmail], subject, html })
    })
    if (!res.ok) throw new Error('Resend: ' + await res.text())

    return new Response(JSON.stringify({ success: true, sent_to: toEmail, platform: kauf.platform }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (err: any) {
    console.error('send-purchase-confirmation error:', err.message)
    try { await supabase.rpc('log_error', { function_name: 'send-purchase-confirmation', error_message: err.message }) } catch (_) {}
    return new Response(JSON.stringify({ success: false, error: err.message }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  }
})
