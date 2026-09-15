import { supabase, KI_MODELL, PLATFORM_LABEL, deZahl, deDatum, logAIUsage } from './basis.ts'
import { tonName, computeStats } from './daten.ts'
import { befunde, bez } from './befunde.ts'

/* Punkt 1: Das Modell hat schon einmal ein JSON mit nur zwei Schluesseln geliefert.
   JSON.parse war erfolgreich, alle fehlenden Felder wurden ueber "?? null" still zu
   NULL -- und der Kauf wurde trotzdem verbraucht. Der Kunde hat 9,99 EUR fuer 2 von
   9 Abschnitten bezahlt. Diese Felder muessen da sein, sonst gilt der Lauf als
   gescheitert und die Freischaltung bleibt erhalten. */
const PFLICHTFELDER = [
  'kernaussage',
  'einordnung',
  'was_gut_lief',
  'verbesserungspotenzial',
  'reichweite_resonanz',
  'top_posts_gemeinsamkeiten',
  'caption_struktur',
  'weglassen',
  'tipps_zukunft'
]

function fehlendeFelder(parsed: any): string[] {
  if (!parsed || typeof parsed !== 'object') return [...PFLICHTFELDER]
  return PFLICHTFELDER.filter(f => {
    const v = parsed[f]
    if (f === 'tipps_zukunft') return !Array.isArray(v) || v.length < 5
    if (f === 'kernaussage') return typeof v !== 'string' || v.trim().length < 15
    return typeof v !== 'string' || v.trim().length < 80
  })
}

async function callKiJSON(prompt: string, maxTokens = 8000): Promise<{ text: string; tokensInput: number; tokensOutput: number; success: boolean }> {
  const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY') || ''
  if (!ANTHROPIC_KEY) return { text: '', tokensInput: 0, tokensOutput: 0, success: false }
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: KI_MODELL, max_tokens: maxTokens,
        // Alle Zahlen stehen fertig im Prompt -- das Modell soll formulieren, nicht rechnen.
        output_config: { effort: 'low' },
        messages: [{ role: 'user', content: prompt + '\n\nANTWORTE NUR MIT VALIDEM JSON. Kein Text davor oder danach. Kein Markdown.' }],
        system: 'Du antwortest ausschliesslich mit validem JSON. Kein Text vor oder nach dem JSON-Objekt.'
      })
    })
    if (!res.ok) { console.error('KI error:', res.status, await res.text()); return { text: '', tokensInput: 0, tokensOutput: 0, success: false } }
    const json = await res.json()
    // Bei Modellen mit Denkschritt ist content[0] nicht zwingend der Text.
    const raw = (json.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('')
    const text = raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim()
    return { text, tokensInput: json.usage?.input_tokens ?? 0, tokensOutput: json.usage?.output_tokens ?? 0, success: text.length > 0 }
  } catch (e: any) { console.error('KI exception:', e.message); return { text: '', tokensInput: 0, tokensOutput: 0, success: false } }
}

/* Eine Zeile je Beitrag, alles fertig gerechnet und in deutscher Schreibweise.
   Frueher ging das rohe JSON in den Prompt und das Modell rechnete selbst -- daher
   Saetze wie "515 Likes mit 200 Comments", obwohl es drei Kommentare waren. */
function postZeile(p: any): string {
  const t = tonName(p)
  const teile = [
    bez(p),
    `${deZahl(p.likes)} Likes`,
    `${deZahl(p.comments)} Kommentare`,
    p.views > 0 ? `${deZahl(p.views)} Aufrufe` : 'keine Aufrufe ausgewiesen'
  ]
  if (p.views > 0) {
    const res = (p.likes ?? 0) / p.views * 1000
    const kom = (p.comments ?? 0) / p.views * 1000
    teile.push(`Resonanz: ${deZahl(res, 1)} Likes je 1.000 Aufrufe`)
    teile.push(`Kommentarrate: ${deZahl(kom, 1)} Kommentare je 1.000 Aufrufe`)
  }
  if (p.media_type) teile.push(String(p.media_type))
  if (p.duration_seconds > 0) teile.push(`${deZahl(p.duration_seconds, 0)} Sekunden`)
  if (t.name) teile.push(`Ton: ${t.name}${t.eigen ? ' (eigener Ton)' : ''}`)
  const caption = p.caption ? String(p.caption).replace(/\s+/g, ' ').slice(0, 280) : '(keine Caption)'
  return `${teile.join(' | ')}\nCaption: ${caption}`
}

