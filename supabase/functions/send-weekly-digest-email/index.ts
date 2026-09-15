import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || ''
const FROM_EMAIL = 'noreply@viuno.de'
const FROM_NAME = 'viuno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

function esc(s: string) { return String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' } as any)[c]) }

/**
 * Wiederholt eine Supabase-Abfrage. Am 14.09. scheiterte der erste echte
 * Versand an einem "Gateway Timeout" beim Laden von drei Abonnenten - ein
 * voruebergehender Fehler, der ohne Wiederholung die ganze Wochenmail
 * gekostet hat.
 */
async function mitWiederholung<T>(
  was: string,
  abfrage: () => Promise<{ data: T | null; error: any }>,
  versuche = 3,
): Promise<T | null> {
  let letzterFehler: any = null
  for (let versuch = 1; versuch <= versuche; versuch++) {
    const { data, error } = await abfrage()
    if (!error) return data
    letzterFehler = error
    if (versuch < versuche) await new Promise((r) => setTimeout(r, 1500 * versuch))
  }
  throw new Error(`${was} fehlgeschlagen nach ${versuche} Versuchen: ${letzterFehler?.message ?? 'unbekannt'}`)
}

/* Der Abmelde-Link traegt den Token der newsletter_subscribers-Zeile.
   Hier stand ein HMAC ueber die user_id — digest-unsubscribe wurde laengst auf
   den Zeilen-Token umgestellt und weist alles andere als 'invalid' ab. Jeder
   Klick auf "Abmelden" lief damit ins Leere, und Abonnenten ohne Konto hatten
   ohnehin keine user_id. */
function unsubUrlFuer(token: string): string {
  return `https://bzejndghppuipnedasuv.supabase.co/functions/v1/digest-unsubscribe?token=${token}`
}

// Montag der aktuellen ISO-Woche, als YYYY-MM-DD (identische Logik wie in generate-daily-digest)
function getWeekStart(d: Date): string {
  const day = d.getUTCDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  const monday = new Date(d)
  monday.setUTCDate(d.getUTCDate() + diffToMonday)
  return monday.toISOString().split('T')[0]
}

async function hasCompletedAnalysis(userId: string): Promise<boolean> {
  const { count } = await supabase
    .from('analysis_runs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'done')
  return (count ?? 0) > 0
}

const PLATFORM_BADGE: Record<string, { bg: string; color: string }> = {
  instagram: { bg: '#fce4ec', color: '#880e4f' },
  tiktok: { bg: '#f0f0f0', color: '#111110' },
  youtube: { bg: '#ffebee', color: '#b71c1c' },
  meta: { bg: '#e3f2fd', color: '#0d47a1' },
  allgemein: { bg: '#f0efed', color: '#7a7975' },
}

function badgeHtml(platform: string, label: string): string {
  const c = PLATFORM_BADGE[platform] || PLATFORM_BADGE.allgemein
  return `<span style="display:inline-block;font-size:10px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;padding:3px 10px;border-radius:99px;background:${c.bg};color:${c.color};">${esc(label || 'Allgemein')}</span>`
}

// Jede Karte fuehrt auf ihre eigene oeffentliche Seite, nicht mehr auf die
// Login-Wand unter /digest. ?s=mail landet in page_views und zeigt, ob die
// Mail ueberhaupt gelesen wird.
const UEBERSICHT_URL = 'https://viuno.de/news?s=mail'
const kartenUrl = (slug: string) => `https://viuno.de/news/${encodeURIComponent(slug)}?s=mail`

function leseLink(slug: string): string {
  return `<a href="${esc(kartenUrl(slug))}" style="display:inline-block;margin-top:12px;font-size:12px;font-weight:600;color:#111110;text-decoration:none;border-bottom:1px solid #111110;">Mehr lesen &rarr;</a>`
}

/** Aufmacher: groesser gesetzt, aber ohne Bild - siehe Kommentar in buildEmailHtml. */
function topStoryHtml(c: any): string {
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border:1px solid #e4e4e2;border-radius:12px;margin-bottom:20px;overflow:hidden;">
  <tr><td style="padding:18px 18px 16px;">
    <div style="margin-bottom:10px;">${badgeHtml(c.platform, c.platform_label)}</div>
    <a href="${esc(kartenUrl(c.slug))}" style="text-decoration:none;"><p style="margin:0 0 8px;font-size:17px;font-weight:700;color:#111110;line-height:1.35;letter-spacing:-0.01em;">${esc(c.headline || '')}</p></a>
    <p style="margin:0;font-size:13px;color:#7a7975;line-height:1.6;">${esc(c.summary || '')}</p>
    ${leseLink(c.slug)}
  </td></tr>
  </table>`
}

function cardHtml(c: any): string {
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border:1px solid #e4e4e2;border-radius:12px;margin-bottom:10px;">
  <tr><td style="padding:14px 16px;">
    <div style="margin-bottom:8px;">${badgeHtml(c.platform, c.platform_label)}</div>
    <a href="${esc(kartenUrl(c.slug))}" style="text-decoration:none;"><p style="margin:0 0 6px;font-size:14px;font-weight:700;color:#111110;line-height:1.35;">${esc(c.headline || '')}</p></a>
    <p style="margin:0;font-size:13px;color:#7a7975;line-height:1.55;">${esc(c.summary || '')}</p>
    ${leseLink(c.slug)}
  </td></tr>
  </table>`
}

function secondaryCtaHtml(hasAnalysis: boolean): string {
  if (!hasAnalysis) {
    return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border:1px solid #e4e4e2;border-radius:12px;margin-bottom:10px;">
    <tr><td style="padding:16px 18px;text-align:center;">
      <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#111110;">📊 Noch keine Analyse gemacht?</p>
      <p style="margin:0 0 12px;font-size:12px;color:#7a7975;line-height:1.5;">Finde in wenigen Minuten heraus, wie deine Instagram- und TikTok-Postings wirklich performen.</p>
      <a href="https://viuno.de/analytics" style="display:inline-block;padding:9px 18px;background:#111110;border-radius:8px;font-size:12px;font-weight:600;color:#ffffff;text-decoration:none;">Jetzt analysieren</a>
    </td></tr>
    </table>`
  }
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border:1px solid #e4e4e2;border-radius:12px;margin-bottom:10px;">
  <tr><td style="padding:16px 18px;text-align:center;">
    <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#111110;">🔄 Zahlen aktuell halten</p>
    <p style="margin:0 0 12px;font-size:12px;color:#7a7975;line-height:1.5;">Nach deiner letzten Analyse kannst du dein Media Kit mit einem Klick updaten.</p>
    <a href="https://viuno.de/mediakit" style="display:inline-block;padding:9px 18px;background:#111110;border-radius:8px;font-size:12px;font-weight:600;color:#ffffff;text-decoration:none;">Zum Media Kit</a>
  </td></tr>
  </table>`
}

/**
 * Die Karten kommen bereits nach relevance_score sortiert aus der View,
 * karten[0] ist also der Aufmacher.
 *
 * Ohne Bilder: die Stockfotos lagen bei rund 1 MB pro Stueck und sagten
 * nichts ueber die Meldung aus. Die oeffentliche Seite hatte sie aus
 * demselben Grund nie.
 */
function buildEmailHtml(creatorName: string, karten: any[], unsubUrl: string, hasAnalysis: boolean): string {
  const rest = karten.slice(1).map(cardHtml).join('')

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Creator News der Woche</title>
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

<tr><td style="padding:0 8px 6px;">
<h1 style="margin:0 0 4px;font-size:21px;font-weight:700;color:#111110;letter-spacing:-0.03em;">Deine Creator News der Woche</h1>
<p style="margin:0 0 20px;font-size:14px;color:#7a7975;line-height:1.6;">Hallo ${esc(creatorName)}, ${karten.length === 1 ? 'diese Meldung ist' : `diese ${karten.length} Meldungen sind`} in dieser Woche wirklich wichtig für dich.</p>
</td></tr>

<tr><td style="padding:0 8px;">${topStoryHtml(karten[0])}</td></tr>
${rest ? `<tr><td style="padding:0 8px;">${rest}</td></tr>` : ''}

<tr><td style="padding:6px 8px 20px;text-align:center;">
<a href="${UEBERSICHT_URL}" style="display:inline-block;padding:13px 26px;background:#111110;border-radius:10px;font-size:13px;font-weight:600;color:#ffffff;text-decoration:none;">Alle News ansehen</a>
</td></tr>

<tr><td style="padding:0 8px 8px;">${secondaryCtaHtml(hasAnalysis)}</td></tr>

<tr><td style="padding:16px 8px 0;border-top:1px solid #e4e4e2;">
<p style="margin:0 0 6px;font-size:11px;color:#a8a6a3;line-height:1.6;">Diese E-Mail wurde von <a href="https://viuno.de" style="color:#7a7975;text-decoration:underline;font-weight:600;">viuno</a> gesendet, weil du Creator News per E-Mail abonniert hast.</p>
<p style="margin:0;font-size:11px;color:#a8a6a3;"><a href="${esc(unsubUrl)}" style="color:#a8a6a3;text-decoration:underline;">Abmelden</a> &middot; <a href="https://viuno.de/legal/#impressum" style="color:#a8a6a3;text-decoration:underline;">Impressum</a> &middot; <a href="https://viuno.de/legal/#datenschutz" style="color:#a8a6a3;text-decoration:underline;">Datenschutz</a></p>
</td></tr>

</table>
</td></tr>
</table>
</body></html>`
}

/* Wer darf diese Function aufrufen?
   - Interne Aufrufe (Dashboard-Test, digest_waechter, Nachzuegler) schicken den Service-Role-Key als Bearer.
   - pg_cron schickt den Schluessel "cron_schluessel" aus dem Supabase-Vault im
     Header x-schluessel; die Function prueft ihn ueber die RPC schluessel_pruefen,
     die nur der Service Role ausfuehren darf. Der Wert steht damit nirgends im
     Quelltext und in keiner URL. (Launch-Check 15.09.2026: der fruehere Token
     im Code lag im Repo und gilt als kompromittiert.) */
async function darfLaufen(req: Request): Promise<boolean> {
  const kopf = req.headers.get('Authorization') || ''
  const bearer = kopf.startsWith('Bearer ') ? kopf.slice(7) : kopf
  const sr = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  if (sr && bearer === sr) return true
  const wert = req.headers.get('x-schluessel') || ''
  if (!wert) return false
  const { data } = await supabase.rpc('schluessel_pruefen', { p_zweck: 'cron_schluessel', p_wert: wert })
  return data === true
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (!(await darfLaufen(req))) return new Response(JSON.stringify({ error: 'nicht_erlaubt' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  try {
    const body = await req.json().catch(() => ({}))
    const testUid: string | null = body?.test_uid || null

    const weekStart = getWeekStart(new Date())

    // Die Karten kommen aus derselben View wie die oeffentliche Seite. Damit
    // stammen die Slugs in den Maillinks garantiert aus derselben Quelle und
    // koennen nicht auseinanderlaufen.
    const karten = await mitWiederholung<any[]>('Digest laden', () =>
      supabase
        .from('digest_cards_today')
        .select('slug, headline, summary, platform, platform_label, relevance_score, date')
        .order('relevance_score', { ascending: false }) as any
    )

    if (!karten || karten.length === 0) {
      return new Response(JSON.stringify({ success: true, skipped: true, reason: 'Noch kein Digest vorhanden' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
      })
    }

    // Die View liefert immer die juengste Ausgabe. Ist die aelter als diese
    // Woche, hat der Montagslauf nicht geliefert - dann lieber nichts
    // verschicken als die Vorwoche als "Neuigkeiten dieser Woche" zu verkaufen.
    if (karten[0].date !== weekStart && !testUid) {
      const grund = `Juengste Ausgabe ist vom ${karten[0].date}, erwartet war ${weekStart} - kein Versand.`
      try { await supabase.rpc('log_error', { function_name: 'send-weekly-digest-email', error_message: grund }) } catch (_) {}
      return new Response(JSON.stringify({ success: true, skipped: true, reason: grund }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
      })
    }

    // Die staerkste Schlagzeile in den Betreff: "Deine Creator News der Woche"
    // sagt nicht, warum man die Mail jetzt oeffnen sollte.
    const betreff = `Creator News: ${karten[0].headline}`

    // TEST-MODUS: nur an eine bestimmte User-ID senden, ohne Abonnenten-Filter,
    // ohne die "schon verschickt"-Pruefung und ohne den echten Versand-Log zu beschreiben.
    if (testUid) {
      const { data: sub, error: subErr } = await supabase
        .from('users')
        .select('id, email, contact_email, display_name, full_name')
        .eq('id', testUid)
        .single()
      if (subErr || !sub) throw new Error('Test-User nicht gefunden')
      const toEmail = sub.contact_email || sub.email
      if (!toEmail) throw new Error('Test-User hat keine E-Mail-Adresse')

      const creatorName = sub.display_name || sub.full_name || 'Creator'
      const { data: nlZeile } = await supabase
        .from('newsletter_subscribers').select('token').eq('user_id', sub.id).maybeSingle()
      const unsubUrl = unsubUrlFuer(nlZeile?.token || 'test')
      const hasAnalysis = await hasCompletedAnalysis(sub.id)
      const html = buildEmailHtml(creatorName, karten, unsubUrl, hasAnalysis)

      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + RESEND_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: FROM_NAME + ' <' + FROM_EMAIL + '>',
          to: [toEmail],
          subject: '[TEST] ' + betreff,
          html
        })
      })
      if (!resendRes.ok) { const err = await resendRes.text(); throw new Error('Resend: ' + err) }

      return new Response(JSON.stringify({ success: true, test: true, sent_to: toEmail, cards: karten.length, has_analysis: hasAnalysis }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
      })
    }

    /* Empfaenger sind die bestaetigten Eintraege der Newsletter-Tabelle, nicht
       die Konten. Vorher las diese Stelle users mit newsletter_subscribed=true
       — wer sich ohne Konto auf der oeffentlichen Seite angemeldet und
       bestaetigt hatte, stand nirgends in users und bekam deshalb nie eine
       Mail. Die Doppel-Opt-in-Strecke sammelte Adressen, an die niemand
       geschrieben hat. */
    const subscribers = await mitWiederholung<any[]>('Abonnenten laden', () =>
      supabase
        .from('newsletter_subscribers')
        .select('id, email, user_id, token')
        .eq('status', 'active') as any
    )

    /* Namen fuer die Anrede nur fuer die, die ein Konto haben. */
    const kontoIds = (subscribers || []).map((s: any) => s.user_id).filter(Boolean)
    const namen: Record<string, string> = {}
    if (kontoIds.length) {
      const { data: konten } = await supabase
        .from('users').select('id, display_name, full_name').in('id', kontoIds)
      for (const k of konten || []) namen[k.id] = k.display_name || k.full_name || 'Creator'
    }

    let sent = 0, skipped = 0, failed = 0
    const errors: string[] = []

    for (const sub of subscribers || []) {
      const toEmail = sub.email
      if (!toEmail || !sub.token) { skipped++; continue }

      const { data: already } = await supabase
        .from('digest_email_log')
        .select('id')
        .eq('subscriber_id', sub.id)
        .eq('week_start', weekStart)
        .maybeSingle()
      if (already) { skipped++; continue }

      const creatorName = sub.user_id ? (namen[sub.user_id] || 'Creator') : 'Creator'
      const unsubUrl = unsubUrlFuer(sub.token)
      /* Der Produkt-Hinweis am Ende der Mail passt nur zu jemandem mit Konto. */
      const hasAnalysis = sub.user_id ? await hasCompletedAnalysis(sub.user_id) : true
      const html = buildEmailHtml(creatorName, karten, unsubUrl, hasAnalysis)

      try {
        const resendRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + RESEND_API_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: FROM_NAME + ' <' + FROM_EMAIL + '>',
            to: [toEmail],
            subject: betreff,
            html
          })
        })
        if (!resendRes.ok) {
          const err = await resendRes.text()
          failed++
          errors.push(sub.id + ': ' + err)
          continue
        }
        await supabase.from('digest_email_log').insert({ subscriber_id: sub.id, user_id: sub.user_id ?? null, week_start: weekStart })
        sent++
      } catch (e: any) {
        failed++
        errors.push(sub.id + ': ' + e.message)
      }

      await new Promise(r => setTimeout(r, 550))
    }

    if (failed > 0) {
      try { await supabase.rpc('log_error', { function_name: 'send-weekly-digest-email', error_message: `Woche ${weekStart}: ${failed} Mails fehlgeschlagen: ${errors.slice(0, 5).join(' | ')}` }) } catch (_) {}
    }

    return new Response(JSON.stringify({ success: true, week_start: weekStart, cards: karten.length, sent, skipped, failed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
    })
  } catch (err: any) {
    console.error('send-weekly-digest-email error:', err.message)
    try { await supabase.rpc('log_error', { function_name: 'send-weekly-digest-email', error_message: err.message }) } catch (_) {}
    return new Response(JSON.stringify({ success: false, error: err.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
  }
})
