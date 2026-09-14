import { supabase, PLATFORM_LABEL } from './basis.ts'
import { fetchApifyDataset, getApifyDatasetId, mapInstagramPost, mapTiktokPost, extractProfile, computeBestTime, computeStats } from './daten.ts'
import { runKiForPlatform, probelauf } from './auswertung.ts'

// B1: fehlte komplett -- jede Antwort lief in einen ReferenceError, Apify bekam 500
// und stellte den Callback mit Backoff erneut zu.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/* Wie viele Beitraege ein Lauf auswertet. Vorher 12 -- das reichte fuer
   Durchschnitte, aber nicht fuer Muster. MUSS zu BEITRAEGE_PRO_LAUF in
   start-analysis passen. */
const BEITRAEGE_PRO_LAUF = 36

async function buildAndSaveStats(userId: string, analysisRunId: string, platform: 'instagram' | 'tiktok', rawData: any[]): Promise<void> {
  const profile = extractProfile(platform, rawData)
  const { data: posts } = await supabase
    .from('apify_daten')
    .select('platform, posted_at, caption, likes, comments, shares, views, media_type, duration_seconds, hashtags, mentions, post_url, raw_data')
    .eq('analysis_run_id', analysisRunId).eq('platform', platform)
  const computed = computeStats(posts ?? [])

  /* Punkt 12: Beste Zeit ueber ALLE bisher erfassten Beitraege dieses Kanals,
     nicht nur die aus diesem Lauf. */
  const { data: allePosts } = await supabase
    .from('apify_daten').select('posted_at, likes')
    .eq('user_id', userId).eq('platform', platform)
  const zeit = computeBestTime(allePosts ?? [])

  // B4: Der Vorlauf wird mitsamt Username geladen. Nur wenn derselbe Account
  // gemessen wurde, sind Delta-Werte ueberhaupt eine Aussage.
  const { data: prevStats } = await supabase
    .from('analyse_stats').select('username, followers, avg_likes, engagement_rate')
    .eq('user_id', userId).eq('platform', platform).neq('analysis_run_id', analysisRunId)
    .order('created_at', { ascending: false }).limit(1).maybeSingle()

  const norm = (s: string | null | undefined) => (s ?? '').replace(/^@/, '').trim().toLowerCase()
  const previousUsername = prevStats?.username ?? null
  const handleChanged = !!(prevStats && previousUsername && profile.username &&
                           norm(previousUsername) !== norm(profile.username))
  const comparable = !!prevStats && !handleChanged

  const followersNow = profile.followers ?? 0
  const avgLikesNow = computed?.avg_likes ?? 0
  const avgCommentsNow = computed?.avg_comments ?? 0

  /* B2: Headline-Kennzahl ist fest die Follower-Basis. Kein Wechsel der
     Bezugsgroesse mehr -- frueher rechneten manche Laeufe gegen Views und andere
     gegen Follower, wodurch engagement_rate_change zwei Groessen verglich. */
  const er = followersNow > 0
    ? parseFloat(((avgLikesNow + avgCommentsNow) / followersNow * 100).toFixed(2))
    : 0

  const followersChange = comparable && prevStats?.followers !== null && prevStats?.followers !== undefined
    ? followersNow - prevStats.followers : null
  const avgLikesChange = comparable && prevStats?.avg_likes !== null && prevStats?.avg_likes !== undefined
    ? parseFloat((avgLikesNow - Number(prevStats.avg_likes)).toFixed(1)) : null
  const erChange = comparable && prevStats?.engagement_rate !== null && prevStats?.engagement_rate !== undefined
    ? parseFloat((er - Number(prevStats.engagement_rate)).toFixed(2)) : null

  const row = {
    user_id: userId, analysis_run_id: analysisRunId, platform,
    username: profile.username, display_name: profile.display_name,
    bio: profile.bio, avatar_url: profile.avatar_url, verified: profile.verified,
    followers: profile.followers, following: profile.following,
    posts_count: profile.posts_count, total_hearts: profile.total_hearts,
    avg_likes: computed?.avg_likes ?? null,
    avg_comments: computed?.avg_comments ?? null,
    avg_views: computed?.avg_views ?? null,
    avg_shares: computed?.avg_shares ?? null,
    avg_video_duration: computed?.avg_video_duration ?? null,
    engagement_rate: er,
    engagement_per_view: computed?.engagement_per_view ?? null,
    top_format: computed?.top_format ?? null,
    format_stats: computed?.format_stats ?? [],
    duration_stats: computed?.duration_stats ?? [],
    best_posting_hour: zeit.hour,
    best_posting_day: zeit.day,
    best_time_sample: zeit.sample,
    top_hashtags: computed?.top_hashtags ?? [],
    top_mentions: computed?.top_mentions ?? [],
    posts_per_week: computed?.posts_per_week ?? null,
    resonanz_schnitt: computed?.resonanz_schnitt ?? null,
    resonanz_top: computed?.resonanz_top ?? null,
    resonanz_flop: computed?.resonanz_flop ?? null,
    kommentarrate_schnitt: computed?.kommentarrate_schnitt ?? null,
    sound_stats: computed?.sound_stats ?? [],
    eigener_ton: computed?.eigener_ton ?? null,
    ausreisser: computed?.ausreisser ?? null,
    post_resonanz: computed?.post_resonanz ?? [],
    max_likes: computed?.max_likes ?? null,
    min_likes: computed?.min_likes ?? null,
    previous_username: previousUsername,
    handle_changed: handleChanged,
    followers_prev: comparable ? (prevStats?.followers ?? null) : null,
    followers_change: followersChange,
    avg_likes_prev: comparable ? (prevStats?.avg_likes ?? null) : null,
    avg_likes_change: avgLikesChange,
    engagement_rate_prev: comparable ? (prevStats?.engagement_rate ?? null) : null,
    engagement_rate_change: erChange,
    raw_profile: profile.raw
  }
  const { error } = await supabase.from('analyse_stats').insert(row)
  if (error) console.error(`[${platform}] analyse_stats insert error:`, error.message)
  else console.log(`[${platform}] Stats gespeichert: ${followersNow} Follower, ER ${er}%${handleChanged ? ` -- Handle gewechselt (@${previousUsername} -> @${profile.username}), kein Vergleich` : ''}`)
}

