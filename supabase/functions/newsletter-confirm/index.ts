import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * Der zweite Schritt des Double Opt-in: der Link aus der Bestaetigungsmail.
 * Haelt Zeitpunkt, IP und Browserkennung fest - das ist der Nachweis, dass
 * die Anmeldung von dieser Adresse ausging.
 */

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

function weiter(status: 'ok' | 'schon' | 'ungueltig' | 'fehler'): Response {
  return new Response(null, {
    status: 302,
    headers: { 'Location': `https://viuno.de/news-bestaetigt?status=${status}` },
  })
}

Deno.serve(async (req) => {
  try {
    const token = new URL(req.url).searchParams.get('token') || ''
    // Ein nicht wohlgeformter Token trifft nie eine Zeile - gar nicht erst fragen.
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) return weiter('ungueltig')

    const { data: zeile, error } = await supabase
      .from('newsletter_subscribers')
      .select('id, status')
      .eq('token', token)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!zeile) return weiter('ungueltig')
    if (zeile.status === 'active') return weiter('schon')

    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || null
    const browser = (req.headers.get('user-agent') || '').slice(0, 300) || null

    const { error: schreibFehler } = await supabase
      .from('newsletter_subscribers')
      .update({
        status: 'active',
        confirmed_at: new Date().toISOString(),
        confirm_ip: ip,
        confirm_user_agent: browser,
        unsubscribed_at: null,
      })
      .eq('id', zeile.id)
    if (schreibFehler) throw new Error(schreibFehler.message)

    return weiter('ok')
  } catch (err: any) {
    console.error('newsletter-confirm:', err.message)
    try { await supabase.rpc('log_error', { function_name: 'newsletter-confirm', error_message: err.message }) } catch (_) {}
    return weiter('fehler')
  }
})
