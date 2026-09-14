import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = 'https://bzejndghppuipnedasuv.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!

// Sonnet 5 statt Opus 4.5: die Aufgabe ist "Suchergebnisse lesen, auf Deutsch
// zusammenfassen, JSON ausgeben". Das halbiert die Kosten pro Lauf.
const MODEL = 'claude-sonnet-5'
const PROVIDER = 'Anthropic'
const PRICE_INPUT_PER_MTOK = 2.00
const PRICE_OUTPUT_PER_MTOK = 10.00
// Sechs statt zehn Suchen. Bei serverseitigen Suchen geht die komplette
// bisherige Unterhaltung in jede weitere Runde mit ein, die Eingabemenge
// waechst also ueberproportional: 10 Suchen ergaben 479k Input-Token und
// $1,11 pro Lauf. Sechs halten den Lauf unter einem halben Dollar.
const WEB_SEARCH_MAX_USES = 6
const WEB_SEARCH_PRICE_PER_CALL = 10 / 1000

// Ohne Whitelist sucht das Modell frei und landet bei englischsprachigen
// SEO-Sammelseiten: 36 von 237 Karten kamen aus einem einzigen solchen Blog,
// das Meta Newsroom kam zweimal vor, DACH-Quellen nie. Die Liste erzwingt
// Primaerquellen und deutschsprachige Fachpresse.
const ERLAUBTE_QUELLEN = [
  // Primaerquellen der Plattformen
  'about.instagram.com',
  'creators.instagram.com',
  'business.instagram.com',
  'about.fb.com',
  'newsroom.tiktok.com',
  'tiktok.com',
  'blog.youtube',
  'support.google.com',
  'developers.facebook.com',
  // Deutschsprachige Fach- und Rechtsquellen
  't3n.de',
  'omr.com',
  'horizont.net',
  'wuv.de',
  'heise.de',
  'netzpolitik.org',
  'lto.de',
  'e-recht24.de',
  'wbs.legal',
  'drschwenke.de',
  'die-medienanstalten.de',
  'bvdw.org',
  'onlinemarketing.de',
  'internetworld.de',
  'gruenderszene.de',
  'allfacebook.de',
  'futurebiz.de',
  'basicthinking.de',
  'meedia.de',
  // Internationale Fachpresse, die tatsaechlich berichtet statt zu ranken.
  // reuters.com und theverge.com sperren den Crawler und wurden deshalb
  // von der API abgelehnt - nicht wieder aufnehmen.
  'socialmediatoday.com',
  'techcrunch.com',
]

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function fehlerMelden(nachricht: string) {
  // Der stille Ausfall vom 21.05. bis 06.09. war nur moeglich, weil diese
  // Function als einzige im Projekt nichts protokolliert hat.
  try {
    await supabase.rpc('log_error', {
      function_name: 'generate-daily-digest',
      error_message: nachricht,
    })
  } catch (_) { /* Logging darf den Lauf nicht zusaetzlich kippen */ }
}

/**
 * Rettet vollstaendige Karten aus einer abgeschnittenen Antwort.
 * Laeuft das Modell in max_tokens, ist das JSON unparsbar und der komplette
 * Lauf waere bezahlt und verloren - dabei sind die ersten Karten meist ganz.
 * Sucht deshalb jedes auf oberster Ebene geschlossene Objekt im cards-Array.
 */
function kartenRetten(text: string): any[] {
  const start = text.indexOf('[')
  if (start < 0) return []

  const gefunden: any[] = []
  let tiefe = 0
  let beginn = -1
  let imText = false
  let maskiert = false

  for (let i = start; i < text.length; i++) {
    const z = text[i]
    if (maskiert) { maskiert = false; continue }
    if (z === '\\') { maskiert = true; continue }
    if (z === '"') { imText = !imText; continue }
    if (imText) continue

    if (z === '{') {
      if (tiefe === 0) beginn = i
      tiefe++
    } else if (z === '}') {
      tiefe--
      if (tiefe === 0 && beginn >= 0) {
        try { gefunden.push(JSON.parse(text.slice(beginn, i + 1))) } catch { /* unvollstaendig */ }
        beginn = -1
      }
    }
  }
  return gefunden
}

