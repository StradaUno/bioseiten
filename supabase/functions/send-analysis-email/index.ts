import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/* Ergebnis-Mail nach einer abgeschlossenen Analyse.
   Repo-Kopie seit dem Launch-Check (15.09.2026); deployed wird aus dem Dashboard. */

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || ''
const FROM_EMAIL = 'noreply@viuno.de'
const FROM_NAME = 'viuno'
// Antworten landen bei der Support-Adresse aus dem Impressum -- eine reine
// noreply-Adresse ist bei einem Bezahlprodukt die falsche Wahl.
const REPLY_TO = 'office@viuno.de'
const APP_LINK = 'https://viuno.de/app/#/analytics'
const MEDIAKIT_LINK = 'https://viuno.de/app/#/mediakit'
/* Die Einzelseiten /agb/, /datenschutz/ usw. leiten auf /legal mit Anker weiter. */
const LEGAL = 'https://viuno.de/legal'

// Nur analysis-webhook ruft diese Funktion auf. Ohne Secret koennte jeder mit einer
// bekannten Run-ID beliebig oft Mails an fremde Nutzer ausloesen.
const INTERNAL_SECRET = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

function esc(s: string) { return String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' } as any)[c]) }
function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(Number(n))) return '–'
  const v = Number(n)
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (v >= 1_000) return (v / 1_000).toFixed(1).replace(/\.0$/, '') + 'k'
  return String(Math.round(v))
}

const PLATFORM_LABEL: Record<string, string> = { instagram: 'Instagram', tiktok: 'TikTok' }
const PLATFORM_BADGE: Record<string, { bg: string; color: string }> = {
  instagram: { bg: '#fce4ec', color: '#880e4f' },
  tiktok: { bg: '#f0f0f0', color: '#111110' },
}

function badgeHtml(platform: string): string {
  const c = PLATFORM_BADGE[platform] || PLATFORM_BADGE.instagram
  return `<span style="display:inline-block;font-size:10px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;padding:3px 10px;border-radius:99px;background:${c.bg};color:${c.color};">${esc(PLATFORM_LABEL[platform] || platform)}</span>`
}

function kpiCell(label: string, value: string, delta: string | null): string {
  return `<td width="33%" style="padding:4px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="background:#f0efed;border-radius:10px;padding:10px 8px;text-align:center;"><div style="font-size:16px;font-weight:700;color:#111110;letter-spacing:-0.02em;">${esc(value)}</div><div style="font-size:9px;color:#7a7975;text-transform:uppercase;letter-spacing:0.04em;margin-top:2px;">${esc(label)}</div>${delta ? `<div style="font-size:9px;color:#7a7975;margin-top:2px;">${esc(delta)}</div>` : ''}</td></tr></table></td>`
}

