# viuno Analyse — Verbrauchslogik: Was bekommt der User für 9,99 €?

**Stand:** 13. September 2026
**Umfang:** Ist-Zustand exakt aus dem Code, belegt mit allen 7 Bestandsläufen, plus vier Optionen mit Konsequenzen
**Status:** reine Analyse — nichts geändert.

---

## Kurzfassung vorab

**Ein Kauf = ein Run = alle Plattformen, für die ein Handle hinterlegt ist.** Die Kaufzeile wird genau einmal pro Run verbraucht, nachdem mindestens eine Plattform erfolgreich durch Haiku gelaufen ist.

Daraus folgen drei Ungleichheiten, die der User vor dem Kauf nirgends sieht:

- Wer **beide** Handles hinterlegt hat, bekommt für 9,99 € **zwei** vollständige Analysen.
- Wer **einen** Handle hinterlegt hat, bekommt eine — und der Kauf ist trotzdem vollständig weg. Handle nachtragen und nachziehen geht nicht ohne neuen Kauf.
- Wer **keinen** Handle hinterlegt hat, kann trotzdem bezahlen. Der Kaufknopf prüft die Handles nicht.

Und die Annahme, die hinter deiner Frage steht, stimmt nicht: **Es gibt heute keinen plattformübergreifenden Vergleich.** Haiku bekommt pro Plattform einen eigenen Call mit ausschließlich den Daten dieser Plattform. In allen 9 vorhandenen `analyse_ki`-Zeilen erwähnt keine einzige Instagram-Analyse TikTok und keine TikTok-Analyse Instagram — kein einziges Mal. Der Vergleich, der bei Option A und C wegfallen würde, existiert nicht.

Zusätzlich beim Nachsehen gefunden: **der Apify-Webhook feuert nur bei `ACTOR.RUN.SUCCEEDED`.** Scheitert ein Apify-Run, kommt nie ein Callback, der Run bleibt für immer auf `scraping`, und der User kann keine neue Analyse starten — der Button ist dann dauerhaft deaktiviert. Es gibt keinen Timeout und keinen Aufräum-Job.

---

# Phase 1: Ist-Zustand, exakt aus dem Code

## 1.1 Ein Run oder eine Plattform? — Ein Run umfasst beide

`start-analysis` legt **genau eine** `analysis_runs`-Zeile an und startet danach **bis zu zwei** Apify-Runs:

```js
// 2. analysis_runs Row anlegen
const { data: runRow } = await supabase
  .from('analysis_runs')
  .insert({ user_id: userId, status: 'scraping' })
  .select('id').single()
const analysisRunId = runRow.id

// 3. Apify-Runs starten
let igSkipped = !u.instagram_handle
let ttSkipped = !u.tiktok_handle

if (u.instagram_handle) {
  igRunId = await startApifyRun(IG_ACTOR_ID, { usernames:[handle], resultsLimit:12 },
                                buildWebhookParam(userId, analysisRunId, 'instagram'))
  if (!igRunId) igSkipped = true
}
if (u.tiktok_handle) {
  await new Promise(r => setTimeout(r, 2000))
  ttRunId = await startApifyRun(TT_ACTOR_ID, { profiles:[handle], resultsPerPage:15, … },
                                buildWebhookParam(userId, analysisRunId, 'tiktok'))
  if (!ttRunId) ttSkipped = true
}
```

Beide Apify-Runs zeigen mit demselben `runId` auf `analysis-webhook`. Die Function wird also **zweimal für denselben Run** aufgerufen, einmal je Plattform, und sortiert sich über den `platform`-Query-Parameter.

**Antwort: Ein Run = beide Plattformen. Ein Kauf deckt einen Run ab.**

## 1.2 Wann genau wird die Kaufzeile verbraucht?

**Nicht beim Start. Nicht nach dem Scraping. Sondern nachdem Haiku für mindestens eine Plattform erfolgreich war — und genau einmal pro Run.**

Der Aufruf steht in `runHaikuAnalysis`, **nach** der Plattform-Schleife:

```js
const errors = []
let successCount = 0
for (const platform of uniquePlatforms) {
  if (platform !== 'instagram' && platform !== 'tiktok') continue
  try {
    const ok = await runHaikuForPlatform(userId, analysisRunId, platform, niche)
    if (ok) successCount++
  } catch (e) { console.error(e.message); errors.push(e.message) }
}

if (successCount === 0) throw new Error('Alle Plattform-Analysen fehlgeschlagen: ' + errors.join(' | '))

// Freischaltung erst JETZT verbrauchen -- die Analyse ist zu diesem Zeitpunkt erfolgreich
// abgeschlossen (mindestens eine Plattform ausgewertet). Bei komplettem Fehlschlag (oben,
// successCount===0) wird diese Zeile nie erreicht -- der Kauf bleibt unverbraucht.
await consumePurchaseForUser(userId, analysisRunId)

await supabase.from('analysis_runs').update({ status:'done', haiku_done_at: …, completed_at: … })
await sendResultEmail(analysisRunId)
```

`consumePurchaseForUser` nimmt die **älteste** unverbrauchte Zeile und stempelt sie:

```js
const { data: purchase } = await supabase
  .from('analysis_purchases').select('id')
  .eq('user_id', userId).is('consumed_at', null)
  .order('purchased_at', { ascending: true }).limit(1).maybeSingle()

if (!purchase) { console.warn('Keine unverbrauchte Freischaltung … -- Analyse trotzdem erfolgreich'); return }

await supabase.from('analysis_purchases')
  .update({ consumed_at: new Date().toISOString(), analysis_run_id: analysisRunId })
  .eq('id', purchase.id)
```

**Drei Konsequenzen daraus:**

1. **Pro Run, nicht pro Plattform.** Egal ob eine oder zwei Plattformen ausgewertet wurden — genau eine Kaufzeile wird gestempelt.
2. **Der Zeitpunkt ist gut gewählt.** Wer zahlt und dessen Scraping scheitert, behält sein Guthaben. Das ist bewusst so gebaut und im Code kommentiert.
3. **FIFO über `purchased_at ASC`** — bei mehreren Guthaben wird das älteste zuerst verbraucht. Sinnvoll.

