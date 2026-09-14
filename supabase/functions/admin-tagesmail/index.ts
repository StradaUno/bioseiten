/* Die Tagesmail: was gestern passiert ist, an alle Admin-Konten.
 *
 * Sie wird NICHT verschickt, wenn nichts passiert ist. Eine Mail, die jeden
 * Morgen "0 / 0 / 0" meldet, wird nach einer Woche nicht mehr gelesen -- und
 * dann faellt auch die eine nicht auf, in der etwas steht. Ausnahme: ein
 * knappes Guthaben und offene Fehler sind immer einen Versand wert, auch
 * wenn sonst nichts war.
 *
 * Laeuft als Service Role, deshalb kein is_admin() -- die Empfaenger werden
 * hier aus users gelesen. Fuer den Testversand aus dem Admin genuegt der
 * Aufruf ueber admin-dashboard, das die Rechte vorher prueft.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || ''
const FROM_EMAIL = 'noreply@viuno.de'
const FROM_NAME = 'viuno'
const KURS = 0.92            // 1 USD in EUR. Muss zu admin_uebersicht() passen.

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { headers: { ...cors, 'Content-Type': 'application/json' }, status: s })

const esc = (s: unknown) => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' } as any)[c])
const eur = (v: number) => (v || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
const zahl = (v: number) => (v || 0).toLocaleString('de-DE')

async function anzahl(tabelle: string, spalte: string, von: string, bis: string) {
  const { count } = await supabase.from(tabelle).select('*', { count: 'exact', head: true })
    .gte(spalte, von).lt(spalte, bis)
  return count || 0
}

/* Zwei gleichwertige Schloesser, weil es zwei Anrufer gibt:
   - admin-dashboard ruft mit dem Service-Role-Key im Header auf,
   - der Cron-Job kann das nicht (der Schluessel liegt weder im Vault noch
     sonst irgendwo, wo Postgres ihn lesen koennte) und nutzt deshalb den
     Token unten in der Adresse.
   Der Token steht nur hier und im Cron-Befehl -- der Quelltext einer Edge
   Function ist nicht oeffentlich, er ist damit ein echtes gemeinsames
   Geheimnis. Ohne eines von beiden passiert gar nichts: sonst koennte jeder,
   der die Adresse kennt, den Versand ausloesen. */
const CRON_TOKEN = 'BjE9Ade2ji68dzblTXD_AxSoFZ90AOrJ0dmpDF8H_-k'

