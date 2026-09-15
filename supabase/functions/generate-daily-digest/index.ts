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
// Bei serverseitiger Suche geht die komplette bisherige Unterhaltung in
// jede weitere Runde mit ein. Die Eingabemenge waechst deshalb quadratisch:
// gemessen 136k Token bei 5 Suchen, 479k bei 10. Daraus
//     Input  ~  20.000 + 4.585 * n^2
// was beide Messpunkte auf ein Prozent genau trifft. Bei zwoelf Suchen
// landet ein Lauf bei rund $1,55 und damit knapp unter der Grenze von
// 1,50 Euro. Dreizehn waeren schon $1,77 - nicht erhoehen.
const WEB_SEARCH_MAX_USES = 12
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
  'news.linkedin.com',
  'newsroom.pinterest.com',
  'blog.twitch.tv',
  'substack.com',
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
  'gruenderszene.de',
  // allfacebook.de leitet seit dem Umbenennen auf allsocial.de um.
  // internetworld.de antwortet mit 404 und ist deshalb raus.
  'allsocial.de',
  'futurebiz.de',
  'basicthinking.de',
  'meedia.de',
  // Steuern und Abgaben - der folgenreichste Bereich fuer eine
  // selbstaendige Creatorin und bisher in 237 Karten kein einziges Mal
  // vorgekommen.
  'haufe.de',
  'bzst.de',
  'gema.de',
  // Internationale Fachpresse, die tatsaechlich berichtet statt zu ranken.
  // reuters.com und theverge.com sperren den Crawler und wurden deshalb
  // von der API abgelehnt - nicht wieder aufnehmen.
  'socialmediatoday.com',
  'techcrunch.com',
]

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// ── Bilder ─────────────────────────────────────────────────────────────
// Die 61 Stockbilder lagen bei durchschnittlich 2,2 MB und waren deshalb
// zwischenzeitlich abgeschaltet. Sie sind inzwischen auf 900 px und im
// Schnitt 85 kB heruntergerechnet, also wieder tragbar.
function bildKategorie(platform: string, headline: string): string {
  const p = (platform || '').toLowerCase()
  const h = (headline || '').toLowerCase()
  if (p === 'instagram' || p === 'threads') return 'instagram'
  if (p === 'tiktok') return 'tiktok'
  if (p === 'youtube' || p === 'twitch') return 'youtube'
  if (p === 'meta' || p === 'whatsapp') return 'meta'
  if (h.match(/geld|budget|verdien|einnahm|deal|monetar|auszahl|honorar|bonus|revenue|cpm|rpm/)) return 'money'
  if (h.match(/recht|dsgvo|\beu\b|gesetz|kennzeichn|pflicht|regulier|datenschutz|urteil|gericht|steuer|finanzamt|gema/)) return 'legal'
  if (h.match(/canva|capcut|tool|app|software|later|notion|hootsuite|buffer|\bki\b/)) return 'tools'
  if (h.match(/trend|viral|hashtag|fyp|challenge|sound|audio/)) return 'trends'
  return 'creator'
}

async function naechstesBild(platform: string, headline: string, schonBenutzt: string[]): Promise<string | null> {
  const heute = new Date().toISOString().split('T')[0]

  const holen = async (kategorie: string) => {
    const { data } = await supabase
      .from('news_images')
      .select('id, url, last_used_date, use_count')
      .eq('category', kategorie)
      .order('last_used_date', { ascending: true, nullsFirst: true })
      .limit(20)
    return data ?? []
  }

  let bilder = await holen(bildKategorie(platform, headline))
  if (bilder.length === 0) bilder = await holen('creator')
  if (bilder.length === 0) return null

  const frei = bilder.filter((b) => !schonBenutzt.includes(b.url))
  const gewaehlt = frei.find((b) => b.last_used_date !== heute) ?? frei[0] ?? bilder[0]

  await supabase.from('news_images')
    .update({ last_used_date: heute, use_count: (gewaehlt.use_count ?? 0) + 1 })
    .eq('id', gewaehlt.id)

  return gewaehlt.url
}

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
    const { ohne_verlauf: ohneVerlauf = false } = await req.json().catch(() => ({}))
    const weekStart = getWeekStart(new Date())

    // Kontext aus den letzten 4 Wochen, fuer die is_repeat-Bewertung.
    // Die Zusammenfassung geht vollstaendig mit: mit den frueheren 60 Zeichen
    // sahen "Local Feed rollt in den USA aus" und "Local Feed bringt lokale
    // Reichweite" verschieden genug aus, dass das Modell is_repeat=false setzte.
    const vierWochen = new Date()
    vierWochen.setDate(vierWochen.getDate() - 28)

    /* ohne_verlauf uebergeht die Wiederholungspruefung fuer einen Lauf.
       Gedacht fuer den Fall, dass sich Prompt oder Quellen geaendert haben
       und man denselben Zeitraum noch einmal sauber abbilden will - ohne
       dass die alte Ausgabe aus dem Archiv geloescht werden muesste. */
    const { data: recentDigests } = ohneVerlauf
      ? { data: [] as any[] }
      : await supabase
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