**Ein Nebeneffekt, der auffällt:** Schlägt `consumePurchaseForUser` fehl oder findet keine Zeile, wird das nur geloggt (`console.warn`) und der Run läuft normal als `done` weiter. Die Analyse ist dann geliefert, ohne dass ein Guthaben abgebucht wurde. Das ist der richtige Default (Kunde geht nicht leer aus), aber es ist eine stille Lücke — es taucht in keinem Monitoring auf.

## 1.3 Beide Handles hinterlegt → eine Analyse für beide aus einem Kauf

**Ja.** Ein Kauf, ein Run, zwei Apify-Scrapes, zwei Haiku-Calls, zwei `analyse_stats`-Zeilen, zwei `analyse_ki`-Zeilen, eine verbrauchte Kaufzeile.

Belegt durch vier Bestandsläufe mit je 12 Instagram- und 12 TikTok-Posts und je einer `analyse_ki`-Zeile pro Plattform (siehe Tabelle in 2.1).

Der Übergang von „Scraping" zu „Auswertung" wartet explizit auf beide:

```js
const igFinished = refreshed.instagram_skipped || refreshed.instagram_done_at !== null
const ttFinished = refreshed.tiktok_skipped   || refreshed.tiktok_done_at   !== null

if (igFinished && ttFinished && refreshed.status !== 'done' && refreshed.status !== 'analyzing') {
  await supabase.from('analysis_runs').update({ status: 'analyzing' }).eq('id', runId)
  try { await runHaikuAnalysis(userId, runId) } catch (haikuErr) { … status: 'failed' … }
}
```

Wer also beide Kanäle gepflegt hat, bekommt für 9,99 € den doppelten Gegenwert dessen, was ein Instagram-only-User bekommt.

## 1.4 Nur ein Handle → nur diese Plattform, Kauf vollständig verbraucht

**Ja, und das Guthaben ist danach weg.**

Bei fehlendem TikTok-Handle setzt `start-analysis` `tiktok_skipped = true`. Im Webhook ist `ttFinished` damit sofort `true`, sobald Instagram fertig ist läuft Haiku, `successCount = 1`, der Kauf wird gestempelt, Status `done`.

**Kann der User TikTok später nachtragen und ohne neuen Kauf nachziehen? Nein.**

- Die Kaufzeile hat `consumed_at` gesetzt und ist damit für `start-analysis` unsichtbar (`.is('consumed_at', null)`).
- Es gibt kein Feld, das festhält, *welche* Plattformen ein Kauf abgedeckt hat — `analysis_purchases` kennt nur `user_id`, `analysis_run_id`, `consumed_at`.
- Ein zweiter Run erfordert eine neue unverbrauchte Zeile, also einen neuen Kauf über 9,99 €.

**Belegt durch Lauf `d689f0c7` (User `5aec684d`, 09.09. 19:36):** `tiktok_skipped: true`, 12 Instagram-Posts, 1 `analyse_stats`-Zeile, 1 `analyse_ki`-Zeile, Status `done`, Laufzeit 42 s. Der User hat nur `instagram_handle: "Easyglenn"` und kein TikTok. Er hat eine halbe Leistung bekommen — hätte sie zu diesem Zeitpunkt bezahlt, wäre sein Guthaben vollständig verbraucht.

## 1.5 Beide Handles da, eine Plattform schlägt fehl

Hier zerfällt der Fall in vier Varianten mit unterschiedlichem Ausgang:

| Variante | Was passiert | Andere Plattform fertig? | Kauf verbraucht? | Sieht der User den Fehler? |
|---|---|---|---|---|
| **A — Apify-Start scheitert** (`startApifyRun` liefert `null`) | `*_skipped = true` gesetzt, verhält sich wie „kein Handle" | ✅ ja | ✅ **ja** | ❌ nein |
| **B — Apify läuft, Dataset bleibt leer** (privates Profil, Tippfehler im Handle) | `insertedCount = 0` → `buildAndSaveStats` wird übersprungen → keine `apify_daten`-Zeilen → Plattform fehlt in `uniquePlatforms` → kein Haiku-Call | ✅ ja | ✅ **ja** | ❌ nein |
| **C — Haiku scheitert für eine Plattform** | `catch` → `errors.push(…)`, `successCount = 1` → `error: 'Teilweise: …'` wird auf den Run geschrieben, Status trotzdem `done` | ✅ ja | ✅ **ja** | ❌ **nein** — die SPA rendert `run.error` nur im `failed`-Zweig |
| **D — Apify-Run scheitert hart** (FAILED / TIMED-OUT) | **Kein Callback.** Der Webhook ist auf `eventTypes: ['ACTOR.RUN.SUCCEEDED']` registriert. `tiktok_done_at` bleibt `NULL`, `tiktok_skipped` bleibt `false` → `ttFinished` nie `true` → **Haiku läuft nie** | ❌ **nein** | ❌ nein | ⚠️ sieht ewig „Analyse läuft" |

**Variante D ist ein eigenständiger Bug, den ich in der ersten Bestandsaufnahme noch nicht hatte.** Der Webhook-Filter steht in `buildWebhookParam`:

```js
const jsonStr = JSON.stringify([{ eventTypes: ['ACTOR.RUN.SUCCEEDED'], requestUrl: webhookUrl }])
```

Folgen:
- Der Run hängt dauerhaft auf `status: 'scraping'`. Es gibt **keinen Timeout und keinen Aufräum-Job** — in `cron.job` stehen nur `daily-digest-generator` und `weekly-digest-email-sender`.
- Beim nächsten Seitenaufruf findet `checkActiveRun()` den hängenden Run (`.in('status',['scraping','analyzing'])`), ruft `showFlow(run)` auf, und dort steht `btn.disabled = true`. **Der User ist dauerhaft ausgesperrt** und kann auch mit vorhandenem Guthaben keine neue Analyse starten.
- Immerhin: der Kauf bleibt unverbraucht. Das Geld ist nicht weg, nur unerreichbar.

