import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// Version fest gepinnt: "stripe@17" loest inzwischen auf 17.7.0 auf, das die frueher
// gesetzte apiVersion '2024-11-20' ablehnt. Ohne Pin bricht jedes neue Deployment,
// sobald esm.sh eine andere 17.x ausliefert. apiVersion bewusst nicht gesetzt.
import Stripe from 'https://esm.sh/stripe@17.7.0?target=denonext'

/* Repo-Kopie seit dem Launch-Check (15.09.2026). Deployed wird aus dem Dashboard:
   nach einer Aenderung hier deployen, nach einer Aenderung dort zurueckkopieren. */

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

// Wird fuer die Signatur-Pruefung in Deno benoetigt (Web Crypto statt Node crypto).
const cryptoProvider = Stripe.createSubtleCryptoProvider()

/* Waehrend der Umstellung koennen Events aus BEIDEN Welten eintreffen: Test-Sessions
   aus dem neuen Flow und Live-Kaeufe ueber den noch aktiven alten Payment Link.
   Deshalb wird gegen jedes hinterlegte Signing Secret geprueft und der Modus danach
   aus event.livemode abgeleitet -- nicht aus VIUNO_STRIPE_MODE. */
const SIGNING_SECRETS: Array<{ mode: string; secret: string }> = [
  { mode: 'test', secret: Deno.env.get('STRIPE_WEBHOOK_SIGNING_SECRET_TEST') || '' },
  { mode: 'live', secret: Deno.env.get('STRIPE_WEBHOOK_SIGNING_SECRET') || '' }
].filter(s => s.secret.length > 0)

/* Was eine Freischaltung kostet -- der Webhook prueft den bezahlten Betrag dagegen.
   Vorher wurde jede bezahlte Session als Freischaltung verbucht, egal welcher Betrag
   und welches Produkt dahinterstand (Launch-Check 15.09.2026). */
const ERWARTETER_BETRAG = 999
const ERWARTETE_WAEHRUNG = 'eur'

// Vertragsbestaetigung in Textform (§ 356 Abs. 5 Nr. 3 BGB). Nicht fatal: eine
// gescheiterte Mail darf den Kauf nicht kippen, landet aber in admin_errors.
async function sendPurchaseConfirmation(sessionId: string): Promise<void> {
  try {
    const res = await fetch('https://bzejndghppuipnedasuv.supabase.co/functions/v1/send-purchase-confirmation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '')
      },
      body: JSON.stringify({ stripe_checkout_session_id: sessionId })
    })
    if (!res.ok) {
      const t = await res.text()
      console.error('send-purchase-confirmation fehlgeschlagen:', res.status, t)
      try { await supabase.rpc('log_error', { function_name: 'stripe-webhook', error_message: `Kaufbestaetigung fehlgeschlagen fuer Session ${sessionId}: ${t}` }) } catch (_) {}
    }
  } catch (e: any) {
    console.error('sendPurchaseConfirmation exception:', e.message)
    try { await supabase.rpc('log_error', { function_name: 'stripe-webhook', error_message: `Kaufbestaetigung Exception ${sessionId}: ${e.message}` }) } catch (_) {}
  }
}

function stripeFor(mode: string): Stripe {
  const key = mode === 'test' ? (Deno.env.get('STRIPE_SECRET_KEY_TEST') || '') : (Deno.env.get('STRIPE_SECRET_KEY') || '')
  if (!key) throw new Error(`Kein Stripe-Key fuer Modus "${mode}" hinterlegt`)
  return new Stripe(key)
}

/* ── Abo (seit 17.09.2026) ─────────────────────────────────────────────────
   Zustand in subscriptions (plan 'abo', payment_ref = Stripe-Subscription-ID).
   checkout.session.completed (mode subscription) legt die Zeile an,
   invoice.paid verlaengert, customer.subscription.updated traegt Kuendigung
   und Status nach, customer.subscription.deleted beendet. */