AUFGABE: Suche News der letzten 7 Tage und waehle bis zu 7 Meldungen aus. Weniger ist ausdruecklich richtig: drei echte Neuigkeiten sind besser als sieben, von denen vier Fuellmaterial sind. Du durchsuchst zwoelf Bereiche - das heisst nicht, dass aus jedem etwas kommen muss. Aus den meisten kommt in einer gegebenen Woche nichts. Wenn nur eine Meldung wirklich taugt, liefere eine.

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

TREUE ZUR QUELLE — das ist die wichtigste Regel hier:
Du gibst wieder, was in der Quelle steht. Du ergaenzt nichts.

- Schreibe keine Aussage, die nicht in der Quelle belegt ist. Kein Hintergrundwissen, keine Einordnung aus dem Gedaechtnis, keine Verknuepfung mit anderen Regelwerken, die die Quelle nicht herstellt.
- Schreibe "laut Instagram", "Meta teilte mit", "TikTok begruendet" NUR, wenn die Quelle eine solche Aeusserung tatsaechlich zitiert. Gibt es kein Zitat, schreibe nicht, die Plattform habe etwas gesagt.
- Wenn die Quelle einen Geltungsbereich EINSCHRAENKT, gib die Einschraenkung wieder. Mache aus einer Ausnahme keine Warnung. Beispiel: Steht in der Quelle, eine Kennzeichnungspflicht gelte NICHT fuer Bildbearbeitung und Thumbnails, dann darfst du nicht schreiben, Creator mit KI-Thumbnails seien betroffen — du musst schreiben, dass sie es nicht sind.
- Keine Ausschmueckung. Saetze wie "wurde von Followern kaum wahrgenommen" oder "verschwindet in der Versenkung" gehoeren nur hinein, wenn die Quelle das sagt.
- Konkrete Bedienschritte, Zahlen, Fristen und Namen aus der Quelle sind wertvoller als jede allgemeine Einordnung. Nimm sie mit, statt sie durch eigene Ueberlegungen zu ersetzen.

Wenn die Quelle wenig hergibt, ist die Karte kurz. Das ist richtig so.

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
- impact: 1 Satz, was sie jetzt konkret tun soll — ODER null.
    Setze impact NUR, wenn die Quelle einen konkreten Schritt hergibt: eine Einstellung, die man umlegt, eine Funktion, die man oeffnet, eine Frist, die man einhaelt, eine Pruefung, die man durchfuehrt.
    Gibt die Quelle keinen Schritt her, schreibe "impact": null. Eine Meldung ohne Handlungsempfehlung ist voellig in Ordnung — eine erfundene Handlungsempfehlung ist es nicht.
    Der Schritt muss aus der Quelle stammen, nicht aus deiner Vorstellung davon, was sinnvoll waere.
    Schlecht, weil leer: "Werde spezifischer in deiner Nische."
    Schlecht, weil leer: "Beobachte die Funktion und plane, wie du sie nutzen koenntest."
    Schlecht, weil erfunden: ein Bedienweg, den die Quelle nicht beschreibt.
    Gut: "Oeffne die Registerkarte Markiert, waehle den Beitrag und tippe auf 'Zum Profil hinzufuegen' — laut Artikel geht das auch aus der DM-Benachrichtigung."
    Gut: "Geh deine letzten zehn Kooperationen durch und pruefe, ob bei Geschenken ohne Bezahlung eine Kennzeichnung fehlt."