/* Probelauf: baut Kennzahlen und Prompt aus einem fertigen Lauf neu auf, ohne etwas
   zu schreiben und ohne das Modell zu rufen. Token-geschuetzt, nur lesend. Dient dazu,
   Rechenfehler vor dem Livegang zu sehen statt im bezahlten Lauf. */
export async function probelauf(analysisRunId: string): Promise<any> {
  const { data: st0 } = await supabase.from('analyse_stats').select('*').eq('analysis_run_id', analysisRunId).maybeSingle()
  if (!st0) throw new Error('Keine Stats zu diesem Lauf')
  const platform = st0.platform as 'instagram' | 'tiktok'
  const { data: posts } = await supabase.from('apify_daten')
    .select('platform, posted_at, caption, likes, comments, shares, views, media_type, duration_seconds, hashtags, mentions, post_url, raw_data')
    .eq('analysis_run_id', analysisRunId).eq('platform', platform)
  if (!posts?.length) throw new Error('Keine Beitraege')
  const neu = computeStats(posts)
  const { data: u } = await supabase.from('users').select('niche_custom, niche_category').eq('id', st0.user_id).maybeSingle()
  const prompt = await runKiForPlatform(st0.user_id, analysisRunId, platform,
    u?.niche_custom || u?.niche_category || '', { ...st0, ...neu })
  return {
    plattform: platform, beitraege: posts.length,
    resonanz: {
      schnitt: neu.resonanz_schnitt, kommentarrate: neu.kommentarrate_schnitt,
      top: neu.resonanz_top, flop: neu.resonanz_flop,
      ausreisser: neu.ausreisser, eigener_ton: neu.eigener_ton, sounds: neu.sound_stats
    },
    post_resonanz: neu.post_resonanz,
    prompt
  }
}