function istAboEreignis(event: Stripe.Event): boolean {
  const t = event.type
  if (t.startsWith('customer.subscription.') || t.startsWith('invoice.')) return true
  if (t === 'checkout.session.completed') return (event.data.object as any).mode === 'subscription'
  return false
}
/* Solange stripe_prices keine live/abo-Zeile traegt, laeuft das Abo im Test
   ("Test jetzt, Live spaeter") -- dann duerfen Test-Abo-Ereignisse auch im
   Live-Betrieb verbucht werden. */
async function aboImTest(): Promise<boolean> {
  const { data } = await supabase.from('stripe_prices').select('price_id').eq('mode', 'live').eq('platform', 'abo').maybeSingle()
  return !data?.price_id
}
const iso = (sek: number | null | undefined) => sek ? new Date(sek * 1000).toISOString() : null

async function aboAnlegen(session: Stripe.Checkout.Session, mode: string): Promise<void> {
  const userId = session.metadata?.user_id || session.client_reference_id
  const subId = typeof session.subscription === 'string' ? session.subscription : (session.subscription as any)?.id
  if (!userId || !subId) { await melden(`Abo-Session ${session.id} ohne user_id oder subscription`); return }
  let periodeEnde: string | null = null, status = 'active', kuendigung: string | null = null
  try {
    const sub: any = await stripeFor(mode).subscriptions.retrieve(subId)
    periodeEnde = iso(sub.current_period_end); status = sub.status
    kuendigung = sub.cancel_at_period_end ? periodeEnde : null
  } catch (e: any) { console.warn('Abo nachladen fehlgeschlagen:', e.message) }
  const jetzt = new Date().toISOString()
  const zeile = {
    user_id: userId, plan: 'abo', is_active: true, payment_ref: subId,
    stripe_customer_id: typeof session.customer === 'string' ? session.customer : null,
    stripe_mode: mode, status, expires_at: periodeEnde, kuendigung_zum: kuendigung, updated_at: jetzt,
  }
  const { data: vorhanden } = await supabase.from('subscriptions').select('id').eq('user_id', userId).eq('plan', 'abo').maybeSingle()
  const { error } = vorhanden
    ? await supabase.from('subscriptions').update(zeile).eq('id', vorhanden.id)
    : await supabase.from('subscriptions').insert({ ...zeile, started_at: jetzt })
  if (error) { await melden('subscriptions (abo) schreiben: ' + error.message); return }
  console.log(`Abo ${subId} fuer User ${userId} aktiv (${mode})`)
  await supabase.from('withdrawal_consents').update({ effective_at: jetzt })
    .eq('stripe_checkout_session_id', session.id).is('effective_at', null)
}

async function aboStand(sub: any, mode: string, typ: string): Promise<void> {
  const periodeEnde = iso(sub.current_period_end)
  const beendet = typ === 'customer.subscription.deleted'
  const patch = {
    status: beendet ? 'canceled' : sub.status,
    expires_at: beendet ? new Date().toISOString() : periodeEnde,
    kuendigung_zum: beendet ? null : (sub.cancel_at_period_end ? periodeEnde : iso(sub.cancel_at)),
    is_active: !beendet && ['active', 'trialing', 'past_due'].includes(sub.status),
    stripe_mode: mode, updated_at: new Date().toISOString(),
  }
  const { data, error } = await supabase.from('subscriptions').update(patch).eq('payment_ref', sub.id).select('id')
  if (error) { await melden('subscriptions (abo) Stand: ' + error.message); return }
  if (!data?.length && sub.metadata?.user_id && !beendet) {
    await supabase.from('subscriptions').insert({ user_id: sub.metadata.user_id, plan: 'abo', payment_ref: sub.id, started_at: new Date().toISOString(), ...patch })
  }
}

async function aboRechnung(invoice: any, mode: string, typ: string): Promise<void> {
  const subId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id
  if (!subId) return
  if (typ === 'invoice.paid') {
    const ende = invoice.lines?.data?.[0]?.period?.end
    const patch: Record<string, unknown> = { is_active: true, status: 'active', stripe_mode: mode, updated_at: new Date().toISOString() }
    if (ende) patch.expires_at = iso(ende)
    const { error } = await supabase.from('subscriptions').update(patch).eq('payment_ref', subId)
    if (error) await melden('subscriptions (abo) Rechnung: ' + error.message)
  } else {
    await supabase.from('subscriptions').update({ status: 'past_due', updated_at: new Date().toISOString() }).eq('payment_ref', subId)
    await melden(`Abo-Zahlung fehlgeschlagen: ${subId} (${mode}) -- Stripe versucht es erneut, Konto bleibt bis expires_at aktiv`)
  }
}

