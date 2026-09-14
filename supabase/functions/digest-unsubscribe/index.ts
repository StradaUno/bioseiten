import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
const SECRET = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

async function computeToken(userId: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(userId))
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function redirect(status: 'ok' | 'invalid' | 'error'): Response {
  return new Response(null, {
    status: 302,
    headers: { 'Location': `https://viuno.de/digest-unsubscribed?status=${status}` }
  })
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url)
    const uid = url.searchParams.get('uid') || ''
    const token = url.searchParams.get('token') || ''
    if (!uid || !token) return redirect('invalid')

    const expected = await computeToken(uid)
    if (expected !== token) return redirect('invalid')

    const { error } = await supabase.from('users').update({ newsletter_subscribed: false }).eq('id', uid)
    if (error) throw new Error(error.message)

    // Zweite Liste mitziehen. Bisher schrieb nur das Profil beide Stellen,
    // dieser Link und die News-Seite nur users - wer sich hier abmeldete,
    // stand in newsletter_subscribers weiter als "active".
    const { error: listenFehler } = await supabase
      .from('newsletter_subscribers')
      .update({ status: 'unsubscribed', unsubscribed_at: new Date().toISOString() })
      .eq('user_id', uid)
    if (listenFehler) {
      try { await supabase.rpc('log_error', { function_name: 'digest-unsubscribe', error_message: 'Abmeldung gesetzt, newsletter_subscribers nicht nachgezogen: ' + listenFehler.message, user_id: uid }) } catch (_) {}
    }

    return redirect('ok')
  } catch (err: any) {
    console.error('digest-unsubscribe error:', err.message)
    try { await supabase.rpc('log_error', { function_name: 'digest-unsubscribe', error_message: err.message }) } catch (_) {}
    return redirect('error')
  }
})
