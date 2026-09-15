import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/* Repo-Kopie seit dem Launch-Check (15.09.2026). Deployed wird aus dem
   Supabase-Dashboard; nach einer Aenderung hier deployen, nach einer Aenderung
   dort zurueckkopieren -- dieselbe Regel wie bei den anderen Functions. */

const APIFY_TOKEN = Deno.env.get('APIFY_TOKEN') || ''

/* Instagram braucht ZWEI Actors:
   - der Profil-Scraper liefert Follower, Bio, Verifizierung -- aber hoechstens 12
     Beitraege, und er kennt keinen resultsLimit. Bei jemandem, der drei mal
     taeglich postet, deckt eine Analyse damit vier Tage ab.
   - der Beitrags-Scraper liefert beliebig viele Beitraege samt videoDuration,
     das der Profil-Scraper nie mitgeliefert hat -- kennt dafuer kein Profil.
   Beide melden sich beim selben Webhook, unterschieden ueber den Parameter teil. */
const IG_PROFIL_ACTOR = 'apify~instagram-profile-scraper'
const IG_POSTS_ACTOR = 'apify~instagram-post-scraper'
const TT_ACTOR_ID = 'clockworks~tiktok-scraper'
const WEBHOOK_BASE_URL = 'https://bzejndghppuipnedasuv.supabase.co/functions/v1/analysis-webhook'

/* Wie viele Beitraege ein Lauf abruft. MUSS zu BEITRAEGE_PRO_LAUF in
   analysis-webhook passen -- wird hier mehr geholt als dort verarbeitet, zahlt
   man bei Apify fuer Daten, die niemand auswertet. */
const BEITRAEGE_PRO_LAUF = 36

/* Angepinnte Beitraege bleiben draussen.
   Instagram liefert sie IMMER zuerst, unabhaengig vom Datum. Ein Konto, das
   seit zwei Wochen postet und einen alten Beitrag oben anheftet, bekam damit
   einen fuenf Monate alten Beitrag in denselben Topf wie 35 frische -- der
   ausgewiesene Zeitraum lief dann "vom 15.04. bis 14.09.", obwohl die
   eigentliche Aktivitaet siebzehn Tage umfasste. Schlimmer als die falsche
   Zeitangabe ist die Wirkung auf die Zahlen: ein angehefteter Beitrag steht
   monatelang oben und sammelt entsprechend Likes, also zieht er
   Durchschnitt, Engagement-Rate, beste Uhrzeit und besten Tag mit sich.
   Fuer eine Analyse, die 9,99 EUR kostet, ist das kein Detail. */
const ANGEPINNTE_UEBERSPRINGEN = true

// Auch die Fehler-Ereignisse registrieren. Vorher stand hier nur ACTOR.RUN.SUCCEEDED:
// ein gescheiterter Apify-Run hat dann NIE einen Callback ausgeloest, der Run blieb
// dauerhaft auf 'scraping' stehen und der User konnte keine neue Analyse mehr starten.
const APIFY_EVENT_TYPES = [
  'ACTOR.RUN.SUCCEEDED',
  'ACTOR.RUN.FAILED',
  'ACTOR.RUN.ABORTED',
  'ACTOR.RUN.TIMED_OUT'
]

const PLATFORM_LABEL: Record<string, string> = { instagram: 'Instagram', tiktok: 'TikTok' }
const HANDLE_FIELD: Record<string, string> = { instagram: 'instagram_handle', tiktok: 'tiktok_handle' }

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status
  })
}

/* teil unterscheidet die beiden Instagram-Laeufe. Ohne diesen Parameter koennte der
   Webhook nicht sagen, ob gerade das Profil oder die Beitraege zurueckkommen -- und
   wuerde die Rohdaten des einen mit dem Mapper des anderen verarbeiten.

   schluessel ist der Wert "apify_webhook_schluessel" aus dem Supabase-Vault. Der
   Webhook nimmt nur Callbacks an, die ihn tragen -- sonst koennte jeder, der eine
   Run-ID und eine UUID kennt, den bezahlten Pfad mit fremden Daten fuettern
   (Launch-Check 15.09.2026). */