// Option C: verbraucht wird die aelteste unverbrauchte Freischaltung GENAU DIESER Plattform.
async function consumePurchaseForUser(userId: string, analysisRunId: string, platform: string): Promise<void> {
  const { data: purchase, error } = await supabase
    .from('analysis_purchases')
    .select('id')
    .eq('user_id', userId)
    .eq('platform', platform)
    .is('consumed_at', null)
    .order('purchased_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error) {
    console.error('consumePurchaseForUser select error:', error.message)
    try { await supabase.rpc('log_error', { function_name: 'analysis-webhook', error_message: `Kauf-Verbrauch [${platform}] Run ${analysisRunId}: ${error.message}` }) } catch (_) {}
    return
  }
  if (!purchase) {
    // Frueher nur console.warn -- damit blieb unbemerkt, dass eine Analyse ohne
    // Abbuchung geliefert wurde. Jetzt taucht der Fall in admin_errors auf.
    console.warn(`Keine unverbrauchte ${platform}-Freischaltung fuer User ${userId} -- Analyse trotzdem geliefert`)
    try { await supabase.rpc('log_error', { function_name: 'analysis-webhook', error_message: `Run ${analysisRunId}: keine unverbrauchte ${platform}-Freischaltung fuer User ${userId} gefunden, Analyse wurde trotzdem geliefert` }) } catch (_) {}
    return
  }

  const { error: updErr } = await supabase
    .from('analysis_purchases')
    .update({ consumed_at: new Date().toISOString(), analysis_run_id: analysisRunId })
    .eq('id', purchase.id)
  if (updErr) console.error('consumePurchaseForUser update error:', updErr.message)
  else console.log(`Freischaltung ${purchase.id} verbraucht fuer Run ${analysisRunId}`)
}

