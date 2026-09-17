import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// Version fest gepinnt: "stripe@17" loeste zwischenzeitlich auf 17.7.0 auf, das die
// frueher gesetzte apiVersion '2024-11-20' ablehnt. Ohne Pin bricht jedes neue
// Deployment, sobald esm.sh eine andere 17.x ausliefert. apiVersion bewusst nicht
// gesetzt -- das SDK nutzt dann seine eigene, dazu passende Default-Version.
import Stripe from 'https://esm.sh/stripe@17.7.0?target=denonext'

/* Repo-Kopie seit 17.09.2026. Legt Stripe-Produkte und -Preise an und traegt
   sie in stripe_prices ein. Zwei Produkte:
   - "viuno Analyse", 9,99 EUR einmalig, je Plattform (Altbestand, der
     Einmalkauf wird in der App nicht mehr angeboten)
   - "viuno Abo", 4,99 EUR im Monat (body {"produkt":"abo","mode":"test"|"live"}).
   Aufruf mit x-setup-token aus setup_tokens. */

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

const LIVE_PRODUCT_ID = 'prod_VEUNSFSahcHv1b'
const AMOUNT = 999
const CURRENCY = 'eur'
const PRODUCT_NAME = 'viuno Analyse'
const PRODUCT_DESCRIPTION =
  'Einmalige Analyse eines Kanals mit konkreten Handlungsempfehlungen, direkt in deinem viuno-Account. Gemäß § 19 UStG keine Umsatzsteuer.'

const ABO_AMOUNT = 499
const ABO_NAME = 'viuno Abo'
const ABO_DESCRIPTION =
  'Jede Woche eine Analyse deines Kanals (sonntags, automatisch), aktuelle Zahlen im Media Kit und der Brand-Ready-Check. Monatlich kündbar. Gemäß § 19 UStG keine Umsatzsteuer.'

const PLATFORM_LABEL: Record<string, string> = { instagram: 'Instagram', tiktok: 'TikTok' }

function stripeFor(mode: string): Stripe {
  const key = mode === 'test'
    ? (Deno.env.get('STRIPE_SECRET_KEY_TEST') || '')
    : (Deno.env.get('STRIPE_SECRET_KEY') || '')
  if (!key) throw new Error(`Kein Stripe-Key fuer Modus "${mode}" hinterlegt`)
  if (mode === 'test' && !key.startsWith('sk_test_')) throw new Error('STRIPE_SECRET_KEY_TEST ist kein Test-Key')
  if (mode === 'live' && !key.startsWith('sk_live_')) throw new Error('STRIPE_SECRET_KEY ist kein Live-Key')
  return new Stripe(key)
}

async function ensureProduct(stripe: Stripe, mode: string): Promise<string> {
  if (mode === 'live') return LIVE_PRODUCT_ID
  const found = await stripe.products.search({ query: `name:"${PRODUCT_NAME}" AND active:"true"`, limit: 1 })
  if (found.data.length > 0) return found.data[0].id
  const created = await stripe.products.create({ name: PRODUCT_NAME, description: PRODUCT_DESCRIPTION, tax_code: 'txcd_20030000' })
  return created.id
}

/* Das Abo-Produkt gibt es in beiden Welten nur per Namenssuche -- eine feste
   Live-ID wie beim Analyse-Produkt entsteht erst, wenn es dort angelegt ist. */
async function ensureAboProduct(stripe: Stripe): Promise<string> {
  const found = await stripe.products.search({ query: `name:"${ABO_NAME}" AND active:"true"`, limit: 1 })
  if (found.data.length > 0) return found.data[0].id
  const created = await stripe.products.create({ name: ABO_NAME, description: ABO_DESCRIPTION, tax_code: 'txcd_20030000' })
  return created.id
}