function buildWebhookParam(userId: string, runId: string, platform: string, teil: string, schluessel: string): string {
  const webhookUrl = `${WEBHOOK_BASE_URL}?userId=${userId}&runId=${runId}&platform=${platform}&teil=${teil}&schluessel=${encodeURIComponent(schluessel)}`
  const jsonStr = JSON.stringify([{ eventTypes: APIFY_EVENT_TYPES, requestUrl: webhookUrl }])
  return btoa(unescape(encodeURIComponent(jsonStr)))
}

async function startApifyRun(actorId: string, input: object, webhookParam: string): Promise<string | null> {
  const res = await fetch(
    `https://api.apify.com/v2/acts/${actorId}/runs?token=${APIFY_TOKEN}&webhooks=${webhookParam}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) }
  )
  if (!res.ok) {
    const errText = await res.text()
    console.error('Apify start failed:', actorId, res.status, errText)
    return null
  }
  const run = await res.json()
  return run.data?.id || null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    if (!APIFY_TOKEN) throw new Error('APIFY_TOKEN fehlt')

    // Auth: JWT validieren
    const authHeader = req.headers.get('Authorization') || ''
    if (!authHeader) throw new Error('Kein Authorization Header')
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) throw new Error('Auth fehlgeschlagen')
    const userId = user.id

    // Option C: ein Lauf deckt genau eine Plattform ab. Die Plattform kommt vom Client.
    const body = await req.json().catch(() => ({}))
    const platform = String(body.platform || '').toLowerCase()
    if (platform !== 'instagram' && platform !== 'tiktok') {
      return json({ success: false, error: 'invalid_platform', message: 'Bitte waehle Instagram oder TikTok.' }, 400)
    }

    // 1. Bezahl-Check: unverbrauchte Freischaltung GENAU FUER DIESE PLATTFORM.
    const { data: purchase, error: purchaseErr } = await supabase
      .from('analysis_purchases')
      .select('id')
      .eq('user_id', userId)
      .eq('platform', platform)
      .is('consumed_at', null)
      .order('purchased_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (purchaseErr) throw new Error('Kauf-Pruefung fehlgeschlagen: ' + purchaseErr.message)
    if (!purchase) {
      return json({
        success: false, error: 'payment_required', platform,
        message: `Fuer eine ${PLATFORM_LABEL[platform]}-Analyse ist eine Freischaltung noetig.`
      }, 402)
    }

    const { data: u, error: userErr } = await supabase
      .from('users')
      .select('instagram_handle, tiktok_handle')
      .eq('id', userId)
      .single()
    if (userErr || !u) throw new Error('User nicht gefunden')

    const handle = (u as Record<string, string | null>)[HANDLE_FIELD[platform]]
    if (!handle || !String(handle).trim()) {
      return json({
        success: false, error: 'handle_missing', platform,
        message: `Es ist kein ${PLATFORM_LABEL[platform]}-Handle hinterlegt. Deine Freischaltung bleibt erhalten.`
      }, 400)
    }

    /* Der Webhook-Schluessel muss vorliegen, BEVOR ein Lauf angelegt wird: ohne
       ihn wuerde Apify melden, der Webhook ablehnen und der Lauf nach 15 Minuten
       als "zu lange gedauert" scheitern -- mit einer Fehlermeldung, die in die Irre fuehrt. */
    const { data: webhookSchluessel, error: schluesselErr } = await supabase
      .rpc('schluessel_holen', { p_zweck: 'apify_webhook_schluessel' })
    if (schluesselErr || !webhookSchluessel) {
      throw new Error('Webhook-Schluessel nicht verfuegbar: ' + (schluesselErr?.message ?? 'leer'))
    }

    // 2. analysis_runs Row anlegen -- die jeweils andere Plattform gilt als uebersprungen.
    const { data: runRow, error: runErr } = await supabase
      .from('analysis_runs')
      .insert({
        user_id: userId,
        status: 'scraping',
        platform,
        instagram_skipped: platform !== 'instagram',
        tiktok_skipped: platform !== 'tiktok'
      })
      .select('id')
      .single()
    if (runErr || !runRow) throw new Error('Konnte analysis_run nicht anlegen: ' + (runErr?.message ?? ''))
    const analysisRunId = runRow.id

    const cleanHandle = String(handle).replace(/^@/, '').trim()

    const abbrechen = async (grund: string) => {
      await supabase.from('analysis_runs').update({
        status: 'failed', error: grund, completed_at: new Date().toISOString()
      }).eq('id', analysisRunId)
      return json({ success: false, error: 'apify_start_failed', platform, message: grund }, 502)
    }
    const startFehler = 'Der Abruf konnte nicht gestartet werden. Deine Freischaltung bleibt erhalten - bitte versuche es in ein paar Minuten erneut.'

    if (platform === 'instagram') {
      /* Beide Laeufe starten. Schlaegt einer von beiden fehl, wird der ganze Lauf
         abgebrochen: eine Analyse ohne Followerzahl oder ohne Beitraege waere ein
         halbes Ergebnis, und dafuer soll niemand 9,99 EUR bezahlt haben. */
      const profilRunId = await startApifyRun(
        IG_PROFIL_ACTOR,
        { usernames: [cleanHandle] },
        buildWebhookParam(userId, analysisRunId, 'instagram', 'profil', webhookSchluessel)
      )
      if (!profilRunId) return await abbrechen(startFehler)

      const postsRunId = await startApifyRun(
        IG_POSTS_ACTOR,
        { username: [cleanHandle], resultsLimit: BEITRAEGE_PRO_LAUF, skipPinnedPosts: ANGEPINNTE_UEBERSPRINGEN },
        buildWebhookParam(userId, analysisRunId, 'instagram', 'beitraege', webhookSchluessel)
      )
      if (!postsRunId) return await abbrechen(startFehler)

      await supabase.from('analysis_runs').update({
        instagram_profil_run_id: profilRunId,
        instagram_run_id: postsRunId
      }).eq('id', analysisRunId)

      return json({
        success: true, analysis_run_id: analysisRunId, platform,
        apify_run_id: postsRunId, apify_profil_run_id: profilRunId, status: 'scraping'
      })
    }

    // TikTok: ein Lauf liefert Profil und Videos zusammen.
    const apifyRunId = await startApifyRun(
      TT_ACTOR_ID,
      {
        profiles: [cleanHandle],
        resultsPerPage: BEITRAEGE_PRO_LAUF,
        shouldDownloadVideos: false,
        shouldDownloadCovers: false,
        shouldDownloadSubtitles: false,
        shouldDownloadSlideshowImages: false
      },
      buildWebhookParam(userId, analysisRunId, 'tiktok', 'beides', webhookSchluessel)
    )
    if (!apifyRunId) return await abbrechen(startFehler)
    await supabase.from('analysis_runs').update({ tiktok_run_id: apifyRunId }).eq('id', analysisRunId)

    return json({
      success: true, analysis_run_id: analysisRunId, platform,
      apify_run_id: apifyRunId, status: 'scraping'
    })
  } catch (err: any) {
    console.error('start-analysis error:', err.message)
    try { await supabase.rpc('log_error', { function_name: 'start-analysis', error_message: err.message }) } catch (_) {}
    /* Interne Details bleiben im Log; der Client bekommt einen Satz, den man
       einem Menschen zeigen kann. */
    return json({ success: false, error: 'server_error', message: 'Die Analyse konnte nicht gestartet werden. Deine Freischaltung bleibt erhalten - bitte versuche es gleich noch einmal.' }, 400)
  }
})
