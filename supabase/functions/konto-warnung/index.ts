import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * Hinweis an die BISHERIGE Adresse, wenn Passwort oder Login-E-Mail geaendert
 * wurden.
 *
 * Warum das und nicht Zwei-Faktor: ein viuno-Konto enthaelt keine Zahlungsdaten
 * und keine Plattform-Zugaenge. Das Schlimmste, was jemand mit einer
 * uebernommenen Sitzung anrichten kann, ist die oeffentliche Seite zu
 * veraendern oder den Zugang zu uebernehmen. Genau das faellt mit dieser Mail
 * auf -- TOTP waere fuer diese Zielgruppe Ueberbau.
 *
 * Die Mail ist Beiwerk: der Client ruft sie ohne await auf, ein Fehler hier
 * darf die Aenderung nie blockieren.
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

function esc(t: string) {
  return String(t ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' } as any)[c])
}

function rahmen(titel: string, absaetze: string[]) {
  return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f5f4f2;font-family:-apple-system,BlinkMacSystemFont,'Inter',Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f4f2;padding:32px 14px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;background:#ffffff;border:1px solid #e4e4e2;border-radius:14px;">
<tr><td style="padding:28px 26px 24px;">
  <div style="width:26px;height:26px;border-radius:7px;background:#111110;text-align:center;line-height:26px;font-size:13px;font-weight:800;color:#fff;margin-bottom:18px;">v</div>
  <h1 style="margin:0 0 10px;font-size:20px;font-weight:700;color:#111110;letter-spacing:-0.03em;">${esc(titel)}</h1>
  ${absaetze.map((a) => `<p style="margin:0 0 14px;font-size:14px;color:#7a7975;line-height:1.6;">${a}</p>`).join('')}
  <p style="margin:18px 0 0;font-size:13px;color:#111110;line-height:1.6;"><strong>Warst du das nicht?</strong> Dann melde dich sofort bei <a href="mailto:kontakt@stradauno.de" style="color:#111110;">kontakt@stradauno.de</a>. Setze ausserdem dein Passwort über „Passwort vergessen“ auf viuno.de neu.</p>
</td></tr>
<tr><td style="padding:0 26px 24px;">
  <p style="margin:0;font-size:11px;color:#a8a6a3;line-height:1.6;border-top:1px solid #e4e4e2;padding-top:14px;">
    <a href="https://viuno.de/legal/#impressum" style="color:#a8a6a3;">Impressum</a> &middot;
    <a href="https://viuno.de/legal/#datenschutz" style="color:#a8a6a3;">Datenschutz</a>
  </p>
</td></tr>
</table></td></tr></table></body></html>`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ success: false, error: 'nur POST' }, 405)

  try {
    const authHeader = req.headers.get('Authorization') || ''
    if (!authHeader.startsWith('Bearer ')) return json({ success: false, error: 'Nicht angemeldet' }, 401)
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.slice(7))
    if (authError || !user) return json({ success: false, error: 'Sitzung abgelaufen' }, 401)

    const { art = '', neue_adresse = null } = await req.json().catch(() => ({}))
    if (art !== 'passwort' && art !== 'email') return json({ success: false, error: 'unbekannte Art' }, 400)
    if (!RESEND_API_KEY) throw new Error('Kein RESEND_API_KEY gesetzt')

    /* Die Adresse aus dem Token ist noch die alte: sb.auth.updateUser({email})
       setzt erst nach der Bestaetigung um. Genau dorthin soll der Hinweis. */
    const ziel = user.email
    if (!ziel) return json({ success: true, uebersprungen: 'keine Adresse' })

    const wann = new Date().toLocaleString('de-DE', { timeZone: 'Europe/Berlin', dateStyle: 'long', timeStyle: 'short' })

    const html = art === 'passwort'
      ? rahmen('Dein Passwort wurde geändert', [
          `Das Passwort deines viuno-Kontos wurde am ${esc(wann)} Uhr geändert.`,
          'Wenn du das selbst warst, kannst du diese Mail einfach ignorieren.',
        ])
      : rahmen('Änderung deiner Login-Adresse', [
          `Für dein viuno-Konto wurde am ${esc(wann)} Uhr eine neue Login-Adresse angefordert${neue_adresse ? `: <strong>${esc(String(neue_adresse))}</strong>` : ''}.`,
          'Die Änderung wird erst wirksam, wenn der Link in der Bestätigungsmail an die neue Adresse angeklickt wird. Bis dahin gilt weiterhin diese Adresse hier.',
        ])

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM, to: [ziel],
        subject: art === 'passwort' ? 'Dein viuno-Passwort wurde geändert' : 'Änderung deiner viuno-Login-Adresse',
        html,
      }),
    })
    if (!res.ok) throw new Error('Resend: ' + (await res.text()))

    return json({ success: true })
  } catch (err: any) {
    console.error('konto-warnung:', err.message)
    try { await supabase.rpc('log_error', { function_name: 'konto-warnung', error_message: err.message }) } catch (_) {}
    return json({ success: false, error: 'Hinweis konnte nicht gesendet werden' }, 400)
  }
})
