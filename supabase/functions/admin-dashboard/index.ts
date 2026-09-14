// admin-dashboard: liefert alle Stats fürs Admin-Panel in einem Call.
// Auth: JWT wird gegen den Auth-Server geprüft, danach is_admin-Check via
// service-role-key.
//
// Bis 14.09.2026 stand hier ein decodeJwtSub(), das nur den base64-Mittelteil
// des Tokens gelesen hat -- mit dem Kommentar "gleiches Pattern wie andere
// viuno-Functions". Die Signatur wurde nie geprüft, und die Function läuft mit
// verify_jwt:false. Ein selbstgebautes Token mit der UUID eines Admins reichte
// damit, um ohne eigenes Konto alle Nutzer mit E-Mail-Adresse, die Newsletter-
// Liste und die Kontaktanfragen der Landingpage abzurufen.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  try {
    // ─── Auth ──────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (!token) return json({ error: 'invalid_token: missing' }, 403)

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // Signaturprüfung gegen den Auth-Server, nicht bloßes Dekodieren.
    const { data: { user }, error: authError } = await admin.auth.getUser(token)
    if (authError || !user) return json({ error: 'invalid_token: rejected' }, 403)
    const userId = user.id

    const { data: me, error: meErr } = await admin
      .from('users')
      .select('id, is_admin, email')
      .eq('id', userId)
      .maybeSingle()
    if (meErr) return json({ error: 'auth_lookup_failed: ' + meErr.message }, 500)
    if (!me?.is_admin) return json({ error: 'forbidden: not admin' }, 403)

    // ─── Action routing ───────────────────────────────────────────────
    const url = new URL(req.url)
    const action = url.searchParams.get('action') || 'overview'

    if (action === 'overview') return json(await buildOverview(admin))
    if (action === 'delete_contact_submission') {
      const id = url.searchParams.get('id')
      if (!id) return json({ error: 'missing_id' }, 400)
      const { error } = await admin.from('contact_submissions')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
      if (error) return json({ error: error.message }, 500)
      return json({ success: true })
    }
    if (action === 'mark_error_resolved') {
      const id = url.searchParams.get('id')
      if (!id) return json({ error: 'missing_id' }, 400)
      const { error } = await admin.from('admin_errors')
        .update({ resolved: true, resolved_at: new Date().toISOString() })
        .eq('id', id)
      if (error) return json({ error: error.message }, 500)
      return json({ success: true })
    }

    return json({ error: 'unknown_action' }, 400)
  } catch (err: any) {
    return json({ error: 'internal: ' + (err?.message || String(err)) }, 500)
  }
})

// ─── Overview Builder ──────────────────────────────────────────────────

