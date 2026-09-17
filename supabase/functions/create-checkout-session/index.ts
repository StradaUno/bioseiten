import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// Version fest gepinnt, siehe Kommentar in viuno-stripe-setup: "stripe@17" loest
// inzwischen auf 17.7.0 auf und lehnt die frueher gesetzte apiVersion ab.
import Stripe from 'https://esm.sh/stripe@17.7.0?target=denonext'

/* Repo-Kopie seit 17.09.2026 (mit dem Abo). Deployed wird aus dem Dashboard
   bzw. per MCP; nach einer Aenderung hier deployen, dort zurueckkopieren. */

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const APP_URL = 'https://viuno.de/app/'
const PLATFORM_LABEL: Record<string, string> = { instagram: 'Instagram', tiktok: 'TikTok' }
const HANDLE_FIELD: Record<string, string> = { instagram: 'instagram_handle', tiktok: 'tiktok_handle' }

const WITHDRAWAL_CONSENT_TEXT =
  'Ich stimme zu, dass die Analyse sofort nach Zahlung beginnt, und verliere damit mein 14-taegiges Widerrufsrecht.'
const ABO_CONSENT_TEXT =
  'Ich stimme zu, dass das Abo sofort nach Zahlung beginnt, und verliere damit mein 14-taegiges Widerrufsrecht fuer die begonnene Laufzeit.'
const INVOICE_FOOTER =
  'Kleinunternehmer gemäß § 19 UStG – es wird keine Umsatzsteuer ausgewiesen.'

/* Der Bestellprozess selbst wies bisher weder auf AGB noch auf das Widerrufsrecht hin.
   custom_text.submit erscheint direkt ueber dem Bezahlen-Button in Stripe Checkout und
   braucht -- anders als consent_collection.terms_of_service -- keine zusaetzliche
   Konfiguration im Stripe-Dashboard. */
const CHECKOUT_HINWEIS =
  'Es gelten die AGB von viuno (viuno.de/legal#agb). Du hast zugestimmt, dass die Analyse sofort nach der Zahlung beginnt; ' +
  'damit erlischt dein Widerrufsrecht (viuno.de/legal#widerruf). Kleinunternehmer gemäß § 19 UStG – keine Umsatzsteuer.'
const ABO_HINWEIS =
  'Es gelten die AGB von viuno (viuno.de/legal#agb). Das Abo kostet 4,99 EUR im Monat, verlaengert sich monatlich und ist jederzeit zum Ende des Monats kuendbar. ' +
  'Du hast zugestimmt, dass es sofort beginnt; damit erlischt dein Widerrufsrecht fuer die begonnene Laufzeit (viuno.de/legal#widerruf). Kleinunternehmer gemaess § 19 UStG - keine Umsatzsteuer.'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status
  })
}