function platformSectionHtml(platform: string, ki: any, stats: any): string {
  const follDelta = (stats?.followers_change !== null && stats?.followers_change !== undefined)
    ? `${stats.followers_change >= 0 ? '+' : ''}${fmt(stats.followers_change)}` : null

  /* Punkt 6: Engagement je Aufruf steht vor der Follower-Rate. Die Follower-Rate kann
     bei stark ausgespielten Beitraegen weit ueber 30 % liegen -- rechnerisch richtig,
     aber als Kopfzahl irrefuehrend. */
  const epv = stats?.engagement_per_view
  const kpiRow = stats
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:14px;"><tr>
        ${kpiCell('Follower', fmt(stats.followers), follDelta)}
        ${epv != null
          ? kpiCell('Engagement', Number(epv).toFixed(2) + '%', 'je Aufruf')
          : kpiCell('Ø Kommentare', fmt(stats.avg_comments), 'pro Beitrag')}
        ${kpiCell('Ø Likes', fmt(stats.avg_likes), 'pro Beitrag')}
      </tr></table>`
    : ''

  const handleHinweis = stats?.handle_changed
    ? `<p style="margin:0 0 12px;font-size:12px;color:#7a7975;line-height:1.6;">Dein Handle hat sich seit der letzten Analyse geändert – ein Zahlenvergleich ist deshalb erst ab der nächsten Analyse wieder möglich.</p>`
    : ''

  const overview = ki?.analyse_ueberblick
    ? `<p style="margin:0 0 14px;font-size:13px;color:#3a3835;line-height:1.7;white-space:pre-line;">${esc(ki.analyse_ueberblick)}</p>`
    : ''

  const tips = Array.isArray(ki?.tipps_zukunft) && ki.tipps_zukunft.length > 0
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:4px;">` +
      ki.tipps_zukunft.slice(0, 4).map((t: string, i: number) => `
      <tr><td style="padding:6px 0;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td valign="top" style="width:20px;"><div style="width:16px;height:16px;border-radius:50%;background:#111110;color:#fff;font-size:9px;font-weight:700;text-align:center;line-height:16px;">${i + 1}</div></td>
          <td style="padding-left:8px;font-size:12.5px;color:#111110;line-height:1.5;">${esc(t)}</td>
        </tr></table>
      </td></tr>`).join('') + `</table>`
    : ''

  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border:1px solid #e4e4e2;border-radius:12px;margin-bottom:14px;">
  <tr><td style="padding:18px 18px 16px;">
    <div style="margin-bottom:12px;">${badgeHtml(platform)}</div>
    ${kpiRow}
    ${handleHinweis}
    ${overview}
    ${tips}
  </td></tr>
  </table>`
}

/* P11: Der Betreff traegt die konkreteste Zahl, die vorliegt -- vorher stand dort
   immer derselbe Satz. */
function buildSubject(platforms: string[], statsRows: any[], kiRows: any[]): string {
  const label = platforms.length === 1 ? (PLATFORM_LABEL[platforms[0]] || '') + '-' : ''
  const st = statsRows[0]
  if (st && st.followers_change !== null && st.followers_change !== undefined && Number(st.followers_change) !== 0) {
    const d = Number(st.followers_change)
    return `Deine ${label}Analyse ist fertig – ${d > 0 ? '+' : ''}${fmt(d)} Follower seit dem letzten Mal`
  }
  const top = kiRows[0]?.top_posts
  if (Array.isArray(top) && top.length > 0) {
    return `Deine ${label}Analyse ist fertig – ${top.length} Beiträge stechen heraus`
  }
  return `Deine ${label}Analyse ist fertig ✓`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const auth = req.headers.get('Authorization') || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : auth
    if (!INTERNAL_SECRET || token !== INTERNAL_SECRET) {
      return new Response(JSON.stringify({ success: false, error: 'unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401
      })
    }

    const body = await req.json().catch(() => ({}))
    const analysisRunId = body.analysis_run_id
    if (!analysisRunId) throw new Error('analysis_run_id fehlt')

    const { data: run, error: runErr } = await supabase
      .from('analysis_runs')
      .select('user_id, status, platform, error')
      .eq('id', analysisRunId)
      .single()
    if (runErr || !run) throw new Error('analysis_run nicht gefunden')
    if (run.status !== 'done') {
      return new Response(JSON.stringify({ success: true, skipped: 'run_not_done' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    }

    const { data: user, error: userErr } = await supabase
      .from('users')
      .select('display_name, full_name, email, contact_email')
      .eq('id', run.user_id)
      .single()
    if (userErr || !user) throw new Error('User nicht gefunden')
    const toEmail = user.contact_email || user.email
    if (!toEmail) throw new Error('Keine E-Mail-Adresse fuer User')
    const creatorName = user.display_name || user.full_name || 'Creator'

    const [{ data: kiRows }, { data: statsRows }] = await Promise.all([
      supabase.from('analyse_ki').select('*').eq('analysis_run_id', analysisRunId),
      supabase.from('analyse_stats').select('*').eq('analysis_run_id', analysisRunId)
    ])

    /* Option C: ein Lauf deckt genau einen Kanal ab. Bei Altlaeufen (platform NULL)
       bleibt es beim bisherigen Verhalten und es kommen beide Abschnitte. */
    const alleKi = (kiRows || []).filter((r: any) => !run.platform || r.platform === run.platform)
    const alleStats = (statsRows || []).filter((r: any) => !run.platform || r.platform === run.platform)

    const platforms = [...new Set([...alleKi.map((r: any) => r.platform), ...alleStats.map((r: any) => r.platform)])]
    if (platforms.length === 0) throw new Error('Keine Analyse-Ergebnisse fuer diesen Run gefunden')

    const sectionsHtml = platforms.map((p) => {
      const ki = alleKi.find((r: any) => r.platform === p)
      const stats = alleStats.find((r: any) => r.platform === p)
      return platformSectionHtml(p as string, ki, stats)
    }).join('')

    /* Das Wichtigste zuerst: der erste konkrete Tipp steht ueber den Zahlen.
       Vorher begann die Mail mit der KPI-Zeile -- also mit dem, was der Creator
       ohnehin kennt. */
    const ersterTipp = alleKi.map((r: any) => Array.isArray(r.tipps_zukunft) ? r.tipps_zukunft[0] : null).find(Boolean)
    const highlight = ersterTipp
      ? `<tr><td style="padding:0 8px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#111110;border-radius:12px;">
            <tr><td style="padding:16px 18px;">
              <div style="font-size:10px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:rgba(255,255,255,.55);margin-bottom:6px;">Das Wichtigste zuerst</div>
              <div style="font-size:14px;color:#ffffff;line-height:1.6;">${esc(ersterTipp)}</div>
            </td></tr>
          </table>
        </td></tr>`
      : ''

    const teilFehler = run.error
      ? `<tr><td style="padding:0 8px 16px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fff4f4;border:1px solid #f3d6d6;border-radius:10px;"><tr><td style="padding:12px 14px;font-size:12.5px;color:#8a2b2b;line-height:1.6;">${esc(run.error)}</td></tr></table></td></tr>`
      : ''

    const subject = buildSubject(platforms as string[], alleStats, alleKi)

    const html = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${esc(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f5f4f2;font-family:-apple-system,BlinkMacSystemFont,'Inter',Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f4f2;padding:28px 14px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">

<tr><td style="padding:4px 8px 20px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="vertical-align:middle;"><div style="width:26px;height:26px;border-radius:7px;background:#111110;display:inline-block;text-align:center;line-height:26px;font-size:13px;font-weight:800;color:#fff;">v</div></td>
<td style="padding-left:8px;vertical-align:middle;"><span style="font-size:15px;font-weight:700;color:#111110;letter-spacing:-0.02em;">viuno</span></td>
</tr></table>
</td></tr>

<tr><td style="padding:0 8px 18px;">
<h1 style="margin:0 0 4px;font-size:21px;font-weight:700;color:#111110;letter-spacing:-0.03em;">${esc(subject)}</h1>
<p style="margin:0;font-size:14px;color:#7a7975;line-height:1.5;">Hallo ${esc(creatorName)}, hier sind deine Ergebnisse im Überblick.</p>
</td></tr>

${highlight}
${teilFehler}

<tr><td style="padding:0 8px;">${sectionsHtml}</td></tr>

<tr><td style="padding:6px 8px 20px;text-align:center;">
<a href="${APP_LINK}" style="display:inline-block;padding:13px 26px;background:#111110;border-radius:10px;font-size:13px;font-weight:600;color:#ffffff;text-decoration:none;">Volle Auswertung ansehen</a>
</td></tr>

<tr><td style="padding:0 8px 24px;text-align:center;">
<p style="margin:0;font-size:12px;color:#7a7975;line-height:1.6;">Deine Zahlen kannst du direkt in dein <a href="${MEDIAKIT_LINK}" style="color:#111110;font-weight:600;text-decoration:underline;">Media Kit</a> übernehmen.</p>
</td></tr>

<tr><td style="padding:16px 8px 0;border-top:1px solid #e4e4e2;">
<p style="margin:0 0 6px;font-size:11px;color:#a8a6a3;line-height:1.6;">Diese E-Mail wurde von <a href="https://viuno.de" style="color:#7a7975;text-decoration:underline;font-weight:600;">viuno</a> gesendet, weil du eine Analyse in Auftrag gegeben hast. Fragen: office@viuno.de</p>
<p style="margin:0;font-size:11px;color:#a8a6a3;"><a href="${LEGAL}#impressum" style="color:#a8a6a3;text-decoration:underline;">Impressum</a> &middot; <a href="${LEGAL}#datenschutz" style="color:#a8a6a3;text-decoration:underline;">Datenschutz</a></p>
</td></tr>

</table>
</td></tr>
</table>
</body></html>`

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM_NAME + ' <' + FROM_EMAIL + '>',
        reply_to: REPLY_TO,
        to: [toEmail],
        subject,
        html
      })
    })
    if (!resendRes.ok) { const err = await resendRes.text(); throw new Error('Resend: ' + err) }

    return new Response(JSON.stringify({ success: true, sent_to: toEmail, platforms, subject }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
    })
  } catch (err: any) {
    console.error('send-analysis-email error:', err.message)
    try { await supabase.rpc('log_error', { function_name: 'send-analysis-email', error_message: err.message }) } catch (_) {}
    return new Response(JSON.stringify({ success: false, error: err.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
  }
})
