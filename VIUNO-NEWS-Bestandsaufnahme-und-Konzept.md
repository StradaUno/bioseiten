# viuno Creator News — Bestandsaufnahme und Konzept

**Stand:** 14. September 2026
**Umfang:** Edge Functions `generate-daily-digest`, `send-weekly-digest-email`, `digest-unsubscribe`; Tabellen `daily_digest`, `news_images`, `digest_email_log`, `newsletter_subscribers`; Views `digest_cards_today` / `digest_cards_past`; SPA-View `renderDigest`, Dashboard-Teaser, öffentliche Seite `/news/`, Startseite
**Zielvorgabe:** Creator News soll Creator in die App holen und wiederkommen lassen. Bewertet wird nach Frische, Teilbarkeit, DACH-Relevanz.
**Status:** reine Analyse — nichts geändert.

---

## Kurzfassung vorab

Die News sind technisch weiter gebaut, als das Ergebnis vermuten lässt. Es gibt eine Pipeline mit Websuche, eine Wochenmail mit HMAC-Abmeldelink, eine öffentliche Seite ohne Login, ein Bildsystem, zwei aufbereitete Views. Vieles davon läuft ins Leere.

Fünf Befunde bestimmen alles Weitere:

1. **Zwischen dem 21. Mai und dem 6. September 2026 gab es 109 Tage lang keine einzige News-Ausgabe — und niemand hat es gemerkt.** Der pg_cron-Job hat jeden Tag um 04:00 gefeuert (`cron.job_run_details` lückenlos „succeeded"), aber es entstand keine `daily_digest`-Zeile und kein `ai_usage_log`-Eintrag. Ursache: `generate-daily-digest` schreibt im `catch`-Zweig **nichts** nach `admin_errors` — anders als jede andere Function im Projekt. Ein Feature, dessen Versprechen „Wiederkehr" ist, war dreieinhalb Monate tot, und die App hat weiter die Karten vom 20. Mai angezeigt.

2. **Die Mail ist noch nie verschickt worden.** `digest_email_log` hat 0 Zeilen. Der erste echte Versuch war heute, 14.09. um 04:30 — und er ist gescheitert: `Abonnenten laden fehlgeschlagen: Gateway Timeout`, bei 3 Abonnenten. Es gibt keinen Retry; der Cron läuft erst nächsten Montag wieder, und dann für eine andere Woche. Die Ausgabe dieser Woche geht per Mail nie raus.

3. **Die wichtigste Karte steht ganz unten, die unwichtigste ganz oben.** Die Karten werden in der Reihenfolge gespeichert, in der das Modell sie ausgibt, und die App sortiert nicht nach. Am 07.09. war die Karte mit `relevance_score` 9 (EU AI Act) die letzte von fünf. Am 14.09. ist die erste Karte ein Score-5-„Info"-Eintrag über einen iOS-Test. Der Dashboard-Teaser nimmt `cards.slice(0,2)` — er zeigt diese Woche also die beiden schwächsten Karten. Die Mail sortiert dagegen nach Score. App und Mail widersprechen sich.

4. **Die öffentliche News-Seite existiert, ist fertig, und ist von nirgendwo verlinkt.** `/news/` lädt ohne Login über den publishable Key, hat Archiv, OG-Tags und Nachladen. Die Kachel „Creator News" auf der Startseite zeigt aber auf `/digest` — die Login-Wand. Wer geteilte News anklickt, landet auf `https://viuno.de` (Startseite), weil der Teilen-Knopf in der App genau das als URL mitgibt. Der einzige Weg, über den News neue Nutzer bringen könnten, ist nicht angeschlossen.

5. **Keine der Quellen ist DACH, und fast keine ist primär.** 237 Karten aus 45 Ausgaben: Spitzenreiter ist `SocialBee` (36 Karten), ein SEO-Blog; `Meta Newsroom` kommt 2× vor. Kein t3n, kein OMR, kein Anwaltsblog, keine Medienanstalt. Dabei war genau das das relevante Material: OLG Karlsruhe zur Kennzeichnungspflicht ohne Bezahlung, AI Act Art. 50 seit 02.08.2026, Digital Fairness Act im Herbst. Die eine Rechtskarte, die es gab, zitiert einen englischsprachigen Aggregator und nennt eine Bußgeldhöhe, die zu Art. 50 nicht passt.

Dazu die Messlage: **es gibt keinerlei Aufrufzahlen.** Keine `page_views`-Tabelle, kein Tracking auf `/digest`, keins auf `/news`. Ob irgendjemand die News je geöffnet hat, ist aus den Daten nicht beantwortbar — und damit ist das Ziel „Wiederkehr" heute schlicht nicht prüfbar.

---

# Phase 1: Bestandsaufnahme

## A. Pipeline — wie News entstehen

### A.1 Die beteiligten Bausteine

| Baustein | Art | Rolle |
|---|---|---|
| `generate-daily-digest` | Edge Function, `verify_jwt: false`, v47 (zuletzt 09.09.2026) | Sucht, schreibt, bewertet, speichert eine Wochenausgabe |
| Cron `daily-digest-generator` (jobid 6) | `0 4 * * 1` | Montags 04:00 UTC, `net.http_post`, ohne Auth-Header |
| `daily_digest` | Tabelle, RLS: nur `authenticated` lesen | `date` UNIQUE (= Montag der Woche), `cards` jsonb, `teaser`, `model_used`, `tokens_*` |
| `news_images` | Tabelle, RLS an, **keine Policy** (nur Service Role) | 61 Stockbilder in 9 Kategorien |
| `send-weekly-digest-email` | Edge Function, v9 (09.09.2026) | Baut die HTML-Mail, versendet über Resend |
| Cron `weekly-digest-email-sender` (jobid 16) | `30 4 * * 1` | 30 Minuten nach der Generierung |
| `digest-unsubscribe` | Edge Function | HMAC-Token-Prüfung, setzt `users.newsletter_subscribed = false` |
| `digest_cards_today` / `digest_cards_past` | Views | Flachgeklopfte Karten für die öffentliche Seite |

### A.2 Ablauf eines Laufs, Schritt für Schritt

```
pg_cron, Montag 04:00 UTC
   │  net.http_post ohne Body, Timeout 5 s
   │  → pg_net meldet nach 5 s "Timeout", die Function läuft weiter
   ▼
generate-daily-digest
   │
   ├─ 1. weekStart = Montag der aktuellen ISO-Woche (UTC)
   │
   ├─ 2. Kontext holen: alle Karten der letzten 28 Tage vor weekStart
   │     → Liste "[Woche <date>] (<platform>) <headline> — <summary[0..60]>"
   │     → wird als recentBlock in den System-Prompt gehängt
   │
   ├─ 3. EIN Anthropic-Aufruf:
   │       model  = claude-opus-4-5
   │       tools  = [{ web_search_20250305, max_uses: 10 }]
   │       beta   = web-search-2025-03-05
   │       max_tokens = 8000
   │     Das Modell sucht selbst, 7 vorgegebene Themenbereiche
   │
   ├─ 4. Antwort: Textblöcke joinen, ```json strippen, JSON.parse
   │     Fallback: erstes {...} per Regex, nochmal parsen
   │     Kein Parse → throw
   │
   ├─ 5. Pro Karte ein Bild aus news_images ziehen (Kategorie aus
   │     platform + Schlagwort-Regex auf die Headline), last_used_date
   │     und use_count hochzählen
   │
   ├─ 6. upsert daily_digest on conflict (date)
   │     → approved wird hart auf false gesetzt
   │
   └─ 7. insert ai_usage_log (Kosten, Suchanzahl, cards_count)

   catch → console.error + HTTP 400.  KEIN admin_errors-Eintrag.
```

### A.3 Quellen — es gibt keine Quellenliste

Das ist der zentrale Punkt der Pipeline: **es gibt keine RSS-Feeds, keine URL-Liste, keine Domain-Whitelist.** Die einzige Steuerung ist der Nutzer-Prompt, der dem Modell sieben Themenbereiche nennt und es selbst googeln lässt:

```
1. Instagram Algorithmus Updates oder neue Features (letzte 7 Tage)
2. TikTok neue Features, Regeln oder Creator Economy (letzte 7 Tage)
3. YouTube Creator Economy oder neue Tools (letzte 7 Tage)
4. Meta Werbebudgets oder Creator Programme (letzte 7 Tage)
5. Social Media Marketing Trends (letzte 7 Tage)
6. Rechtliches fuer Creator in der EU (letzte 7 Tage)
7. Tools fuer Creator, z.B. Canva, CapCut (letzte 7 Tage)
```

Was dabei herauskommt, ist das, was in englischsprachigem SEO-Content zu diesen Begriffen gut rankt. Die gemessene Quellenverteilung über alle 237 Karten:

| Quelle | Karten | Ausgaben |
|---|---|---|
| SocialBee | 36 | 25 |
| YouTube Help | 9 | 9 |
| Marketing Brew | 9 | 9 |
| Social Media Today | 8 | 7 |
| MediaPost | 7 | 7 |
| HeyOrca | 7 | 7 |
| Marketing Dive / IAB | 6 | 6 |
| Emarketer | 6 | 6 |
| ALM Corp | 5 | 5 |
| Anchour | 5 | 5 |
| … | | |
| **Meta Newsroom** | **2** | **2** |

Kein `about.instagram.com`, kein `newsroom.tiktok.com`, kein `blog.youtube`, kein einziges deutschsprachiges Medium.

### A.4 Der vollständige Prompt

**System-Prompt** (`${recentBlock}` wird zur Laufzeit eingesetzt):

```
Du bist Chefredakteur eines woechentlichen News-Briefings fuer deutschsprachige
Content Creator mit 1.000-200.000 Followern. Das Briefing erscheint einmal pro
Woche (Montags) und deckt die vorherigen 7 Tage ab.

Deine Aufgabe: Suche nach News der letzten 7 Tage und waehle die relevantesten
Meldungen aus — bis zu 6 Cards. Qualitaet geht klar vor Quantitaet: Gib lieber
nur 3 oder 4 wirklich relevante, aktuelle Cards zurueck als 6 Cards, bei denen
die Luecken mit alten oder schwachen Themen gefuellt werden. Es ist ausdruecklich
in Ordnung, weniger als 6 Cards zu liefern, wenn nicht genug wirklich Neues aus
den letzten 7 Tagen vorliegt.

RELEVANZ-REGELN:
Relevant:
- Algorithmus-Aenderungen (Instagram, TikTok, YouTube)
- Neue Features auf Social-Media-Plattformen
- Brand-Budgets, Werbeausgaben, Creator-Economy-Zahlen
- Rechtliches (Kennzeichnungspflicht, DSGVO, EU-Regulierung)
- Tools die Creators nutzen (Canva, CapCut, Later etc.)

NICHT relevant:
- Allgemeine Tech-News ohne direkten Creator-Bezug
- US-Politik oder Wirtschaft allgemein
- Promis ohne Creator-Kontext

RELEVANCE SCORE Definition:
10 = betrifft fast alle Creator sofort
7-9 = sehr relevant fuer viele Creator, klarer Handlungsbedarf
4-6 = nuetzlich aber nicht dringend
1-3 = eher Info oder Nische. Cards mit Score unter 4 nur aufnehmen, wenn sonst
      weniger als 3 Cards zusammenkommen.

FRESHNESS-FELD (freshness) — basierend auf published_date, bezogen auf das
woechentliche Format:
- "neu": innerhalb der letzten 7 Tage — das ist der Regelfall und sollte die
  meisten Cards betreffen
- "mittel": 8 bis 14 Tage alt — nur wenn besonders relevant und nichts Frischeres
  zum Thema vorliegt
- "alt": mehr als 14 Tage alt — nur in Ausnahmefaellen aufnehmen (z.B. eine
  wichtige Regelung, die weiterhin zentral wichtig ist), niemals um die
  6-Card-Quote zu fuellen

IS_REPEAT-FELD (is_repeat) — Vergleich mit den letzten Wochen-Ausgaben:
- false: Thema wurde noch nicht behandelt (Standard)
- true: Thema ist inhaltlich identisch oder sehr aehnlich zu einer News der
  letzten Wochen

${recentBlock}

Fuer jede Meldung schreibe auf Deutsch:
- headline: max. 8 Woerter, direkt und konkret
- summary: 1 praegnanter Satz, Klartext was passiert ist
- impact: 1 Satz, handlungsorientiert — was soll der Creator JETZT konkret tun?
- full_content: vollstaendiger In-App Artikel auf Deutsch.
  Bei relevance_score 1-8: 250-400 Woerter, mindestens 3 Absaetze.
  Bei relevance_score 9-10: 250-600 Woerter, mindestens 4 Absaetze.
  Immer mit konkreten Zahlen und praktischen Tipps. Kein Fuelltext.
- level: "hoch" | "mittel" | "info"
- platform: "instagram" | "tiktok" | "youtube" | "meta" | "allgemein"
- source: Name der Quelle
- source_url: Direktlink zur originalen News-Seite
- published_date: Datum der Meldung (YYYY-MM-DD)
- relevance_score: Zahl 1-10 gemaess Definition oben
- score_reason: 1 Satz warum dieser Score
- freshness: "neu" | "mittel" | "alt" gemaess Definition oben
- is_repeat: true | false gemaess Definition oben
- approved: false

Zusaetzlich generiere einen "teaser" — genau 3 Zeilen, eine pro Top-Plattform/
Thema. Jede Zeile beginnt mit passendem Emoji und Plattformname, dann Doppelpunkt,
dann max. 6 Woerter. Kein Fliesstext. Kein Hinweis auf fehlende oder alte News.

Antworte AUSSCHLIESSLICH mit einem JSON-Objekt ohne Text davor oder danach:
{"teaser": "...", "cards": [{...}]}
```

**`recentBlock`** (nur wenn es Vorwochen gibt):

```
BEREITS BEHANDELT (letzte Wochen-Ausgaben) — zur Information fuer is_repeat
Bewertung:
1. [Woche 2026-09-07] (instagram) Instagram rollt 'Your Algorithm' global aus — …
…

Waehle weiterhin neue Themen. Setze is_repeat: true nur wenn ein Thema inhaltlich
identisch oder sehr aehnlich ist.
```

**Nutzer-Prompt:** siehe A.3, plus Vor- und Nachsatz mit Datum und `weekStart`.

### A.5 Filterung, Deduplizierung, Bewertung — alles im Modell, nichts im Code

| Aufgabe | Wo | Wirkt sie? |
|---|---|---|
| Relevanzfilter | nur Prompt | teils — Durchschnitts-Score 7,38, aber „TikTok Shop Seller Center" für Micro-Creator ohne Shop |
| `relevance_score` | Modell-Selbsteinschätzung | plausibel vergeben, aber **wird nirgends zum Sortieren oder Filtern benutzt** |
| `freshness` | Modell, aus `published_date` | erstaunlich ehrlich: „neu" ⌀ 3,0 Tage, „mittel" ⌀ 11,0, „alt" ⌀ 58,1 Tage. Nur 2 von 69 „neu"-Karten sind älter als 7 Tage. |
| `is_repeat` | Modell, gegen `recentBlock` | **funktioniert nicht** — siehe B.3 |
| `level` | Modell | rein dekorativ, keine Auswirkung |
| `approved` | Code, hart `false` | **toter Code.** Der String `approved` kommt in `public/` **null mal** vor. Es gibt keine Freigabe-Oberfläche, keinen Admin-Screen, keine Query, die darauf filtert. Jede Karte ist sofort live. |
| Deduplizierung im Code | — | existiert nicht |
| Bildwahl | Code: Regex auf Plattform + Headline | funktioniert, Pool zu klein (siehe C.5) |

**Kartenzahl pro Lauf:** 6 bei allen Läufen bis 20.05., 5 bei beiden September-Läufen (einmal 4 am 20.04. mit dem Teaser „⚠️ Keine brandneuen News heute"). Die Prompt-Erlaubnis „weniger ist ok" wird also tatsächlich genutzt, aber nur zaghaft.

### A.6 Kosten pro Lauf, verifiziert

Aus `ai_usage_log`, Feature `daily_digest`:

| Datum | Input-Tok. | Output-Tok. | Suchen | Token-Kosten | Such-Kosten | **Summe** |
|---|---:|---:|---:|---:|---:|---:|
| 14.09.2026 | 104.371 | 3.566 | 9 | $0,6110 | $0,0900 | **$0,7010** |
| 09.09.2026 (Woche 07.09.) | 93.377 | 4.114 | 9 | $0,5697 | $0,0900 | **$0,6597** |
| 20.05.2026 | 56.279 | 4.209 | 0* | $0,3866 | $0,0000 | $0,3866* |
| 19.05.2026 | 57.356 | 4.660 | 0* | $0,4033 | $0,0000 | $0,4033* |

\* **Die alte Messung von „~0,41 $" ist zu niedrig.** Die Suchzählung war strukturell immer 0 — sie zählte `tool_use`-Blöcke mit Namen `web_search`, während das serverseitige Tool `server_tool_use` / `web_search_tool_result` liefert. Der Kommentar im aktuellen Code dokumentiert genau diesen Fix. Real lagen die Mai-Läufe bei ca. $0,45–0,50.

**Aufschlüsselung des aktuellen Laufs ($0,70):**

- **Input dominiert: $0,52 von $0,70.** Die 104k Input-Token sind fast ausschließlich Suchergebnis-Text, den das Tool in den Kontext schiebt, plus der wachsende `recentBlock`.
- Output: $0,09 (3.566 Token).
- Suche: $0,09 (9 Aufrufe × $0,01).

**Das Modell ist der größte Einzelhebel.** `claude-opus-4-5` kostet $5 / $25 je MTok. Bei identischem Token-Verbrauch:

| Modell | Token-Kosten | + Suche | **Summe** | Δ |
|---|---:|---:|---:|---:|
| `claude-opus-4-5` (heute) | $0,611 | $0,09 | **$0,701** | — |
| `claude-sonnet-5` ($2/$10) | $0,244 | $0,09 | **$0,334** | −52 % |
| `claude-haiku-4-5` ($1/$5) | $0,122 | $0,09 | **$0,212** | −70 % |

Die Aufgabe ist „Suchergebnisse lesen, auf Deutsch zusammenfassen, JSON ausgeben". Dafür ist Opus-Klasse deutlich überdimensioniert; Sonnet 5 ist hier der ehrliche Default.

**Prompt-Caching bringt hier nichts** und sollte nicht eingebaut werden: der Löwenanteil des Inputs sind bei jedem Lauf frische Suchergebnisse, und zwischen zwei Läufen liegen Tage — jeder Cache ist längst abgelaufen.

**Jahreskosten heute:** 52 × $0,70 ≈ **$36**.

### A.7 Fehlerfälle — was passiert, wenn etwas schiefgeht

| Fall | Verhalten heute | Sichtbar? |
|---|---|---|
| Suche liefert nichts | Modell füllt trotzdem mit Altem auf (40 Karten sind ⌀ 58 Tage alt, Maximum 160 Tage) | nein |
| Modell liefert ungültiges JSON | `throw`, HTTP 400, **kein `admin_errors`** | **nein** |
| Modell liefert leeres `cards` | `throw 'Keine Cards im JSON'`, kein Log | **nein** |
| Anthropic-API-Fehler | `throw`, kein Log | **nein** |
| Upsert scheitert | `throw`, kein Log | **nein** |
| Lauf fällt ganz aus | Vorwoche bleibt stehen. In der App wandert sie unter `<details>Frühere Tage</details>` — der Bereich „Diese Woche" ist dann **leer**, die Überschrift behauptet trotzdem „Diese Woche · 21.–27. September". Auf `/news/` erscheint „Zurzeit keine Ausgabe verfügbar." | halb |
| Mail scheitert | `admin_errors` wird geschrieben (diese Function loggt korrekt), aber **kein Retry** | ja, wenn jemand hinsieht |

**Der Beweis, dass das nicht theoretisch ist:**

```
cron.job_run_details, jobid 6: 18.08. … 09.09. jeden Tag "succeeded"
daily_digest:                 nichts zwischen 2026-05-20 und 2026-09-07
ai_usage_log (daily_digest):  nichts zwischen 2026-05-20 und 2026-09-09
admin_errors:                 kein einziger Eintrag für generate-daily-digest
```

`succeeded` beim Cron heißt nur, dass `net.http_post` die Anfrage in die Warteschlange gelegt hat — nicht, dass die Function durchgelaufen ist. 109 Tage Totalausfall, unbemerkt. Die Ursache lässt sich nachträglich nicht mehr rekonstruieren, weil die Edge-Function-Logs so weit nicht zurückreichen und nie etwas in `admin_errors` geschrieben wurde. Genau das ist der Befund.

**Nebenbefund zum Cron-Zeitplan:** Der Job heißt noch `daily-digest-generator` und lief nachweislich bis zum 09.09. täglich; der Zeitplan wurde erst danach auf `0 4 * * 1` umgestellt. Die Umstellung auf wöchentlich ist also wenige Tage alt — es gibt genau **zwei** Wochenausgaben, aus denen sich Qualität beurteilen lässt.

### A.8 Woche vs. Tag — was sich ändern müsste, was es kostet

**Was technisch nötig wäre für täglich:**

1. `getWeekStart()` raus, `date` = heutiges Datum (die Tabelle kann das, sie hieß nicht umsonst mal so).
2. `digest_cards_today` neu definieren (heute: `date = date_trunc('week', CURRENT_DATE)`).
3. In der SPA: `getWeekStartLocal`-Trennung „Diese Woche / Frühere Tage" umbauen — bei täglichen Ausgaben sind sieben Tagesblöcke in „Diese Woche" korrekt, heute ist es genau einer.
4. `recentBlock` begrenzen — bei täglicher Fahrweise und 28-Tage-Rückblick wächst die Liste auf ~80 Zeilen und treibt die Input-Token.
5. Mail-Cron entkoppeln: täglich mailen ist zu viel, wöchentlich mailen bei täglichen Karten braucht eine andere Auswahl-Query.

**Was es kostet.** Nicht ×7, weil weniger Suchen und weniger Output pro Lauf:

| Szenario | Suchen | Input | Output | $/Lauf | $/Woche | $/Jahr |
|---|---:|---:|---:|---:|---:|---:|
| Heute: wöchentlich, Opus 4.5, 10 Suchen, 5–6 Karten | 9 | 104k | 3,6k | $0,70 | $0,70 | **$36** |
| Wöchentlich, Sonnet 5, sonst gleich | 9 | 104k | 3,6k | $0,33 | $0,33 | **$17** |
| Täglich, Opus 4.5, unverändert | 9 | 104k | 3,6k | $0,70 | $4,91 | **$255** |
| Täglich, Sonnet 5, 3 Suchen, 2–3 Karten | 3 | ~45k | ~2,2k | ~$0,14 | ~$0,98 | **~$51** |
| Bedingt täglich (s. u.), Sonnet 5 | 3 | ~45k | ~1,3k Ø | ~$0,12 Ø | ~$0,84 | **~$44** |

Die Zahlen der unteren Zeilen sind Schätzungen, aber konservativ: der Input skaliert nahezu linear mit der Zahl der Suchen, weil die Suchergebnisse den Kontext füllen.

**Qualitätsrisiko an nachrichtenarmen Tagen.** Das ist kein hypothetisches Risiko, die Daten zeigen es bereits im damaligen Tagesbetrieb:

- 40 von 237 Karten sind als `alt` markiert und trotzdem veröffentlicht — im Schnitt 58 Tage alt, eine 160 Tage.
- 59 Karten (25 %) sind älter als 14 Tage.
- 47 Karten (20 %) sind vom Modell selbst als `is_repeat` markiert — und wurden trotzdem gezeigt, weil der Code das Feld nicht auswertet.
- „Local Feed" erschien an 8 verschiedenen Tagen zwischen dem 04.04. und 20.05., „Gemini" an 8, „240 Mrd. Dollar Werbeeinnahmen" dreimal in vier Tagen (14., 16., 17.05.).

Täglich zu veröffentlichen, ohne das zu lösen, produziert eine Wiederholungsmaschine — und Wiederholung ist das Gegenteil von „Grund, die App zu öffnen".

**Der Zwischenweg gibt es, und er ist der interessanteste Pfad: bedingt täglich.** Täglich suchen, aber nur veröffentlichen, wenn genug Substanz da ist. Technisch:

```
täglich 05:00:  suchen → bewerten
   ├─ ≥ 2 Karten mit relevance_score ≥ 7 und freshness = "neu"
   │     und keine davon is_repeat            → Ausgabe schreiben + Push/Mail
   └─ sonst                                   → nichts schreiben, Grund loggen
```

Der Filter läuft im Code, nicht im Prompt — das ist der Unterschied zu heute. Kosten laufen auch an leeren Tagen an (die Suche passiert ja), aber nur ~$0,12 statt $0,70. Und die Wochenmail montags fasst dann zusammen, was in den letzten 7 Tagen tatsächlich erschienen ist.

---

## B. Qualität der heutigen Ergebnisse

Vorbemerkung: Der Auftrag war „alle Zeilen der letzten 8 Wochen". Die gibt es nicht — zwischen 21.05. und 06.09. ist die Tabelle leer. Bewertet werden deshalb **die 10 Karten der beiden vorhandenen Wochenausgaben im Detail** plus die 227 Karten des früheren Tagesbetriebs aggregiert.

### B.1 Karte für Karte — Ausgabe 14.09.2026

| # | Headline | Plat. | Score | `published` | Abstand | Quelle | Urteil |
|---|---|---|---:|---|---:|---|---|
| 1 | Instagram testet Music Highlights auf iOS | IG | 5 | 10.09. | 4 T | SocialBee | **Füllmaterial.** Ein iOS-Test eines Profil-Features. „Beobachte die Funktion und plane, wie du Musik-bezogenen Content nutzen könntest, sobald das Feature live geht" ist kein Handlungsauftrag, das ist Luft. Und es ist die **erste** Karte. |
| 2 | Instagram First Draft: KI erstellt Reel-Rohschnitte | IG | 7 | 25.08. | **20 T** | NapoleonCat | Echte Neuigkeit, aber drei Wochen alt und trotzdem als `freshness: neu` geführt — einer der zwei Fehletiketten im Gesamtbestand. |
| 3 | TikTok Shop: Neue Seller Center Navigation | TT | 7 | 08.09. | 6 T | StackInfluence | **Zielgruppe verfehlt.** „Logge dich ins Seller Center ein, bevor du die nächste Bestellwelle abarbeitest" — ein DACH-Micro-Creator mit 5k Followern hat keinen TikTok Shop und keine Bestellwelle. `level: hoch`. |
| 4 | Reels dominieren: 50 % der Instagram-Zeit | IG | 8 | 07.09. | 7 T | New Engen | **Evergreen als News verkauft.** Die Zahl ist eine Meta-Kennzahl, keine Meldung dieser Woche; die Quelle ist eine dauerhaft gepflegte „Instagram Trends"-Seite. Der `impact` („Priorisiere Reels") steht seit zwei Jahren in jedem Ratgeber. |
| 5 | Instagram KI-Labels werden präziser | IG | 6 | 10.09. | 4 T | SocialBee | Echte Neuigkeit, ordentlich. `impact` ist allerdings generisch („Nutze deine menschliche Authentizität als Differenzierungsmerkmal"). |

**Bilanz der Woche:** 1 solide Neuigkeit, 2 brauchbare, 1 Evergreen, 1 Füllmaterial. Vier von fünf Karten sind Instagram. Kein YouTube, kein Meta, nichts Rechtliches, nichts DACH.

### B.2 Karte für Karte — Ausgabe 07.09.2026

| # | Headline | Plat. | Score | `published` | Abstand | Quelle | Urteil |
|---|---|---|---:|---|---:|---|---|
| 1 | Instagram rollt 'Your Algorithm' global aus | IG | 9 | 04.09. | 3 T | Metricool / HeyOrca | **Gut.** Echte Meldung, frisch, `impact` konkret genug. |
| 2 | Meta Summit: 70–80 % Performance kommt vom Creative | Meta | 8 | **09.09.** | **−2 T** | Billo / Aspire | Inhaltlich stark, aber das `published_date` liegt **nach** dem Ausgabedatum — Folge des Nachholens am 09.09. |
| 3 | TikTok: Creator können Keywords selbst verwalten | TT | 7 | 02.09. | 5 T | HeyOrca | **Die beste Karte beider Wochen.** Neu, betrifft jeden Creator, `impact` ist ausführbar. |
| 4 | Instagram testet Boni für Fotos und Carousels | IG | 7 | 26.08. | 12 T | NapoleonCat | Relevant (Geld!), aber 12 Tage alt und als `freshness: mittel` korrekt markiert. |
| 5 | EU AI Act: KI-Kennzeichnung ab August Pflicht | allg. | **9** | 02.08. | 36 T | linkdash.eu | **Wichtigstes Thema, schwächste Ausführung — und es steht ganz unten.** Siehe B.5. |

### B.3 Wiederholungen über Wochen

Aus dem Tagesbetrieb, Headline-Stichworte über alle 45 Ausgaben:

| Stichwort | Karten | verschiedene Tage | Zeitraum |
|---|---:|---:|---|
| Shop | 17 | 15 | 07.04.–14.09. |
| Werbe… | 13 | 13 | 15.04.–17.05. |
| Shorts | 12 | 12 | 17.04.–19.05. |
| Local Feed | 8 | 8 | 04.04.–20.05. |
| Gemini | 8 | 8 | 06.04.–13.05. |
| Original (Content) | 6 | 6 | 20.04.–18.05. |
| Creator Marketplace | 5 | 5 | 16.04.–10.05. |
| „240 Mrd." | 3 | 3 | 14.–17.05. |

47 Karten (20 %) tragen `is_repeat: true`. **Der Code liest das Feld nie.** Die App auch nicht. Es wird berechnet, gespeichert und ignoriert — ein Ein-Zeilen-Filter wäre der billigste Qualitätsgewinn im ganzen System.

Warum `is_repeat` trotzdem nicht reicht: Der `recentBlock` liefert dem Modell nur `headline` + 60 Zeichen `summary`. „TikTok Local Feed rollt in den USA aus" und „TikTok Local Feed bringt lokale Reichweite" sehen darin verschieden genug aus, dass das Modell `false` setzt.

### B.4 Impact-Feld: konkret oder generisch?

Von den 10 September-Karten:

- **Konkret und ausführbar (3):** „Logge dich ins Seller Center ein…" (falsche Zielgruppe, aber konkret), „Nutze die neue Keyword-Funktion aktiv, um deine Videos zu optimieren", „Prüfe JETZT deinen Workflow auf KI-Einsatz und implementiere klare Kennzeichnungen".
- **Halb konkret (3):** „Teste First Draft für deine nächsten Reels", „Priorisiere Reels in deiner Content-Strategie", „Behalte deine Creator-Einstellungen im Blick".
- **Generisch (4):** „Werde noch spezifischer in deiner Nische", „Investiere in diverse, authentische Creator-Creatives", „Nutze deine menschliche Authentizität als Differenzierungsmerkmal", „Beobachte die Funktion und plane, wie du … könntest".

Rund **40 % der `impact`-Felder sind Sprechblasen.** Die Prompt-Formulierung „was soll der Creator JETZT konkret tun?" reicht offenbar nicht; es fehlt ein Negativbeispiel im Prompt.

Nebenbefund zur Länge: Der Prompt verlangt für `full_content` mindestens 250 Wörter (bei Score 9–10 mindestens 4 Absätze). Gemessen: 1.083 bis 1.598 Zeichen, also **rund 160–240 Wörter**. Das Modell unterschreitet die Vorgabe durchgehend, auch bei den Score-9-Karten. Entweder die Vorgabe anpassen oder `max_tokens` und Ausgabeprüfung nachziehen — heute wird es einfach hingenommen.

### B.5 Quelle, `source_url`, `published_date`

**Erreichbarkeit:** Alle 8 geprüften URLs antworten (SocialBee gibt einem Kommandozeilen-Client 403, im Browser ist die Seite erreichbar). Kein toter Link.

**Aber die URLs zeigen überwiegend nicht auf die Meldung.** `socialbee.com/blog/instagram-updates/`, `napoleoncat.com/blog/instagram-new-features-and-updates/`, `metricool.com/instagram-news/`, `heyorca.com/blog/tiktok-social-news`, `newengen.com/insights/instagram-trends/` — das sind laufend überschriebene Sammelseiten. Wer in vier Wochen auf „Quelle lesen" klickt, findet die Meldung dort nicht mehr. Für ein Produkt, dessen Wert „ich habe es geprüft" ist, ist das die schlechtestmögliche Belegform.

**`published_date` gegen Ausgabedatum**, alle 237 Karten:

| Kennzahl | Wert |
|---|---|
| Durchschnittlicher Abstand | **18,2 Tage** |
| Maximum | **160 Tage** |
| Älter als 14 Tage | 59 Karten (25 %) |
| `published_date` in der Zukunft | 1 |

Der frühere Befund „bis zu 5 Wochen Abstand" ist also noch zu freundlich.

**Faktenprüfung an einer Karte.** Die EU-AI-Act-Karte vom 07.09. schreibt: „Bußgelder können bis zu 35 Mio. Euro oder 7 % des Jahresumsatzes betragen." Die 35 Mio. / 7 % sind im AI Act die Obergrenze für **verbotene Praktiken** nach Art. 5. Für Verstöße gegen die **Transparenzpflichten** nach Art. 50 — genau das, worum es in der Karte geht — liegt die Grenze niedriger; deutschsprachige Fachquellen nennen für diesen Fall 15 Mio. €. Die Karte übernimmt die höchste Zahl aus dem Regelwerk und hängt sie an den falschen Tatbestand. Das ist kein Tippfehler, sondern die absehbare Folge davon, dass ein englischsprachiger Aggregator (`linkdash.eu`) als Quelle für deutsches Recht dient. Bei Rechtsthemen ist das ein Haftungsthema, kein Qualitätsthema.

**`image_url` leer:** 40 von 237 Karten (**17 %**). In beiden September-Ausgaben: 0 — der Bildmechanismus greift dort durchgehend.

### B.6 Was systematisch fehlt

Stichprobe gegen das, was im Zeitraum tatsächlich relevant war:

| Thema | Im Digest? | Tatsächlich relevant |
|---|---|---|
| **Deutsches Wettbewerbsrecht / Kennzeichnung** | **nie** | OLG Karlsruhe 2026: Kennzeichnungspflicht auch **ohne** Bezahlung, bei bloßen geldwerten Vorteilen; dazu ein BVerfG-Beschluss. Das ändert für jeden Micro-Creator mit PR-Paketen die Praxis. |
| **Digital Fairness Act** | nie | Erster Entwurf für Herbst 2026 angekündigt, zielt direkt auf Influencer-Marketing-Transparenz. |
| **AI Act Art. 50 korrekt eingeordnet** | 1× falsch | Seit 02.08.2026 in Kraft, betrifft KI-Bilder, Deepfakes, Voice-Clones in Posts. |
| **DSA-Pflichten bei Video/Live** | nie | Durchgehende Sichtbarkeit kommerzieller Kommunikation in Videos. |
| **Mosseri-Aussagen im Original** | nie direkt | Sends-per-Reach als stärkstes Signal, Jahresend-Memo zu „raw, real human content", Trial-Reels-Empfehlung — alles über Dritte referiert, nie von `about.instagram.com`. |
| **KI-Tools für Creator** | randständig | Der Prompt nennt nur „Canva, CapCut" — die eigentliche Welle (Schnitt-KI, Voice, Thumbnail-Generatoren) taucht kaum auf. |
| **Studien / belastbare Zahlen** | selten | Wenn, dann US-Werbemarktzahlen („240 Mrd."), die ein DACH-Micro-Creator nicht handeln kann. |
| **Brand-Deals / Preise im DACH-Markt** | nie | Was ein Reel bei 10k Followern in Deutschland kostet — das Thema, das diese Zielgruppe am meisten interessiert. |

Das Muster ist eindeutig: **Der Digest berichtet über den US-Plattformmarkt aus Sicht von Social-Media-Agenturen. Die Zielgruppe ist ein deutschsprachiger Micro-Creator.** Das ist eine andere Zeitung.

---

## C. Darstellung in der App

### C.1 Die News-Seite, aktueller Stand (`renderDigest`, `public/app/index.html:5018`)

```
┌──────────────────────────────────────────┐
│ Creator News                             │  page-title
│ Diese Woche · 14.–20. September          │  page-sub, immer der
│                                          │  laufenden Woche
│ (Alle) (Instagram) (TikTok)              │  filter-row, scrollbar
├──────────────────────────────────────────┤
│ HEUTE · MONTAG, 14. SEPTEMBER ──────────  │  day-head
│ ┌──────────────────────────────────────┐ │
│ │ [  Stockbild 130px, 1,05 MB        ] │ │
│ │ INSTAGRAM          SocialBee    ⌄   │ │  Quelle steht OBEN rechts
│ │ Instagram testet Music Highlights    │ │  ← Score 5, erste Karte
│ │ Instagram arbeitet an einer neuen …  │ │
│ └──────────────────────────────────────┘ │
│ ┌──────────────────────────────────────┐ │
│ │ … Karte 2 …                          │ │
│ └──────────────────────────────────────┘ │
│ ┌──────────────────────────────────────┐ │
│ │ … Karte 3 …                          │ │
│ └──────────────────────────────────────┘ │
│ ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐ │
│   ☐ Creator News täglich per Mail …     │  nl-line, nach Karte 3
│ └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘ │
│ ┌──────────────────────────────────────┐ │
│ │ … Karten 4, 5 …                      │ │
│ └──────────────────────────────────────┘ │
│                                          │
│              Frühere Tage                │  <details>, ZU
└──────────────────────────────────────────┘
```

**Was oben steht:** die Karte, die das Modell zufällig zuerst geschrieben hat. Diese Woche ist das der schwächste Eintrag.

**Wie prominent die neuesten Karten sind:** Alle Karten sind gleich groß, gleich gestaltet, gleich laut. Es gibt keine Hierarchie — kein Aufmacher, keine Abstufung nach `relevance_score`, keine Markierung „wichtig". Die einzige Auszeichnung im Datensatz (`level: hoch|mittel|info`) wird in der App gar nicht dargestellt.

**Der Weg zu früheren Tagen geht unter — und ist schlimmer als gedacht.** `<details class="earlier-days">` mit `summary` „Frühere Tage" ist zentriert, grau, ohne Pfeilmarker (`list-style:none`, `::-webkit-details-marker{display:none}`) und steht ganz unten. Es sieht nicht nach einem Bedienelement aus. Dahinter liegt bei Wochenrhythmus genau **eine** Ausgabe.

Und im Fehlerfall kippt die Seite: fällt ein Montagslauf aus, ist `thisWeek` leer, `earlier` enthält die Vorwoche, `shown > 0` — die Seite zeigt dann **nur die graue Zeile „Frühere Tage"** unter der Überschrift „Diese Woche · …". Kein Leerzustand, kein Hinweis, nichts.

**Tagesüberschriften passen nicht zum Wochenrhythmus.** `dayHeading()` schreibt „Heute · Montag, 14. September", am Dienstag „Gestern · Montag", ab Mittwoch „Montag, 14. September". Eine Wochenausgabe, die sieben Tage abdeckt, wird als Tagesmeldung etikettiert — und wirkt ab Mittwoch alt, obwohl sie es nicht ist.

**Quelle:** `card-source` steht in der Meta-Zeile **oben rechts**, gleichrangig neben dem Plattform-Badge, in `--subtle`. Der Wunsch „dezenter, aber nicht verschwinden" heißt hier: sie gehört nach unten in die Karte, in eine eigene Fußzeile zusammen mit dem Datum.

### C.2 Dashboard-Teaser (`public/app/index.html:2016`)

```
┌──────────────────────────────────────────┐
│ Creator News                    Alle  ›  │
├──────────────────────────────────────────┤
│ INSTAGRAM                     SocialBee  │
│ Instagram testet Music Highlights auf …  │  ← Score 5
├──────────────────────────────────────────┤
│ INSTAGRAM                   NapoleonCat  │
│ Instagram First Draft: KI erstellt …     │  ← Score 7
└──────────────────────────────────────────┘
```

Zwei Zeilen, klickbar als Ganzes, führen auf `#/digest`. Ordentlich gebaut. Drei Probleme:

1. **`cards.slice(0,2)` nimmt die ersten zwei, nicht die besten zwei.** Der Teaser dieser Woche zeigt Score 5 und 7 und verschweigt die Score-8-Karte.
2. **Kein Alterslimit.** Die Query ist `order(date desc).limit(1).single()` — ohne `gte('date', …)`. Während der 109 Tage Ausfall hat das Dashboard weiter die Karten vom 20. Mai angezeigt, ohne Datum, ohne Hinweis. Es würde das heute wieder tun.
3. **Kein Datum, kein „neu"-Signal.** Nichts sagt dem Nutzer, ob das von heute oder vom Mai ist — und genau das wäre der Wiederkehr-Anreiz.

Der `teaser`-Text aus der Datenbank (drei Emoji-Zeilen, extra generiert) wird auf dem Dashboard **nicht verwendet** und auf der News-Seite auch nicht. Er kostet Output-Token bei jedem Lauf und erscheint nirgends.

### C.3 Plattform-Filter-Pills — braucht es sie?

Gemessen an den Bestandsdaten, Karten je Plattform und Ausgabe:

| Ausgabe | Instagram | TikTok | YouTube | Meta | Allgemein |
|---|---:|---:|---:|---:|---:|
| 14.09. | 4 | 1 | 0 | 0 | 0 |
| 07.09. | 2 | 1 | 0 | 1 | 1 |
| Tagesbetrieb, typisch | 1–2 | 1–2 | 1–2 | 1–2 | 0–1 |

**Nein.** Bei 5 Karten pro Woche stehen hinter jeder Pill ein bis zwei Karten, hinter mehreren null. Die Pills werden aus `allCards()` gebaut, also aus dem gesamten 14-Tage-Fenster — es kann eine Pill geben, die für „Diese Woche" leer ist und beim Klick den Leerzustand „Keine Karten. Für diesen Filter gibt es nichts." zeigt. Ein Filter, der auf leere Ergebnisse führt, ist schlechter als kein Filter.

Dazu kommt: Die Pill-Zeile ist das Erste unter der Überschrift. Sie kostet vertikalen Platz genau dort, wo die wichtigste Nachricht stehen sollte.

**Alternativen, falls doch gefiltert werden soll:**

- **„Nur Wichtiges"** — ein einzelner Schalter auf `relevance_score >= 8` bzw. `level = hoch`. Das ist die Frage, die ein Nutzer tatsächlich hat („was muss ich wissen, wenn ich 30 Sekunden habe"), und sie funktioniert auch bei 5 Karten.
- **Themen statt Plattformen** — „Algorithmus / Geld / Recht / Tools" bildet ab, wonach jemand sucht. Braucht aber ein neues Feld in der Karte und lohnt erst bei mehr Volumen.
- **Nichts.** Bei 5 Karten ist Scrollen billiger als Filtern. Das ist die ehrliche Empfehlung für heute.