Aktuell hängt kein Run (Abfrage auf `status IN ('pending','scraping','analyzing')` liefert nichts). Die Konstruktion lässt es aber jederzeit zu.

**Ein fünfter Randfall:** `pruneOldestTiktokPosts` löscht nach dem Insert die 3 ältesten TikTok-Posts und rechnet `insertedCount = Math.max(0, insertedCount - 3)`. Liefert TikTok **genau 3 oder weniger** Videos, bleibt `insertedCount = 0`, `buildAndSaveStats` wird übersprungen — und alle eingefügten Zeilen sind bereits gelöscht. Die Plattform verschwindet komplett aus dem Run. Bei einem frisch gestarteten TikTok-Account mit wenigen Videos ist das realistisch.

## 1.6 Was sieht der User vor dem Kauf?

**Nichts über Plattformen. Nirgends.**

Ich habe alle Stellen durchsucht, an denen der Kauf angebahnt wird:

| Stelle | Text | Nennt Plattformen? | Warnt bei fehlendem Handle? |
|---|---|---|---|
| Landingpage-Kachel | „Analyse starten — Sieh, welche Posts wirklich performen" | ❌ | — |
| Dashboard-Einrichten-Karte | „Analyse starten — Sieh, was deine Beiträge leisten" | ❌ | — |
| Kaufbutton | „Analyse freischalten – 9,99€" | ❌ | ❌ |
| Button-Untertitel vor Kauf | „Einmalige Freischaltung pro Analyse" | ❌ | ❌ |
| Widerrufs-Checkbox | „Ich stimme zu, dass die Analyse sofort nach Zahlung beginnt…" | ❌ | ❌ |
| Stripe-Produktbeschreibung | „Einmalige Analyse deiner **Instagram-/TikTok**-Performance…" | ✅ **einzige Stelle** | ❌ |
| Handle-Modal | „Gib **mindestens einen** Handle ein um deine Analyse zu starten." | ✅ | ❌ |

Der einzige Ort, an dem „Instagram/TikTok" vor dem Kauf steht, ist die Stripe-Produktbeschreibung im Checkout — also *nachdem* der User viuno bereits verlassen hat. Und dort steht „Instagram-/TikTok-Performance", was nach beidem klingt, unabhängig davon, was tatsächlich läuft.

**Die Warnung bei fehlendem Handle existiert nicht.** `renderBtn()` zeigt den Hinweis „Bitte zuerst einen Kanal verknüpfen" ausschließlich im Zweig **nach** erfolgtem Kauf:

```js
if (!anv.hasPurchase) {
  btn.disabled = false
  btn.classList.add('pay')
  btn.innerHTML = `… Analyse freischalten – 9,99€`
  sub.textContent = 'Einmalige Freischaltung pro Analyse'   // ← keine Handle-Prüfung
  consentWrap.classList.remove('hidden')
  return
}
// erst hier, nach dem Kauf:
sub.textContent = p.instagram_handle || p.tiktok_handle ? '' : 'Bitte zuerst einen Kanal verknüpfen'
```

Und `handleStartClick` leitet ohne jede Prüfung weiter:

```js
window.handleStartClick = function(){
  if (!anv) return
  if (!anv.hasPurchase) { goToPayment(); return }   // ← keine Handle-Prüfung
  startAnalysis()
}
```

**Das heißt konkret: Ein User ohne jeden Handle kann 9,99 € bezahlen.** Erst danach öffnet `startAnalysis()` das Handle-Modal. Das Geld ist zu dem Zeitpunkt bereits weg, das Guthaben immerhin noch da — aber die Reihenfolge ist falsch herum.

Dazu kommt: Die Plattform-Tabs „Instagram | TikTok" stehen **immer beide** in der Oberfläche, unabhängig von den hinterlegten Handles. Wer nur Instagram hat, sieht nach dem Kauf einen TikTok-Tab, klickt ihn an und liest „Kein TikTok-Handle — Verknüpfe deinen Kanal um die Analyse nutzen zu können." Das liest sich wie ein Versprechen, das mit dem bereits bezahlten Kauf einlösbar wäre. Ist es nicht.

---

## 2. Beleg aus den Bestandsdaten

### 2.1 Alle 7 Läufe

| Run | User | Status | IG skip | IG fertig | TT skip | TT fertig | IG Posts | TT Posts | IG Stats | TT Stats | IG KI | TT KI | Kauf verknüpft | Dauer |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `23047f7e` | `d5dff681` | done | nein | ✅ | nein | ✅ | 12 | 12 | 1 | 1 | 1 | 1 | **0** | 67 s |
| `6dadf5c3` | `5620b0b6` | done | nein | ✅ | nein | ✅ | 12 | 12 | 1 | 1 | 1 | 1 | **0** | 113 s |
| `e9c4a4b5` | `2f417fef` | done | nein | ✅ | nein | ✅ | 12 | 12 | 1 | 1 | 1 | 1 | **0** | 68 s |
| `13d45bee` | `5620b0b6` | **failed** | nein | ✅ | nein | ✅ | 12 | 12 | 1 | 1 | **0** | **0** | **0** | 42 s |
| `cb3864c9` | `5620b0b6` | **failed** | nein | ✅ | nein | ✅ | 12 | 12 | 1 | 1 | **0** | **0** | **0** | 56 s |
| `f0fd2bc2` | `5620b0b6` | done | nein | ✅ | nein | ✅ | 12 | 12 | 1 | 1 | 1 | 1 | **0** | 92 s |
| `d689f0c7` | `5aec684d` | done | nein | ✅ | **ja** | – | 12 | **0** | 1 | **0** | 1 | **0** | **0** | 42 s |

**Was die Tabelle zeigt:**