function darfLaufen(req: Request): boolean {
  const kopf = req.headers.get('Authorization') || ''
  const schluessel = kopf.startsWith('Bearer ') ? kopf.slice(7) : kopf
  if (schluessel && schluessel === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) return true
  try { return new URL(req.url).searchParams.get('schluessel') === CRON_TOKEN } catch (_) { return false }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY fehlt')

    if (!darfLaufen(req)) return json({ error: 'nicht_erlaubt' }, 403)

    const koerper = await req.json().catch(() => ({} as any))
    const test = koerper?.test === true

    // Gestern, 00:00 bis heute 00:00 -- in Ortszeit gedacht, in UTC gerechnet.
    const heute = new Date(); heute.setUTCHours(0, 0, 0, 0)
    const gestern = new Date(heute.getTime() - 86_400_000)
    const von = gestern.toISOString(), bis = heute.toISOString()

    const [neueUser, neueNl, analysen, fehlerNeu, bioAufrufe, mkAufrufe] = await Promise.all([
      anzahl('users', 'created_at', von, bis),
      anzahl('newsletter_subscribers', 'subscribed_at', von, bis),
      anzahl('analysis_runs', 'started_at', von, bis),
      anzahl('admin_errors', 'created_at', von, bis),
      anzahl('biolink_aufrufe', 'viewed_at', von, bis),
      anzahl('mediakit_aufrufe', 'viewed_at', von, bis),
    ])

    const { count: landing } = await supabase.from('page_views').select('*', { count: 'exact', head: true })
      .like('page', 'landing%').gte('created_at', von).lt('created_at', bis)

    const { data: kaeufe } = await supabase.from('analysis_purchases')
      .select('amount_paid, platform').gte('purchased_at', von).lt('purchased_at', bis)
    const umsatz = (kaeufe || []).reduce((s, k) => s + (k.amount_paid || 0), 0) / 100

    const { count: offen } = await supabase.from('admin_errors')
      .select('*', { count: 'exact', head: true }).eq('resolved', false)

    const { data: kaputt } = await supabase.from('analysis_runs')
      .select('id').eq('status', 'failed').gte('started_at', von).lt('started_at', bis)

    // Guthaben: neueste Zeile je Anbieter, Verbrauch seit dem Stichtag dagegen.
    const stand: any[] = []
    for (const anbieter of ['anthropic', 'apify']) {
      const { data: g } = await supabase.from('kosten_guthaben')
        .select('betrag_usd, stand_am').eq('anbieter', anbieter)
        .order('stand_am', { ascending: false }).limit(1).maybeSingle()
      if (!g) { stand.push({ anbieter, fehlt: true }); continue }
      let verbrauchtUsd = 0
      if (anbieter === 'anthropic') {
        const { data } = await supabase.from('ai_usage_log').select('cost_usd').gte('created_at', g.stand_am)
        verbrauchtUsd = (data || []).reduce((s: number, r: any) => s + (+r.cost_usd || 0), 0)
      } else {
        const { data } = await supabase.from('analysis_runs').select('apify_kosten_usd').gte('apify_kosten_stand', g.stand_am)
        verbrauchtUsd = (data || []).reduce((s: number, r: any) => s + (+r.apify_kosten_usd || 0), 0)
      }
      const restUsd = Math.max(0, (+g.betrag_usd || 0) - verbrauchtUsd)
      const tageSeit = Math.max((Date.now() - new Date(g.stand_am).getTime()) / 86_400_000, 0.5)
      const proTag = verbrauchtUsd / tageSeit
      stand.push({
        anbieter, fehlt: false,
        restEur: restUsd * KURS,
        reicht: proTag > 0 ? Math.floor(restUsd / proTag) : null,
      })
    }
    const knapp = stand.filter(s => !s.fehlt && s.reicht != null && s.reicht <= 21)

    const etwasPassiert = umsatz > 0 || (kaeufe || []).length > 0 || neueUser > 0 || neueNl > 0 ||
      analysen > 0 || fehlerNeu > 0 || (kaputt || []).length > 0
    const wichtig = (offen || 0) > 0 || knapp.length > 0

    if (!test && !etwasPassiert && !wichtig) {
      return json({ ok: true, verschickt: false, grund: 'nichts_passiert' })
    }

    const { data: admins } = await supabase.from('users')
      .select('email, display_name').eq('is_admin', true).is('deleted_at', null)
    const empfaenger = (admins || []).map(a => a.email).filter(Boolean)
    if (!empfaenger.length) return json({ ok: false, grund: 'keine_admins' })

    const tag = gestern.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' })
    const zeile = (name: string, wert: string, hervor?: 'gut' | 'rot') =>
      `<tr><td style="padding:9px 0;border-bottom:1px solid #eceaf2;color:#4e4a5e;font-size:14px">${esc(name)}</td>
       <td style="padding:9px 0;border-bottom:1px solid #eceaf2;text-align:right;font-weight:700;font-size:15px;font-variant-numeric:tabular-nums;color:${
         hervor === 'rot' ? '#c23a31' : hervor === 'gut' ? '#15784b' : '#17151f'}">${esc(wert)}</td></tr>`

    const zeilen = [
      zeile('Umsatz', eur(umsatz), umsatz > 0 ? 'gut' : undefined),
      (kaeufe || []).length ? zeile('Kaeufe', zahl((kaeufe || []).length)) : '',
      neueUser ? zeile('Neue Konten', zahl(neueUser), 'gut') : '',
      neueNl ? zeile('Neue Newsletter-Anmeldungen', zahl(neueNl), 'gut') : '',
      analysen ? zeile('Analysen gestartet', zahl(analysen)) : '',
      (kaputt || []).length ? zeile('Analysen fehlgeschlagen', zahl((kaputt || []).length), 'rot') : '',
      bioAufrufe ? zeile('BioLink-Aufrufe', zahl(bioAufrufe)) : '',
      mkAufrufe ? zeile('Media-Kit-Aufrufe', zahl(mkAufrufe)) : '',
      landing ? zeile('Startseite', zahl(landing || 0)) : '',
      fehlerNeu ? zeile('Neue Fehler', zahl(fehlerNeu), 'rot') : '',
      (offen || 0) ? zeile('Offene Fehler gesamt', zahl(offen || 0), 'rot') : '',
    ].filter(Boolean).join('')

    const guthabenBlock = stand.map(s => {
      const name = s.anbieter === 'anthropic' ? 'Anthropic' : 'Apify'
      if (s.fehlt) return `<p style="margin:0 0 6px;color:#817c92;font-size:13px">${name}: kein Guthaben hinterlegt.</p>`
      const kritisch = s.reicht != null && s.reicht <= 7
      const warn = s.reicht != null && s.reicht <= 21
      return `<p style="margin:0 0 6px;font-size:14px;color:${kritisch ? '#c23a31' : warn ? '#a8630b' : '#4e4a5e'}">
        <b>${name}:</b> noch ${esc(eur(s.restEur))}${s.reicht != null ? ` — reicht etwa ${s.reicht} Tage` : ' — seit dem Stichtag kein Verbrauch'}.
      </p>`
    }).join('')

    const html = `<!DOCTYPE html><html lang="de"><body style="margin:0;padding:24px 16px;background:#f6f5fa;
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#17151f">
      <div style="max-width:460px;margin:0 auto;background:#fff;border:1px solid rgba(27,24,38,.09);
        border-radius:18px;padding:26px 24px">
        <div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#5b32c9">viuno Admin</div>
        <h1 style="margin:8px 0 2px;font-size:21px;font-weight:700;letter-spacing:-.03em">${esc(tag)}</h1>
        <p style="margin:0 0 18px;font-size:13px;color:#817c92">Das ist gestern passiert.</p>
        <table style="width:100%;border-collapse:collapse">${zeilen}</table>
        <div style="margin-top:20px;padding-top:16px;border-top:1px solid #eceaf2">
          <div style="font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:#817c92;margin-bottom:8px">Guthaben</div>
          ${guthabenBlock}
        </div>
        <a href="https://viuno.de/admin/" style="display:block;margin-top:22px;padding:13px;text-align:center;
          background:#17151f;color:#fff;text-decoration:none;border-radius:11px;font-weight:600;font-size:14px">Admin oeffnen</a>
        <p style="margin:16px 0 0;font-size:11px;color:#817c92;line-height:1.5">
          Diese Mail kommt nur, wenn etwas passiert ist oder etwas offen steht.</p>
      </div></body></html>`

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM_NAME + ' <' + FROM_EMAIL + '>',
        to: empfaenger,
        subject: (test ? '[Test] ' : '') + 'viuno — ' + tag,
        html,
      }),
    })
    if (!res.ok) throw new Error('Resend: ' + (await res.text()))

    return json({ ok: true, verschickt: true, an: empfaenger.length, test })
  } catch (err: any) {
    console.error('admin-tagesmail:', err?.message || err)
    try { await supabase.rpc('log_error', { function_name: 'admin-tagesmail', error_message: String(err?.message || err) }) } catch (_) { /* egal */ }
    return json({ ok: false, error: String(err?.message || err) }, 500)
  }
})