async function melden(text: string) {
  try { await supabase.rpc('log_error', { function_name: 'stripe-webhook', error_message: text }) } catch (_) {}
}

/* Verbucht eine bezahlte Checkout-Session als Freischaltung. Wird fuer
   checkout.session.completed (Karte: sofort bezahlt) UND fuer
   checkout.session.async_payment_succeeded (SEPA, Klarna, Sofort: erst spaeter
   bezahlt) aufgerufen -- vorher kam bei verzoegerten Zahlarten nie eine
   Freischaltung an, weil completed mit payment_status 'unpaid' ignoriert wurde
   und das spaetere Ereignis nicht abonniert war. */
async function freischalten(session: Stripe.Checkout.Session, mode: string): Promise<void> {
  const userId = session.metadata?.user_id || session.client_reference_id

  /* platform kommt aus den Metadata des neuen Flows. Der alte Payment Link ist
     seit dem 15.09.2026 deaktiviert; Sessions ohne platform gibt es damit nur
     noch aus Altbestand -- sie werden weiterhin als Instagram gewertet. */
  let platform = String(session.metadata?.platform || '').toLowerCase()
  if (platform !== 'instagram' && platform !== 'tiktok') {
    platform = 'instagram'
    console.warn(`Session ${session.id} ohne platform-Metadata -- als instagram verbucht`)
    await melden(`Session ${session.id} ohne platform-Metadata -- als instagram verbucht`)
  }

  if (!userId) {
    console.error(`Checkout Session ${session.id} hat weder metadata.user_id noch client_reference_id`)
    await melden(`checkout.session ohne user_id: session ${session.id}`)
    return
  }

  /* Betrag und Waehrung muessen zur Bestellung passen. Weicht etwas ab, wird
     NICHT freigeschaltet, sondern gemeldet -- lieber ein Kauf von Hand geprueft
     als eine Freischaltung fuer einen Cent. */
  const betrag = session.amount_total ?? 0
  const waehrung = String(session.currency || '').toLowerCase()
  if (betrag !== ERWARTETER_BETRAG || waehrung !== ERWARTETE_WAEHRUNG) {
    await melden(`Session ${session.id} (${mode}): Betrag ${betrag} ${waehrung} passt nicht zu ${ERWARTETER_BETRAG} ${ERWARTETE_WAEHRUNG} -- NICHT freigeschaltet, bitte pruefen`)
    return
  }

  const { error: insertErr } = await supabase.from('analysis_purchases').insert({
    user_id: userId,
    platform,
    stripe_checkout_session_id: session.id,
    stripe_payment_intent_id: typeof session.payment_intent === 'string' ? session.payment_intent : null,
    amount_paid: betrag,
    currency: waehrung
  })
  if (insertErr) {
    // Unique-Constraint-Verletzung (gleiche Session nochmal) ist unproblematisch, alles andere loggen.
    if (!insertErr.message.includes('duplicate key')) {
      console.error('analysis_purchases insert error:', insertErr.message)
      await melden(insertErr.message)
    }
  } else {
    console.log(`Freischaltung ${platform} gespeichert fuer User ${userId}, Session ${session.id} (${mode})`)
    // Erst nach erfolgreichem Insert -- die Mail bestaetigt einen existierenden Kauf.
    await sendPurchaseConfirmation(session.id)
  }

  /* Die Widerrufs-Zustimmung wird erst jetzt wirksam -- vorher war sie nur
     protokolliert. Eine Zustimmung ohne Zahlung bleibt damit erkennbar
     (effective_at IS NULL). */
  const { error: consentErr } = await supabase
    .from('withdrawal_consents')
    .update({ effective_at: new Date().toISOString() })
    .eq('stripe_checkout_session_id', session.id)
    .is('effective_at', null)
  if (consentErr) console.error('withdrawal_consents update error:', consentErr.message)
}