const SAMMEL_SEGMENTE = ['topic', 'topics', 'category', 'categories', 'tag', 'tags', 'themen', 'thema', 'archiv', 'archive']
const SAMMEL_ENDUNGEN = ['news', 'blog', 'updates', 'insights', 'press', 'newsroom', 'aktuelles', 'presse', 'magazin']

/**
 * Erkennt Links auf laufend fortgeschriebene Uebersichtsseiten.
 * Der Prompt verbietet sie, das Modell haelt sich nicht immer daran - im
 * Testlauf kam "socialmediatoday.com/topic/instagram/" durch. Wer so eine
 * Karte in vier Wochen anklickt, findet die Meldung dort nicht mehr.
 *
 * Faengt Themen- und Kategorieseiten sowie nackte Rubriken. SEO-Sammelseiten
 * mit artikelartiger URL ("/blog/instagram-updates/") sind an der URL nicht
 * erkennbar - dagegen hilft nur die Domain-Whitelist.
 */
function istSammelseite(url: string): boolean {
  try {
    const pfad = new URL(url).pathname.replace(/\/+$/, '')
    const teile = pfad.split('/').filter(Boolean)
    if (teile.length < 2) return true
    if (teile.some((t) => SAMMEL_SEGMENTE.includes(t.toLowerCase()))) return true
    if (SAMMEL_ENDUNGEN.includes(teile[teile.length - 1].toLowerCase())) return true
    return false
  } catch {
    return true
  }
}