async function sendResultEmail(analysisRunId: string): Promise<void> {
  // Nicht fatal -- eine fehlgeschlagene Mail darf die erfolgreiche Analyse nicht kippen.
  try {
    // send-analysis-email verlangt die Service-Role als Nachweis -- vorher konnte
    // jeder mit einer bekannten Run-ID beliebig Mails ausloesen.
    const res = await fetch('https://bzejndghppuipnedasuv.supabase.co/functions/v1/send-analysis-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '')
      },
      body: JSON.stringify({ analysis_run_id: analysisRunId })
    })
    if (!res.ok) {
      const errText = await res.text()
      console.error('send-analysis-email fehlgeschlagen:', res.status, errText)
      try { await supabase.rpc('log_error', { function_name: 'analysis-webhook', error_message: 'Ergebnis-Mail fehlgeschlagen fuer Run ' + analysisRunId + ': ' + errText }) } catch (_) {}
    }
  } catch (e: any) {
    console.error('sendResultEmail exception:', e.message)
  }
}

async function runKiAnalysis(userId: string, analysisRunId: string): Promise<void> {
  // Frueher stand hier zusaetzlich die Spalte "niche", die es in users nie gab --
  // PostgREST lieferte dadurch einen Fehler, userData blieb null und die Nische
  // war in jedem Prompt leer.
  const { data: userData } = await supabase
    .from('users').select('niche_custom, niche_category').eq('id', userId).maybeSingle()
  const niche = userData?.niche_custom || userData?.niche_category || ''

  /* Option C: der Lauf traegt seine Plattform selbst. Nur Altlaeufe von vor der
     Umstellung haben platform IS NULL -- fuer die wird weiterhin ueber die
     tatsaechlich vorhandenen Rohdaten iteriert. */
  const { data: runInfo } = await supabase
    .from('analysis_runs').select('platform').eq('id', analysisRunId).maybeSingle()

  const { data: platforms } = await supabase
    .from('apify_daten').select('platform').eq('analysis_run_id', analysisRunId)
  const vorhanden = [...new Set((platforms ?? []).map((p: any) => p.platform))]
  const uniquePlatforms = runInfo?.platform
    ? vorhanden.filter((p: any) => p === runInfo.platform)
    : vorhanden

  if (uniquePlatforms.length === 0) {
    throw new Error('Wir konnten keine Beitraege abrufen. Ist das Profil oeffentlich und der Handle richtig geschrieben? Deine Freischaltung bleibt erhalten.')
  }

  const errors: string[] = []
  const erfolgreich: string[] = []
  for (const platform of uniquePlatforms) {
    if (platform !== 'instagram' && platform !== 'tiktok') continue
    try {
      const ok = await runKiForPlatform(userId, analysisRunId, platform, niche)
      if (ok) erfolgreich.push(platform)
    } catch (e: any) { console.error(e.message); errors.push(e.message) }
  }
  const successCount = erfolgreich.length

  if (successCount === 0) {
    // Technisches Detail nach admin_errors, der User bekommt einen Satz in Klartext.
    try { await supabase.rpc('log_error', { function_name: 'analysis-webhook', error_message: `Run ${analysisRunId}: alle Plattform-Analysen fehlgeschlagen: ${errors.join(' | ')}` }) } catch (_) {}
    throw new Error('Bei der Auswertung ist etwas schiefgelaufen. Deine Freischaltung bleibt erhalten - bitte versuche es in ein paar Minuten erneut.')
  }

  /* Freischaltung erst JETZT verbrauchen -- die Analyse ist zu diesem Zeitpunkt
     erfolgreich abgeschlossen. Bei komplettem Fehlschlag wird diese Zeile nie
     erreicht, der Kauf bleibt unverbraucht und kann erneut versucht werden. */
  await consumePurchaseForUser(userId, analysisRunId, runInfo?.platform ?? erfolgreich[0])

  // Teilerfolg: der Kauf ist verbraucht, deshalb muss der User erfahren, was fehlt --
  // die SPA zeigt analysis_runs.error auch im 'done'-Zustand an (B8).
  let teilFehler: string | null = null
  if (errors.length > 0) {
    const betroffen = [...new Set(errors.map(e => {
      const m = e.match(/^\[(instagram|tiktok)\]/)
      return m ? PLATFORM_LABEL[m[1]] : null
    }).filter(Boolean))]
    try { await supabase.rpc('log_error', { function_name: 'analysis-webhook', error_message: `Run ${analysisRunId} teilweise: ${errors.join(' | ')}` }) } catch (_) {}
    teilFehler = betroffen.length > 0
      ? `${betroffen.join(' und ')} konnte diesmal nicht ausgewertet werden. Schreib uns kurz, dann schalten wir dir das frei.`
      : 'Eine Plattform konnte diesmal nicht ausgewertet werden. Schreib uns kurz, dann schalten wir dir das frei.'
  }

  await supabase.from('analysis_runs').update({
    status: 'done', haiku_done_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    error: teilFehler
  }).eq('id', analysisRunId)

  // Ergebnis-Mail zuletzt -- erst NACHDEM der Run offiziell als 'done' markiert ist.
  await sendResultEmail(analysisRunId)
}

