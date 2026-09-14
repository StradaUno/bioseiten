import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * Abmeldung ueber den Link im Mailfuss.
 *
 * Nutzt denselben Token wie die Bestaetigung. Vorher war der Token ein HMAC
 * ueber die user_id - damit konnten sich Abonnenten ohne Konto ueberhaupt
 * nicht abmelden. Verschickt wurde bis heute keine Mail, es sind also keine
 * alten Links im Umlauf.
 */

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

function weiter(status: 'ok' | 'invalid' | 'error'): Response {
  return new Response(null, {
    status: 302,
    headers: { 'Location': `https://viuno.de/digest-unsubscribed?status=${status}` },
  })
}

Deno.serve(async (req) => {
  try {
    const token = new URL(req.url).searchParams.get('token') || ''
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) return weiter('invalid')

    const { data: zeile, error } = await supabase
      .from('newsletter_subscribers')
      .select('id, status')
      .eq('token', token)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!zeile) return weiter('invalid')

    // Schon abgemeldet ist kein Fehler - der Link darf mehrfach geklickt werden.
    if (zeile.status !== 'unsubscribed') {
      const { error: schreibFehler } = await supabase
        .from('newsletter_subscribers')
        .update({ status: 'unsubscribed', unsubscribed_at: new Date().toISOString() })
        .eq('id', zeile.id)
      if (schreibFehler) throw new Error(schreibFehler.message)
    }

    return weiter('ok')
  } catch (err: any) {
    console.error('digest-unsubscribe:', err.message)
    try { await supabase.rpc('log_error', { function_name: 'digest-unsubscribe', error_message: err.message }) } catch (_) {}
    return weiter('error')
  }
})
