import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * An- und Abmeldung zu den Creator News.
 *
 * Zwei Wege, ein Ergebnis:
 *   - Ohne Konto: Zeile auf "pending", Bestaetigungsmail, erst ihr Link
 *     schaltet auf "active". Eine Adresse auf einer oeffentlichen Seite
 *     einzusammeln und dann zu mailen, ohne dass jemand bestaetigt hat,
 *     ist im deutschen Markt angreifbar - deshalb dieser Umweg.
 *   - Mit Konto: die Adresse gehoert zum Konto und ist durch die Anmeldung
 *     bereits bestaetigt, also direkt "active". Die Adresse kommt dann aus
 *     dem Konto, nicht aus dem Formular.
 *
 * Seit dem Umbau schreibt kein Browser mehr direkt in die Tabelle - sonst
 * koennte man per REST einfach status='active' setzen und die Bestaetigung
 * ueberspringen. Alles laeuft hier durch.
 *
 * verify_jwt bleibt aus, weil die Function auch ohne Anmeldung erreichbar
 * sein muss. Ein mitgeschickter Token wird hier selbst geprueft.
 */

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || ''
const FROM = 'viuno <noreply@viuno.de>'

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const antwort = (daten: unknown, status = 200) =>
  new Response(JSON.stringify(daten), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

function esc(s: string) {
  return String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' } as any)[c])
}

/** Bewusst schlicht: alles, was ein @ mit Text davor und eine Domain dahinter hat. */
function adresseTaugt(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 254
}

async function bestaetigungSenden(email: string, token: string) {
  if (!RESEND_API_KEY) throw new Error('Kein RESEND_API_KEY gesetzt')
  const link = `https://bzejndghppuipnedasuv.supabase.co/functions/v1/newsletter-confirm?token=${token}`

  const html = `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Anmeldung bestätigen</title></head>
<body style="margin:0;padding:0;background:#f5f4f2;font-family:-apple-system,BlinkMacSystemFont,'Inter',Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f4f2;padding:32px 14px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;background:#ffffff;border:1px solid #e4e4e2;border-radius:14px;">
<tr><td style="padding:28px 26px 24px;">
  <div style="width:26px;height:26px;border-radius:7px;background:#111110;text-align:center;line-height:26px;font-size:13px;font-weight:800;color:#fff;margin-bottom:18px;">v</div>
  <h1 style="margin:0 0 10px;font-size:20px;font-weight:700;color:#111110;letter-spacing:-0.03em;">Noch ein Klick</h1>
  <p style="margin:0 0 20px;font-size:14px;color:#7a7975;line-height:1.6;">Bestätige diese Adresse, dann bekommst du die Creator News jeden Montag — was sich bei Instagram, TikTok und Co. für Creator ändert, und was das für dich heißt.</p>
  <a href="${esc(link)}" style="display:inline-block;padding:12px 24px;background:#111110;border-radius:9px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">Anmeldung bestätigen</a>
  <p style="margin:22px 0 0;font-size:12px;color:#a8a6a3;line-height:1.6;">Du hast das nicht angefordert? Dann ignoriere diese Mail einfach — ohne Bestätigung wird nichts versendet.</p>
</td></tr>
<tr><td style="padding:0 26px 24px;">
  <p style="margin:0;font-size:11px;color:#a8a6a3;line-height:1.6;border-top:1px solid #e4e4e2;padding-top:14px;">
    <a href="https://viuno.de/legal/#impressum" style="color:#a8a6a3;text-decoration:underline;">Impressum</a> &middot;
    <a href="https://viuno.de/legal/#datenschutz" style="color:#a8a6a3;text-decoration:underline;">Datenschutz</a>
  </p>
</td></tr>
</table></td></tr></table></body></html>`

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + RESEND_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [email], subject: 'Bestätige deine Anmeldung zu den Creator News', html }),
  })
  if (!res.ok) throw new Error('Resend: ' + (await res.text()))
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return antwort({ error: 'nur POST' }, 405)

  try {
    const { email: eingabe = '', source = 'unbekannt', abmelden = false } = await req.json().catch(() => ({}))

    // Angemeldet? Dann gilt die Adresse des Kontos, nicht die aus dem Formular.
    let kontoId: string | null = null
    let adresse = String(eingabe || '').trim().toLowerCase()

    const authHeader = req.headers.get('Authorization') || ''
    const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    if (jwt) {
      const { data } = await supabase.auth.getUser(jwt)
      if (data?.user) {
        kontoId = data.user.id
        /* Die Login-Adresse, nicht contact_email. Das Abo gehoert dem
           Kontoinhaber, nicht dem Postfach, das auf dem Media Kit steht --
           dieselbe Entscheidung wie in datenauskunft. Wer dort die Adresse
           seiner Agentur eintraegt, wuerde die sonst als "active" mit
           gesetztem confirmed_at in den Verteiler schreiben, ohne dass sie
           je zugestimmt hat. Genau das soll der Doppel-Opt-in verhindern. */
        const { data: profil } = await supabase
          .from('users').select('email, contact_email').eq('id', kontoId).maybeSingle()
        adresse = String(profil?.email || data.user.email || profil?.contact_email || '').trim().toLowerCase()
      }
    }

    // Abmelden aus der App. Ohne Konto fuehrt der Weg ueber den Token im
    // Mailfuss - dafuer gibt es digest-unsubscribe.
    if (abmelden) {
      if (!kontoId) return antwort({ error: 'Abmelden braucht eine Anmeldung' }, 401)
      const { error } = await supabase
        .from('newsletter_subscribers')
        .update({ status: 'unsubscribed', unsubscribed_at: new Date().toISOString() })
        .eq('user_id', kontoId)
      if (error) throw new Error(error.message)
      return antwort({ status: 'abgemeldet' })
    }

    if (!adresseTaugt(adresse)) return antwort({ error: 'Adresse sieht nicht richtig aus' }, 400)

    const { data: vorhanden } = await supabase
      .from('newsletter_subscribers')
      .select('id, status, token, updated_at, user_id')
      .ilike('email', adresse)
      .maybeSingle()

    /* Mit und ohne Konto: bestaetigen lassen. Seit 17.09.2026 auch fuer
       angemeldete Konten -- vorher wurde ein Konto direkt "active" gesetzt,
       der Betreiber will aber in jedem Fall die Bestaetigung per Mail. Mit
       Konto traegt die Zeile die user_id, damit die App den Stand sieht. */
    if (vorhanden?.status === 'active') return antwort({ status: 'schon_aktiv' })

    // Gegen versehentliches und absichtliches Mehrfachanfordern.
    if (vorhanden?.status === 'pending' && vorhanden.updated_at) {
      const alter = Date.now() - new Date(vorhanden.updated_at).getTime()
      if (alter < 2 * 60 * 1000) return antwort({ status: 'bestaetigung_unterwegs', email: adresse })
    }

    let token = vorhanden?.token
    if (vorhanden) {
      const { data, error } = await supabase
        .from('newsletter_subscribers')
        .update({ status: 'pending', source, subscribed_at: new Date().toISOString(), unsubscribed_at: null, user_id: kontoId ?? vorhanden.user_id ?? null })
        .eq('id', vorhanden.id)
        .select('token').single()
      if (error) throw new Error(error.message)
      token = data.token
    } else {
      const { data, error } = await supabase
        .from('newsletter_subscribers')
        .insert({ email: adresse, user_id: kontoId, source, status: 'pending', subscribed_at: new Date().toISOString() })
        .select('token').single()
      if (error) throw new Error(error.message)
      token = data.token
    }

    await bestaetigungSenden(adresse, token!)
    return antwort({ status: 'bestaetigung_unterwegs', email: adresse })
  } catch (err: any) {
    console.error('newsletter-subscribe:', err.message)
    try { await supabase.rpc('log_error', { function_name: 'newsletter-subscribe', error_message: err.message }) } catch (_) {}
    return antwort({ error: 'Hat gerade nicht geklappt' }, 400)
  }
})