async function buildOverview(admin: any) {
  const now = new Date()
  const isoNow = now.toISOString()
  const day7 = new Date(now.getTime() - 7 * 86_400_000).toISOString()
  const day30 = new Date(now.getTime() - 30 * 86_400_000).toISOString()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()

  // ─── Users (komplett, klein – aktuell <100 erwartet) ──────────────────
  const { data: users = [] } = await admin
    .from('users')
    .select('id, email, display_name, full_name, created_at, last_active_at, subscription_type, niche_category, bio_active, mediakit_active, bio_views_total, bio_views_last_7_days, mediakit_views_total, mediakit_views_last_7_days, total_followers, deleted_at, is_admin')
    .order('created_at', { ascending: false })

  const usersTotal = users.length
  const usersActive = users.filter((u: any) => !u.deleted_at).length
  const usersDeleted = users.filter((u: any) => u.deleted_at).length
  const usersPro = users.filter((u: any) => u.subscription_type === 'pro' && !u.deleted_at).length
  const usersNew7 = users.filter((u: any) => u.created_at && u.created_at >= day7).length
  const usersNew30 = users.filter((u: any) => u.created_at && u.created_at >= day30).length

  // ─── Biolink Views ────────────────────────────────────────────────
  const { count: bioViewsTotal } = await admin.from('biolink_aufrufe').select('id', { count: 'exact', head: true })
  const { count: bioViews7 } = await admin.from('biolink_aufrufe').select('id', { count: 'exact', head: true }).gte('viewed_at', day7)
  const { count: bioViewsToday } = await admin.from('biolink_aufrufe').select('id', { count: 'exact', head: true }).gte('viewed_at', startOfDay)

  // Top User Biolink-Views (last 7 days, group via SQL impossible w/ JS client → fetch + reduce)
  const { data: bioRows = [] } = await admin
    .from('biolink_aufrufe')
    .select('user_id, viewed_at')
    .gte('viewed_at', day30)
    .limit(10000)
  const bioPerUser7: Record<string, number> = {}
  const bioPerUser30: Record<string, number> = {}
  for (const r of bioRows as any[]) {
    bioPerUser30[r.user_id] = (bioPerUser30[r.user_id] || 0) + 1
    if (r.viewed_at >= day7) bioPerUser7[r.user_id] = (bioPerUser7[r.user_id] || 0) + 1
  }

  // ─── MediaKit Views ───────────────────────────────────────────────
  const { count: mkViewsTotal } = await admin.from('mediakit_aufrufe').select('id', { count: 'exact', head: true })
  const { count: mkViews7 } = await admin.from('mediakit_aufrufe').select('id', { count: 'exact', head: true }).gte('viewed_at', day7)
  const { count: mkViewsToday } = await admin.from('mediakit_aufrufe').select('id', { count: 'exact', head: true }).gte('viewed_at', startOfDay)

  const { data: mkRows = [] } = await admin
    .from('mediakit_aufrufe')
    .select('user_id, viewed_at')
    .gte('viewed_at', day30)
    .limit(10000)
  const mkPerUser7: Record<string, number> = {}
  const mkPerUser30: Record<string, number> = {}
  for (const r of mkRows as any[]) {
    mkPerUser30[r.user_id] = (mkPerUser30[r.user_id] || 0) + 1
    if (r.viewed_at >= day7) mkPerUser7[r.user_id] = (mkPerUser7[r.user_id] || 0) + 1
  }

  // ─── User-Tabelle anreichern + Ranking ───────────────────────────────
  const userTable = users.map((u: any) => ({
    id: u.id,
    email: u.email,
    display_name: u.display_name,
    full_name: u.full_name,
    niche: u.niche_category,
    plan: u.subscription_type,
    is_admin: u.is_admin === true,
    created_at: u.created_at,
    last_active_at: u.last_active_at,
    deleted_at: u.deleted_at,
    bio_active: u.bio_active === true,
    mediakit_active: u.mediakit_active === true,
    bio_views_total: u.bio_views_total || 0,
    bio_views_7d: bioPerUser7[u.id] || 0,
    bio_views_30d: bioPerUser30[u.id] || 0,
    mk_views_total: u.mediakit_views_total || 0,
    mk_views_7d: mkPerUser7[u.id] || 0,
    mk_views_30d: mkPerUser30[u.id] || 0,
    total_followers: u.total_followers || 0,
  }))

  // Ranking: total Bio+MK Views
  const ranking = [...userTable]
    .map((u) => ({ ...u, score: (u.bio_views_total || 0) + (u.mk_views_total || 0) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)

  // ─── AI-Kosten ─────────────────────────────────────────────────
  const { data: aiAll = [] } = await admin
    .from('ai_usage_log')
    .select('feature, provider, model, tokens_input, tokens_output, cost_usd, user_id, created_at')
    .gte('created_at', day30)
    .order('created_at', { ascending: false })
    .limit(2000)

  let aiCostMonth = 0
  let aiCost7 = 0
  let aiCostToday = 0
  let aiCallsMonth = 0
  let aiTokensMonth = 0
  const aiByFeature: Record<string, { cost: number; calls: number; tokens: number }> = {}
  const aiByModel: Record<string, { cost: number; calls: number }> = {}

  for (const r of aiAll as any[]) {
    const cost = Number(r.cost_usd || 0)
    const tokens = (r.tokens_input || 0) + (r.tokens_output || 0)
    if (r.created_at >= startOfMonth) {
      aiCostMonth += cost
      aiCallsMonth += 1
      aiTokensMonth += tokens
      const f = r.feature || 'unknown'
      if (!aiByFeature[f]) aiByFeature[f] = { cost: 0, calls: 0, tokens: 0 }
      aiByFeature[f].cost += cost
      aiByFeature[f].calls += 1
      aiByFeature[f].tokens += tokens
      const m = r.model || 'unknown'
      if (!aiByModel[m]) aiByModel[m] = { cost: 0, calls: 0 }
      aiByModel[m].cost += cost
      aiByModel[m].calls += 1
    }
    if (r.created_at >= day7) aiCost7 += cost
    if (r.created_at >= startOfDay) aiCostToday += cost
  }

  // ─── Analyse-Runs ───────────────────────────────────────────────
  const { data: analysisAll = [] } = await admin
    .from('analysis_runs')
    .select('id, user_id, status, started_at, completed_at, error')
    .gte('started_at', day30)
    .order('started_at', { ascending: false })
    .limit(200)

  const analysisDone = analysisAll.filter((a: any) => a.status === 'done').length
  const analysisFailed = analysisAll.filter((a: any) => a.status === 'failed').length
  const analysisInProgress = analysisAll.filter((a: any) =>
    ['pending', 'scraping', 'analyzing'].includes(a.status)
  ).length

  // ─── Apify Verbrauch ─────────────────────────────────────────────
  const { count: apifyPostsTotal } = await admin.from('apify_daten').select('id', { count: 'exact', head: true })
  const { count: apifyPostsMonth } = await admin.from('apify_daten').select('id', { count: 'exact', head: true }).gte('created_at', startOfMonth)
  const { count: apifyPosts7 } = await admin.from('apify_daten').select('id', { count: 'exact', head: true }).gte('created_at', day7)

  // Nachschlagetabelle fuer die Anreicherung weiter unten.
  const userById: Record<string, any> = {}
  for (const u of users) userById[u.id] = u

  // ─── Contact Submissions (Landing Page) ─────────────────────────────
  const { data: contactSubmissions = [] } = await admin
    .from('contact_submissions')
    .select('id, name, email, message, instagram_handle, tiktok_handle, website_url, source, status, created_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(50)

  // ─── Newsletter Subscribers ───────────────────────────────────────
  const { data: newsletter = [] } = await admin
    .from('newsletter_subscribers')
    .select('id, email, source, status, subscribed_at, unsubscribed_at')
    .order('subscribed_at', { ascending: false })
    .limit(50)

  const newsletterActive = (newsletter as any[]).filter((n) => n.status === 'active').length

  // ─── Admin Errors ───────────────────────────────────────────────
  const { data: errors = [] } = await admin
    .from('admin_errors')
    .select('id, function_name, error_message, user_id, resolved, created_at')
    .order('created_at', { ascending: false })
    .limit(20)

  const errorsUnresolved = (errors as any[]).filter((e) => !e.resolved).length

  // ─── Biolinks Übersicht ───────────────────────────────────────────
  const { data: biolinkSettings = [] } = await admin
    .from('biolink_settings')
    .select('user_id, slug, is_active, theme, language, updated_at')
    .order('updated_at', { ascending: false })
  const biolinks = (biolinkSettings as any[]).map((b) => ({
    ...b,
    email: userById[b.user_id]?.email || null,
    display_name: userById[b.user_id]?.display_name || null,
    bio_views_total: userById[b.user_id]?.bio_views_total || 0,
  }))
  const biolinksActive = biolinks.filter((b) => b.is_active).length

  // ─── MediaKits Übersicht ─────────────────────────────────────────
  const { data: mkRows2 = [] } = await admin
    .from('mediakit_viuno')
    .select('user_id, default_language, followers_instagram, followers_tiktok, updated_at')
    .order('updated_at', { ascending: false })
  const mediakits = (mkRows2 as any[]).map((m) => ({
    ...m,
    email: userById[m.user_id]?.email || null,
    display_name: userById[m.user_id]?.display_name || null,
    is_active: userById[m.user_id]?.mediakit_active === true,
    mk_views_total: userById[m.user_id]?.mediakit_views_total || 0,
  }))
  const mediakitsActive = mediakits.filter((m) => m.is_active).length

  return {
    success: true,
    generated_at: isoNow,
    kpis: {
      users_total: usersTotal,
      users_active: usersActive,
      users_deleted: usersDeleted,
      users_pro: usersPro,
      users_new_7d: usersNew7,
      users_new_30d: usersNew30,
      bio_views_total: bioViewsTotal || 0,
      bio_views_7d: bioViews7 || 0,
      bio_views_today: bioViewsToday || 0,
      mk_views_total: mkViewsTotal || 0,
      mk_views_7d: mkViews7 || 0,
      mk_views_today: mkViewsToday || 0,
      ai_cost_month_usd: round4(aiCostMonth),
      ai_cost_7d_usd: round4(aiCost7),
      ai_cost_today_usd: round4(aiCostToday),
      ai_calls_month: aiCallsMonth,
      ai_tokens_month: aiTokensMonth,
      analysis_done_30d: analysisDone,
      analysis_failed_30d: analysisFailed,
      analysis_in_progress: analysisInProgress,
      apify_posts_total: apifyPostsTotal || 0,
      apify_posts_month: apifyPostsMonth || 0,
      apify_posts_7d: apifyPosts7 || 0,
      biolinks_active: biolinksActive,
      biolinks_total: biolinks.length,
      mediakits_active: mediakitsActive,
      mediakits_total: mediakits.length,
      contact_submissions_new: (contactSubmissions as any[]).filter((c) => c.status === 'new').length,
      newsletter_active: newsletterActive,
      errors_unresolved: errorsUnresolved,
    },
    users: userTable,
    ranking,
    ai: {
      by_feature: Object.entries(aiByFeature).map(([feature, v]) => ({ feature, cost_usd: round4(v.cost), calls: v.calls, tokens: v.tokens })).sort((a, b) => b.cost_usd - a.cost_usd),
      by_model: Object.entries(aiByModel).map(([model, v]) => ({ model, cost_usd: round4(v.cost), calls: v.calls })).sort((a, b) => b.cost_usd - a.cost_usd),
      recent: (aiAll as any[]).slice(0, 30).map((r) => ({
        created_at: r.created_at,
        feature: r.feature,
        model: r.model,
        tokens: (r.tokens_input || 0) + (r.tokens_output || 0),
        cost_usd: round4(Number(r.cost_usd || 0)),
        user_email: userById[r.user_id]?.email || null,
      })),
    },
    analysis: {
      recent: (analysisAll as any[]).slice(0, 20).map((a) => ({
        id: a.id,
        status: a.status,
        started_at: a.started_at,
        completed_at: a.completed_at,
        error: a.error,
        user_email: userById[a.user_id]?.email || null,
      })),
    },
    contact_submissions: contactSubmissions,
    newsletter,
    errors,
    biolinks,
    mediakits,
  }
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000
}
