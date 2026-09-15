/* Admin — die schreibende Seite.
 *
 * Gelesen wird nicht mehr hier. Die Oberflaeche ruft direkt die RPC
 * admin_uebersicht() auf: die rechnet in Postgres statt 10.000 Zeilen
 * biolink_aufrufe nach Deno zu ziehen und dort in einer Schleife zu
 * gruppieren, wie es die Vorgaengerversion getan hat.
 *
 * Hier bleiben nur die Aktionen, die den Service Role brauchen --
 * Analysen freischalten, Admin-Rechte setzen.
 * Was die RLS dem Admin ohnehin erlaubt (kosten_guthaben schreiben,
 * admin_errors erledigen), macht die Oberflaeche direkt.
 *
 * Auth: immer supabase.auth.getUser(token). Niemals das JWT von Hand
 * zerlegen -- siehe CLAUDE.md.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const PROJEKT = Deno.env.get('SUPABASE_URL')!
const admin = createClient(PROJEKT, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { headers: { ...cors, 'Content-Type': 'application/json' }, status })

/* Ruft eine andere Edge Function mit dem Service-Role-Key auf. */
async function ruf(slug: string, body: unknown) {
  const res = await fetch(`${PROJEKT}/functions/v1/${slug}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  let daten: any = null
  try { daten = JSON.parse(text) } catch { daten = { roh: text.slice(0, 400) } }
  return { ok: res.ok, status: res.status, daten }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const kopf = req.headers.get('Authorization') || ''
    if (!kopf) return json({ error: 'kein_token' }, 401)
    const token = kopf.startsWith('Bearer ') ? kopf.slice(7) : kopf

    const { data: { user }, error: authFehler } = await admin.auth.getUser(token)
    if (authFehler || !user) return json({ error: 'invalid_token' }, 403)

    const { data: ich } = await admin.from('users').select('is_admin').eq('id', user.id).maybeSingle()
    if (!ich?.is_admin) return json({ error: 'kein_admin' }, 403)

    const url = new URL(req.url)
    const koerper = await req.json().catch(() => ({}))
    const aktion = url.searchParams.get('action') || koerper.aktion || ''
    const id = url.searchParams.get('id') || koerper.id || ''

    switch (aktion) {

      /* Kontaktformular-Eintrag verstecken (weich, bleibt in der DB). */
      case 'kontakt_loeschen': {
        if (!id) return json({ error: 'id_fehlt' }, 400)
        const { error } = await admin.from('contact_submissions')
          .update({ status: 'deleted', deleted_at: new Date().toISOString() }).eq('id', id)
        if (error) throw error
        return json({ ok: true })
      }

      /* Fehler einer Function gesammelt erledigen. */
      case 'fehler_erledigt': {
        const name = koerper.function_name
        const q = admin.from('admin_errors')
          .update({ resolved: true, resolved_at: new Date().toISOString() })
        const { error } = name ? await q.eq('function_name', name).eq('resolved', false)
                               : await q.eq('id', id)
        if (error) throw error
        return json({ ok: true })
      }

      /* 'seite_neu' und 'datenauskunft' gab es hier und sind wieder raus:
         generate-biolink, generate-mediakit und datenauskunft leiten den
         Creator aus dem JWT ab und ignorieren eine uebergebene user_id. Mit
         dem Service-Role-Key aufgerufen scheitert dort getUser() -- beide
         Aktionen konnten nie funktionieren. Aufgefallen ist es nicht, weil
         die Antwort { ok: false } mit HTTP 200 und ohne error-Feld kam: die
         Oberflaeche warf nicht und meldete "Auskunft ist raus.". Wer die
         Aktionen zurueckwill, muss den drei Functions zuerst einen Admin-Pfad
         geben -- Service-Role-Key plus user_id im Body, sauber abgegrenzt. */

      /* Analyse ohne Zahlung freischalten. amount_paid 0 -- die Zeile zaehlt
         damit nicht in den Umsatz, taucht aber in der Kaufliste auf und ist
         dort an der Session-Kennung als Freischaltung erkennbar. */
      case 'analyse_freischalten': {
        const platform = koerper.platform === 'tiktok' ? 'tiktok' : 'instagram'
        if (!id) return json({ error: 'id_fehlt' }, 400)
        const { error } = await admin.from('analysis_purchases').insert({
          user_id: id, platform, amount_paid: 0, currency: 'eur',
          stripe_checkout_session_id: 'admin_freischaltung_' + Date.now(),
        })
        if (error) throw error
        return json({ ok: true })
      }

      /* Admin-Recht setzen oder entziehen. Das eigene nie entziehen --
         sonst sperrt man sich mit einem Klick selbst aus. */
      case 'admin_setzen': {
        if (!id) return json({ error: 'id_fehlt' }, 400)
        if (id === user.id) return json({ error: 'nicht_bei_sich_selbst' }, 400)
        const { error } = await admin.from('users').update({ is_admin: koerper.wert === true }).eq('id', id)
        if (error) throw error
        return json({ ok: true })
      }

      /* Die Tagesmail sofort schicken, zum Ausprobieren. */
      case 'tagesmail': {
        const r = await ruf('admin-tagesmail', { test: true })
        return json({ ok: r.ok, antwort: r.daten })
      }

      default:
        return json({ error: 'unbekannte_aktion', aktion }, 400)
    }
  } catch (err: any) {
    console.error('admin-dashboard:', err?.message || err)
    try { await admin.rpc('log_error', { function_name: 'admin-dashboard', error_message: String(err?.message || err) }) } catch (_) { /* egal */ }
    return json({ error: String(err?.message || err) }, 500)
  }
})