- **Kein einziger Lauf hat einen Kauf verbraucht** (`purchases_linked = 0` überall). Alle 7 stammen aus der kostenlosen Vorgängerlogik über `users.analyse_moeglich`. Die Bezahlschranke ist seit dem 10.09. scharf, aber seither hat niemand einen bezahlten Lauf gestartet.
- **5 von 7 Läufen waren Zwei-Plattform-Läufe** — hätten also für 9,99 € die doppelte Leistung geliefert.
- **1 Lauf war Instagram-only** (`d689f0c7`) und hätte denselben Preis gekostet.
- **Die beiden `failed`-Läufe sind aufschlussreich:** Scraping und Stats liefen bei **beiden** Plattformen sauber durch (je 12 Posts, je 1 Stats-Zeile), nur Haiku scheiterte an beiden — `successCount = 0`, also kein Kauf verbraucht. Genau das gewünschte Verhalten. Und es zeigt: die teure Hälfte (Scraping) war bezahlt, die billige (Haiku) fiel aus.
- **Kein Lauf zeigt Variante C** (eine Plattform erfolgreich, eine nicht) — dieser Fall ist bisher nie eingetreten. Er ist theoretisch, aber der einzige, in dem heute ein Kauf für eine Teilleistung verfällt.

### 2.2 Der plattformübergreifende Vergleich existiert nicht

Das ist die Prüfung, die deine Optionsfrage direkt beantwortet.

`runHaikuForPlatform` bekommt **ausschließlich** Daten einer Plattform:

```js
const { data: currentPosts } = await supabase.from('apify_daten')
  .select(…).eq('analysis_run_id', analysisRunId).eq('platform', platform)   // ← Filter
const { data: currentStats } = await supabase.from('analyse_stats')
  .select('*').eq('analysis_run_id', analysisRunId).eq('platform', platform) // ← Filter
const { data: prevAnalysis } = await supabase.from('analyse_ki')
  .select(…).eq('user_id', userId).eq('platform', platform)                  // ← Filter
```

Der Prompt beginnt mit „Du bist ein deutschsprachiger **{Instagram|TikTok}**-Coach" und enthält keinerlei Daten der jeweils anderen Plattform. `vergleich_vorherige` vergleicht den **vorherigen Lauf derselben Plattform**, nicht die Plattformen untereinander.

**Textprüfung über alle 9 `analyse_ki`-Zeilen:** keine einzige Instagram-Analyse erwähnt TikTok, keine einzige TikTok-Analyse erwähnt Instagram. Null Treffer.

**Damit ist der Wert des plattformübergreifenden Vergleichs heute exakt null.** Er geht bei keiner Option verloren, weil es ihn nicht gibt. Wer ihn will, müsste ihn bauen — und das wäre ein *drittes* Haiku-Call mit beiden Datensätzen, nicht etwas, das durch Beibehalten des Status quo erhalten bliebe.

### 2.3 Was `vergleich_vorherige` tatsächlich liefert

Nur 2 von 9 Zeilen haben überhaupt einen Vergleichstext. Beide sind inhaltlich stark geschrieben — und beide reproduzieren die Rechenfehler aus der ersten Bestandsaufnahme als Tatsachenbehauptung:

> „Deine Follower sind um etwa 88% gefallen (von 10300 auf 1218) — das ist ein dramatischer Bruch. Das deutet auf einen Account-Reset, Shadowban-Periode oder Content-Pivot hin. Parallel dazu ist deine ER explosiv von 1.69% auf 76.42% gestiegen […] Das ist kein organisches Wachstum — das ist ein Neustart."

Der „88-%-Follower-Einbruch" ist der **Handle-Wechsel** (`antonietta_chiquita` → `antoniettadigraci`), der „explosive ER-Anstieg auf 76,42 %" ist der **ER-Bug**. Das Modell hat aus zwei Datenfehlern eine überzeugend klingende Shadowban-Diagnose gebaut und dem User ausgeliefert.