### C.4 Aufgeklappte Karte

Klick auf die Karte togglet `.expanded`; der Link „Quelle lesen" hat `stopPropagation`.

**Was funktioniert:** Der Aufbau stimmt — Volltext, dann der abgesetzte Block „⚡ Was das für dich bedeutet" auf `--surface2`, dann die Aktionszeile. Der Impact-Block ist das beste Element der ganzen Seite; er macht sichtbar, warum das hier und nicht bei Google steht.

**Was fehlt:**

- **Kein Lesezeichen / Speichern.** Es gibt keine Tabelle dafür, keinen Knopf. Für ein Feature, dessen Ziel Wiederkehr ist, ist „ich hebe mir das auf" der natürlichste Grund wiederzukommen — und er existiert nicht.
- **Keine Gelesen-Markierung.** Nichts unterscheidet Gesehenes von Neuem. Wer zweimal pro Woche reinschaut, sieht beim zweiten Mal dieselbe Wand.
- **Kein „neu seit deinem letzten Besuch"-Zähler**, weder im Sidebar-Eintrag noch als Badge. Der Anfragen-View hat so ein Badge (`new-count-badge`) — hier fehlt es.
- **Kein Datum in der Karte.** Auf `/news/` wird im Archiv ein Datum gezeigt, in der App nie. Nur die Tagesüberschrift trägt es.
- **Kein `published_date`.** Dass eine Meldung 20 Tage alt ist, sieht man nicht.
- **Der Volltext ist `escHtml` + `white-space: pre-line`.** Das Modell schreibt `**Fettungen**` in Markdown — die öffentliche Seite löst sie auf (`escMitFett`), **die App nicht.** In der App stehen die Sternchen sichtbar im Text.