// Montag der aktuellen ISO-Woche, als YYYY-MM-DD
function getWeekStart(d: Date): string {
  const day = d.getUTCDay() // 0=So, 1=Mo, ... 6=Sa
  const diffToMonday = day === 0 ? -6 : 1 - day
  const monday = new Date(d)
  monday.setUTCDate(d.getUTCDate() + diffToMonday)
  return monday.toISOString().split('T')[0]
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const weekStart = getWeekStart(new Date())

    // Kontext aus den letzten 4 Wochen, fuer die is_repeat-Bewertung.
    // Die Zusammenfassung geht vollstaendig mit: mit den frueheren 60 Zeichen
    // sahen "Local Feed rollt in den USA aus" und "Local Feed bringt lokale
    // Reichweite" verschieden genug aus, dass das Modell is_repeat=false setzte.
    const vierWochen = new Date()
    vierWochen.setDate(vierWochen.getDate() - 28)
    const { data: recentDigests } = await supabase
      .from('daily_digest')
      .select('cards, date')
      .gte('date', vierWochen.toISOString().split('T')[0])
      .lt('date', weekStart)
      .order('date', { ascending: false })

    const recentContext: string[] = []
    if (recentDigests) {
      for (const digest of recentDigests) {
        if (Array.isArray(digest.cards)) {
          for (const card of digest.cards) {
            if (card.headline) {
              recentContext.push(`[${digest.date}] (${card.platform || '?'}) ${card.headline} — ${card.summary || ''}`)
            }
          }
        }
      }
    }
    const kontext = recentContext.slice(0, 40)

    const recentBlock = kontext.length > 0
      ? `BEREITS BEHANDELT (letzte Ausgaben) — Grundlage fuer is_repeat:\n${kontext.map((r, i) => `${i + 1}. ${r}`).join('\n')}\n\nSetze is_repeat: true, sobald eine Meldung denselben Sachverhalt betrifft — auch wenn sie anders formuliert ist oder ein neues Detail nachreicht. Im Zweifel true.`
      : ''

    const systemPrompt = `Du bist Chefredakteur eines woechentlichen News-Briefings fuer deutschsprachige Content Creator. Das Briefing erscheint montags und deckt die vorherigen 7 Tage ab.

DEINE LESERIN, ganz konkret:
Selbststaendige Creatorin im deutschsprachigen Raum, 1.000 bis 50.000 Follower auf Instagram und/oder TikTok. Sie hat KEINEN Shop, KEINE Agentur, KEIN Werbebudget und KEIN Team. Sie verdient ueber Kooperationen mit Marken, nicht ueber Anzeigenschaltung. Sie faellt unter deutsches Wettbewerbsrecht und EU-Regulierung.

Alles, was nur fuer Agenturen, Shops, Mediaeinkaeufer oder US-Werbetreibende zaehlt, ist fuer sie wertlos — egal wie gross die Zahl in der Meldung ist.

AUFGABE: Suche News der letzten 7 Tage und waehle bis zu 5 Meldungen aus. Weniger ist ausdruecklich richtig: drei echte Neuigkeiten sind besser als fuenf, von denen zwei Fuellmaterial sind. Wenn nur eine Meldung wirklich taugt, liefere eine.

RELEVANT:
- Aenderungen an Algorithmus, Ranking oder Reichweite (Instagram, TikTok, YouTube)
- Neue Funktionen, die sie selbst benutzen kann — mit Rollout, nicht nur als Test
- Geld: Monetarisierungsprogramme, Boni, Auszahlungen, Honorare im DACH-Markt
- Recht in DE/AT/CH und EU: Kennzeichnungspflicht, Urteile, AI Act, DSA, DSGVO
- Belastbare Studien mit Zahlen, die ihre eigene Arbeit betreffen

NICHT RELEVANT — diese Meldungen NICHT aufnehmen:
- Gesamtzahlen des US-Werbemarkts ("Meta erreicht 240 Mrd. Dollar Werbeeinnahmen")
- Shop-, Seller- und Commerce-Werkzeuge (TikTok Shop Seller Center, Katalogpflege)
- Werbeanzeigen-Tools fuer Mediaeinkaeufer
- Reine Tests ohne Rollout-Datum und ohne Verfuegbarkeit in Europa
- Evergreen-Ratschlaege, die schon 2024 galten ("Reels sind wichtig", "poste regelmaessig", "sei authentisch")
- Allgemeine Tech- oder KI-News ohne direkten Creator-Bezug
- Promis, US-Politik, Boersenkurse

QUELLEN: Nimm die Primaerquelle, wenn es sie gibt — also das Newsroom oder den Blog der Plattform selbst. Verlinke auf die EINZELNE Meldung, nie auf eine laufend fortgeschriebene Sammelseite wie "Alle Instagram-Updates 2026". Wenn du zu einer Meldung nur eine Sammelseite findest, lass die Meldung weg.

Bei Rechtsthemen: ausschliesslich deutschsprachige Rechts- oder Fachquellen. Nenne die Rechtsgrundlage genau (Artikel, Paragraph, Gericht, Datum) und ordne Bussgeldhoehen dem richtigen Tatbestand zu — nicht die hoechste Zahl aus dem Gesetz an den erstbesten Verstoss haengen.

RELEVANCE SCORE:
10 = betrifft fast alle Creator sofort
7-9 = sehr relevant fuer viele, klarer Handlungsbedarf
4-6 = nuetzlich, aber nicht dringend
1-3 = Info oder Nische — nicht aufnehmen

FRESHNESS, aus published_date:
- "neu": in den letzten 7 Tagen — der Regelfall
- "mittel": 8 bis 14 Tage — nur wenn nichts Frischeres zum Thema vorliegt
- "alt": aelter als 14 Tage — nur bei einer weiterhin geltenden Pflicht oder Frist, niemals zum Auffuellen

${recentBlock}

FELDER pro Meldung, auf Deutsch:
- headline: max. 8 Woerter, konkret, keine Frage
- summary: 1 Satz, was passiert ist
- impact: 1 Satz, was sie JETZT tun soll. Muss eine Handlung enthalten, die sie heute ausfuehren kann.
    Schlecht: "Werde spezifischer in deiner Nische."
    Schlecht: "Beobachte die Funktion und plane, wie du sie nutzen koenntest."
    Gut: "Oeffne Einstellungen > Konto > Your Algorithm und trage drei Themen ein, bevor die Funktion in DE startet."
    Gut: "Geh deine letzten zehn Kooperationen durch und pruefe, ob bei Geschenken ohne Bezahlung eine Kennzeichnung fehlt."
- full_content: In-App-Artikel, 180 bis 300 Woerter, mindestens 3 Absaetze, mit konkreten Zahlen und Schritten. Kein Fuelltext, keine Wiederholung der summary.
- level: "hoch" | "mittel" | "info"
- platform: "instagram" | "tiktok" | "youtube" | "meta" | "allgemein"
- source: Name der Quelle
- source_url: Direktlink auf genau diese Meldung
- published_date: YYYY-MM-DD
- relevance_score: 4-10
- score_reason: 1 Satz
- freshness: "neu" | "mittel" | "alt"
- is_repeat: true | false

Antworte AUSSCHLIESSLICH mit einem JSON-Objekt, ohne Text davor oder danach:
{"cards": [{"headline":"...","summary":"...","impact":"...","full_content":"...","level":"...","platform":"...","source":"...","source_url":"...","published_date":"...","relevance_score":8,"score_reason":"...","freshness":"neu","is_repeat":false}]}`

    const userPrompt = `Heute ist der ${new Date().toISOString().split('T')[0]}, die Ausgabe laeuft unter dem ${weekStart}.

Suche News der letzten 7 Tage. Du hast hoechstens ${WEB_SEARCH_MAX_USES} Suchen — setze sie breit an und buendele mehrere Begriffe in einer Anfrage, statt jeden Punkt einzeln zu suchen:
1. Instagram und TikTok: Algorithmus, Reichweite, neue Funktionen fuer Creator
2. YouTube Shorts und Creator-Programme
3. Monetarisierung, Boni und Honorare fuer Creator im DACH-Markt
4. Kennzeichnungspflicht, Influencer-Recht und aktuelle Urteile in Deutschland
5. EU-Regulierung fuer Creator: AI Act, DSA, Digital Fairness Act

Mindestens eine Karte soll aus Bereich 4 oder 5 kommen, wenn es dort in den letzten 7 Tagen etwas gab.

Gib bis zu 5 Karten als JSON zurueck. Weniger ist richtig, wenn nicht mehr taugt — aber wenn du drei brauchbare Meldungen gefunden hast, liefere auch alle drei. NUR JSON.`

    const claudeAufrufen = (domains: string[]) => fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 16000,
        // Mittlere Stufe: weniger und staerker gebuendelte Suchaufrufe, was
        // hier direkt auf die Eingabemenge und damit auf die Kosten wirkt.
        output_config: { effort: 'medium' },
        system: systemPrompt,
        tools: [{
          type: 'web_search_20250305',
          name: 'web_search',
          max_uses: WEB_SEARCH_MAX_USES,
          allowed_domains: domains,
        }],
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    let res = await claudeAufrufen(ERLAUBTE_QUELLEN)

    // Sperrt eine Quelle spaeter den Crawler, lehnt die API die ganze Anfrage
    // ab und der Lauf faellt aus. Statt daran zu sterben: die genannten
    // Domains einmalig streichen, neu versuchen und den Vorfall melden.
    if (!res.ok) {
      const err = await res.text()
      const treffer = err.match(/domains are not accessible[^[]*\[([^\]]*)\]/)
      if (!treffer) throw new Error('Claude API Fehler: ' + res.status + ' — ' + err)

      const gesperrt = treffer[1].split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
      await fehlerMelden('Quellen sperren den Crawler, Lauf ohne sie wiederholt: ' + gesperrt.join(', '))
      res = await claudeAufrufen(ERLAUBTE_QUELLEN.filter((d) => !gesperrt.includes(d)))
      if (!res.ok) throw new Error('Claude API Fehler (2. Versuch): ' + res.status + ' — ' + (await res.text()))
    }

    const data = await res.json()
    const textBlocks = (data.content || []).filter((b: any) => b.type === 'text')
    if (!textBlocks.length) throw new Error('Kein Text in Claude Antwort')

    const rawText = textBlocks.map((b: any) => b.text).join('')
    const clean = rawText.replace(/```json/g, '').replace(/```/g, '').trim()

    let parsed: any = null
    try {
      parsed = JSON.parse(clean)
    } catch {
      const matchObj = clean.match(/\{[\s\S]*\}/)
      if (matchObj) { try { parsed = JSON.parse(matchObj[0]) } catch { } }
    }

    let gerettet = false
    if (!parsed) {
      const karten = kartenRetten(clean)
      if (karten.length > 0) {
        parsed = { cards: karten }
        gerettet = true
        await fehlerMelden(`Antwort war abgeschnitten (stop_reason ${data.stop_reason}), ${karten.length} vollstaendige Karten gerettet.`)
      }
    }

    if (!parsed) throw new Error('JSON parsing fehlgeschlagen. Antwortanfang: ' + clean.slice(0, 300))

    const tokensInput = data.usage?.input_tokens ?? 0
    const tokensOutput = data.usage?.output_tokens ?? 0
    const tokensTotal = tokensInput + tokensOutput
    const suchen = (data.content || []).filter((b: any) =>
      (b.type === 'server_tool_use' && b.name === 'web_search') || b.type === 'web_search_tool_result'
    ).length / 2
    const tokenCost = (tokensInput / 1_000_000 * PRICE_INPUT_PER_MTOK) + (tokensOutput / 1_000_000 * PRICE_OUTPUT_PER_MTOK)
    const searchCost = suchen * WEB_SEARCH_PRICE_PER_CALL
    const costUsd = parseFloat((tokenCost + searchCost).toFixed(6))

    // Wiederholungen fliegen hier raus, nicht erst im Kopf der Leserin:
    // 47 der 237 Altkarten trugen is_repeat=true und wurden trotzdem gezeigt,
    // weil das Feld berechnet, aber nie gelesen wurde.
    const alle: any[] = Array.isArray(parsed.cards) ? parsed.cards : []
    const aussortiert: string[] = []
    const karten = alle
      .filter((c) => {
        if (!c || typeof c.headline !== 'string' || !c.headline.trim()) return false
        if (c.is_repeat === true) { aussortiert.push(`Wiederholung: ${c.headline}`); return false }
        if (!c.source_url || istSammelseite(c.source_url)) { aussortiert.push(`Sammelseite: ${c.headline} (${c.source_url})`); return false }
        return true
      })
      .sort((a, b) => (b.relevance_score || 0) - (a.relevance_score || 0))

    if (aussortiert.length > 0) {
      console.log('Aussortiert: ' + aussortiert.join(' | '))
    }

    if (karten.length === 0) {
      const grund = `Woche ${weekStart}: keine brauchbare Karte (${alle.length} geliefert). ${aussortiert.join(' | ')} Kosten trotzdem $${costUsd}.`
      await fehlerMelden(grund)
      await supabase.from('ai_usage_log').insert({
        feature: 'daily_digest', provider: PROVIDER, model: MODEL,
        tokens_input: tokensInput, tokens_output: tokensOutput, tokens_total: tokensTotal,
        cost_usd: costUsd, user_id: null,
        metadata: { week_start: weekStart, cards_count: 0, verworfen: alle.length, aussortiert, web_searches: suchen },
      })
      return new Response(JSON.stringify({ success: true, skipped: true, reason: grund }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
      })
    }

    const { error: upsertError } = await supabase
      .from('daily_digest')
      .upsert({
        date: weekStart,
        cards: karten,
        teaser: null,
        generated_at: new Date().toISOString(),
        model_used: MODEL,
        tokens_used: tokensTotal,
        tokens_input: tokensInput,
        tokens_output: tokensOutput,
      }, { onConflict: 'date' })

    if (upsertError) throw new Error('Supabase Fehler: ' + upsertError.message)

    await supabase.from('ai_usage_log').insert({
      feature: 'daily_digest', provider: PROVIDER, model: MODEL,
      tokens_input: tokensInput, tokens_output: tokensOutput, tokens_total: tokensTotal,
      cost_usd: costUsd, user_id: null,
      metadata: {
        week_start: weekStart, cards_count: karten.length, verworfen: alle.length - karten.length,
        web_searches: suchen, gerettet,
        token_cost_usd: parseFloat(tokenCost.toFixed(6)), search_cost_usd: parseFloat(searchCost.toFixed(6)),
      },
    })

    console.log(`Erfolg (Woche ${weekStart}): ${karten.length} Karten, ${alle.length - karten.length} verworfen | Kosten $${costUsd}`)

    return new Response(
      JSON.stringify({
        success: true, cards_count: karten.length, verworfen: alle.length - karten.length,
        week_start: weekStart,
        tokens: { input: tokensInput, output: tokensOutput, total: tokensTotal },
        cost: { token_usd: parseFloat(tokenCost.toFixed(6)), search_usd: parseFloat(searchCost.toFixed(6)), total_usd: costUsd, web_searches: suchen },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (err: any) {
    console.error('Digest Error:', err.message)
    await fehlerMelden(err.message)
    return new Response(JSON.stringify({ success: false, error: err.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
  }
})