// Kappt auf BEITRAEGE_PRO_LAUF und gibt zurueck, wie viele wirklich entfernt wurden.
async function pruneOldestTiktokPosts(analysisRunId: string, removeCount: number): Promise<number> {
  if (removeCount <= 0) return 0
  const { data: oldest, error } = await supabase
    .from('apify_daten')
    .select('id, posted_at')
    .eq('analysis_run_id', analysisRunId)
    .eq('platform', 'tiktok')
    .order('posted_at', { ascending: true, nullsFirst: true })
    .limit(removeCount)
  if (error) { console.error('Prune fetch error:', error.message); return 0 }
  if (!oldest || oldest.length === 0) return 0
  const ids = oldest.map((r: any) => r.id)
  const { error: delErr } = await supabase.from('apify_daten').delete().in('id', ids)
  if (delErr) { console.error('Prune delete error:', delErr.message); return 0 }
  console.log(`[tiktok] ${ids.length} aelteste Posts entfernt`)
  return ids.length
}

async function markPlatformFailed(runId: string, platform: string, eventType: string, teil: string): Promise<void> {
  const patch: any = {}
  /* Bei Instagram bestehen zwei Abrufe. Scheitert einer, ist die Analyse als Ganzes
     hinfaellig -- ohne Followerzahl oder ohne Beitraege waere es ein halbes Ergebnis.
     Die Plattform wird sofort als uebersprungen markiert, damit der Lauf nicht auf
     den zweiten Teil wartet; der Kauf bleibt unverbraucht. */
  if (platform === 'instagram') { patch.instagram_skipped = true; patch.instagram_done_at = new Date().toISOString() }
  else { patch.tiktok_skipped = true; patch.tiktok_done_at = new Date().toISOString() }
  await supabase.from('analysis_runs').update(patch).eq('id', runId)
  console.warn(`[${platform}/${teil}] Apify-Run nicht erfolgreich (${eventType}) -- Plattform uebersprungen fuer Run ${runId}`)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  let analysisRunId: string | null = null
  try {
    const APIFY_TOKEN = Deno.env.get('APIFY_TOKEN') || ''
    const url = new URL(req.url)

    const probe = url.searchParams.get('probelauf')
    if (probe) {
      const token = req.headers.get('x-setup-token') || ''
      const { data: ok } = await supabase.from('setup_tokens').select('token').eq('token', token).maybeSingle()
      if (!ok) return new Response('Token unbekannt', { status: 403, headers: corsHeaders })
      const out = await probelauf(probe)
      return new Response(JSON.stringify(out, null, 2), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const userId = url.searchParams.get('userId')
    const runId = url.searchParams.get('runId')
    const platform = url.searchParams.get('platform')
    /* teil sagt, WELCHER der beiden Instagram-Abrufe sich meldet. Altlaeufe von vor
       der Umstellung schicken den Parameter nicht mit -- fuer die gilt 'beides'. */
    const teil = url.searchParams.get('teil') || 'beides'
    if (!userId || !runId || !platform) throw new Error('userId, runId und platform fehlen')
    analysisRunId = runId

    const body = await req.json().catch(() => ({}))
    const eventType = String(body.eventType || 'ACTOR.RUN.SUCCEEDED')

    const { data: runRow, error: runErr } = await supabase
      .from('analysis_runs').select('*').eq('id', runId).single()
    if (runErr || !runRow) throw new Error('analysis_run nicht gefunden')

    if (runRow.status === 'done' || runRow.status === 'failed') {
      return new Response(JSON.stringify({ success: true, skipped: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    let insertedCount = 0
    let datasetId: string | null = null

    if (eventType !== 'ACTOR.RUN.SUCCEEDED') {
      await markPlatformFailed(runId, platform, eventType, teil)
    } else {
      const apifyRunId = body.resource?.id || body.eventData?.actorRunId
      if (!apifyRunId) throw new Error('apify runId fehlt')

      datasetId = await getApifyDatasetId(apifyRunId, APIFY_TOKEN)
      const data = await fetchApifyDataset(apifyRunId, APIFY_TOKEN)

      if (platform === 'instagram' && teil === 'profil') {
        /* Profil-Abruf: liefert Follower, Bio, Verifizierung -- und sonst nichts, was
           wir hier brauchen. Die Beitraege aus latestPosts werden bewusst NICHT
           uebernommen: sie sind hoechstens 12 und wuerden sich mit denen des
           Beitrags-Abrufs doppeln. */
        const profil = data[0]
        if (!profil || !profil.username) throw new Error('Profil-Abruf leer -- ist das Profil oeffentlich?')
        await supabase.from('analysis_runs').update({
          instagram_profil: profil,
          instagram_profil_done_at: new Date().toISOString()
        }).eq('id', runId)
        console.log(`[instagram/profil] @${profil.username}, ${profil.followersCount} Follower`)
      } else if (platform === 'instagram' && teil === 'beitraege') {
        // Beitrags-Abruf: eine flache Liste von Posts, kein Profil-Objekt.
        const posts = data.filter((x: any) => x && (x.id || x.shortCode))
        const rows = posts.slice(0, BEITRAEGE_PRO_LAUF).map((p: any) => mapInstagramPost(p, userId, runId))
        if (rows.length > 0) {
          const { error: insErr } = await supabase.from('apify_daten').insert(rows)
          if (!insErr) insertedCount = rows.length
          else console.error('[instagram/beitraege] insert:', insErr.message)
        }
        await supabase.from('analysis_runs').update({
          instagram_dataset_id: datasetId,
          instagram_posts_done_at: new Date().toISOString()
        }).eq('id', runId)
        console.log(`[instagram/beitraege] ${insertedCount} Beitraege gespeichert`)
      } else if (platform === 'instagram') {
        // Altlauf von vor der Umstellung: ein Abruf, Profil und Beitraege zusammen.
        const profile = data[0]
        const posts = Array.isArray(profile?.latestPosts) ? profile.latestPosts : []
        const rows = posts.slice(0, BEITRAEGE_PRO_LAUF).map((p: any) => mapInstagramPost(p, userId, runId))
        if (rows.length > 0) {
          const { error: insErr } = await supabase.from('apify_daten').insert(rows)
          if (!insErr) insertedCount = rows.length
        }
        if (insertedCount > 0) {
          try { await buildAndSaveStats(userId, runId, 'instagram', data) }
          catch (e: any) { console.error('Stats build error:', e.message) }
        }
        await supabase.from('analysis_runs').update({
          instagram_dataset_id: datasetId,
          instagram_done_at: new Date().toISOString()
        }).eq('id', runId)
      } else if (platform === 'tiktok') {
        const videos = data.filter((d: any) => d.id || d.webVideoUrl || d.text || d.diggCount !== undefined)
        const rows = videos.slice(0, BEITRAEGE_PRO_LAUF).map((v: any) => mapTiktokPost(v, userId, runId))
        if (rows.length > 0) {
          const { error: insErr } = await supabase.from('apify_daten').insert(rows)
          if (!insErr) {
            insertedCount = rows.length
            if (insertedCount > BEITRAEGE_PRO_LAUF) {
              insertedCount -= await pruneOldestTiktokPosts(runId, insertedCount - BEITRAEGE_PRO_LAUF)
            }
          }
        }
      }

      if (platform === 'tiktok') {
        if (insertedCount > 0) {
          try { await buildAndSaveStats(userId, runId, 'tiktok', data) }
          catch (e: any) { console.error('Stats build error:', e.message) }
        }
        await supabase.from('analysis_runs').update({
          tiktok_dataset_id: datasetId,
          tiktok_done_at: new Date().toISOString()
        }).eq('id', runId)
      }

      /* Beide Instagram-Teile da? Genau EINE der beiden Antworten darf die Stats
         bauen. Die Bedingung steckt deshalb im UPDATE selbst: nur der Aufruf, der
         instagram_done_at tatsaechlich von NULL auf jetzt setzt, bekommt eine Zeile
         zurueck und macht weiter. Ein reines Lesen-dann-Schreiben wuerde bei zwei
         gleichzeitig eintreffenden Webhooks doppelt bauen. */
      if (platform === 'instagram' && (teil === 'profil' || teil === 'beitraege')) {
        const { data: uebernommen } = await supabase.from('analysis_runs')
          .update({ instagram_done_at: new Date().toISOString() })
          .eq('id', runId)
          .is('instagram_done_at', null)
          .not('instagram_profil_done_at', 'is', null)
          .not('instagram_posts_done_at', 'is', null)
          .select('id, instagram_profil')
        if (uebernommen && uebernommen.length === 1) {
          console.log(`[instagram] beide Teile da -- Stats werden gebaut`)
          try { await buildAndSaveStats(userId, runId, 'instagram', [uebernommen[0].instagram_profil]) }
          catch (e: any) { console.error('Stats build error:', e.message) }
        }
      }
    }

    const { data: refreshed } = await supabase
      .from('analysis_runs').select('instagram_done_at, instagram_skipped, tiktok_done_at, tiktok_skipped, status')
      .eq('id', runId).single()
    if (!refreshed) throw new Error('Refresh fehlgeschlagen')

    const igFinished = refreshed.instagram_skipped || refreshed.instagram_done_at !== null
    const ttFinished = refreshed.tiktok_skipped || refreshed.tiktok_done_at !== null

    /* Auch hier atomar: bei zwei Webhooks koennten sonst beide gleichzeitig die
       Auswertung starten und der Kunde bekaeme zwei Ergebnisse fuer einen Kauf. */
    const { data: gestartet } = igFinished && ttFinished
      ? await supabase.from('analysis_runs').update({ status: 'analyzing' })
          .eq('id', runId).eq('status', 'scraping').select('id')
      : { data: [] as any[] }

    if (gestartet && gestartet.length === 1) {
      try { await runKiAnalysis(userId, runId) }
      catch (kiErr: any) {
        await supabase.from('analysis_runs').update({
          status: 'failed', error: kiErr.message, completed_at: new Date().toISOString()
        }).eq('id', runId)
        throw kiErr
      }
    }

    return new Response(
      JSON.stringify({ success: true, platform, teil, event: eventType, inserted: insertedCount, both_done: igFinished && ttFinished }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (err: any) {
    console.error('analysis-webhook error:', err.message)
    try { await supabase.rpc('log_error', { function_name: 'analysis-webhook', error_message: err.message }) } catch (_) {}
    if (analysisRunId) {
      try { await supabase.from('analysis_runs').update({ error: err.message }).eq('id', analysisRunId) } catch (_) {}
    }
    return new Response(JSON.stringify({ success: false, error: err.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
  }
})