Deno.serve(async (req) => {
  const signature = req.headers.get('stripe-signature')
  if (!signature) return new Response('Missing stripe-signature header', { status: 400 })
  if (SIGNING_SECRETS.length === 0) {
    console.error('Kein STRIPE_WEBHOOK_SIGNING_SECRET(_TEST) als Supabase-Secret hinterlegt')
    return new Response('Server nicht konfiguriert', { status: 500 })
  }

  // Rohtext wird gebraucht -- NICHT als JSON parsen, sonst schlaegt die Signatur-Pruefung fehl.
  const body = await req.text()

  let event: Stripe.Event | null = null
  let letzterFehler = ''
  for (const { secret } of SIGNING_SECRETS) {
    try {
      const tmp = new Stripe('sk_placeholder')
      event = await tmp.webhooks.constructEventAsync(body, signature, secret, undefined, cryptoProvider)
      break
    } catch (err: any) { letzterFehler = err.message }
  }
  if (!event) {
    console.error('Signatur-Pruefung fehlgeschlagen gegen alle hinterlegten Secrets:', letzterFehler)
    return new Response('Ungueltige Signatur: ' + letzterFehler, { status: 400 })
  }

  const mode = event.livemode ? 'live' : 'test'

  /* Sobald VIUNO_STRIPE_MODE auf live steht, darf ein Test-Event keine echte
     Freischaltung mehr erzeugen -- auch nicht mit gueltiger Test-Signatur.
     Das Event wird bestaetigt (200), aber nicht verbucht. */
  const betriebsmodus = (Deno.env.get('VIUNO_STRIPE_MODE') || 'live').toLowerCase()
  if (betriebsmodus === 'live' && mode === 'test' && !(istAboEreignis(event) && await aboImTest())) {
    console.warn(`Test-Event ${event.id} im Live-Betrieb ignoriert`)
    return new Response(JSON.stringify({ received: true, skipped: 'test_event_in_live_mode' }), { status: 200 })
  }

  try {
    // Idempotenz: dieses Event schon verarbeitet? (Stripe kann Events mehrfach zustellen)
    const { data: already } = await supabase
      .from('stripe_webhook_events')
      .select('id')
      .eq('stripe_event_id', event.id)
      .maybeSingle()
    if (already) {
      return new Response(JSON.stringify({ received: true, skipped: 'already_processed' }), { status: 200 })
    }

    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      const session = event.data.object as Stripe.Checkout.Session
      if (session.mode === 'subscription') {
        await aboAnlegen(session, mode)
      } else if (session.payment_status !== 'paid') {
        // Verzoegerte Zahlart: das Geld kommt spaeter, dann meldet sich async_payment_succeeded.
        console.log(`Session ${session.id} noch nicht bezahlt (status: ${session.payment_status}) -- warte auf async_payment_succeeded`)
      } else {
        await freischalten(session, mode)
      }
    } else if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      await aboStand(event.data.object, mode, event.type)
    } else if (event.type === 'invoice.paid' || event.type === 'invoice.payment_failed') {
      await aboRechnung(event.data.object, mode, event.type)
    } else if (event.type === 'checkout.session.async_payment_failed') {
      const session = event.data.object as Stripe.Checkout.Session
      await melden(`Verzoegerte Zahlung fehlgeschlagen: Session ${session.id} (${mode}) -- keine Freischaltung, Kunde ggf. anschreiben`)
    }

    // Event als verarbeitet markieren, unabhaengig vom Typ -- verhindert erneute Verarbeitung bei Retry.
    await supabase.from('stripe_webhook_events').insert({
      stripe_event_id: event.id,
      event_type: event.type
    })

    return new Response(JSON.stringify({ received: true, mode }), { status: 200 })
  } catch (err: any) {
    console.error('stripe-webhook processing error:', err.message)
    await melden(err.message)
    // 500 zurueckgeben, damit Stripe es spaeter erneut zustellt
    return new Response('Interner Fehler', { status: 500 })
  }
})
