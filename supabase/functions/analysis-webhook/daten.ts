import { supabase } from './basis.ts'

function getBerlinOffsetHours(d: Date): number {
  const month = d.getUTCMonth() + 1
  return (month >= 4 && month <= 10) ? 2 : 1
}

export async function fetchApifyDataset(runId: string, token: string, maxRetries = 4, delayMs = 6000): Promise<any[]> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const res = await fetch(`https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${token}&clean=true`)
    if (!res.ok) throw new Error(`Apify Dataset HTTP ${res.status}`)
    const data = await res.json()
    if (data && data.length > 0) return data
    if (attempt < maxRetries) await new Promise(r => setTimeout(r, delayMs))
  }
  return []
}

export async function getApifyDatasetId(runId: string, token: string): Promise<string | null> {
  try {
    const res = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${token}`)
    if (!res.ok) return null
    const json = await res.json()
    return json.data?.defaultDatasetId ?? null
  } catch (_) { return null }
}

export function mapInstagramPost(p: any, userId: string, analysisRunId: string): any {
  const hashtags = Array.isArray(p.hashtags) ? p.hashtags : []
  const mentions = Array.isArray(p.mentions) ? p.mentions : []
  const mediaType = p.type ?? (p.isVideo ? 'Video' : (p.productType === 'clips' ? 'Reel' : 'Image'))
  const isVideoLike = mediaType === 'Video' || mediaType === 'Reel' || p.isVideo === true || p.productType === 'clips'
  const views = isVideoLike ? (p.videoViewCount ?? p.videoPlayCount ?? null) : null
  return {
    user_id: userId, analysis_run_id: analysisRunId, platform: 'instagram',
    post_id: p.id ?? p.shortCode ?? null, post_url: p.url ?? null,
    caption: p.caption ?? null, posted_at: p.timestamp ?? null,
    likes: p.likesCount ?? null, comments: p.commentsCount ?? null, shares: null,
    views, play_count: isVideoLike ? (p.videoPlayCount ?? null) : null,
    hashtags, mentions, media_type: mediaType,
    duration_seconds: isVideoLike ? (p.videoDuration ?? null) : null,
    thumbnail_url: p.displayUrl ?? null, video_url: p.videoUrl ?? null,
    raw_data: p
  }
}

export function mapTiktokPost(v: any, userId: string, analysisRunId: string): any {
  const rawHashtags = v.hashtags ?? []
  const hashtags = Array.isArray(rawHashtags)
    ? rawHashtags.map((h: any) => typeof h === 'string' ? h : (h.name ?? h.title ?? null)).filter(Boolean) : []
  const rawMentions = v.mentions ?? []
  const mentions = Array.isArray(rawMentions)
    ? rawMentions.map((m: any) => typeof m === 'string' ? m : (m.name ?? m.uniqueId ?? null)).filter(Boolean) : []
  const ts = v.createTimeISO ?? (v.createTime ? new Date(v.createTime * 1000).toISOString() : null)
  return {
    user_id: userId, analysis_run_id: analysisRunId, platform: 'tiktok',
    post_id: v.id ?? null, post_url: v.webVideoUrl ?? null,
    caption: v.text ?? null, posted_at: ts,
    likes: v.diggCount ?? null, comments: v.commentCount ?? null, shares: v.shareCount ?? null,
    views: v.playCount ?? null, play_count: v.playCount ?? null,
    hashtags, mentions, media_type: 'Video',
    duration_seconds: v.videoMeta?.duration ?? null,
    thumbnail_url: v.videoMeta?.coverUrl ?? null,
    video_url: v.videoMeta?.downloadAddr ?? v.mediaUrls?.[0] ?? null,
    raw_data: v
  }
}

export function extractProfile(platform: string, data: any[]): any {
  if (platform === 'instagram') {
    const p = data[0] ?? {}
    return {
      username: p.username ?? null, display_name: p.fullName ?? null,
      bio: p.biography ?? null, avatar_url: p.profilePicUrlHD ?? p.profilePicUrl ?? null,
      verified: p.verified ?? null,
      followers: p.followersCount ?? null, following: p.followsCount ?? null,
      posts_count: p.postsCount ?? null, total_hearts: null,
      raw: { followersCount: p.followersCount, followsCount: p.followsCount, postsCount: p.postsCount, verified: p.verified, businessCategory: p.businessCategoryName ?? null }
    }
  }
  const a = data[0]?.authorMeta ?? data[0]?.author ?? {}
  return {
    username: a.name ?? a.uniqueId ?? null,
    display_name: a.nickName ?? a.nickname ?? null,
    bio: a.signature ?? null,
    avatar_url: a.avatar ?? a.avatarLarger ?? null,
    verified: a.verified ?? null,
    followers: a.fans ?? a.followers ?? a.followerCount ?? null,
    following: a.following ?? a.followingCount ?? null,
    posts_count: a.video ?? a.videoCount ?? null,
    total_hearts: a.heart ?? a.heartCount ?? null,
    raw: { fans: a.fans, video: a.video, heart: a.heart, verified: a.verified }
  }
}

/* Punkt 12: Die beste Zeit kam frueher aus den Beitraegen EINES Laufs -- wenige
   Datenpunkte fuer 168 Wochenstunden, und trotzdem als Fakt ausgegeben. Jetzt ueber
   alle je erfassten Beitraege des Kanals. best_time_sample sagt der Oberflaeche,
   wie belastbar die Aussage ist. */
export function computeBestTime(posts: any[]): { day: string | null; hour: number | null; sample: number } {
  const dayNames = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']
  const withTime = posts.filter(p => p.posted_at)
  if (withTime.length < 8) return { day: null, hour: null, sample: withTime.length }

  const sorted = [...withTime].sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0))
  const top = sorted.slice(0, Math.ceil(sorted.length / 2))
  const hCounts: Record<number, number> = {}, dCounts: Record<number, number> = {}
  for (const p of top) {
    const dUtc = new Date(p.posted_at)
    const dBerlin = new Date(dUtc.getTime() + getBerlinOffsetHours(dUtc) * 3600 * 1000)
    hCounts[dBerlin.getUTCHours()] = (hCounts[dBerlin.getUTCHours()] ?? 0) + 1
    dCounts[dBerlin.getUTCDay()] = (dCounts[dBerlin.getUTCDay()] ?? 0) + 1
  }
  const h = Object.entries(hCounts).sort((a, b) => b[1] - a[1])[0]
  const d = Object.entries(dCounts).sort((a, b) => b[1] - a[1])[0]
  return {
    day: d ? dayNames[parseInt(d[0])] : null,
    hour: h ? parseInt(h[0]) : null,
    sample: top.length
  }
}

/* Resonanz = Likes je 1.000 Aufrufe. Reichweite und Zustimmung wurden vorher nie
   getrennt: ein Beitrag mit 320.507 Aufrufen und 1.985 Likes stand neben einem mit
   69.111 Aufrufen und 2.640 Likes, als waere der erste der staerkere. Alle Werte
   werden EINMAL hier berechnet und danach nur noch abgeschrieben -- weder das
   Modell noch die Oberflaeche rechnen selbst. */
export function tonName(p: any): { name: string | null; eigen: boolean } {
  const r = p?.raw_data
  if (!r) return { name: null, eigen: false }
  if (r.musicInfo?.song_name) return { name: String(r.musicInfo.song_name), eigen: r.musicInfo.uses_original_audio === true }
  if (r.musicMeta?.musicName) return { name: String(r.musicMeta.musicName), eigen: r.musicMeta.musicOriginal === true }
  return { name: null, eigen: false }
}

function resonanzDaten(posts: any[]) {
  const mitViews = posts.filter(p => p.views !== null && p.views !== undefined && p.views > 0)
  const res = (p: any) => (p.likes ?? 0) / p.views * 1000
  const kom = (p: any) => (p.comments ?? 0) / p.views * 1000
  const r1 = (n: number) => parseFloat(n.toFixed(1))

  if (mitViews.length < 2) {
    return { schnitt: null, kommentarrate: null, top: null, flop: null,
             ausreisser: null, sounds: [], eigenerTon: null, proPost: [] }
  }

  /* Ungewichtetes Mittel der Einzelwerte, NICHT Summe-Likes durch Summe-Views.
     Gewichtet kann der Schnitt ueber dem Mittel der vier staerksten Beitraege
     liegen, wenn ein reichweitenstarker Beitrag die Summe dominiert -- bei einem
     TikTok-Lauf standen so 33,2 im Schnitt gegen 29,9 bei den staerksten.
     Nebeneinander in zwei Kacheln liest sich das wie ein Fehler. Ungewichtet
     beantwortet ausserdem die Frage, die der Creator stellt: wie gut laeuft ein
     typischer Beitrag von mir. */
  const schnitt = r1(mitViews.reduce((s, p) => s + res(p), 0) / mitViews.length)
  const kommentarrate = r1(mitViews.reduce((s, p) => s + kom(p), 0) / mitViews.length)

  const sortiert = [...mitViews].sort((a, b) => res(b) - res(a))
  // Bei sechs Beitraegen waeren "die vier staerksten" fast alle -- dann sagt der
  // Vergleich nichts. Deshalb nie mehr als die Haelfte je Seite.
  const n = Math.min(4, Math.floor(sortiert.length / 2))
  const mittel = (arr: any[]) => arr.length ? r1(arr.reduce((s, p) => s + res(p), 0) / arr.length) : null

  /* Viel Reichweite, wenig Resonanz: unter der reichweitenstaerkeren Haelfte der
     Beitrag mit der niedrigsten Resonanz. Genau der Fall, den der Creator selbst
     falsch liest, weil die Aufrufzahl gross aussieht. */
  const nachViews = [...mitViews].sort((a, b) => b.views - a.views)
  const a = nachViews.slice(0, Math.ceil(nachViews.length / 2)).sort((x, y) => res(x) - res(y))[0] ?? null

  /* Toene: nur fremde Toene werden gruppiert. "suono originale" / "Originalton" ist
     kein wiederverwendbarer Ton, sondern nur der Hinweis, dass keiner gewaehlt wurde. */
  const nachSound: Record<string, any[]> = {}
  let eigen = 0
  for (const p of mitViews) {
    const t = tonName(p)
    if (t.eigen) { eigen++; continue }
    if (!t.name) continue
    if (!nachSound[t.name]) nachSound[t.name] = []
    nachSound[t.name].push(p)
  }
  const sounds = Object.entries(nachSound)
    .filter(([_, v]) => v.length > 1)
    .map(([sound, v]) => {
      const werte = v.map(res).sort((x, y) => y - x).map(r1)
      return { sound, n: v.length, werte, faktor: r1(werte[0] / Math.max(werte[werte.length - 1], 0.1)) }
    })
    .sort((x, y) => y.faktor - x.faktor)

  const proPost = [...posts]
    .sort((x, y) => new Date(y.posted_at ?? 0).getTime() - new Date(x.posted_at ?? 0).getTime())
    .map(p => ({
      datum: p.posted_at ?? null,
      likes: p.likes ?? 0,
      comments: p.comments ?? 0,
      views: p.views ?? null,
      media_type: p.media_type ?? null,
      url: p.post_url ?? null,
      ton: tonName(p).name,
      resonanz: p.views > 0 ? r1(res(p)) : null,
      kommentarrate: p.views > 0 ? r1(kom(p)) : null
    }))

  return {
    schnitt, kommentarrate,
    top: mittel(sortiert.slice(0, n)), flop: mittel(sortiert.slice(-n)),
    ausreisser: a ? { datum: a.posted_at, views: a.views, likes: a.likes ?? 0, resonanz: r1(res(a)), url: a.post_url ?? null } : null,
    sounds,
    eigenerTon: { mit: eigen, gesamt: mitViews.length },
    proPost
  }
}

export function computeStats(posts: any[]): any {
  if (!posts.length) return null
  const likes = posts.map(p => p.likes ?? 0)
  const comments = posts.map(p => p.comments ?? 0)
  const shares = posts.filter(p => p.shares !== null && p.shares !== undefined).map(p => p.shares)
  const durations = posts.filter(p => p.duration_seconds !== null && p.duration_seconds !== undefined && p.duration_seconds > 0).map(p => p.duration_seconds)

  const avg = (arr: number[]) => arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : null
  const avgLikes = avg(likes) ?? 0
  const avgComments = avg(comments) ?? 0

  /* B2: "Engagement pro View" nur ueber Posts, die Views ausweisen -- Zaehler und
     Nenner aus DERSELBEN Menge. Instagram liefert fuer Carousels keine Views;
     frueher stand deren Likes im Zaehler, waehrend der Nenner sie nicht kannte. */
  const withViews = posts.filter(p => p.views !== null && p.views !== undefined && p.views > 0)
  const avgViews = avg(withViews.map(p => p.views))
  const avgLikesWithViews = avg(withViews.map(p => p.likes ?? 0))
  const avgCommentsWithViews = avg(withViews.map(p => p.comments ?? 0))
  const engagementPerView = (avgViews !== null && avgViews > 0)
    ? parseFloat((((avgLikesWithViews ?? 0) + (avgCommentsWithViews ?? 0)) / avgViews * 100).toFixed(2))
    : null

  const byType: Record<string, { sum: number; n: number }> = {}
  for (const p of posts) {
    const t = p.media_type || 'unknown'
    if (!byType[t]) byType[t] = { sum: 0, n: 0 }
    byType[t].sum += p.likes ?? 0
    byType[t].n += 1
  }
  const topFormat = Object.entries(byType)
    .filter(([_, v]) => v.n >= 2)
    .map(([t, v]) => ({ t, avg: v.sum / v.n }))
    .sort((a, b) => b.avg - a.avg)[0]?.t ?? null

  const withTime = posts.filter(p => p.posted_at)

  /* Punkt 9: Formate nur innerhalb derselben Metrik vergleichen. Video/Reel weisen
     Views aus, Sidecar/Image nicht -- ein Likes-Vergleich zwischen beiden bevorzugt
     strukturell das Video. */
  const nachFormat: Record<string, { likes: number[]; views: number[] }> = {}
  for (const p of posts) {
    const t = p.media_type || 'Unbekannt'
    if (!nachFormat[t]) nachFormat[t] = { likes: [], views: [] }
    nachFormat[t].likes.push(p.likes ?? 0)
    if (p.views !== null && p.views !== undefined && p.views > 0) nachFormat[t].views.push(p.views)
  }
  const formatStats = Object.entries(nachFormat)
    .filter(([_, v]) => v.likes.length >= 2)
    .map(([typ, v]) => ({
      typ,
      n: v.likes.length,
      avg_likes: Math.round(avg(v.likes) ?? 0),
      avg_views: v.views.length >= 2 ? Math.round(avg(v.views)!) : null
    }))
    .sort((x, y) => y.n - x.n)

  /* Punkt 9: Video-Laenge gegen Views. Der neue Beitrags-Actor liefert
     videoDuration auch bei Instagram -- der Profil-Actor tat das nie. */
  const LAENGEN_STUFEN = [
    { label: 'unter 10 s', min: 0,  max: 10 },
    { label: '10-20 s',    min: 10, max: 20 },
    { label: '20-40 s',    min: 20, max: 40 },
    { label: 'ueber 40 s', min: 40, max: Number.POSITIVE_INFINITY }
  ]
  const mitLaenge = posts.filter(p =>
    p.duration_seconds !== null && p.duration_seconds !== undefined && p.duration_seconds > 0 &&
    p.views !== null && p.views !== undefined && p.views > 0)
  let durationStats = LAENGEN_STUFEN.map(b => {
    const grp = mitLaenge.filter(p => p.duration_seconds >= b.min && p.duration_seconds < b.max)
    if (grp.length < 2) return null
    return {
      bucket: b.label,
      n: grp.length,
      avg_views: Math.round(avg(grp.map(p => p.views))!),
      avg_likes: Math.round(avg(grp.map(p => p.likes ?? 0))!)
    }
  }).filter(Boolean) as any[]
  // Eine einzelne Stufe ist kein Vergleich -- dann lieber gar nichts zeigen.
  if (durationStats.length < 2) durationStats = []

  const sortedByLikes = [...posts].sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0))
  const top3 = sortedByLikes.slice(0, 3)
  const tagCounts: Record<string, number> = {}
  for (const p of top3) {
    const tags = Array.isArray(p.hashtags) ? p.hashtags : []
    for (const t of tags) if (t) tagCounts[t] = (tagCounts[t] ?? 0) + 1
  }
  const topHashtags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([tag, count]) => ({ tag, count }))

  const mentionCounts: Record<string, number> = {}
  for (const p of top3) {
    const ms = Array.isArray(p.mentions) ? p.mentions : []
    for (const m of ms) if (m) mentionCounts[m] = (mentionCounts[m] ?? 0) + 1
  }
  const topMentions = Object.entries(mentionCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([m, count]) => ({ mention: m, count }))

  /* Punkt 3: Frueher wurde jede Spanne hochgerechnet -- 12 Videos aus eineinhalb
     Tagen ergaben "64 Posts/Woche". Jetzt nur noch, wenn die Stichprobe mindestens
     14 Tage abdeckt. */
  const MIN_TAGE_FUER_FREQUENZ = 14
  let postsPerWeek: number | null = null
  if (withTime.length >= 4) {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
    const last30d = withTime.filter(p => new Date(p.posted_at).getTime() >= cutoff)
    if (last30d.length >= 4) {
      const times = last30d.map(p => new Date(p.posted_at).getTime()).sort((a, b) => a - b)
      const dayDiff = (times[times.length - 1] - times[0]) / (1000 * 60 * 60 * 24)
      if (dayDiff >= MIN_TAGE_FUER_FREQUENZ) {
        postsPerWeek = parseFloat((last30d.length / (dayDiff / 7)).toFixed(1))
      }
    }
  }

  const rd = resonanzDaten(posts)

  return {
    resonanz_schnitt: rd.schnitt,
    resonanz_top: rd.top,
    resonanz_flop: rd.flop,
    kommentarrate_schnitt: rd.kommentarrate,
    sound_stats: rd.sounds,
    eigener_ton: rd.eigenerTon,
    ausreisser: rd.ausreisser,
    post_resonanz: rd.proPost,
    avg_likes: parseFloat(avgLikes.toFixed(1)),
    avg_comments: parseFloat(avgComments.toFixed(1)),
    avg_views: avgViews !== null ? parseFloat(avgViews.toFixed(1)) : null,
    avg_shares: avg(shares) !== null ? parseFloat(avg(shares)!.toFixed(1)) : null,
    avg_video_duration: avg(durations) !== null ? parseFloat(avg(durations)!.toFixed(1)) : null,
    engagement_per_view: engagementPerView,
    posts_with_views: withViews.length,
    top_format: topFormat,
    format_stats: formatStats,
    duration_stats: durationStats,
    top_hashtags: topHashtags,
    top_mentions: topMentions,
    posts_per_week: postsPerWeek,
    max_likes: Math.max(...likes),
    min_likes: Math.min(...likes)
  }
}