Das ist kein Argument gegen den Verlaufsvergleich — die zweite Zeile („+823 % Follower, alte Empfehlung ignoriert, Content zu stark auf ein Thema verengt") zeigt, wie gut der Abschnitt sein kann. Es ist ein Argument dafür, **die Datenfehler vor jeder Optionsentscheidung zu beheben.** Ein Vergleich über falschen Zahlen ist schlechter als gar keiner.

---

## 3. Kosten: beide Plattformen gegenüber nur Instagram

| Posten | Nur Instagram | Beide Plattformen | Differenz |
|---|---|---|---|
| Haiku Instagram (gemessen, Ø 7 Läufe) | $0,0127 | $0,0127 | — |
| Haiku TikTok (gemessen, Ø 5 Läufe) | — | $0,0129 | +$0,0129 |
| **Modell gesamt** | **$0,0127** | **$0,0256** | **+$0,0129** |
| Apify IG-Profil-Scraper, 1 Result *(geschätzt)* | ~$0,0023 | ~$0,0023 | — |
| Apify TikTok-Scraper, 15 Videos *(geschätzt)* | — | ~$0,006 | +$0,006 |
| **Apify gesamt** | **~$0,002** | **~$0,008** | **+$0,006** |
| **Produktionskosten gesamt** | **~$0,015 ≈ 1,4 Cent** | **~$0,034 ≈ 3,1 Cent** | **+1,7 Cent** |
| Stripe-Gebühr auf 9,99 € | 0,40–0,65 € | 0,40–0,65 € | — |
| **Deckungsbeitrag** | **~9,34–9,58 €** | **~9,32–9,57 €** | **−1,7 Cent** |

Die Haiku-Zahlen sind echte Messwerte aus `ai_usage_log`. Die Apify-Zahlen sind aus öffentlichen Actor-Preisen geschätzt und sollten gegen deine Apify-Abrechnung geprüft werden.

**Die Aussage, auf die es ankommt:** TikTok wegzulassen spart **1,7 Cent pro Lauf** — das sind 0,17 % des Verkaufspreises und rund 3 % der Stripe-Gebühr. **Die Kostenseite spielt bei dieser Entscheidung keine Rolle.** Wer wegen der Kosten über die Plattformfrage nachdenkt, optimiert die falsche Größe.

Entscheidend ist stattdessen:
- **Produktklarheit** — was verspricht der Preis?
- **Wahrgenommene Fairness** — warum bekommt A das Doppelte von B zum gleichen Preis?
- **Wiederkaufrate** — welches Modell erzeugt mehr Käufe?

---

# Phase 2: Vier Optionen

## Option A — Nur Instagram, TikTok raus aus dem Kaufprodukt

### Was sich ändern müsste

| Bereich | Änderung | Aufwand |
|---|---|---|
| **Code** | `start-analysis`: TikTok-Block entfernen, `tiktok_skipped` fest auf `true`. `analysis-webhook`: `mapTiktokPost`, `pruneOldestTiktokPosts`, TikTok-Zweig in `extractProfile` entfernen. SPA: Plattform-Tabs entfernen (die ganze `switchPlatform`-Mechanik und `anv.platform`), Handle-Modal auf ein Feld reduzieren. `send-analysis-email`: Schleife über Plattformen entfällt. | **mittel** |
| **DB** | Kein Schemaeingriff nötig — `platform` bleibt als Spalte, es kommt nur nichts Neues mit `'tiktok'` dazu. `users.tiktok_handle` bleibt für Media Kit und BioLink erhalten. | **klein** |
| **Stripe** | Produktbeschreibung: „Instagram-/TikTok-Performance" → „Instagram-Performance". Preis unverändert. | **klein** |
| **Texte** | Landingpage-Kachel, Dashboard-Karte, Empty-State, Kaufbutton-Untertitel: überall „Instagram" statt neutral. AGB § 1.2 („Analytics: Auswertung deiner Instagram- und/oder TikTok-Profildaten") anpassen. Datenschutz 3.4, 4.6(b), 5.3, 5.4(b) erwähnen TikTok ebenfalls. | **mittel** |
| **Prompt** | `platformLabel`-Logik und der TikTok-Zweig entfallen. Der Prompt wird einfacher, weil Sonderfälle wie „Shares" und „total_hearts" wegfallen. | **klein** |

### Was mit dem Bestand passiert

- **`analyse_stats` / `analyse_ki` mit `platform='tiktok'`:** 6 bzw. 4 Zeilen. Sie müssten nicht gelöscht werden, würden aber unerreichbar, sobald die Tabs weg sind. Ohne Aufräumen bleiben sie als toter Bestand liegen — und `loadMediakit()` liest `analyse_stats` **ohne Plattformfilter** in `mkv.analyseStats[row.platform]`, würde also weiterhin veraltete TikTok-Zahlen ins Media Kit schreiben. **Das müsste explizit mitbedacht werden.**
- **User, die nur TikTok haben:** Derzeit keiner — alle 5 User haben einen Instagram-Handle, 3 davon zusätzlich TikTok. Das Risiko ist heute null, aber es ist eine Wette darauf, dass es so bleibt.

### User-Gefühl, Missbrauch, Prompt

- **Gefühl:** Ehrlich und klar. „9,99 € für deine Instagram-Analyse" ist ein Satz, den jeder sofort versteht. Kein Gefühl von Ungleichbehandlung mehr, weil alle dasselbe bekommen.
- **Missbrauch:** unverändert gering.
- **Prompt/Vergleich:** Verliert nichts, weil der plattformübergreifende Vergleich nicht existiert (siehe 2.2).
- **Der eigentliche Verlust:** TikTok ist die Plattform, auf der Micro-Creator in DACH gerade wachsen, und `avg_shares` ist dort eine echte Kennzahl, die Instagram öffentlich gar nicht hergibt. Man wirft die datenreichere Plattform weg, um ein Kommunikationsproblem zu lösen.

---

## Option B — Wie heute, aber transparent

Ein Kauf = alle Plattformen mit Handle. Der User sieht **vor** dem Kauf, was laufen wird, und wird gewarnt, wenn ein Handle fehlt. Fehlt es trotzdem, wird verbraucht — aber informiert.

### Was sich ändern müsste