export async function runKiForPlatform(userId: string, analysisRunId: string, platform: 'instagram' | 'tiktok', niche: string, nurPrompt?: any): Promise<any> {
  const { data: currentPosts, error: currentErr } = await supabase
    .from('apify_daten')
    .select('platform, posted_at, caption, likes, comments, shares, views, media_type, duration_seconds, hashtags, post_url, raw_data')
    .eq('analysis_run_id', analysisRunId).eq('platform', platform)
    .order('likes', { ascending: false })
  if (currentErr) throw new Error(`[${platform}] Posts laden fehlgeschlagen: ${currentErr.message}`)
  if (!currentPosts || currentPosts.length === 0) return false

  const { data: statsRow } = await supabase
    .from('analyse_stats').select('*').eq('analysis_run_id', analysisRunId).eq('platform', platform).maybeSingle()
  const currentStats = nurPrompt ?? statsRow

  /* B4: Ein Vergleich mit dem Vorlauf ist nur zulaessig, wenn derselbe Account
     gemessen wurde. Bei gewechseltem Handle stehen in *_prev/*_change bereits NULL
     -- der Prompt darf dann gar nicht erst vergleichen. */
  const handleChanged = currentStats?.handle_changed === true

  const { data: prevAnalysis } = await supabase
    .from('analyse_ki')
    .select('analysis_run_id, was_gut_lief, verbesserungspotenzial, tipps_zukunft, created_at')
    .eq('user_id', userId).eq('platform', platform).neq('analysis_run_id', analysisRunId)
    .order('created_at', { ascending: false }).limit(1).maybeSingle()

  let prevStats: any = null
  if (!handleChanged && prevAnalysis?.analysis_run_id) {
    const { data: ps } = await supabase
      .from('analyse_stats').select('*').eq('analysis_run_id', prevAnalysis.analysis_run_id).eq('platform', platform).maybeSingle()
    prevStats = ps
  }

  const platformLabel = PLATFORM_LABEL[platform]
  const hasHistory = !handleChanged && (prevAnalysis !== null || prevStats !== null)
  const st: any = currentStats ?? {}

  /* Alle Kennzahlen stehen hier fertig gerechnet und in deutscher Schreibweise.
     Vorher ging das rohe Post-JSON in den Prompt -- das Modell rechnete selbst und
     lag dabei falsch. Ab jetzt gilt: kein Wert im Text, der nicht hier steht. */
  const kennzahlen = [
    `Kanal: @${st.username ?? '?'}${st.verified ? ' (verifiziert)' : ''}`,
    `Follower: ${deZahl(st.followers)}${st.followers_change !== null && st.followers_change !== undefined ? ` (${st.followers_change >= 0 ? 'plus ' : 'minus '}${deZahl(Math.abs(st.followers_change))} seit der letzten Analyse)` : ''}`,
    `Ausgewertete Beiträge: ${deZahl(currentPosts.length)}`,
    `Durchschnittliche Likes: ${deZahl(st.avg_likes, 0)}`,
    `Durchschnittliche Kommentare: ${deZahl(st.avg_comments, 0)}`,
    st.avg_views ? `Durchschnittliche Aufrufe: ${deZahl(st.avg_views, 0)}` : null,
    st.avg_shares ? `Durchschnittlich geteilt: ${deZahl(st.avg_shares, 0)} mal` : null,
    st.resonanz_schnitt !== null && st.resonanz_schnitt !== undefined
      ? `Resonanz im Schnitt: ${deZahl(st.resonanz_schnitt, 1)} Likes je 1.000 Aufrufe` : null,
    st.kommentarrate_schnitt !== null && st.kommentarrate_schnitt !== undefined
      ? `Kommentarrate im Schnitt: ${deZahl(st.kommentarrate_schnitt, 1)} Kommentare je 1.000 Aufrufe` : null,
    st.resonanz_top !== null && st.resonanz_top !== undefined
      ? `Die stärksten Beiträge: ${deZahl(st.resonanz_top, 1)} Likes je 1.000 Aufrufe` : null,
    st.resonanz_flop !== null && st.resonanz_flop !== undefined
      ? `Die schwächsten Beiträge: ${deZahl(st.resonanz_flop, 1)} Likes je 1.000 Aufrufe` : null,
    st.ausreisser
      ? `Viel Reichweite, wenig Resonanz: Beitrag vom ${deDatum(st.ausreisser.datum)} mit ${deZahl(st.ausreisser.views)} Aufrufen und einer Resonanz von ${deZahl(st.ausreisser.resonanz, 1)}` : null,
    /* "Engagement je Aufruf" stand hier frueher daneben. Es ist gewichtet gerechnet,
       die Resonanz ungewichtet -- bei einem Kanal ergab das 5,74 Prozent neben 75,3
       je 1.000 Aufrufen, also 7,5 Prozent. Zwei Zahlen fuer dieselbe Sache, die sich
       widersprechen. Resonanz und Kommentarrate sagen es praeziser. */
    `Engagement je Follower: ${deZahl(st.engagement_rate, 2)} Prozent (Likes plus Kommentare, geteilt durch die Followerzahl)`,
    st.best_posting_day && st.best_posting_hour !== null && st.best_posting_hour !== undefined
      ? `Beste Zeit: ${st.best_posting_day} gegen ${st.best_posting_hour} Uhr Berliner Zeit, gerechnet über ${deZahl(st.best_time_sample)} Beiträge${(st.best_time_sample ?? 0) < 20 ? ' — das ist eine Tendenz, keine Regel' : ''}` : null,
    st.posts_per_week !== null && st.posts_per_week !== undefined
      ? `Veröffentlichungen: ${deZahl(st.posts_per_week, 1)} pro Woche`
      : `Veröffentlichungs-Häufigkeit: liegt nicht belastbar vor — mache dazu KEINE Aussage`,
    `Likes-Spanne: ${deZahl(st.min_likes)} bis ${deZahl(st.max_likes)}`,
    Array.isArray(st.format_stats) && st.format_stats.length > 1
      ? `Formate: ${st.format_stats.map((f: any) => `${f.typ} (${deZahl(f.n)} mal, im Schnitt ${deZahl(f.avg_likes)} Likes${f.avg_views ? `, ${deZahl(f.avg_views)} Aufrufe` : ''})`).join(' | ')}` : null,
    Array.isArray(st.duration_stats) && st.duration_stats.length > 1
      ? `Videolänge gegen Aufrufe: ${st.duration_stats.map((d: any) => `${d.bucket} (${deZahl(d.n)} mal, im Schnitt ${deZahl(d.avg_views)} Aufrufe)`).join(' | ')}` : null
  ].filter(Boolean).join('\n')

  /* Töne: bei einem Testkanal brachte derselbe Ton einmal 40,1 und einmal 6,2
     Resonanz. Genau dieser Befund entwertet den verbreiteten Rat "nimm den richtigen
     Sound" -- und er steht nur in den Rohdaten, in keiner Kennzahl. */
  const sounds = Array.isArray(st.sound_stats) ? st.sound_stats : []
  const eigen = st.eigener_ton
  const soundBlock = sounds.length > 0
    ? `\n\nTÖNE, DIE MEHRFACH VORKOMMEN\n` +
      sounds.map((x: any) => `"${x.sound}": ${deZahl(x.n)} mal verwendet, Resonanz ${x.werte.map((w: number) => deZahl(w, 1)).join(' und ')} — Unterschied Faktor ${deZahl(x.faktor, 1)}`).join('\n') +
      (eigen ? `\nMit eigenem Ton statt fremdem: ${deZahl(eigen.mit)} von ${deZahl(eigen.gesamt)} Beiträgen.` : '')
    : (eigen && eigen.gesamt > 0
        ? `\n\nTÖNE: Kein fremder Ton kommt mehrfach vor. Mit eigenem Ton: ${deZahl(eigen.mit)} von ${deZahl(eigen.gesamt)} Beiträgen. Mache KEINE Aussage darüber, welcher Ton besser wirkt.`
        : `\n\nTÖNE: Zu den Tönen liegen keine Daten vor. Mache KEINE Aussage dazu.`)

  const beitraege = [...currentPosts]
    .sort((a: any, b: any) => new Date(a.posted_at ?? 0).getTime() - new Date(b.posted_at ?? 0).getTime())
    .map(postZeile).join('\n\n')

  /* Ranglisten und Zusammenhaenge kommen fertig aus Code. Der einzige echte Fehler
     in der geprueften Auswertung war eine selbstgebaute Rangliste. */
  const bf = befunde(currentPosts, st)
  const ranglistenBlock = bf.ranglisten.length
    ? `\n\n=== RANGLISTEN (fertig sortiert, bilde KEINE eigenen) ===\n${bf.ranglisten.join('\n')}` : ''
  const befundeBlock = bf.befunde.length
    ? `\n\n=== BEREITS BERECHNETE ZUSAMMENHÄNGE ===\n${bf.befunde.map(x => '- ' + x).join('\n')}` : ''

  let historyBlock: string
  if (handleChanged) {
    historyBlock = `\n\n=== HANDLE GEWECHSELT, KEIN VERGLEICH MÖGLICH ===\n` +
      `Der Kanal hieß beim letzten Lauf @${st.previous_username ?? '?'} und heißt jetzt @${st.username ?? '?'}.\n` +
      `Die Zahlen beider Läufe gehören zu verschiedenen Profilen und sind nicht vergleichbar.\n` +
      `Schreibe in "vergleich_vorherige" genau einen Satz: dass der Name gewechselt hat und der Vergleich erst ab der nächsten Analyse wieder möglich ist.\n` +
      `Erfinde KEINE Wachstums- oder Einbruchszahlen und deute den Wechsel NICHT als Sperre oder Strafe.`
  } else if (hasHistory) {
    historyBlock = `\n\n=== STAND DER LETZTEN ANALYSE ===\n` +
      (prevStats ? `Damals: ${deZahl(prevStats.followers)} Follower, ${deZahl(prevStats.avg_likes, 0)} Likes im Schnitt, ${deZahl(prevStats.avg_comments, 0)} Kommentare im Schnitt, Engagement je Follower ${deZahl(prevStats.engagement_rate, 2)} Prozent\n` : '') +
      (prevAnalysis?.tipps_zukunft ? `Das haben wir letztes Mal geraten: ${JSON.stringify(prevAnalysis.tipps_zukunft)}\n` : '') +
      `\nNutze das für "vergleich_vorherige". Vergleiche nur diese Zahlen. Du siehst die alten Beiträge nicht, spekuliere nicht über sie.`
  } else {
    historyBlock = `\n\n=== KEINE VORHERIGE ANALYSE ===\nDies ist die erste Auswertung dieses Kanals. Lasse "vergleich_vorherige" leer.`
  }

  const vergleichHinweis = handleChanged
    ? 'Genau ein Satz: Name wurde gewechselt, Vergleich erst ab der nächsten Analyse möglich. Keine Zahlen.'
    : hasHistory
      ? '1 bis 2 Absätze. Nur die oben genannten Zahlen vergleichen. Wurden die alten Ratschläge umgesetzt?'
      : 'Leerer String.'

  const prompt = `Du schreibst die Auswertung eines ${platformLabel}-Kanals für den Creator selbst${niche ? `, Bereich "${niche}"` : ''}.
Er hat dafür bezahlt. Er will lesen, was er selbst nicht sieht — nicht seine eigenen Zahlen vorgelesen bekommen.

SO SCHREIBST DU
- Deutsch mit allen Umlauten und ß. Schreibe "Beiträge", nicht "Beitraege". Schreibe "größer", nicht "groesser".
- Du-Form, ganze Sätze. Wechsle die Satzlänge: kurze Sätze neben längeren.
- Beginne Absätze unterschiedlich. Nicht dreimal hintereinander mit einem Substantiv.
- Jeder Absatz sagt EINE Sache. Keine Wiederholung zwischen den Feldern.
- Schreibe so, wie ein Mensch einem anderen etwas erklärt. Ruhig, direkt, ohne Werbeton.

VERBOTEN
- Englische oder halbenglische Wortschöpfungen. Kein "Winner", "Sweet-Spot", "Framing", "Performance", "Hook", "publishen", "Growth". Gibt es ein deutsches Wort, nimm das deutsche Wort. ("Likes", "Kommentare", "Follower", "Reels" sind in Ordnung, das sind die Namen der Sache.)
- Abkürzungen wie "ER". Schreibe "Likes je 1.000 Aufrufe".
- Ausrufezeichen, Emojis, Zwischenüberschriften, Aufzählungszeichen, Markdown.
- Floskeln wie "massiv", "enorm", "explosiv", "bemerkenswert", "Das zeigt deutlich", "Spannend ist".
- Aussagen über Bilder oder Videoinhalte. Du siehst nur Text und Zahlen, keine Bilder.
- Ratschläge zu Hashtags. Hashtags sind kein Reichweitenfaktor mehr.
- Der Satz, ein Beitrag habe "keine Aufrufe". Bei Karussells und Bildern weist ${platformLabel} keine Aufrufe aus, das ist normal und sagt nichts über den Beitrag. Beurteile diese nur nach Likes und Kommentaren.

ZAHLEN, WICHTIGSTE REGEL
Rechne NICHTS selbst aus. Verwende ausschließlich Zahlen, die unten stehen, und schreibe sie
GENAU so ab, wie sie dastehen: 12.921 (nicht 12921), 25,7 (nicht 25.7), das 6,5-Fache.
Übernimm auch die Einheit unverändert. Steht dort "je 1.000 Aufrufe", schreibe "je 1.000 Aufrufe"
und nicht "je 100". Fehlt dir eine Zahl, um etwas zu sagen, dann sage es nicht.
Auch Verhältnisse sind Rechnen: "das Doppelte", "das Sechsundzwanzigfache", "rund die Hälfte",
"50 Prozent mehr" darfst du nur schreiben, wenn der Faktor oben ausdrücklich dasteht.
Erfundene oder selbst umgerechnete Zahlen sind der schlimmste Fehler, den du machen kannst.

RANGFOLGEN
Bilde KEINE eigenen Ranglisten. Wörter wie "der stärkste", "die drei reichweitenstärksten",
"der zweitbeste" darfst du nur verwenden, wenn genau diese Beiträge so in den Ranglisten oben
stehen. Sortiere nicht selbst und zähle nicht selbst ab.

WIE DU BEITRÄGE BENENNST
Immer mit Datum UND Uhrzeit, also "der Beitrag vom 09.09. um 11:09". Nie nur mit dem Datum:
an einem Tag können mehrere Beiträge erschienen sein, und der Leser kann sie sonst nicht
auseinanderhalten. Schreibe die Uhrzeit genau so ab, wie sie in der Beitragsliste steht.

WAS "RESONANZ" BEDEUTET
Likes je 1.000 Aufrufe. Sie sagt, wie viele der Zuschauer reagiert haben. Viel Reichweite bei
niedriger Resonanz heißt: der Beitrag wurde weit ausgespielt, kam aber nicht an. Das ist der
Unterschied, den der Creator an seinen eigenen Zahlen nicht ablesen kann.

=== KENNZAHLEN ===
${kennzahlen}${soundBlock}${ranglistenBlock}${befundeBlock}

=== DIE EINZELNEN BEITRÄGE (ältester zuerst) ===
${beitraege}
${historyBlock}

Antworte als JSON, exakt diese Felder:
{
  "kernaussage": "Ein Satz, höchstens 12 Wörter. Die wichtigste Erkenntnis. Wird als Überschrift über der ganzen Auswertung gezeigt. Kein Doppelpunkt, kein Punkt am Ende.",
  "einordnung": "2 Absätze, getrennt durch \\n\\n. Wo der Kanal gerade steht.",
  "was_gut_lief": "2 Absätze. Welche Beiträge getragen haben und was sie verbindet.",
  "verbesserungspotenzial": "2 Absätze. Wo Wirkung verloren geht. Konkret, ohne Trost.",
  "reichweite_resonanz": "1 bis 2 Absätze. Wie weit Reichweite und Resonanz auseinanderliegen und was das für ihn heißt.",
  "top_posts_gemeinsamkeiten": "1 bis 2 Absätze. Was die stärksten Beiträge gemeinsam haben.",
  "caption_struktur": "1 bis 2 Absätze. Wie die Texte der starken Beiträge gebaut sind, im Vergleich zu den schwachen.",
  "sound_befund": "1 Absatz zu den Tönen. Wenn oben steht, dass dazu keine Aussage möglich ist: leerer String.",
  "weglassen": "1 Absatz. Was weniger werden sollte, begründet mit den Zahlen von oben.",
  "tipps_zukunft": ["6 Sätze. Jeder nennt eine konkrete Handlung und den Grund aus den Daten. Keine Nummerierung im Text."],
  "top_posts": [{ "datum": "TT.MM. um HH:MM", "likes": 0, "warum_top": "höchstens 18 Wörter, begründet aus Text und Zahlen" }],
  "weitere_insights": "Ein Befund, der in keinem Feld oben vorkam. Wenn es keinen gibt: leerer String.",
  "vergleich_vorherige": "${vergleichHinweis}"
}

top_posts: genau die fünf aus der Rangliste "Die stärksten Beiträge nach Likes", in derselben Reihenfolge, mit Datum und Uhrzeit.
tipps_zukunft: genau 6 Einträge.`

  if (nurPrompt) return prompt

  /* Punkt 1: Ein Versuch, bei unvollstaendiger Antwort genau ein zweiter mit
     explizitem Hinweis auf die fehlenden Felder. Danach gilt der Lauf als
     gescheitert -- lieber kein Ergebnis und Geld zurueck als ein halbes. */
  let parsed: any = null
  let fehlt: string[] = [...PFLICHTFELDER]
  let tokensIn = 0, tokensOut = 0
  let versuche = 0

  for (let versuch = 1; versuch <= 2 && fehlt.length > 0; versuch++) {
    versuche = versuch
    const nachfassen = versuch === 1 ? '' :
      `\n\nACHTUNG: Deine letzte Antwort war unvollstaendig. Diese Felder fehlten oder waren zu kurz: ` +
      `${fehlt.join(', ')}. Gib das VOLLSTAENDIGE JSON mit ALLEN Feldern zurueck. ` +
      `"tipps_zukunft" braucht 6 Eintraege, jedes Textfeld mindestens zwei Saetze.`

    const result = await callKiJSON(prompt + nachfassen, 8000)
    tokensIn += result.tokensInput
    tokensOut += result.tokensOutput

    if (!result.success) { parsed = null; continue }
    try { parsed = JSON.parse(result.text) }
    catch (e: any) {
      console.error(`[${platform}] KI JSON parse error (Versuch ${versuch}):`, e.message, 'raw:', result.text.slice(0, 400))
      parsed = null
      continue
    }
    fehlt = fehlendeFelder(parsed)
    if (fehlt.length > 0) {
      console.warn(`[${platform}] Versuch ${versuch}: unvollstaendig, fehlt: ${fehlt.join(', ')}`)
    }
  }

  await logAIUsage({
    feature: 'analyse_v2_' + platform,
    tokensInput: tokensIn, tokensOutput: tokensOut,
    userId,
    metadata: { analysis_run_id: analysisRunId, platform, modell: KI_MODELL, has_history: hasHistory, handle_changed: handleChanged, post_count: currentPosts.length, versuche, fehlende_felder: fehlt }
  })

  if (!parsed) throw new Error(`[${platform}] KI-Analyse fehlgeschlagen`)
  if (fehlt.length > 0) {
    throw new Error(`[${platform}] Auswertung unvollstaendig (fehlt: ${fehlt.join(', ')})`)
  }

  const { error: insertErr } = await supabase.from('analyse_ki').insert({
    user_id: userId, analysis_run_id: analysisRunId, platform,
    modell: KI_MODELL,
    kernaussage: parsed.kernaussage ?? null,
    einordnung: parsed.einordnung ?? null,
    reichweite_resonanz: parsed.reichweite_resonanz ?? null,
    /* Leere Felder bekommen den berechneten Befund statt NULL -- besser eine
       korrekte Zeile aus Code als eine leere Box im Ergebnis. */
    sound_befund: parsed.sound_befund || bf.fallback.sound_befund || null,
    weglassen: parsed.weglassen ?? null,
    top_posts: parsed.top_posts ?? null,
    was_gut_lief: parsed.was_gut_lief ?? null,
    verbesserungspotenzial: parsed.verbesserungspotenzial ?? null,
    top_posts_gemeinsamkeiten: parsed.top_posts_gemeinsamkeiten ?? null,
    caption_struktur: parsed.caption_struktur ?? null,
    // Altes Feld: bleibt befuellt, solange irgendwo noch darauf gelesen wird.
    analyse_ueberblick: parsed.einordnung ?? null,
    tipps_zukunft: parsed.tipps_zukunft ?? null,
    weitere_insights: (parsed.weitere_insights && String(parsed.weitere_insights).trim())
      ? parsed.weitere_insights : (bf.fallback.weitere_insights ?? null),
    vergleich_vorherige: (hasHistory || handleChanged) ? (parsed.vergleich_vorherige ?? null) : null,
    raw_haiku_response: parsed
  })
  if (insertErr) throw new Error(`[${platform}] analyse_ki insert: ${insertErr.message}`)
  return true
}