### C.5 Bilder

61 Stockbilder (Unsplash) in Supabase Storage, 9 Kategorien. Die Nutzung ist stark ungleich verteilt: `meta` 7 Bilder / 38 Nutzungen, `tiktok` 9 / 36, `trends` 6 / 0. Bei 45 Ausgaben heißt das: dasselbe Bild erscheint alle paar Wochen wieder.

**Und sie sind zu groß.** Ein Beispielbild: **1.047.680 Bytes = 1,05 MB** für eine Kachel, die mit `height:130px; object-fit:cover` dargestellt wird. Bei 5 Karten sind das ~5 MB pro Seitenaufruf für Deko. `loading="lazy"` hilft nur für die unteren Karten. Die öffentliche Seite `/news/` hat die Bilder deshalb **bewusst komplett weggelassen** — der Kommentar im Quelltext sagt es ausdrücklich („~2,5 MB pro Stueck, und weder Supabase noch Cloudflare skalieren sie hier").

Das heißt: **die App liefert 5 MB Stockfotos aus, die die eigene öffentliche Seite als untragbar eingestuft hat.**

### C.6 Teilen

Der aktuelle Code (`shareCard`, `public/app/index.html:5151`):

```js
const text = `📰 ${headline}\n\n${summary ? summary.slice(0,120)+'…' : ''}\n\nMehr Creator-News auf viuno.de`
if (navigator.share) { await navigator.share({ title: headline, text, url: 'https://viuno.de' }) }
else await navigator.clipboard.writeText(text)
```

Der tatsächliche Text (kein „👉", das war eine ältere Fassung):

```
📰 Instagram rollt 'Your Algorithm' global aus

Instagram gibt allen englischsprachigen Nutzern weltweit Zugriff auf die 'Your
Algorithm'-Steuerung — Nutzer können jetzt aktiv festlegen, welche Th…

Mehr Creator-News auf viuno.de
```

**Wie das ankommt:**

- **WhatsApp / iMessage (mit `navigator.share`):** Das System hängt `url` an `text` an. Empfangen wird der Block oben **plus** eine Zeile `https://viuno.de`. Die Linkvorschau zeigt die viuno-**Startseite** — Logo, „Deine Creator-Toolbox", nichts von der News. Wer klickt, muss die News selbst suchen; sie steht auf `/news`, das von der Startseite nicht verlinkt ist. Praktisch: **der Empfänger findet die geteilte Nachricht nicht.**
- **Instagram-DM:** `navigator.share` bietet Instagram meist gar nicht als Ziel für reinen Text an; landet es doch dort, ist der 5-zeilige Block mit abgeschnittenem `…` für eine DM viel zu lang.
- **Desktop (kein `navigator.share`):** nur Zwischenablage, ohne URL. Der Empfänger bekommt Text ohne jeden Link.

**Gibt es eine öffentliche URL pro News? Nein.** Es gibt `/news` als Seite, aber keine Karten-URL, keinen Anker, keine ID im DOM. Die Karten haben in der Datenbank nicht einmal einen eigenen Schlüssel — sie sind Elemente eines jsonb-Arrays; die Views vergeben `card_index` erst zur Laufzeit.

**Was eine teilbare News-URL bräuchte** (Aufwand im Detail in Phase 2.4):

1. Eine stabile Kennung pro Karte — `slug` beim Generieren mitschreiben (aus Datum + Kurzform der Headline), sonst verschiebt sich alles beim nächsten Upsert.
2. Route `/news/<slug>` über `_redirects` auf `public/news/index.html` (dasselbe Muster wie `/analyse/*`, das es schon gibt).
3. **OG-Tags pro Karte** — und das ist der Haken: `/news/index.html` ist statisches HTML auf Cloudflare Pages, die Karten kommen per `fetch`. WhatsApp, iMessage und Instagram führen kein JavaScript aus, sie lesen nur das ausgelieferte HTML. Clientseitig gesetzte `og:title` werden **nie** gesehen. Es braucht entweder einen Cloudflare Worker / Pages Function, die die Tags serverseitig einsetzt, oder eine Edge Function, die `/news/<slug>` als fertiges HTML ausliefert.

### C.7 Newsletter / Mail-Digest

**Es gibt einen Versand — er ist nur noch nie gelaufen.**

`send-weekly-digest-email`, montags 04:30 UTC:

1. Digest der laufenden Woche laden. Keiner da → sauber überspringen.
2. `users` mit `newsletter_subscribed = true` und `deleted_at is null`.
3. Pro Abonnent: `digest_email_log` auf `(user_id, week_start)` prüfen (Doppelversand-Schutz), Name bestimmen, HMAC-Abmeldetoken rechnen, prüfen ob es eine fertige Analyse gibt, HTML bauen, Resend, Log schreiben, 550 ms warten.
4. Bei Fehlschlägen: `admin_errors` (korrekt implementiert, im Gegensatz zur Generierung).

**Inhalt und Design der Mail** — das ist gut gemacht:

```
┌────────────────────────────────────┐
│ [v] viuno                          │
│                                    │
│ Deine Creator News der Woche       │  21px, bold
│ Hallo <Name>, hier sind die        │
│ wichtigsten Neuigkeiten …          │
│                                    │
│ ┌────────────────────────────────┐ │
│ │ [    Bild, max-height 180px   ]│ │  ← Top-Story, nach
│ │ [INSTAGRAM]                    │ │    relevance_score
│ │ Instagram rollt 'Your Algo…    │ │    sortiert
│ │ Instagram gibt allen …         │ │
│ │ Mehr lesen →                   │ │
│ └────────────────────────────────┘ │
│ ┌────────────────────────────────┐ │
│ │ [META]  Meta Summit: 70-80 %…  │ │  ← Rest, kompakt
│ └────────────────────────────────┘ │
│ … 3 weitere …                      │
│                                    │
│   [ Alle News in viuno ansehen ]   │
│                                    │
│ ┌────────────────────────────────┐ │
│ │ 📊 Noch keine Analyse gemacht? │ │  ← wechselt zu
│ │    [ Jetzt analysieren ]       │ │    „Media Kit updaten",
│ └────────────────────────────────┘ │    wenn Analyse existiert
│ ────────────────────────────────── │
│ Abmelden · Impressum · Datenschutz │
└────────────────────────────────────┘
```

Tabellen-Layout, Inline-Styles, Plattform-Badges, sekundärer CTA je nach Nutzerzustand, Abmeldelink mit HMAC-Token, Impressum und Datenschutz im Fuß. Das ist handwerklich die sauberste Komponente des ganzen News-Features.

**Aber:**

- **`digest_email_log`: 0 Zeilen.** Noch nie versandt.
- **Heute 04:30 gescheitert:** `Abonnenten laden fehlgeschlagen: Gateway Timeout` — bei einer Query auf eine Tabelle mit **5 Zeilen**. Das ist kein Datenvolumen-Problem, sondern ein transienter PostgREST-Fehler (vermutlich Cold Start). Es gibt keinen Retry und keinen Wiederanlauf. Nächster Cron ist in 7 Tagen, dann mit anderem `weekStart` — **die Mail dieser Woche geht nie raus.**
- **Alle Links in der Mail zeigen auf `https://viuno.de/digest`** — die Login-Seite. Jede Headline, jedes „Mehr lesen", der große CTA. Auch der Top-Story-Bildlink. Die öffentliche Seite `/news` kommt nicht vor.
- **Die Mail lädt die 1-MB-Stockbilder** als Top-Story-Bild.

**Was der Newsletter-Haken auf der News-Seite bewirkt** — und hier liegt ein Konsistenzfehler:

| Ort | schreibt `users.newsletter_subscribed` | schreibt `newsletter_subscribers` |
|---|---|---|
| News-Seite, `nl-line` (`toggleNewsMail`) | ja | **nein** |
| Profil-Seite (`toggleNewsletter`) | ja | ja (`status: active` / `unsubscribed`) |
| `digest-unsubscribe` (Mail-Link) | ja | **nein** |

Der Versand liest nur `users`, funktioniert also. Aber `newsletter_subscribers` (3 Zeilen) driftet ab: wer sich über die News-Seite oder den Mail-Link abmeldet, steht dort weiter als `active`. Sollte diese Tabelle je für einen Versand benutzt werden, bekommt ein Abgemeldeter Post — und das ist dann ein rechtliches Problem, kein Datenpflegeproblem.

**Und die Beschriftung ist falsch:** „Creator News **täglich** per Mail bekommen" / „Kommt **täglich** per Mail". Die Mail ist wöchentlich. Das steht zweimal im Code und einmal als Toast.

### C.8 Die öffentliche Seite `/news/` — fertig gebaut, nicht angeschlossen

`public/news/index.html`, 13 KB, eigenständig, kein supabase-js, zwei REST-Aufrufe mit dem publishable Key gegen `digest_cards_today` und `digest_cards_past`. Verifiziert: die API antwortet anonym mit HTTP 200.

Was sie kann und die App nicht: Datum pro Archivkarte, Markdown-Fettungen aufgelöst, Nachladen in 18er-Schritten, Hinweisbox „Lieber per Mail? → Konto anlegen", Footer mit Rechtslinks, saubere Startseiten-Optik.

Was fehlt: **jeder Weg dorthin.**

- Startseite, Kachel „Creator News" → `href="/digest"` → **Login-Wand**.
- Kein Link im Footer der Startseite.
- Kein Link aus der App.
- Kein Link aus der Mail.
- Der Teilen-Knopf gibt `https://viuno.de` mit, nicht `/news`.

Die Seite ist über `canonical` und `og:*` für Suchmaschinen vorbereitet, hat aber keinen einzigen internen Link — für SEO praktisch unsichtbar.

Zwei Nebenbefunde:
- `digest_cards_today` filtert auf `date = date_trunc('week', CURRENT_DATE)`. Fällt ein Montagslauf aus, zeigt die Seite „Zurzeit keine Ausgabe verfügbar." — obwohl die Vorwoche im Archiv darunter steht. Ein Besucher sieht zuerst eine Fehlmeldung.
- `CLAUDE.md` sagt „es gibt kein `_headers`" — das stimmt nicht mehr, `public/_headers` existiert und sperrt `/karussell/*`. Beim nächsten Anfassen mitziehen.

---

## D. Verbindung zum Swipe-File (nachrangig)

**Korrektur zur Ausgangsannahme:** Das Swipe-File-Frontend ist **keine eigene Cloudflare-Pages-Seite** — es liegt in diesem Repo unter `public/karussell/` (`index.html` + `app.js`, 2.533 Zeilen) und wird über `public/_headers` mit `X-Frame-Options: DENY`, `frame-ancestors 'none'` und `noindex` abgeschirmt. Nur das **Backend** ist getrennt: Supabase-Projekt `dodglijurmtrbwnjivlg`, eine Edge Function `admin-api`.

### D.1 Die Schnittstelle, wie sie heute aussieht

Aus dem Client rekonstruiert (auf das fremde Projekt habe ich keinen Zugriff):

```
POST/GET  https://dodglijurmtrbwnjivlg.supabase.co/functions/v1/admin-api<pfad>
Header:   X-Admin-Token: <Token>      (localStorage "viuno-admin-token")
          ODER Supabase-Sitzung von viuno.de (gleiche Herkunft, /admin/)
```

| Pfad | Zweck |
|---|---|
| `/posts`, `/post/<id>` | Liste und Detail der gefundenen Karussells |
| `/post/<id>/status`, `/skript`, `/caption` | Zustand, Skript, Caption ändern |
| `/post/manual` | **POST `{url}`** — Instagram-Link einwerfen: holen, Bilder sichern, bewerten. Antwort: `{post_id, relevance, slides, kosten}` oder `{status:'bereits_vorhanden', post_id, hinweis}` |
| `/accounts`, `/keywords`, `/settings`, `/scores` | Watchlist, Keywords, Konfiguration, Bewertungsgewichte |
| `/runs`, `/run/status`, `/run/phase/<phase>` | Scrape-Läufe steuern und beobachten |
| `/zip/<id>`, `/own/fetch`, `/own/offen` | Bilder-Download, eigene Beiträge nachziehen |

Auf viuno-Seite existiert `ig_carousels` (6 Zeilen, `is_admin()`-RLS): `post_date`, `title`, `slides` jsonb, `caption`, `status`, `kind`, `scores`, `reason`, `sources`, `metrics`, `total_score`. Das ist die **Produktionstabelle für eigene Karussells** — nicht das Swipe-File, sondern dessen Ziel.

### D.2 Richtung 1 — Swipe-File-Funde als Quelle im Digest

**Konzeptionell möglich.** Nötige Felder für einen Transport:

| Digest-Feld | Woher aus dem Swipe-File |
|---|---|
| `headline` | `title` (oder aus der Caption abgeleitet) |
| `summary` | Kurzfassung der Caption, muss neu erzeugt werden |
| `source` | „Instagram · @handle" |
| `source_url` | Post-Permalink |
| `published_date` | `post_date` |
| `platform` | fest `instagram` |
| `relevance_score` | vorhandener Viuno-Relevanz-Score, Skala abgleichen |
| `impact` | **fehlt komplett** — müsste erzeugt werden |
| `full_content` | fehlt |

**Transport:** `pg_net` aus dem viuno-Projekt gegen `admin-api` (Token im Vault) wäre der geradlinigste Weg — kein neuer Endpunkt auf der Gegenseite nötig, wenn `/posts` einen Zeitfilter kennt. Alternativ ein Webhook vom Swipe-File nach dem Sonntagslauf in eine Staging-Tabelle. Deduplizierung müsste auf viuno-Seite über die Permalink-URL laufen, weil nur dort der Digest-Bestand liegt.

**Bewertung: nicht machen.** Was das Swipe-File findet, sind **gut performende Karussells anderer Creator** — Format-Vorlagen. Das ist keine Neuigkeit. Ein Eintrag „@xyz hat ein Karussell über Hook-Schreiben gepostet, 12k Likes" beantwortet die Frage „was hat sich verändert, das ich wissen muss?" nicht. Er würde den Digest verwässern und genau die Evergreen-Schlagseite verstärken, die schon jetzt das Hauptproblem ist (B.1, Karte 4). **Nutzen für die App-Nutzung: gering bis negativ.** Aufwand: mittel (Score-Mapping, Zusammenfassung erzeugen, Dedup). Risiko: hoch — zwei bewusst getrennte Systeme verschränken sich, und die Trennung ist gut begründet (unterschiedliche Datenhoheit, das Swipe-File ist rein intern und `noindex`).

### D.3 Richtung 2 — aus einer News einen Karussell-Vorschlag anstoßen

**Was es bräuchte:**

- **Swipe-File-Seite:** einen neuen Endpunkt, etwa `POST /post/thema`, der `{titel, kern, quelle_url, datum}` annimmt und eine Zeile mit `source: manual`, ohne Slides, ohne Bilder anlegt. `/post/manual` **taugt dafür nicht** — es erwartet eine Instagram-URL und startet Scrape + Bildsicherung + Bewertung.
- **viuno-Seite:** einen Knopf. Es gibt aber **keine Digest-Oberfläche im Admin** — `public/admin/index.html` fasst nur `users` an, und `approved` kommt im gesamten `public/`-Baum nicht vor. Der Knopf bräuchte also erst eine Admin-Ansicht für den Digest.

**Bewertung: der Nutzen liegt auf der Content-Produktionsseite, nicht bei der App-Nutzung.** Nach der gesetzten Zielvorgabe ist das damit nachrangig. Aufwand klein bis mittel, Risiko gering (eine Richtung, keine Datenrückflüsse). Wenn überhaupt, dann **diese** Richtung zuerst — sie schreibt nur, liest nichts, und vermischt die Systeme nicht.

### D.4 Was ich zum echten Prüfen bräuchte

- Lesezugriff auf Supabase-Projekt `dodglijurmtrbwnjivlg` (Tabellenschema, Edge-Function-Quelltext `scrape` / `analyze` / `admin-api`).
- Ein gültiges `X-Admin-Token` oder eine Beispielantwort von `GET /posts` und `GET /post/<id>`, um die tatsächlichen Feldnamen zu sehen.
- Den Bewertungs-Prompt aus `analyze`, um zu beurteilen, ob „viuno-Relevanz" und `relevance_score` im Digest überhaupt vergleichbar sind.

---

# Phase 2: Konzept

## 2.1 Rhythmus-Empfehlung

**Empfehlung: bedingt täglich, aber erst nach Schritt 2.2 — und vorher einen Monat lang messen.**

Die Begründung in der Reihenfolge, in der sie trägt:

**Erstens: Ein täglicher Rhythmus schlägt einen wöchentlichen nur, wenn es täglich etwas zu sagen gibt.** Die Bestandsdaten sagen, dass es das nicht gibt. Im Tagesbetrieb waren 25 % der Karten älter als zwei Wochen, 20 % waren selbst-markierte Wiederholungen, „Local Feed" kam achtmal. Ein täglicher Digest mit dem heutigen Prompt und den heutigen Quellen erzeugt sechs Tage Wiederholung für einen Tag Substanz. Das zerstört Vertrauen schneller, als eine wöchentliche Ausgabe es aufbauen kann.

**Zweitens: Die Benachrichtigung ist der Wiederkehr-Hebel, nicht die Frequenz.** Eine Ausgabe, von der niemand erfährt, erzeugt keine Wiederkehr — egal wie oft sie erscheint. Der Beweis liegt vor: die Wochenmail existiert seit dem 09.09. und ist **null Mal** verschickt worden. Bevor über 7× nachgedacht wird, muss 1× funktionieren.

**Drittens: Push gibt es nicht und lohnt jetzt nicht.** Die App ist eine statische SPA auf Cloudflare Pages ohne Service Worker, ohne Manifest, ohne VAPID-Schlüssel, ohne Push-Subscription-Tabelle. Web-Push auf iOS setzt zusätzlich voraus, dass der Nutzer die Seite zum Home-Bildschirm hinzufügt — bei 5 Nutzern ist das kein Kanal, sondern ein Projekt. **Mail ist der Kanal.** Sie ist gebaut, sie ist gut, sie muss nur laufen.

**Der Pfad, in dieser Reihenfolge:**

| Stufe | Was | Kosten/Jahr | Vorbedingung |
|---|---|---:|---|
| **0** | Wöchentlich bleiben. Mail zum Laufen bringen, Fehler-Logging einbauen, Messung einbauen (2.6). | $36 (→ $17 mit Sonnet 5) | — |
| **1** | Pipeline schärfen (2.2). Weiter wöchentlich. Vier Wochen messen: Öffnungen der News-Seite pro Nutzer und Woche, Mail-Klicks. | $17 | Stufe 0 |
| **2** | Bedingt täglich: täglich suchen, nur bei ≥ 2 Karten mit Score ≥ 7 und `freshness = neu` veröffentlichen. Mail bleibt wöchentlich, fasst die erschienenen Tage zusammen. | ~$44 | Messung aus Stufe 1 zeigt, dass die News überhaupt geöffnet werden |
| **3** | Täglich fest + Tagesmail, nur falls Stufe 2 zeigt, dass an ≥ 4 von 7 Tagen genug Material da ist. | ~$51 | Stufe 2 |

**Die ehrliche Antwort auf die gestellte Frage** („erzeugt täglich mit 2–3 Karten mehr Wiederkehr als wöchentlich mit 6–8?"): Auf Basis der vorliegenden Daten **ist das nicht entscheidbar**, weil es keine einzige Aufrufzahl gibt. Was die Daten sagen, ist: der heutige Materialfluss trägt keine sieben Tage. Stufe 2 ist der Weg, es herauszufinden, ohne es vorher zu behaupten — und sie kostet $44 statt $255 im Jahr.

## 2.2 Pipeline-Verbesserungen, nach Wirkung pro Euro

**① Quellen-Whitelist statt freier Websuche** — größter Hebel, kleinster Aufwand.

Das Websuche-Tool nimmt `allowed_domains`. Statt das Modell googeln zu lassen, zwei Suchblöcke mit je eigener Domainliste:

```
Primärquellen Plattform:
  about.instagram.com, newsroom.tiktok.com, blog.youtube,
  about.fb.com, business.instagram.com, developers.facebook.com
DACH-Fach und Recht:
  t3n.de, omr.com, horizont.net, wuv.de, drweb… , kanzleiblogs zu
  Wettbewerbsrecht, die Landesmedienanstalten, heise.de
```

Das adressiert auf einen Schlag: fehlende Primärquellen, fehlende DACH-Themen, Sammelseiten-URLs statt Permalinks, und die falsche AI-Act-Zahl aus B.5. (Beim Umsetzen prüfen, welche Variante des Suchtools das Projekt fährt — die neuere Variante mit dynamischer Filterung setzt ein aktuelleres Modell voraus, was ohnehin ansteht.)

**② `is_repeat` auswerten** — eine Zeile Code.

```js
const safeCards = cards.filter(c => c.is_repeat !== true)
```

20 % der Karten fallen weg, ohne dass eine Zeile Prompt geändert wird. Zusätzlich den `recentBlock` mit der **vollen** `summary` statt 60 Zeichen füttern, damit die Erkennung überhaupt greifen kann.

**③ Modellwechsel auf `claude-sonnet-5`** — eine Zeile, −52 % Kosten.

Die Aufgabe ist Suchergebnisse lesen und auf Deutsch strukturiert zusammenfassen. Die eingesparten ~$19/Jahr sind nicht der Punkt; der Punkt ist, dass damit auch die täglichen Szenarien bezahlbar werden. Vor dem Umstellen einen Lauf vergleichen. `PRICE_INPUT_PER_MTOK` / `PRICE_OUTPUT_PER_MTOK` im Code mitziehen, sonst ist das Kostenlog falsch.

**④ Nach `relevance_score` sortieren, bevor gespeichert wird** — eine Zeile, behebt C.1, C.2 und die App/Mail-Diskrepanz auf einmal.

```js
safeCards.sort((a,b) => (b.relevance_score||0) - (a.relevance_score||0))
```

**⑤ Fehler-Logging und ein Wächter** — verhindert die Wiederholung des 109-Tage-Ausfalls.

```js
catch (err) {
  await supabase.rpc('log_error', { function_name: 'generate-daily-digest',
                                     error_message: err.message })
  …
}
```

Dazu ein zweiter Cron, dienstags: gibt es für `weekStart` keine Zeile, `log_error` schreiben und eine Mail an den Betreiber. Ohne diesen Wächter ist jede Verbesserung an der Pipeline wertlos, weil der nächste stille Ausfall sie mitnimmt.

**⑥ Prompt-Schärfung** — kostet nur Denkarbeit:

- Zielgruppe präzisieren: „deutschsprachiger Micro-Creator, 1.000–50.000 Follower, **ohne Shop, ohne Agentur, ohne Werbebudget**". Das hätte die TikTok-Seller-Center-Karte verhindert.
- Negativliste erweitern: „keine US-Werbemarkt-Gesamtzahlen", „keine Evergreen-Ratschläge, die schon 2024 galten", „keine iOS-Tests ohne Rollout-Datum".
- `impact` mit Negativbeispiel: *„Schlecht: ‚Werde spezifischer in deiner Nische.' Gut: ‚Öffne Einstellungen → Konto → Your Algorithm und trage drei Themen ein, bevor die Funktion in DE startet.'"*
- Quote pro Ausgabe: mindestens 1 Karte aus Kategorie „Recht/DACH", mindestens 1 mit belastbarer Zahl.
- `full_content`-Vorgabe an die Realität anpassen (heute 160–240 statt geforderter 250–400 Wörter) — entweder 180–250 verlangen oder die Ausgabe prüfen und nachfordern.
- `teaser` streichen, solange er nirgends angezeigt wird. Spart Output-Token.

**⑦ Bilder** — zwei Optionen:

- **Klein:** die 61 Bilder einmalig auf ~1.200 px Breite und WebP herunterrechnen, neu hochladen. Aus 1,05 MB werden ~80 KB. Eine Stunde Arbeit, spart ~4,5 MB pro Seitenaufruf.
- **Besser:** Stockfotos ganz weglassen, wie `/news/` es schon tut, und stattdessen eine farbige Plattform-Kachel mit Icon verwenden. Ein Unsplash-Foto von einem Laptop sagt nichts über die Meldung aus und schadet der Glaubwürdigkeit eher, als dass es nützt.

**Rangfolge nach Wirkung pro Euro:** ② (kostenlos, sofort) → ⑤ (kostenlos, verhindert Totalausfall) → ④ (kostenlos, größter sichtbarer Effekt) → ① (halber Tag, größter Qualitätseffekt) → ③ (Minuten, halbiert Kosten) → ⑥ → ⑦.

## 2.3 Design-Vorschlag News-Seite

Im bestehenden Token-Set (`--surface`, `--border`, `--r-md`, `--t-*`, `--s-*`), minimalistisch, keine neuen Farben.

**Prinzipien:** Eine Karte dominiert. Quelle wandert nach unten. Der Weg zu früheren Ausgaben wird ein Element, kein grauer Textrest. Kein Filter.

### Oben — mit Hierarchie, ohne Filterzeile

```
┌──────────────────────────────────────────────┐
│ Creator News                                 │  --t-2xl
│ 5 Meldungen · aktualisiert heute             │  --t-sm --muted
│                                              │  ← Zustand statt Zeitraum
├──────────────────────────────────────────────┤
│                                              │
│ ┌──────────────────────────────────────────┐ │
│ │                                          │ │
│ │  WICHTIG                                 │ │  Chip, nur bei Score >= 8
│ │                                          │ │
│ │  Instagram rollt 'Your                   │ │  --t-2xl, 2 Zeilen
│ │  Algorithm' global aus                   │ │
│ │                                          │ │
│ │  Instagram gibt allen englischsprachi-   │ │  --t-base --muted
│ │  gen Nutzern Zugriff auf die Steuerung,  │ │  3 Zeilen
│ │  welche Themen im Feed erscheinen.       │ │
│ │                                          │ │
│ │  ────────────────────────────────────    │ │
│ │  Instagram · Metricool · vor 3 Tagen  ⌄  │ │  --t-xs --subtle
│ └──────────────────────────────────────────┘ │  ← Quelle UNTEN, eine Zeile
│                                              │
│ ┌──────────────────────────────────────────┐ │
│ │  Meta Summit: 70–80 % Performance        │ │  --t-lg
│ │  kommt vom Creative                      │ │
│ │  Meta bestätigt: Targeting ist durch …   │ │  2 Zeilen
│ │  ────────────────────────────────────    │ │
│ │  Meta · Billo · vor 5 Tagen           ⌄  │ │
│ └──────────────────────────────────────────┘ │
│                                              │
│ ┌──────────────────────────────────────────┐ │
│ │  TikTok: Creator können Keywords …       │ │
│ │  …                                       │ │
│ └──────────────────────────────────────────┘ │
│                                              │
│ ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐ │
│   ☐ Jede Woche per Mail                     │  Text korrigiert
│ └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘ │
│                                              │
│ ┌──────────────────────────────────────────┐ │
│ │  ↺  Woche davor · 7.–13. September       │ │  ← echtes Element,
│ │     5 Meldungen                       ›  │ │    nicht graue Zeile
│ └──────────────────────────────────────────┘ │
└──────────────────────────────────────────────┘
```

Kein Bild in der Kopfkarte — oder, falls Bild, dann die verkleinerte Variante aus 2.2⑦. Die Untertitelzeile sagt „aktualisiert heute" / „aktualisiert vor 3 Tagen" statt „Diese Woche · 14.–20. September": das beantwortet die Frage, die der Nutzer beim Öffnen hat, und es lügt nicht, wenn ein Lauf ausfällt.

### Karte zu (Standardkarte)

```
┌──────────────────────────────────────────────┐
│  TikTok: Creator können Keywords selbst      │  --t-lg --fw-sb
│  verwalten                                   │
│  TikTok erlaubt Creatorn, Keywords für ihre  │  --t-sm --muted
│  Videos hinzuzufügen und zu entfernen.       │  max. 2 Zeilen
│  ──────────────────────────────────────────  │  1px --border
│  TikTok · HeyOrca · vor 5 Tagen           ⌄  │  --t-xs --subtle
└──────────────────────────────────────────────┘
```

Plattform, Quelle und Alter in **einer** Fußzeile, Punkt-getrennt. Die Quelle bleibt sichtbar, beansprucht aber keinen Platz oben.

### Karte offen

```
┌──────────────────────────────────────────────┐
│  TikTok: Creator können Keywords selbst      │
│  verwalten                                   │
│  TikTok erlaubt Creatorn, Keywords …         │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │ ⚡ WAS DAS FÜR DICH BEDEUTET           │  │  ← ZUERST, nicht
│  │ Nutze die neue Keyword-Funktion aktiv, │  │    nach dem Volltext
│  │ um deine Videos für relevante Such-    │  │
│  │ anfragen zu optimieren.                │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  Bisher konnten Creator nur indirekt über    │  Volltext, Markdown-
│  Hashtags und Captions steuern, …            │  Fettungen aufgelöst
│                                              │
│  … 3 Absätze …                               │
│                                              │
│  ──────────────────────────────────────────  │
│  TikTok · HeyOrca · 2. Sep. 2026          ⌃  │  Fußzeile: beim
│                                              │  Öffnen volles Datum
│  [ Quelle lesen ↗ ]   [ ⤴ Teilen ]   [ ☆ ]   │
└──────────────────────────────────────────────┘
```

Zwei Änderungen gegenüber heute: **Der Impact-Block steht oben**, weil er der Grund ist, warum jemand die Karte aufklappt — der Volltext ist die Begründung, nicht die Antwort. Und ein **☆ Merken** in der Aktionszeile (Tabelle `digest_bookmarks (user_id, digest_date, card_index, created_at)`, ~20 Zeilen Code) als der eine Wiederkehrgrund, der heute fehlt.

### Mit / ohne Filter

**Ohne Filter (Empfehlung).** Bei 5 Karten ist Scrollen billiger, und die Pill-Zeile kostet genau den Platz über der wichtigsten Meldung.

Falls doch, dann als **einzelner Schalter rechts in der Kopfzeile**, nicht als Pill-Leiste:

```
│ Creator News                    [ Nur Wichtiges ○ ]  │
│ 5 Meldungen · aktualisiert heute                     │
```

`relevance_score >= 8`. Bei der Ausgabe vom 07.09. blieben 2 Karten übrig, beim 14.09. eine. Das ist eine sinnvolle 30-Sekunden-Ansicht — Plattform-Pills sind es bei dieser Menge nicht.

## 2.4 Teilen als Textnachricht

### Textvorlage

```
Instagram rollt "Your Algorithm" global aus

Nutzer können jetzt selbst festlegen, welche Themen sie in Reels
und Feed sehen — Nischenschärfe wird damit zum Reichweitenhebel.

viuno.de/news/2026-09-07-your-algorithm
```

Aufbau: **Schlagzeile, Leerzeile, ein Satz, Leerzeile, Link.** Kein Emoji-Präfix (überlebt Copy-Paste nicht zuverlässig und wirkt in einer 1:1-Nachricht wie ein Newsletter), kein „Mehr Creator-News auf …" (Werbung im geteilten Text senkt die Weiterleitungsrate), kein `…`-Abschnitt.

Umsetzung: `navigator.share({ title, text, url })` mit `url` = die **Karten-URL**. Systeme, die beides zusammenführen, hängen die URL an — deshalb darf sie im `text` nicht noch einmal stehen. Im Clipboard-Zweig die URL explizit anhängen.

### Die öffentliche News-URL

| Schritt | Was | Aufwand |
|---|---|---|
| 1 | `slug` pro Karte beim Generieren mitschreiben: `<date>-<headline kebab, gekürzt>`. Muss beim Upsert stabil bleiben, sonst brechen geteilte Links. | ~1 h |
| 2 | `slug` in `digest_cards_today` / `digest_cards_past` durchreichen | ~15 min |
| 3 | `/news/*  /news/index.html  200` in `_redirects`; die Seite liest den Slug aus `location.pathname`, sucht die Karte, klappt sie auf und scrollt hin. Exakt das Muster von `/analyse/<token>`, das im Repo schon funktioniert. | ~2 h |
| 4 | **OG-Tags pro Karte.** Nicht clientseitig lösbar — WhatsApp, iMessage und Instagram lesen nur das ausgelieferte HTML. Es braucht eine Cloudflare Pages Function unter `functions/news/[slug].js`, die `og:title`, `og:description` und `og:url` serverseitig in die HTML-Vorlage einsetzt. Das ist der erste serverseitige Baustein im bisher rein statischen Deploy — bewusste Entscheidung, in `CLAUDE.md` festhalten. | ~3–4 h |
| 5 | Startseiten-Kachel „Creator News" von `/digest` auf `/news` umhängen; `/news` in den Footer; Mail-Links auf `/news/<slug>` statt `/digest`. | ~30 min |

**Schritt 5 ist der eigentliche Hebel** und braucht eine halbe Stunde. Ohne ihn führt kein Weg zur öffentlichen Seite, und die Schritte 1–4 sind vergebens. Ohne Schritt 4 ist jeder geteilte Link eine nackte URL ohne Vorschau — funktionsfähig, aber deutlich weniger anklickbar.

Ein `og:image` pro Karte braucht es nicht: ein generisches viuno-Bild reicht, solange Titel und Beschreibung stimmen. Das spart den ganzen Bildgenerierungs-Pfad.

## 2.5 Swipe-File-Anbindung

**Empfehlung: bewusst keine — in keiner Richtung, jetzt nicht.**

Begründung entlang der Zielvorgabe:

- **Richtung Swipe-File → Digest schadet dem Ziel.** Karussell-Funde sind Format-Vorlagen, keine Neuigkeiten. Sie würden die Evergreen-Schlagseite verstärken, die schon heute das Hauptqualitätsproblem ist. Kein Beitrag zur Wiederkehr.
- **Richtung Digest → Swipe-File hilft der Content-Produktion, nicht der App-Nutzung.** Nach der gesetzten Vorgabe damit nachrangig. Sie bräuchte außerdem erst eine Digest-Admin-Ansicht, die es nicht gibt.
- **Die Trennung ist begründet und sollte bestehen bleiben.** Zwei Supabase-Projekte, ein eigenes Admin-Token, `noindex` und `frame-ancestors 'none'` auf `/karussell/*` — das ist eine absichtliche Abschottung. Sie für einen Nutzen aufzuweichen, der nicht auf das Ziel einzahlt, ist ein schlechter Tausch.

**Falls es doch kommt: Richtung 2 zuerst** (News → Karussell-Vorschlag). Sie schreibt nur, liest nichts, erzeugt keine Rückkopplung und lässt sich jederzeit abschalten. Vorbedingung wäre ohnehin eine Digest-Admin-Ansicht — und die ist aus anderen Gründen fällig (das tote `approved`-Feld, siehe 2.6).

## 2.6 Was fehlt, aber wichtig ist

### Messung — Pflicht, und heute bei null

Ohne Aufrufzahlen ist die Zielvorgabe nicht prüfbar. Es gibt keine `page_views`-Tabelle; getrackt wird im Projekt nur BioLink und Media Kit (`track-bio-view`, `track-mediakit-view`, `biolink_aufrufe`, `mediakit_aufrufe`). Das Muster steht also schon.

**Minimalvorschlag:**

```sql
create table page_views (
  id          bigserial primary key,
  user_id     uuid references users(id),   -- null = anonym auf /news
  page        text not null,               -- 'news' | 'news_card' | 'dashboard_teaser'
  card_slug   text,                        -- bei 'news_card'
  source      text not null,               -- 'app' | 'public' | 'share' | 'mail'
  created_at  timestamptz not null default now()
);
create index on page_views (page, created_at desc);
create index on page_views (user_id, created_at desc);
```

- In `renderDigest` ein Insert `{page:'news', source:'app'}`.
- Auf `/news/` ein Insert `{page:'news', source: new URLSearchParams(location.search).has('s') ? 'share' : 'public'}` — geteilte Links bekommen `?s=1`.
- Beim Aufklappen einer Karte `{page:'news_card', card_slug}` — das misst, ob die Impact-Blöcke überhaupt gelesen werden.
- Mail-Links mit `?s=mail`.

RLS: anonymes `insert`, `select` nur für Admin. Kein IP-Speichern, keine Cookies — dann bleibt es datenschutzrechtlich so unkritisch wie die vorhandenen Zähler.

**Die drei Zahlen, die nach vier Wochen die Rhythmusfrage beantworten:**
1. Aufrufe der News-Seite pro angemeldetem Nutzer und Woche (< 1 → Frequenz ist nicht das Problem, die Benachrichtigung ist es).
2. Anteil der Karten, die aufgeklappt werden (< 20 % → die Headlines tragen nicht).
3. Aufrufe mit `source = 'share'` (0 → Teilen funktioniert nicht, unabhängig vom Text).

### Rechtliches beim Zusammenfassen fremder Artikel

- **Die Zusammenfassungen sind in Ordnung.** Eine eigenständige deutschsprachige Zusammenfassung einer Tatsachenmeldung ist keine Vervielfältigung; Nachrichten als solche sind nicht geschützt. Das Verfahren ist richtig gewählt.
- **Die Quellenangabe muss bleiben.** Sie ist heute da (Name + Link) und sollte beim Umbau nach unten wandern, aber nicht verschwinden — sie ist zugleich Glaubwürdigkeitsanker und Absicherung.
- **Das reale Risiko ist ein anderes: falsche Rechtsauskunft.** Die AI-Act-Karte (B.5) nennt eine Bußgeldhöhe, die zum beschriebenen Tatbestand nicht passt, formuliert im Imperativ („Prüfe JETZT…"), gerichtet an Gewerbetreibende. Zwei Gegenmaßnahmen:
  1. Rechtskarten nur aus Primär- oder deutschen Fachquellen (2.2①).
  2. Ein fester Zusatz unter jeder Karte mit `platform: allgemein` und Rechtsbezug: *„Zusammenfassung, keine Rechtsberatung. Im Zweifel anwaltlich prüfen lassen."* Ein Satz, kostet nichts.
- **Bilder:** Die 61 Unsplash-Fotos sind lizenzrechtlich unproblematisch. Wenn sie bleiben, gehört eine Urheberzeile dazu (die Dateinamen tragen die Fotografennamen bereits — `boliviainteligente-YRHvv3OhOW0-unsplash.jpg`); wenn sie gehen (2.2⑦), erledigt sich das.

### Ladezeit und Caching

- **~5 MB Stockbilder pro Seitenaufruf** (C.5). Größter einzelner Performance-Posten der ganzen App.
- Die Query holt `full_content` aller Karten aller 14 Tage sofort mit, obwohl es erst beim Aufklappen gebraucht wird. Bei 5–10 Karten unkritisch, bei täglichem Rhythmus mit 14 Tagen Fenster nicht mehr — dann `full_content` nachladen.
- `/news/` holt bei jedem Aufruf beide Views frisch. Eine `Cache-Control`-Regel für `/rest/v1/digest_cards_*` ist über PostgREST nicht direkt setzbar; falls die Seite Last bekommt, ist eine Pages Function mit `caches.default` und 15 Minuten TTL der Weg. Bei heutigem Traffic nicht nötig.

### Was sonst noch auffiel

- **`approved` ist tot.** Der Generator setzt es auf `false`, die Views reichen es durch, **niemand liest es.** Jede KI-generierte Karte ist ungeprüft live. Bei 5 Nutzern verschmerzbar, bei Rechtsthemen nicht. Entweder das Feld ersatzlos streichen oder eine Ein-Klick-Freigabe im Admin bauen — der Schwebezustand ist die schlechteste Variante.
- **Der `teaser` wird erzeugt und nirgends angezeigt.** Drei Zeilen Output-Token pro Lauf, Verwendung: keine.
- **`digest_cards` (die dritte View) wird von nichts benutzt** und verweist auf Wikipedia-Icon-URLs; `digest_teaser_today` ebenfalls ungenutzt. Aufräumkandidaten.
- **Zwei Abonnentenlisten, die auseinanderlaufen** (C.7). Entweder `newsletter_subscribers` konsequent mitschreiben oder die Tabelle abschaffen.
- **„täglich per Mail"** steht dreimal im Code, die Mail ist wöchentlich.
- **Markdown-Sternchen sind in der App sichtbar**, auf `/news/` nicht (C.4).
- **`CLAUDE.md` ist an zwei Stellen überholt:** „es gibt kein `_headers`" (gibt es) und die Liste der Edge Functions kennt `generate-daily-digest`, `send-weekly-digest-email`, `digest-unsubscribe` nicht.
- **Kein `robots.txt`, keine `sitemap.xml`.** Wenn `/news` als Einstiegskanal ernst gemeint ist, gehört es dort hinein.

---

# Priorisierung

## Bug / heute

| # | Was | Warum jetzt | Aufwand |
|---|---|---|---|
| 1 | **`log_error` im `catch` von `generate-daily-digest`** + Wächter-Cron dienstags (keine Zeile für `weekStart` → Fehler + Mail) | Der 109-Tage-Ausfall kann sich morgen wiederholen und würde wieder niemandem auffallen | 1 h |
| 2 | **Mail-Versand reparieren:** Abonnentenabfrage mit Retry umgeben; nach einem Fehlschlag am selben Tag erneut versuchen (zweiter Cron 05:30) | Noch nie eine Mail verschickt; die Ausgabe dieser Woche ist bereits verloren | 1 h |
| 3 | **Startseiten-Kachel „Creator News" auf `/news` umhängen**, `/news` in den Footer | Führt heute auf eine Login-Wand; die fertige öffentliche Seite ist unerreichbar | 15 min |
| 4 | **Karten nach `relevance_score` sortieren** vor dem Upsert | Dashboard-Teaser zeigt diese Woche die zwei schwächsten Karten; App und Mail widersprechen sich | 15 min |
| 5 | **`is_repeat === true` herausfiltern** | 20 % der Karten sind selbst-markierte Wiederholungen und werden trotzdem gezeigt | 10 min |
| 6 | **Dashboard-Teaser: `gte('date', vor 14 Tagen)`** + Datumszeile | Zeigte 109 Tage lang Karten vom Mai, ohne Hinweis | 20 min |
| 7 | **„täglich" → „wöchentlich"** in `nl-line`, Toast und Label | Sagt dem Nutzer etwas Falsches über ein Abo, das er gerade abschließt | 10 min |
| 8 | **Markdown-Fettungen in der App auflösen** (`escMitFett` aus `/news/` übernehmen) | Sichtbare `**` im Volltext | 15 min |

Punkte 1–8 zusammen: **ein Arbeitstag**, und sie beheben den Totalausfall-Blindflug, den kaputten Versand, den unerreichbaren öffentlichen Kanal und die verdrehte Reihenfolge.

## Verbesserung

| # | Was | Wirkung | Aufwand |
|---|---|---|---|
| 9 | **Messung einbauen** (`page_views`, 2.6) | Ohne sie ist das Ziel „Wiederkehr" nicht prüfbar und jede weitere Entscheidung Bauchgefühl | 3 h |
| 10 | **Quellen-Whitelist** (Primärquellen + DACH/Recht), Prompt schärfen | Behebt gleichzeitig: keine Primärquellen, keine DACH-Themen, Sammelseiten-URLs, falsche Rechtsangaben | 4–6 h |
| 11 | **Modell auf `claude-sonnet-5`**, Preiskonstanten mitziehen | −52 % Kosten, macht tägliche Szenarien bezahlbar | 30 min + 1 Vergleichslauf |
| 12 | **News-Seite umbauen** nach 2.3: Aufmacherkarte, Quelle nach unten, Filter raus, „Woche davor" als echtes Element, Impact vor Volltext | Die Seite hat heute keine Hierarchie; die wichtigste Meldung ist nicht erkennbar | 4–6 h |
| 13 | **Bilder verkleinern oder streichen** (2.2⑦) | ~5 MB → ~0,4 MB oder 0 pro Seitenaufruf | 1–2 h |
| 14 | **☆ Merken** (`digest_bookmarks`) | Der einzige naheliegende Wiederkehrgrund, der heute komplett fehlt | 3 h |
| 15 | **Teilbare News-URL** (2.4, Schritte 1–3) ohne OG-Tags | Geteilte Links führen zur Meldung statt zur Startseite | 3 h |
| 16 | **OG-Tags über Pages Function** (2.4, Schritt 4) | Erst damit hat ein geteilter Link eine Vorschau | 3–4 h; erster serverseitiger Baustein |
| 17 | **`approved` entscheiden:** streichen oder Ein-Klick-Freigabe im Admin | Ungeprüfte KI-Rechtsaussagen gehen heute direkt live | 20 min oder 4 h |
| 18 | **Abonnentenlisten zusammenführen**, `teaser` und ungenutzte Views aufräumen, `CLAUDE.md` nachziehen | Datendrift mit rechtlicher Kante; toter Code | 2 h |

## Geschäftsentscheidung

| # | Frage | Datenlage | Empfehlung |
|---|---|---|---|
| A | **Wöchentlich, täglich oder bedingt täglich?** | Nicht entscheidbar — null Aufrufzahlen. Materialfluss trägt nachweislich keine 7 Tage. | Wöchentlich bleiben, messen, dann Stufe 2 (bedingt täglich, ~$44/Jahr) |
| B | **Ist `/news` ein Akquisekanal oder ein Nebenprodukt?** | Heute Nebenprodukt: fertig gebaut, null Links, nicht auffindbar | Wenn Akquise: Punkte 3, 15, 16 plus `robots.txt`/Sitemap. Wenn nicht: `/news` abschalten statt halb betreiben |
| C | **Push-Benachrichtigungen?** | Keine PWA-Infrastruktur, iOS braucht Home-Screen-Installation, 5 Nutzer | Nein. Mail ist der Kanal — sie muss erst einmal laufen |
| D | **Swipe-File anbinden?** | Beide Richtungen zahlen nicht auf App-Nutzung ein | Nein. Trennung bewusst beibehalten |
| E | **Wie viel darf das Feature kosten?** | Heute $36/Jahr, nach Modellwechsel $17, bedingt täglich $44, täglich voll $255 | Der Kostenrahmen ist in jedem Szenario unkritisch — die Entscheidung sollte über Qualität laufen, nicht über Geld |
| F | **Rechtsthemen überhaupt aufnehmen?** | Das systematisch fehlende und zugleich relevanteste DACH-Thema — und das mit dem höchsten Fehlerrisiko | Ja, aber nur aus Primär-/Fachquellen und mit Haftungshinweis (2.6) |

---

# Offene Fragen

1. **Warum ist die Generierung zwischen dem 21.05. und dem 06.09. ausgefallen?** Aus den erhaltenen Daten nicht rekonstruierbar — keine `admin_errors`, Edge-Function-Logs reichen nicht zurück. Gab es in dem Zeitraum eine Änderung an der Function, am Anthropic-Key oder am Modellnamen?
2. **War der Ausfall bekannt?** Falls ja: warum wurde die App weiter mit Mai-Karten betrieben, statt einen Hinweis zu zeigen?
3. **Soll `/news` indexiert werden?** Das ändert Prompt und Quellenwahl: SEO-Verkehr will andere Themen als eine Bestandsleserschaft.
4. **Ist der Nachrichtenteil an @viuno auf Instagram gekoppelt?** Wenn die Karussells ohnehin produziert werden, wäre „News → Karussell" ein Vertriebskanal — das würde die Bewertung in 2.5 kippen.
5. **Was ist die Zielgruppe genau?** Der Prompt sagt „1.000–200.000 Follower". Bei 200k ist TikTok Shop relevant, bei 5k nicht. Die Spanne ist zu breit für scharfe Relevanzentscheidungen.
6. **Soll der Digest zweisprachig werden?** Es gibt `/it/`. Eine italienische Ausgabe verdoppelt die Kosten, aber nicht die Suchen.
7. **Wer gibt frei?** Die Antwort auf Punkt 17 (`approved`) hängt daran, ob jemand bereit ist, montags fünf Karten durchzusehen, bevor sie live gehen.
8. **Darf `public/news/index.html` ein serverseitiges Gegenstück bekommen?** Punkt 16 durchbricht die bisherige „nur statische Dateien"-Annahme des Deploys. Das ist eine Architekturentscheidung, keine Umsetzungsfrage.

---

*Erstellt am 14. September 2026. Grundlage: `main` @ `ede0871`, Supabase-Projekt `bzejndghppuipnedasuv` (Livedaten, Stand 14.09. mittags), Edge Functions `generate-daily-digest` v47, `send-weekly-digest-email` v9, `digest-unsubscribe` v7. Auf Projekt `dodglijurmtrbwnjivlg` (Swipe-File-Backend) bestand kein Zugriff — Abschnitt D ist aus dem Client rekonstruiert.*