| Bereich | Änderung | Aufwand |
|---|---|---|
| **Code** | `renderBtn()`: Handle-Status in den Vor-Kauf-Zweig ziehen und den Untertitel daraus bauen. `handleStartClick()`: bei 0 Handles das Modal **vor** `goToPayment()` öffnen. Neuer Hinweisblock über dem Kaufbutton mit den erkannten Kanälen und einem „TikTok ergänzen"-Link. Plattform-Tabs nur rendern, wenn ein Handle existiert. Backend bleibt **unverändert**. | **klein** |
| **DB** | keine Änderung | — |
| **Stripe** | keine Änderung — die Produktbeschreibung passt bereits („Instagram-/TikTok-Performance") | — |
| **Texte** | Landingpage-Kachel, Dashboard-Karte und Empty-State um „Instagram und TikTok" ergänzen. Kaufbutton-Untertitel dynamisch. AGB/Widerruf: unverändert richtig, es ändert sich nichts am Leistungsumfang. | **klein** |
| **Prompt** | keine Änderung | — |

### Skizze des Vor-Kauf-Zustands

```
┌────────────────────────────────────────────┐
│  Analysiert werden:                        │
│    ✓ Instagram   @antonietta_chiq          │
│    ✓ TikTok      @antoniettadigraci        │
│                                            │
│  [ 🔒 Analyse freischalten – 9,99 € ]      │
│     Beide Kanäle, eine Freischaltung       │
└────────────────────────────────────────────┘

  ── oder, bei fehlendem Handle: ─────────────

┌────────────────────────────────────────────┐
│  Analysiert wird:                          │
│    ✓ Instagram   @easyglenn                │
│    ○ TikTok      nicht verknüpft           │
│                                            │
│  ⚠ Nur Instagram wird analysiert. Der      │
│    TikTok-Handle lässt sich später nicht   │
│    nachtragen — die Freischaltung gilt     │
│    für diesen einen Durchlauf.             │
│    [ TikTok jetzt ergänzen ]               │
│                                            │
│  [ 🔒 Trotzdem freischalten – 9,99 € ]     │
└────────────────────────────────────────────┘
```

### User-Gefühl, Missbrauch, Prompt

- **Gefühl:** Der Zwei-Plattform-User fühlt sich gut behandelt („zwei für den Preis von einer"). Der Ein-Plattform-User weiß wenigstens, worauf er sich einlässt — und bekommt genau im richtigen Moment den Anstoß, den zweiten Kanal zu verknüpfen. Das ist der Nebeneffekt, der die Option besonders attraktiv macht: **die Warnung erhöht die Datenqualität, statt sie nur zu kommunizieren.**
- **Missbrauch:** keiner. Ein User kann nicht mehr bekommen, als er hinterlegt hat.
- **Restrisiko:** Der Ein-Plattform-User zahlt objektiv dasselbe für die Hälfte. Transparenz macht das nicht fair, nur ehrlich. Wer das als unfair empfindet, empfindet es weiter so — nur eben vor dem Kauf statt danach.
- **Prompt:** unverändert.

---

## Option C — Ein Kauf = eine Plattform, Auswahl beim Kauf

### Was sich ändern müsste

| Bereich | Änderung | Aufwand |
|---|---|---|
| **DB** | `analysis_purchases` braucht eine Spalte `platform TEXT` (`'instagram'` \| `'tiktok'`). Der Teilindex `idx_analysis_purchases_user_unconsumed` müsste auf `(user_id, platform) WHERE consumed_at IS NULL` erweitert werden. Migration nötig, aber klein. | **klein** |
| **Code** | `start-analysis`: Kauf-Abfrage um `.eq('platform', gewaehlt)` ergänzen, nur den einen Apify-Run starten, die andere Plattform auf `skipped`. `consumePurchaseForUser` muss die passende Plattform-Zeile treffen, nicht die älteste beliebige. `stripe-webhook`: muss aus der Session erkennen, **welche** Plattform gekauft wurde — über zwei `price_id`s oder ein `metadata`-Feld. Payment Links tragen keine dynamische Metadata; entweder zwei Payment Links oder ein Wechsel auf serverseitig erzeugte Checkout Sessions. **Das ist der teuerste Einzelpunkt.** SPA: Plattform-Auswahl vor dem Checkout, Kaufstatus pro Plattform, Button-Logik je Tab. | **groß** |
| **Stripe** | Zwei Preise oder zwei Payment Links („viuno Analyse — Instagram", „… TikTok"). Alternativ Umstellung auf `POST /v1/checkout/sessions` aus einer Edge Function, damit `metadata` gesetzt werden kann. Letzteres ist sauberer und öffnet gleichzeitig die Tür für Rabatte und Pakete. | **mittel–groß** |
| **Texte** | Preisdarstellung überall: „9,99 € pro Kanal". Landingpage, Dashboard, Empty-State. AGB § 1.2 präzisieren. Fertig-Mail: nur die gekaufte Plattform. | **mittel** |
| **Prompt** | keine Änderung (er ist ohnehin plattformweise) | — |

### User-Gefühl, Missbrauch, Prompt

- **Gefühl:** Sauber und fair im Prinzip — jeder zahlt für das, was er bekommt. Aber: **der Zwei-Plattform-User zahlt ab sofort 19,98 € statt 9,99 €.** Das ist eine faktische Preisverdopplung für genau die Gruppe, die heute am meisten Wert zieht, bei 1,7 Cent Mehrkosten auf unserer Seite. Bei null Bestandskunden ist das schmerzfrei umsetzbar; ab dem ersten Wiederkäufer ist es eine Preiserhöhung, die man erklären muss.
- **Zweiter Reibungspunkt:** Eine zusätzliche Entscheidung vor dem Kauf senkt die Conversion. Bei aktuell 8,3 % Checkout-Conversion ist jede zusätzliche Frage teuer.
- **Missbrauch:** Neuer Vektor. Der Kauf ist an die Plattform gebunden, aber **nicht an den Handle**. Ein User könnte einen Instagram-Kauf tätigen, den Handle vor dem Start auf ein fremdes Profil ändern und so gezielt Fremdanalysen kaufen. Das geht heute auch, wird aber durch die explizite Plattformbindung eher noch offensichtlicher als Produkt-Feature missverstanden.
- **Prompt:** unverändert, verliert nichts.

---

## Option D — Anspruch auf beide Plattformen, der nicht verfällt

Ein Kauf gewährt einen Anspruch auf je eine Auswertung pro Plattform. Fehlt ein Handle, bleibt der Teilanspruch offen, bis er nachgetragen wird.

### Was sich ändern müsste

| Bereich | Änderung | Aufwand |
|---|---|---|
| **DB** | Der Kauf ist nicht mehr ein Zustand, sondern zwei. Entweder `analysis_purchases` um `consumed_ig_at` / `consumed_tt_at` erweitern, oder eine Tabelle `analysis_entitlements (purchase_id, platform, consumed_at, analysis_run_id)` mit zwei Zeilen pro Kauf. Letzteres ist sauberer, bedeutet aber eine zweite Ebene im Datenmodell. | **mittel** |
| **Code** | `start-analysis` muss ermitteln, *welche* Ansprüche offen sind und nur für die einen Apify-Run starten. `consumePurchaseForUser` wird zu `consumeEntitlement(userId, platform, runId)` und muss **pro Plattform im Erfolgsfall** gestempelt werden — also innerhalb der Schleife statt danach. SPA: Der Kaufstatus ist nicht mehr boolesch. `renderBtn` muss drei Zustände abbilden („nichts offen", „nur TikTok offen", „beides offen"), die Tabs müssen zeigen, welcher Kanal noch ein Guthaben hat. Verlaufslogik wird komplizierter, weil zwei Plattformen desselben Kaufs zu verschiedenen Zeitpunkten laufen. | **groß** |
| **Stripe** | keine Änderung am Produkt | — |
| **Texte** | Muss den Anspruchscharakter erklären: „Deine Freischaltung deckt Instagram und TikTok ab. TikTok ist noch offen — verknüpfe deinen Kanal, wann du willst." Das ist mehr Erklärtext als die anderen Optionen brauchen. | **mittel** |
| **AGB/Widerruf** | **Hier wird es unangenehm.** Die Widerrufskonstruktion nach § 356 Abs. 5 BGB stützt sich darauf, dass die Leistung **sofort und vollständig** ausgeführt wird — der Checkbox-Text sagt wörtlich „dass die Analyse sofort nach Zahlung beginnt". Bei einem Anspruch, der Wochen später noch offen ist, ist die Leistung eben nicht vollständig erbracht. Eine Teilleistung, die auf unbestimmte Zeit aussteht, ist widerrufsrechtlich ein anderer Sachverhalt. Zusätzlich: Was passiert mit offenen Ansprüchen bei Account-Löschung? Und verjähren sie? | **groß, und anwaltlich zu klären** |
| **Prompt** | keine Änderung | — |

### User-Gefühl, Missbrauch, Prompt

- **Gefühl:** Auf dem Papier das fairste Modell — niemand verliert etwas. In der Praxis das komplizierteste: Der User muss verstehen, dass er ein Guthaben mit zwei Hälften hat. Das ist eine Buchhaltungsmetapher, keine Produktidee.
- **Missbrauch:** Der offene TikTok-Anspruch lässt sich auf ein **beliebiges** Profil einlösen. Wer heute Instagram für sich analysiert, kann in drei Monaten den TikTok-Handle eines Konkurrenten eintragen und die zweite Hälfte darauf verwenden. Zeitlich entkoppelt ist das schwerer zu bemerken als beim Sofortlauf.
- **Zweiter Missbrauchsvektor:** Der Anspruch ist an die Plattform gebunden, nicht an den Zeitpunkt. Ein User könnte Instagram sofort einlösen, ein halbes Jahr warten und den TikTok-Anspruch dann auf einen völlig anderen, inzwischen gewachsenen Account anwenden.
- **Prompt:** unverändert — aber der Verlaufsvergleich wird unsauber, weil die beiden Plattformen desselben Kaufs aus verschiedenen Zeiträumen stammen.

---

## Vergleich auf einen Blick

| | A — nur Instagram | B — wie heute, transparent | C — Kauf pro Plattform | D — Anspruch beide |
|---|---|---|---|---|
| Aufwand Code | mittel | **klein** | groß | groß |
| Aufwand DB | klein | **keiner** | klein | mittel |
| Aufwand Stripe | klein | **keiner** | mittel–groß | keiner |
| Aufwand Texte | mittel | klein | mittel | mittel |
| Aufwand Recht | mittel | **keiner** | klein | **groß** |
| Verständlichkeit für den User | **sehr hoch** | hoch | hoch | niedrig |
| Fairness bei nur einem Handle | **entfällt** | ehrlich, nicht fair | **fair** | **fair** |
| Umsatz je Zwei-Plattform-User | 9,99 € | 9,99 € | **19,98 €** | 9,99 € |
| Conversion-Wirkung | neutral | **leicht positiv** | negativ (Extra-Entscheidung) | neutral |
| Missbrauchsrisiko | unverändert | unverändert | leicht erhöht | **erhöht** |
| Verlust des Plattform-Vergleichs | **keiner — gibt es nicht** | keiner | **keiner — gibt es nicht** | keiner |
| Kostenersparnis pro Lauf | 1,7 Cent | 0 | 0 | 0 |

---

# Empfehlung

**Option B — mit einer Einschränkung und einer Reihenfolge.**

## Warum B

1. **Sie behebt das eigentliche Problem.** Der Ärger entsteht nicht daraus, dass ein Kauf beide Plattformen abdeckt — sondern daraus, dass der User vor dem Kauf nicht weiß, was er bekommt, und dass ein Kauf ohne jeden Handle möglich ist. Beides ist ein Frontend-Problem, kein Modellproblem.

2. **Sie ist die einzige Option ohne Backend-, DB-, Stripe- und Rechtsänderung.** `renderBtn()` und `handleStartClick()` sind zusammen unter 40 Zeilen. Bei einem Produkt mit null echten Kunden ist das die einzig angemessene Investitionsgröße.

3. **Die Kostenfrage entfällt nachweislich.** Die zweite Plattform kostet 1,7 Cent. Es gibt keinen wirtschaftlichen Grund, sie zu beschneiden oder separat zu verkaufen.

4. **Das Argument gegen A und C ist inzwischen widerlegt.** Ich hatte selbst erwartet, dass der plattformübergreifende Vergleich das starke Argument für ein Bündel ist. Er existiert nicht — in keiner der 9 vorhandenen Auswertungen. A und C verlieren dadurch nichts; sie gewinnen aber auch nichts, was B nicht billiger bekäme.

5. **Die Warnung ist nebenbei ein Datenqualitäts-Werkzeug.** „Nur Instagram wird analysiert — TikTok jetzt ergänzen?" erscheint im Moment höchster Kaufbereitschaft. Das ist der beste denkbare Zeitpunkt, um einen zweiten Handle zu bekommen — und mehr Handles heißt mehr Daten für den Nischen-Benchmark, der ohnehin auf der Roadmap steht.

6. **Zwei Plattformen für einen Preis sind ein Verkaufsargument, kein Problem.** „Instagram und TikTok, eine Freischaltung, 9,99 €" ist eine stärkere Aussage als „9,99 € pro Kanal" — gerade gegen kostenlose Konkurrenz.

## Die Einschränkung

**B allein löst Variante C nicht** — den Fall, dass eine Plattform durchläuft, die andere still scheitert, und der Kauf trotzdem vollständig verbraucht wird. Das ist der einzige Fall, in dem ein User für eine Teilleistung zahlt, ohne es zu erfahren. Er ist bisher nie eingetreten, aber er ist der wahrscheinlichste Supportfall, sobald Volumen kommt.

Die kleine Lösung dafür braucht kein neues Modell: `run.error` auch bei `status: 'done'` rendern, mit einem Satz wie „Instagram ist fertig. TikTok konnte nicht ausgelesen werden — schreib uns, wir schalten dir dafür frei." Plus ein Admin-Knopf, der `consumed_at` zurücksetzt. Das ist Kulanz statt Automatik, und bei dieser Kundenzahl die richtige Größenordnung.

## Die Reihenfolge

**Erst die Datenfehler, dann die Verbrauchslogik.** Abschnitt 2.3 zeigt, warum: Der Verlaufsvergleich hat einem User bereits eine erfundene Shadowban-Diagnose ausgeliefert, gebaut aus dem ER-Bug und dem Handle-Wechsel-Bug. Solange das so ist, macht jede Diskussion über den Leistungsumfang die falsche Leistung nur besser verpackt.

Meine Reihenfolge: `corsHeaders`-Bug → ER-Definition → Handle-Wechsel → **dann** Option B → dann Variante-C-Hinweis.

## Wann ich B *nicht* empfehlen würde

- **Wenn du feststellst, dass TikTok-Analysen deutlich schlechter sind als Instagram-Analysen.** Das kann ich nicht beurteilen — dazu müsstest du die vier vorhandenen TikTok-Texte lesen. Wenn TikTok im Kern nur „du postest viel und bekommst wenig" sagt, weil der Scraper weniger Signal liefert, dann verkauft B eine schwache Hälfte mit. Dann wäre **A** richtig: lieber ein gutes Produkt als zwei halbe.

- **Wenn der Preis dauerhaft auf 9,99 € bleiben soll und du mehr Umsatz pro Kunde brauchst.** C ist die einzige Option, die den Umsatz je Zwei-Plattform-User verdoppelt, ohne den Listenpreis anzufassen. Das kostet Conversion und Aufwand — kann sich aber rechnen, wenn die Zahlungsbereitschaft höher ist als gedacht. Das weißt du erst nach den ersten 20 echten Käufen.

- **Wenn du ohnehin von Payment Links auf serverseitige Checkout Sessions wechseln willst.** Dann fällt der teuerste Teil von C weg, und C wird von „groß" auf „mittel" — der Aufwandsunterschied zu B schrumpft erheblich. Der Wechsel wäre ohnehin sinnvoll: er erlaubt `metadata`, Rabattcodes, das Dreierpaket aus der ersten Bestandsaufnahme und einen ordentlichen `cancel_url`.

- **D würde ich in keinem Szenario empfehlen.** Es ist die fairste Idee und die teuerste Umsetzung, es öffnet den einzigen echten neuen Missbrauchsvektor (zeitversetzte Einlösung auf beliebige Fremdprofile), und es bringt die Widerrufskonstruktion nach § 356 Abs. 5 BGB ins Wanken, die heute sauber steht. Ein Guthaben mit zwei Hälften ist eine Buchhaltungsmetapher, die man einem Creator nicht erklären sollte.

---

# Was dabei zusätzlich aufgefallen ist

Diese drei Punkte gehören nicht zur Optionsfrage, sind mir aber bei der Codeprüfung untergekommen und sind unabhängig von jeder Option relevant:

| Befund | Wirkung | Aufwand |
|---|---|---|
| **Apify-Webhook nur auf `ACTOR.RUN.SUCCEEDED`** — scheitert ein Apify-Run, kommt nie ein Callback, der Run hängt für immer auf `scraping`, und `showFlow()` sperrt den Start-Button dauerhaft. Kein Timeout, kein Cron-Aufräumjob (`cron.job` enthält nur die beiden Digest-Jobs). | hoch — User dauerhaft blockiert, Guthaben unerreichbar | klein (`ACTOR.RUN.FAILED` und `ACTOR.RUN.TIMED_OUT` mitregistrieren) bis mittel (Cron-Job, der Runs älter als 15 Minuten auf `failed` setzt) |
| **Kauf ohne Handle möglich** — `handleStartClick` prüft die Handles nicht, bevor es zu Stripe weiterleitet. | mittel — der User zahlt, bevor er weiß, ob er überhaupt etwas hinterlegt hat | klein (in Option B enthalten) |
| **TikTok mit ≤3 Videos verschwindet komplett** — `pruneOldestTiktokPosts(3)` löscht alle Zeilen, `insertedCount` wird 0, `buildAndSaveStats` wird übersprungen, die Plattform fehlt in `uniquePlatforms`. Realistisch bei frisch gestarteten Accounts. | niedrig–mittel | klein (nur prunen, wenn mehr als 12 Videos da sind) |

---

# Offene Fragen

1. **Wie gut sind die TikTok-Auswertungen inhaltlich?** Das ist die Frage, die zwischen B und A entscheidet, und ich kann sie nicht beantworten — dazu müsstest du die vier vorhandenen TikTok-Texte in `analyse_ki` lesen und mit den Instagram-Texten vergleichen.
2. **Willst du mittelfristig von Payment Links auf serverseitige Checkout Sessions?** Falls ja, wird C deutlich billiger und die Empfehlung ist neu zu bewerten.
3. **Apify-Kosten:** Meine 0,6 Cent für den TikTok-Scraper sind geschätzt. Was steht real in deiner Abrechnung?
4. **Soll ein plattformübergreifender Vergleich überhaupt gebaut werden?** Er wäre ein dritter Haiku-Call mit beiden Datensätzen — inhaltlich der stärkste Grund für ein Bündel, der heute schlicht fehlt. Kosten: ~1,3 Cent pro Lauf.
5. **Was ist der Plan für User ohne Instagram?** Heute hat jeder der 5 einen. Falls das absichtlich so bleiben soll, wird A risikoärmer, als ich es oben bewertet habe.