- full_content: In-App-Artikel, 120 bis 300 Woerter. So lang, wie die Quelle traegt — nicht laenger. Lieber 130 gute Woerter als 280 mit Fuellung. Nimm die konkreten Schritte, Zahlen und Namen aus der Quelle mit. Keine Wiederholung der summary.
- level: "hoch" | "mittel" | "info"
- platform: "instagram" | "tiktok" | "youtube" | "meta" | "linkedin" | "pinterest" | "threads" | "twitch" | "whatsapp" | "allgemein"
- source: Name der Quelle
- source_url: Direktlink auf genau diese Meldung
- published_date: YYYY-MM-DD
- relevance_score: 4-10
- score_reason: 1 Satz
- freshness: "neu" | "mittel" | "alt"
- is_repeat: true | false

Antworte AUSSCHLIESSLICH mit einem JSON-Objekt, ohne Text davor oder danach:
{"cards": [{"headline":"...","summary":"...","impact":"... oder null","full_content":"...","level":"...","platform":"...","source":"...","source_url":"...","published_date":"...","relevance_score":8,"score_reason":"...","freshness":"neu","is_repeat":false}]}`

    const userPrompt = `Heute ist der ${new Date().toISOString().split('T')[0]}, die Ausgabe laeuft unter dem ${weekStart}.

Suche News der letzten 7 Tage. Du hast ${WEB_SEARCH_MAX_USES} Suchen — eine je Bereich:

PLATTFORM UND REICHWEITE
1. Instagram: Algorithmus, Ranking, Reichweite, neue Funktionen
2. TikTok: Algorithmus, Regeln, neue Funktionen fuer Creator
3. YouTube: Shorts, Creator-Programme, Monetarisierung
4. Nebenplattformen: LinkedIn, Pinterest, Threads, WhatsApp-Kanaele, Twitch

GELD
5. Monetarisierungsprogramme und Boni der Plattformen
6. Honorare, Vertraege und Konditionen bei Marken-Kooperationen im DACH-Markt
7. Einnahmen ausserhalb der Plattformen: Newsletter, Kurse, Affiliate, eigene Produkte

RECHT UND STEUERN
8. Kennzeichnungspflicht, Influencer-Urteile und Abmahnungen in DE/AT/CH
9. Steuern und Abgaben fuer Creator: DAC7 und Plattformen-Steuertransparenzgesetz, Meldungen der Plattformen ans Finanzamt, Umsatzsteuer, Pruefpraxis der Finanzaemter
10. EU-Regulierung: AI Act, DSA, Digital Fairness Act

WERKZEUGE UND UMFELD
11. KI-Werkzeuge, die Creator selbst benutzen: Schnitt, Voice, Thumbnails, Sichtbarkeit in KI-Antworten
12. Account-Sicherheit, Sperren und Wiederherstellung; GEMA und Musiklizenzen

Aus den meisten dieser Bereiche kommt in einer gegebenen Woche nichts. Das ist der Normalfall — such trotzdem, aber erfinde nichts, nur damit ein Bereich vertreten ist.

Wenn es aus Bereich 8, 9 oder 10 etwas gab, nimm es auf: Recht und Steuern sind fuer eine selbstaendige Creatorin folgenreicher als jedes Funktions-Update, kommen aber in der Berichterstattung selten vor.

Gib bis zu 7 Karten als JSON zurueck. NUR JSON.`

    const claudeAufrufen = (domains: string[]) => fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 24000,
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

    const benutzteBilder: string[] = []
    const kartenMitBild = []
    for (const c of karten) {
      const bild = await naechstesBild(c.platform || 'allgemein', c.headline || '', benutzteBilder)
      if (bild) benutzteBilder.push(bild)
      kartenMitBild.push({ ...c, image_url: bild })
    }

    const { error: upsertError } = await supabase
      .from('daily_digest')
      .upsert({
        date: weekStart,
        cards: kartenMitBild,
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
        web_searches: suchen, gerettet, ohne_verlauf: ohneVerlauf,
        token_cost_usd: parseFloat(tokenCost.toFixed(6)), search_cost_usd: parseFloat(searchCost.toFixed(6)),
      },
    })

    console.log(`Erfolg (Woche ${weekStart}): ${kartenMitBild.length} Karten, ${alle.length - karten.length} verworfen | Kosten $${costUsd}`)

    return new Response(
      JSON.stringify({
        success: true, cards_count: karten.length, verworfen: alle.length - karten.length,
        aussortiert, week_start: weekStart,
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