function stripeFor(mode: string): Stripe {
  const key = mode === 'test'
    ? (Deno.env.get('STRIPE_SECRET_KEY_TEST') || '')
    : (Deno.env.get('STRIPE_SECRET_KEY') || '')
  if (!key) throw new Error(`Kein Stripe-Key fuer Modus "${mode}" hinterlegt`)
  return new Stripe(key)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    // Auth: derselbe manuelle JWT-Check wie in start-analysis.
    const authHeader = req.headers.get('Authorization') || ''
    if (!authHeader) return json({ error: 'unauthorized', message: 'Nicht angemeldet.' }, 401)
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return json({ error: 'unauthorized', message: 'Deine Sitzung ist abgelaufen. Bitte melde dich neu an.' }, 401)
    const userId = user.id

    const body = await req.json().catch(() => ({}))
    /* Rueckkehr-Adresse: die App nennt ihren eigenen Ort (z. B. /viuno2/test/),
       erlaubt ist nur viuno.de. Alles andere faellt auf /app/ zurueck. */
    const rueckkehr = typeof body.rueckkehr === 'string' && /^https:\/\/viuno\.de\/[a-z0-9/_-]*$/i.test(body.rueckkehr) ? body.rueckkehr : APP_URL
    const mode = (Deno.env.get('VIUNO_STRIPE_MODE') || 'live').toLowerCase()

    /* ── Abo (4,99 EUR/Monat, seit 17.09.2026) ─────────────────────────────
       Laeuft im Testmodus, solange stripe_prices keine live/abo-Zeile traegt
       ("Test jetzt, Live spaeter"). Der Webhook laesst genau diese
       Test-Ereignisse durch, solange das so ist. */
    if (String(body.art || '') === 'abo') {
      if (body.consent !== true) {
        return json({ error: 'consent_required', message: 'Bitte stimme zuerst der sofortigen Ausfuehrung zu.' }, 400)
      }
      const { data: aboLive } = await supabase.from('stripe_prices').select('price_id').eq('mode', 'live').eq('platform', 'abo').maybeSingle()
      const aboMode = aboLive?.price_id ? mode : 'test'
      const { data: aboPreis } = await supabase.from('stripe_prices').select('price_id').eq('mode', aboMode).eq('platform', 'abo').maybeSingle()
      if (!aboPreis?.price_id) throw new Error(`Kein Abo-Preis im Modus ${aboMode} hinterlegt`)
      const { data: schon } = await supabase.rpc('abo_aktiv', { p_user: userId })
      if (schon === true) return json({ error: 'schon_abonniert', message: 'Du hast schon ein aktives Abo.' }, 400)
      const { data: u } = await supabase.from('users').select('email, contact_email').eq('id', userId).single()
      const stripe = stripeFor(aboMode)
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        line_items: [{ price: aboPreis.price_id, quantity: 1 }],
        client_reference_id: userId,
        customer_email: u?.contact_email || u?.email || undefined,
        metadata: { user_id: userId, art: 'abo' },
        subscription_data: { metadata: { user_id: userId } },
        locale: 'de',
        custom_text: { submit: { message: ABO_HINWEIS } },
        success_url: `${rueckkehr}?checkout=abo#/analyse/analyse`,
        cancel_url: `${rueckkehr}?checkout=cancel#/analyse/analyse`
      })
      const { error: consentErr } = await supabase.from('withdrawal_consents').insert({
        user_id: userId, consent_text: ABO_CONSENT_TEXT, platform: null, stripe_checkout_session_id: session.id
      })
      if (consentErr) console.error('withdrawal_consents insert error (abo):', consentErr.message)
      return json({ url: session.url, session_id: session.id, art: 'abo', mode: aboMode })
    }

    /* ── Einmalkauf (9,99 EUR je Kanal). In der App seit 17.09.2026 nicht mehr
       angeboten, der Weg bleibt fuer Altbestand und Sonderfaelle erhalten. */
    const platform = String(body.platform || '').toLowerCase()
    if (platform !== 'instagram' && platform !== 'tiktok') {
      return json({ error: 'invalid_platform', message: 'Bitte waehle Instagram oder TikTok.' }, 400)
    }

    // Die Zustimmung zur sofortigen Ausfuehrung muss VOR dem Checkout vorliegen (§ 356 Abs. 5 BGB).
    if (body.consent !== true) {
      return json({ error: 'consent_required', message: 'Bitte stimme zuerst der sofortigen Ausfuehrung zu.' }, 400)
    }

    // Ohne hinterlegten Handle gibt es nichts zu analysieren -- frueher konnte man
    // bezahlen und erfuhr erst danach, dass ein Kanal fehlt.
    const { data: u, error: userErr } = await supabase
      .from('users').select('email, contact_email, instagram_handle, tiktok_handle').eq('id', userId).single()
    if (userErr || !u) throw new Error('User nicht gefunden')

    const handle = (u as Record<string, string | null>)[HANDLE_FIELD[platform]]
    if (!handle || !String(handle).trim()) {
      return json({
        error: 'handle_missing',
        platform,
        message: `Fuer die ${PLATFORM_LABEL[platform]}-Analyse fehlt noch dein ${PLATFORM_LABEL[platform]}-Handle. Hinterlege ihn in deinem Profil, dann kannst du freischalten.`
      }, 400)
    }

    const { data: preis } = await supabase
      .from('stripe_prices').select('price_id').eq('mode', mode).eq('platform', platform).maybeSingle()
    if (!preis?.price_id) throw new Error(`Kein Stripe-Preis fuer ${platform} im Modus ${mode} hinterlegt`)

    const stripe = stripeFor(mode)

    /* Der Query-Parameter steht bewusst VOR dem Hash: die SPA liest ihn ueber
       location.search. Haenge man ihn hinter "#/analytics", waere er Teil des
       Fragments und location.search bliebe leer. */
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: preis.price_id, quantity: 1 }],
      client_reference_id: userId,
      customer_email: u.contact_email || u.email || undefined,
      metadata: { user_id: userId, platform },
      payment_intent_data: { metadata: { user_id: userId, platform } },
      locale: 'de',
      custom_text: { submit: { message: CHECKOUT_HINWEIS } },
      invoice_creation: {
        enabled: true,
        invoice_data: {
          description: `viuno Analyse – ${PLATFORM_LABEL[platform]} (@${String(handle).replace(/^@/, '')})`,
          footer: INVOICE_FOOTER,
          metadata: { user_id: userId, platform }
        }
      },
      success_url: `${rueckkehr}?checkout=success&platform=${platform}&session_id={CHECKOUT_SESSION_ID}#/analytics`,
      cancel_url: `${rueckkehr}?checkout=cancel#/analytics`
    })

    /* Die Zustimmung wird der Session zugeordnet und ist zunaechst NICHT wirksam.
       effective_at setzt erst der stripe-webhook, wenn wirklich bezahlt wurde --
       sonst entstehen Zustimmungen ohne Kauf (so geschehen am 11.09.). */
    const { error: consentErr } = await supabase.from('withdrawal_consents').insert({
      user_id: userId,
      consent_text: WITHDRAWAL_CONSENT_TEXT,
      platform,
      stripe_checkout_session_id: session.id
    })
    if (consentErr) {
      console.error('withdrawal_consents insert error:', consentErr.message)
      try { await supabase.rpc('log_error', { function_name: 'create-checkout-session', error_message: 'Consent-Insert: ' + consentErr.message }) } catch (_) {}
    }

    return json({ url: session.url, session_id: session.id, platform, mode })
  } catch (err: any) {
    console.error('create-checkout-session error:', err.message)
    try { await supabase.rpc('log_error', { function_name: 'create-checkout-session', error_message: err.message }) } catch (_) {}
    return json({ error: 'server_error', message: 'Der Bezahlvorgang konnte nicht gestartet werden. Bitte versuche es gleich noch einmal.' }, 500)
  }
})
