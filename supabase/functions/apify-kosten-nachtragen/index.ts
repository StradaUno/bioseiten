/* Traegt die Apify-Kosten zu Analyse-Laeufen nach.
 *
 * Warum nachtraeglich und nicht im analysis-webhook, wo die Run-ID ohnehin
 * vorliegt: der Webhook ist der bezahlte Pfad. Fuer 9,99 EUR laeuft dort die
 * Verarbeitung von 36 Beitraegen, die KI-Analyse und der Mailversand. Eine
 * Kostenerfassung ist das Risiko nicht wert, diesen Pfad anzufassen -- und
 * sie ist auch nicht eilig: fuer eine Marge reicht es, wenn die Zahl am
 * naechsten Morgen dasteht.
 *
 * Diese Funktion laeuft stuendlich per Cron, sucht Laeufe ohne Kostenangabe
 * und holt usageTotalUsd aus der Apify-Run-API. Sie ist beliebig oft
 * wiederholbar: was schon erfasst ist, wird uebersprungen.
 *
 * Instagram hat ZWEI Laeufe (Profil und Beitraege), TikTok einen. Alle
 * gefundenen werden summiert und in einem Rutsch geschrieben.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const APIFY_TOKEN = Deno.env.get('APIFY_TOKEN') || ''
const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { headers: { ...cors, 'Content-Type': 'application/json' }, status: s })

/* Was ein einzelner Actor-Lauf gekostet hat. null, wenn Apify die Zahl nicht
   (mehr) kennt -- dann bleibt der Lauf offen und der naechste Durchgang
   versucht es wieder. */
async function kosten(apifyRunId: string): Promise<number | null> {
  try {
    const res = await fetch(`https://api.apify.com/v2/actor-runs/${apifyRunId}?token=${APIFY_TOKEN}`)
    if (!res.ok) return null
    const usd = Number((await res.json())?.data?.usageTotalUsd)
    return Number.isFinite(usd) && usd >= 0 ? usd : null
  } catch (_) {
    return null
  }
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
    if (!APIFY_TOKEN) throw new Error('APIFY_TOKEN fehlt')

    if (!darfLaufen(req)) return json({ error: 'nicht_erlaubt' }, 403)

    const { data: laeufe, error } = await supabase
      .from('analysis_runs')
      .select('id, platform, instagram_run_id, instagram_profil_run_id, tiktok_run_id')
      .is('apify_kosten_usd', null)
      .order('started_at', { ascending: false })
      .limit(50)
    if (error) throw error

    let erfasst = 0, offen = 0
    for (const lauf of laeufe || []) {
      const ids = [lauf.instagram_run_id, lauf.instagram_profil_run_id, lauf.tiktok_run_id].filter(Boolean)
      if (!ids.length) { offen++; continue }

      const werte = await Promise.all(ids.map(id => kosten(String(id))))
      const gefunden = werte.filter((v): v is number => v != null)
      /* Nur schreiben, wenn ALLE Laeufe eine Zahl geliefert haben. Sonst
         stuende dort eine halbe Summe -- und weil die Spalte dann nicht mehr
         null ist, wuerde sie nie korrigiert. Lieber noch einmal versuchen. */
      if (gefunden.length !== ids.length) { offen++; continue }

      const summe = gefunden.reduce((s, v) => s + v, 0)
      const { error: schreibFehler } = await supabase
        .from('analysis_runs')
        .update({ apify_kosten_usd: Math.round(summe * 10000) / 10000, apify_kosten_stand: new Date().toISOString() })
        .eq('id', lauf.id)
      if (schreibFehler) { offen++; continue }
      erfasst++
    }

    return json({ ok: true, geprueft: (laeufe || []).length, erfasst, offen })
  } catch (err: any) {
    console.error('apify-kosten-nachtragen:', err?.message || err)
    try { await supabase.rpc('log_error', { function_name: 'apify-kosten-nachtragen', error_message: String(err?.message || err) }) } catch (_) { /* egal */ }
    return json({ ok: false, error: String(err?.message || err) }, 500)
  }
})
