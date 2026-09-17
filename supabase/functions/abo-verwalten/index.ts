import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@17.7.0?target=denonext'

/* abo-verwalten — Stand, Kuendigung und Ruecknahme der Kuendigung.
 *
 * Gekuendigt wird zum Ende der laufenden Periode (cancel_at_period_end):
 * bezahlt ist bezahlt, der Monat laeuft aus, dann endet das Abo. Bis dahin
 * kann die Kuendigung zurueckgenommen werden. Den endgueltigen Stand
 * schreibt der Stripe-Webhook (customer.subscription.updated/deleted);
 * hier wird nur vorgemerkt, damit die App sofort etwas zeigt. */

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { headers: { ...cors, 'Content-Type': 'application/json' }, status: s })

function stripeFor(mode: string): Stripe {
  const key = mode === 'test' ? (Deno.env.get('STRIPE_SECRET_KEY_TEST') || '') : (Deno.env.get('STRIPE_SECRET_KEY') || '')
  if (!key) throw new Error(`Kein Stripe-Key fuer Modus "${mode}" hinterlegt`)
  return new Stripe(key)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const authHeader = req.headers.get('Authorization') || ''
    if (!authHeader.startsWith('Bearer ')) return json({ success: false, error: 'Nicht angemeldet' }, 401)
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.slice(7))
    if (authError || !user) return json({ success: false, error: 'Sitzung abgelaufen' }, 401)

    const body = await req.json().catch(() => ({}))
    const aktion = String(body.aktion || 'status')

    const { data: abo } = await supabase.from('subscriptions').select('*')
      .eq('user_id', user.id).eq('plan', 'abo').order('updated_at', { ascending: false }).limit(1).maybeSingle()

    if (aktion === 'status') return json({ success: true, abo: abo ?? null })
    if (aktion !== 'kuendigen' && aktion !== 'zurueck') return json({ success: false, error: 'unbekannte Aktion' }, 400)
    if (!abo || !abo.payment_ref) return json({ success: false, error: 'Kein Abo vorhanden' }, 400)

    const stripe = stripeFor(abo.stripe_mode || 'live')
    const sub: any = await stripe.subscriptions.update(abo.payment_ref, { cancel_at_period_end: aktion === 'kuendigen' })
    const ende = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : abo.expires_at

    const { data: neu, error } = await supabase.from('subscriptions').update({
      kuendigung_zum: aktion === 'kuendigen' ? ende : null,
      status: sub.status, expires_at: ende, updated_at: new Date().toISOString(),
    }).eq('id', abo.id).select('*').single()
    if (error) throw error

    return json({ success: true, abo: neu })
  } catch (err: any) {
    console.error('abo-verwalten:', err.message)
    try { await supabase.rpc('log_error', { function_name: 'abo-verwalten', error_message: err.message }) } catch (_) {}
    return json({ success: false, error: 'Hat gerade nicht geklappt' }, 400)
  }
})