Deno.serve(async (req) => {
  try {
    const token = req.headers.get('x-setup-token') || ''
    if (!token) return new Response('x-setup-token fehlt', { status: 401 })

    const { data: row } = await supabase
      .from('setup_tokens').select('token, used_at').eq('token', token).maybeSingle()
    if (!row) return new Response('Token unbekannt', { status: 403 })

    const body = await req.json().catch(() => ({}))
    const envMode = (Deno.env.get('VIUNO_STRIPE_MODE') || 'live').toLowerCase()
    const mode = String(body.mode || envMode).toLowerCase()
    if (mode !== 'test' && mode !== 'live') throw new Error(`Modus ist "${mode}", erwartet test oder live`)

    const stripe = stripeFor(mode)

    if (body.produkt === 'abo') {
      const productId = await ensureAboProduct(stripe)
      const { data: vorhanden } = await supabase
        .from('stripe_prices').select('price_id').eq('mode', mode).eq('platform', 'abo').maybeSingle()
      if (vorhanden?.price_id) {
        try {
          const p = await stripe.prices.retrieve(vorhanden.price_id)
          if (p.active && p.unit_amount === ABO_AMOUNT && p.recurring?.interval === 'month') {
            await supabase.from('setup_tokens').update({ used_at: new Date().toISOString() }).eq('token', token)
            return new Response(JSON.stringify({ mode, product_id: productId, abo: { price_id: p.id, status: 'unveraendert' } }, null, 2), { headers: { 'Content-Type': 'application/json' } })
          }
        } catch (_) { /* Preis existiert nicht mehr -> neu anlegen */ }
      }
      const price = await stripe.prices.create({
        product: productId, unit_amount: ABO_AMOUNT, currency: CURRENCY,
        recurring: { interval: 'month' }, nickname: 'viuno Abo – monatlich', metadata: { platform: 'abo' }
      })
      const { error: upErr } = await supabase.from('stripe_prices').upsert({
        mode, platform: 'abo', product_id: productId, price_id: price.id,
        amount: ABO_AMOUNT, currency: CURRENCY, updated_at: new Date().toISOString()
      }, { onConflict: 'mode,platform' })
      if (upErr) throw new Error('stripe_prices upsert: ' + upErr.message)
      await supabase.from('setup_tokens').update({ used_at: new Date().toISOString() }).eq('token', token)
      return new Response(JSON.stringify({ mode, product_id: productId, abo: { price_id: price.id, status: 'neu angelegt' } }, null, 2), { headers: { 'Content-Type': 'application/json' } })
    }

    const productId = await ensureProduct(stripe, mode)
    const ergebnis: Record<string, unknown> = {}
    for (const platform of ['instagram', 'tiktok']) {
      const { data: vorhanden } = await supabase
        .from('stripe_prices').select('price_id').eq('mode', mode).eq('platform', platform).maybeSingle()
      if (vorhanden?.price_id) {
        try {
          const p = await stripe.prices.retrieve(vorhanden.price_id)
          if (p.active && p.unit_amount === AMOUNT) {
            ergebnis[platform] = { price_id: p.id, product_id: productId, status: 'unveraendert' }
            continue
          }
        } catch (_) { /* Preis existiert nicht mehr -> neu anlegen */ }
      }
      const price = await stripe.prices.create({
        product: productId, unit_amount: AMOUNT, currency: CURRENCY,
        nickname: `viuno Analyse – ${PLATFORM_LABEL[platform]}`, metadata: { platform }
      })
      const { error: upErr } = await supabase.from('stripe_prices').upsert({
        mode, platform, product_id: productId, price_id: price.id,
        amount: AMOUNT, currency: CURRENCY, updated_at: new Date().toISOString()
      }, { onConflict: 'mode,platform' })
      if (upErr) throw new Error('stripe_prices upsert: ' + upErr.message)
      ergebnis[platform] = { price_id: price.id, product_id: productId, status: 'neu angelegt' }
    }

    await supabase.from('setup_tokens').update({ used_at: new Date().toISOString() }).eq('token', token)
    return new Response(JSON.stringify({ mode, product_id: productId, preise: ergebnis }, null, 2), { headers: { 'Content-Type': 'application/json' } })
  } catch (err: any) {
    console.error('viuno-stripe-setup error:', err.message)
    return new Response(JSON.stringify({ error: err.message }, null, 2), { status: 400, headers: { 'Content-Type': 'application/json' } })
  }
})
