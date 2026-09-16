# Auftrag: viuno Creator-App komplett neu bauen

Du baust die eingeloggte Web-App von **viuno** von Grund auf neu. Das Backend
steht bereits vollständig in Supabase und ist getestet — du baust die
Oberfläche. Nicht anpassen, nicht erweitern: **neu**.

---

## 0. Die vier harten Regeln

**1. Du benutzt NICHTS aus der bestehenden App.**
`public/app/index.html` ist tabu — kein CSS, keine Klassennamen, keine
Komponenten, kein Markup, kein View-Code, kein Layout. Auch nicht „als
Vorlage" oder „zur Orientierung". Öffne die Datei nur, wenn du eine
Datenabfrage nachschlagen musst, und übernimm dann ausschließlich die
Abfrage, nie die Darstellung. Der letzte Versuch ist genau daran
gescheitert: aus Risikoscheu wurden die alten Bausteine wiederverwendet, und
das Ergebnis sah aus wie die alte App mit neuen Seiten darin.

**2. Das UI kommt ausschließlich aus dem mitgeschickten Anhang.**
Leite daraus ein eigenes Designsystem ab — Farb- und Größen-Token,
Komponenten, Abstände, Zustände. Was der Anhang nicht zeigt, baust du
**passend dazu neu**, im selben Geist. Nichts aus dem heutigen viuno.

**3. Du änderst nichts an der laufenden App.**
`public/app/`, alle übrigen Ordner unter `public/`, die öffentlichen
Creator-Seiten und der bezahlte Analyse-Pfad bleiben unangetastet. Die neue
App entsteht in einem **eigenen Ordner** unter `public/` und auf einem
**eigenen Branch**. Nicht nach `main` pushen, ohne dass der Auftraggeber es
ausdrücklich erlaubt — ein Push auf `main` geht sofort live.

**4. Am Ende prüfst du jede Funktion selbst und baust nach, was nicht geht.**
Nicht „die Abfrage ist korrekt", sondern: angeklickt, gespeichert, neu
geladen, Ergebnis gesehen. Die Abnahmeliste steht in Abschnitt 7.

**Und die Reihenfolge aus Abschnitt 8 ist verbindlich.** Erst das
Designsystem, dann drei Ansichten zur Abnahme, erst danach der Rest. Wer
zwölf Ansichten baut, bevor die Grundlage abgenommen ist, baut sie zweimal.

---

## 1. Was viuno ist

Ein Werkzeug für deutschsprachige Micro-Creator (1.000–50.000 Follower auf
Instagram und/oder TikTok). Selbstständig, kein Team, keine Agentur, kein
Werbebudget. Sie verdienen über Kooperationen mit Marken.

Abo: **9,99 € im Monat.** Daraus folgt eine harte Kostengrenze — siehe
Abschnitt 5.

### Der Satz, an dem alles hängt

> **Zahlen und Zusammenhänge entstehen in Code. Das Sprachmodell darf sie
> verwenden, aber keine eigenen bilden.**

Das ist keine Stilfrage. Der Unterschied zwischen viuno und einem beliebigen
KI-Tipp ist die Zahl unter dem Satz. Jede Aussage der App muss auf eine
gemessene Zahl zurückführbar sein, und diese Zahl muss **sichtbar daneben
stehen**, nicht hinter einem Klick.

Daraus folgen drei Regeln, die überall gelten:

- **Mindest-Fallzahl.** Eine Aussage über „das beste Format" braucht
  mindestens 3 Beiträge je Format. Eine Aussage über die beste Uhrzeit
  braucht mehr als 36 Beiträge auf 7 × 24 Felder — also sagt die App dazu
  nichts. Lieber schweigen als raten.
- **„Nicht bewertbar" ist ein eigener Zustand**, weder gut noch schlecht. Er
  senkt die *erreichbare* Punktzahl, nicht die erreichte. Beispiel: die
  Instagram-Profilkategorie wird nicht für jedes Konto geliefert und für
  TikTok nie — daraus „privates Konto" zu machen wäre eine Behauptung über
  das Profil statt einer Messung.
- **Keine Zahl ohne Bezug.** „+8 %" braucht „von 11.980 auf 12.928 seit dem
  07.09." daneben, sonst ist es ein Gefühl.

---

## 2. Das Backend steht schon — baue es nicht nach

Supabase-Projekt: **`bzejndghppuipnedasuv`**

Verschaffe dir als Erstes über die Supabase-Werkzeuge einen eigenen
Überblick (`list_tables`, `execute_sql`, `list_edge_functions`). Die Liste
unten ist die Landkarte, nicht das Gelände.

### Rechenfunktionen (RPC) — hier steckt die Fachlogik

Alle prüfen selbst, wer fragt, und geben nur die eigenen Daten heraus. Du
rufst sie auf, du rechnest nicht nach.

| RPC | liefert |
|---|---|
| `viuno_profilcheck()` | 10 Kriterien mit Punkten, Zustand, Begründungssatz und Zielroute; `punkte`, `max`, `prozent`, `offen` |
| `viuno_score()` | vier Säulen (Wachstum, Interaktion, Beständigkeit, Kooperations-Reife) mit Punkten, Quelle und Zustand; `gesamt` von 100 |
| `viuno_preis(format, rechte, exklusiv, plattform)` | Preisspanne aus den eigenen Ø-Aufrufen, mit vollständigem Rechenweg im Feld `rechnung`, Quelle und Stand |
| `viuno_verlauf(tage, plattform)` | Zeitreihe aus Messpuls und Analysen, mit `quelle` unterscheidbar |
| `viuno_news_profil()` | die Bedingungen, die auf dieses Konto zutreffen (z. B. `plattform_instagram`, `nische_fashion`, `hat_affiliate`) |
| `aufgabe_setzen(id, status)` | Aufgabe abhaken oder verwerfen, setzt den Cooldown |
| `growth_jetzt()` | erzeugt den Wochenbericht außerhalb des Montags, höchstens 1×/Woche |
| `erstanalyse_freischalten()` | schaltet die erste Analyse ohne Kauf frei |
| `biolink_herkunft/-stunden/-klick_zahlen/-klickrate(p_tage)` | BioLink-Auswertung |

### Tabellen

**Gemessen (schreibt nur der Service Role, lesbar nur vom eigenen Konto):**
`kanal_verlauf` · `beitrag_puls` · `growth_signale` · `growth_aufgaben` ·
`growth_wochenbericht` · `brand_readiness` · `analyse_stats` · `analyse_ki` ·
`apify_daten` · `analysis_runs` · `biolink_aufrufe` · `biolink_klicks` ·
`mediakit_aufrufe`

**Vom Creator gepflegt (volle Rechte auf die eigenen Zeilen):**
`users` · `deals` · `brands` · `mediakit_viuno` · `mediakit_preise` ·
`mediakit_content_offers` · `mediakit_brands` · `mediakit_beitraege` ·
`biolink_settings` · `biolink_viuno` · `biolink_custom_links`

**Referenz (für alle Eingeloggten lesbar):**
`preis_referenz` (TKP-Bänder je Nische/Plattform/Format — **Startwerte, keine
erhobenen Marktpreise**; die Spalte `quelle` sagt das, und die Oberfläche
muss es anzeigen) · `nischen_referenz` · `niche_mappings`

**Views:** `digest_cards_today` / `digest_cards_past` (die News; **immer über
diese Views lesen**, nie über `daily_digest.cards`) · `biopage_v2` ·
`mediakit_public`

### Edge Functions, die von selbst laufen

| Zeit | Function | tut |
|---|---|---|
| So 02:00 | `kanal-puls` → `puls-webhook` | misst jeden aktiven Kanal (Profil + bis 12 neue Beiträge), schreibt `kanal_verlauf` und `beitrag_puls` |
| Mo 03:30 | `growth-engine` | 10 Regeln, rein deterministisch, **kein Modell**; schreibt Signale, höchstens 3 Aufgaben, `brand_readiness` |
| Mo 05:00 | `growth-text` | ein Haiku-Aufruf je Konto, macht aus fertigen Belegsätzen 3–5 Sätze |
| Mo + Do 04:00 | `generate-daily-digest` | die News |
| Di 09:30 | `growth_waechter` | holt den Montagsbericht nach, wenn er ausgefallen ist |

Dazu der bezahlte Pfad: `start-analysis` → Apify → `analysis-webhook` →
`analyse_stats` / `analyse_ki`. **Diesen Pfad fasst du nicht an.**

---

## 3. Was die App können muss

Zehn Dinge. Die *Logik* ist in Abschnitt 2 fertig — du baust die Oberfläche
und die Verknüpfungen.

### 3.1 Heute — der Montagsbericht

Die Startseite. Liest `growth_wochenbericht` (der Text), `growth_aufgaben`
(höchstens drei), `growth_signale` (Rückfallebene), `viuno_score`,
`kanal_verlauf`.

- **Die Begründung jeder Aufgabe steht immer sichtbar**, nie hinter einem
  Klick. Genau sie ist der Unterschied zu einem allgemeinen Tipp.
- **Höchstens drei Aufgaben. Sind sie erledigt, kommt bis Montag nichts
  nach.** Ein Coach, der auch mal sagt, dass es reicht.
- **Fällt das Sprachmodell aus**, zeigst du die deterministischen Belegsätze
  aus `growth_signale.beleg`. Trockener, aber richtig. Ein Bericht, der am
  Montag schweigt, wäre schlimmer.
- Abhaken/Verwerfen über `aufgabe_setzen()`.
- Offene Aufgaben der Vorwoche (`status='abgelaufen'`) als Rückfrage zeigen.
- Neues Konto mitten in der Woche: `growth_jetzt()` aufrufen, damit die
  Startseite nicht bis Montag leer bleibt.

### 3.2 Analyse

**Die vorhandene Analyse ist der technisch stärkste Teil des Systems und die
schwächste Ansicht.** Sie muss deutlich mehr zeigen, als heute sichtbar ist.
In `analyse_stats` liegt fertig gerechnet und wird teils gar nicht angezeigt:

`format_stats` (Ø Likes/Views je Format, mit Fallzahl) · `duration_stats`
(Längen-Buckets) · `sound_stats` · `eigener_ton` · `ausreisser` ·
`post_resonanz` (je Beitrag: Resonanz, Kommentarrate, Ton, Datum) ·
`resonanz_schnitt/_top/_flop` · `kommentarrate_schnitt` ·
`best_posting_hour/_day` **mit `best_time_sample`** · `top_hashtags` ·
`top_mentions` · Δ gegen den Vorlauf.

In `apify_daten` liegt zusätzlich ungenutzt: **`thumbnail_url`** (die Analyse
zeigt Top-Beiträge ohne Bild), die vollständigen Captions, alle Hashtags und
Mentions je Beitrag.

Zeige `best_posting_day/hour` **nur mit der Stichprobengröße daneben** — und
mach daraus keine Empfehlung, wenn `best_time_sample` klein ist.

### 3.3 Verlauf

`viuno_verlauf()`. Kurve aus Messpuls und Analysen, Analysepunkte markiert.
Dazu das **Archiv**: alte `analyse_ki`-Auswertungen liegen seit April in der
Datenbank und sind für den Creator bis heute nicht erreichbar.

### 3.4 Profilcheck und Creator Score

`viuno_profilcheck()` und `viuno_score()`. Der Score hat vier Säulen; eine
nicht messbare Säule fällt aus Zähler **und** Nenner. **Community und
Einnahmen fehlen bewusst** — dafür gibt es keine Quelle, und ein Score aus
sechs Teilen, von denen zwei geraten sind, ist schlechter als einer aus vier,
die stimmen. Bewegungen unter 3 Punkten nicht anzeigen.

### 3.5 Media Kit

Zieht seine Zahlen **automatisch** (ein Datenbank-Trigger führt
`mediakit_viuno` bei jeder Messung nach). Die gemessenen Werte sind
**Anzeige, keine Eingabefelder**; jeder Wert trägt seine Herkunft
(`automatisch` / `Handeingabe`, siehe `mediakit_viuno.hand_felder`).

**Es darf keine Aufgabe „Bring dein Media Kit auf Stand" geben.** Eine
Aufgabe, die eine Maschine erledigen kann, ist keine Aufgabe für einen
Menschen. Ein Hinweis ist in Ordnung, eine Aufgabe nicht.

Alters- und Länderverteilung kann viuno **nicht messen**. Sie bleibt
Handeingabe und muss auf der öffentlichen Seite ausdrücklich als
**Eigenangabe** gekennzeichnet sein — eine getippte Zahl, die wie eine
Messung aussieht, schadet gegenüber einer Marke mehr als eine fehlende.

### 3.6 BioLink

Auswertung über die vier RPCs. Gezählt wird ohne Cookie, ohne IP, ohne
Wiedererkennung — deshalb braucht keine BioLink-Seite einen Banner. **Wer
etwas ergänzt, das einen Besucher über zwei Aufrufe hinweg wiedererkennbar
macht, macht den Banner nötig.** Das ist die Grenze, keine Vorliebe.

### 3.7 Kooperationen

`deals` und `brands`. **Sieben Arten, und die Felder wechseln mit der Art** —
eine Link-Kooperation hat keinen Tagessatz, ein Barter-Deal keinen Preis, ein
UGC-Auftrag erscheint gar nicht auf dem eigenen Kanal:

| Art | Felder |
|---|---|
| bezahlt | Vergütung · Format · Plattform · Nutzungsrechte · Abgabe |
| link | Link · Provision % · Laufzeit · Format |
| affiliate | Link · Provision % · Netzwerk |
| code | Rabattcode · Provision % · Laufzeit |
| barter | Warenwert · Format · Plattform |
| ugc | Vergütung · Anzahl Assets · Nutzungsrechte |
| gratis | Format · Plattform |

Haken **„Im Media Kit als Referenz zeigen"** → spiegelt nach
`mediakit_brands`. Name und Logo werden öffentlich, **der vereinbarte Wert
nie**. Eine Abgabefrist wird drei Tage vorher zur Aufgabe im Montagsbericht.

### 3.8 Preise

`viuno_preis()`. Gerechnet wird auf die **durchschnittlichen Aufrufe**, nicht
auf die Followerzahl — fast alle Rechner am Markt nehmen Follower, und bei
einem kleinen Konto mit hoher Reichweite sagt das das Falsche. Die
Follower-Rechnung steht als Gegenprobe daneben; sie ist zugleich das Argument
im Gespräch mit der Marke.

**Der Rechenweg muss sichtbar sein** (Feld `rechnung`), ebenso Quelle und
Stand des TKP-Bandes und der Satz, dass es eine **Orientierung, kein
Marktpreis** ist. Ergebnis übernehmbar nach `mediakit_preise`.

### 3.9 Fahrplan zur ersten Kooperation

Sieben Schritte, und **keiner wird von Hand abgehakt**. Jeder Schritt hat
eine Bedingung, die die App selbst prüfen kann (erste Messung vorhanden?
Kontaktweg? BioLink? Media Kit aktuell? Preis hinterlegt? Kooperation
eingetragen? Als Referenz sichtbar?). Das ist der Unterschied zu jeder
Checkliste.

### 3.10 Creator News

Aus `digest_cards_today` / `digest_cards_past`. **Mit Bildern**
(`image_url`).

- **Knopf „Was bedeutet das für mich?"**: jede Karte trägt ein Array
  `bedeutung` mit Einträgen `{wenn, text}`. Vergleiche `wenn` gegen
  `viuno_news_profil()` — **in Code, kein Modell-Aufruf je Leserin.** Ist
  `bedeutung` leer oder passt nichts, **erscheint der Knopf gar nicht**. Eine
  erfundene Bedeutung wäre schlimmer als keine.
- **Filter**: „Für dich" · „Alle" · Rubriken (`rubrik`: plattform, studie,
  recht, werkzeug, trend).
- Dringlichkeit kommt aus `relevance_score` (≥8 / ≥6 / darunter), **nicht**
  aus dem Feld `level` des Modells — das stand schon auf „hoch" bei einer
  Shop-Meldung mit Score 7.

### 3.11 Navigation

Fünf Ziele statt der heutigen Aufteilung nach Werkzeugen. Vorschlag, den du
anhand des UI-Anhangs schärfen darfst:

**Heute** · **Insights** (Analyse · Verlauf · Profilcheck) · **Studio**
(BioLink · Media Kit) · **Business** (Kooperationen · Preise · Fahrplan) ·
**News**

Das Profil hängt am Avatar in der Kopfleiste. **Der Logout liegt in der
Profil-Ansicht und darf nicht verschwinden.**

### 3.12 Profil

Vollständig, nicht nebenbei: Anzeigename, Nutzername (mit Verfügbarkeitsprüfung),
Bio, Foto (im Browser auf 800 px verkleinern, altes Bild löschen), Nische,
Kanal-Handles, Kontakt-E-Mail, Impressum, E-Mail und Passwort ändern,
Benachrichtigungen, Datenauskunft, Konto löschen, Rechtliches. Nach einer
Änderung an der Bio muss die öffentliche Seite neu erzeugt werden (die
`og:`-Tags sind eingebacken) — bei Handles und Nische nicht, die liest die
Seite zur Laufzeit.

### 3.13 Teilbares für Instagram

An **jeder Stelle mit einer Zahl, auf die man stolz sein kann**: Woche,
Score, Preisspanne, Followerkurve, stärkster Beitrag, Profilcheck-Ergebnis.
Bild im Story-Format (1080 × 1350), auf einem Canvas gezeichnet,
**JPEG** (ein PNG dieser Karte wiegt 1,3 MB, das JPEG 77 kB), geteilt über
`navigator.share` mit Datei, am Schreibtisch als Download. Immer mit
`viuno.de` darauf — die Karte ist Beleg und Werbung zugleich.

---

## 4. Verbinden statt nebeneinanderstellen

Das ist der eigentliche Auftrag. Vier Adern, an denen alles hängt:

```
① MESSUNG (Puls wöchentlich + Analyse)
   └→ Media Kit · Montagsbericht · Profilcheck · Score · Preisrechner · News-Segmente

② KOOPERATIONEN (deals)
   └→ Referenzen im Media Kit · Fahrplan-Fortschritt · Score · Deadlines werden Aufgaben

③ NISCHEN-REFERENZ (einmal erhoben, von allen gelesen)
   └→ Score-Vergleich · TKP-Band im Preisrechner

④ NEWS (einmal erzeugt, per Bedingung personalisiert)
   └→ Heute-Teaser · „Für dich"
```

**Es darf keine Sackgasse geben.** Wenn der Montagsbericht sagt „Schreib zwei
Marken an, die du ohnehin zeigst", muss es einen Ort geben, der diese Marken
zeigt (`apify_daten` → `mentions`). Jede Aufgabe, jeder Hinweis und jeder
Fahrplan-Schritt führt auf eine Ansicht, die das Versprochene auch enthält.
Prüfe das am Ende systematisch.

---

## 5. Technische Leitplanken

- **Statische HTML-Datei**, ausgeliefert über Cloudflare Pages aus `public/`.
  Kein Bundler, kein Framework, kein Build-Schritt.
- **Kein fremdes CDN im Seitenaufruf.** Schriften aus `/fonts/`, supabase-js
  aus `/vendor/supabase-js.mjs`. Niemals googleapis oder esm.sh — die
  Datenschutzerklärung sagt genau das zu.
- **Hash-Routing** (`#/heute`), damit keine Server-Regel nötig ist.
- **Die Sperre ist RLS**, nicht die Oberfläche. Die App kann nichts
  freischalten, sie zeigt nur.
- **Kosten.** Netto bleiben nach Stripe ~9,59 €. Gemessen: ein Wochentext mit
  Haiku 0,0016 $, ein Messpuls 0,07 $, eine volle Analyse 0,24 $. Alles, was
  **pro Creator** läuft, ist Arithmetik; alles, was ein **Modell** braucht,
  läuft entweder einmal für alle oder selten pro Konto. Ein Modell-Aufruf je
  Creator und Tag sprengt die Rechnung.

---

## 6. Fallen, die schon zugeschlagen haben

Lies das, bevor du anfängst. Jede dieser Stellen hat schon einmal Zeit
gekostet.

1. **Die App sieht leer aus, weil die Daten erst später kommen.** Der Puls
   läuft sonntags, die News montags und donnerstags, der Score braucht zwei
   Messpunkte. **Stoße die Läufe von Hand an, bevor du das Ergebnis
   vorzeigst**, sonst beurteilt jemand eine App, die nur auf ihre Daten
   wartet. Das war der größte Fehler des letzten Versuchs.
2. **`text[] || 'wort'`** liest Postgres als Array-Literal. Es braucht
   `'wort'::text`.
3. **Dieses Projekt vergibt `EXECUTE` an `anon` per Default-Privileg.**
   `revoke all ... from public` entfernt das **nicht**. Nach jedem
   `CREATE OR REPLACE FUNCTION` gehört
   `revoke execute on function … from public, anon, authenticated;` und dann
   ein gezieltes `grant`. Sonst ist eine Funktion ohne Konto aufrufbar.
4. **Ein knapper Belegsatz kippt beim Sprachmodell.** Aus „3 Angebot(e), aber
   keines mit Preis" wurde „Du hast 3 Kooperationsangebote bekommen" — die
   Richtung gedreht. **Formuliere jeden Belegsatz vollständig und an genau
   einer Stelle**, und reiche ihn unverändert weiter.
5. **Doppelte globale Namen.** `grep -o "^window\.[A-Za-z0-9_]*" <datei> |
   sort | uniq -d` muss leer bleiben. Eine doppelte Definition gewann schon
   einmal still, und eine Eingabe speicherte monatelang gar nichts.
6. **Zahlen brauchen `font-variant-numeric: tabular-nums`**, sonst springen
   sie beim Aktualisieren. Jede neue Zahlenklasse gehört in die Regel.
7. **`to_char()` nimmt das Trennzeichen der Datenbank-Locale** (en_US) — aus
   112978 wird „112,978". Für deutsche Zahlen gibt es `de_zahl()`.
8. **Edge Functions brauchen `verify_jwt: false`**, sonst lehnt das Gateway
   schon den CORS-Preflight ab. Die Prüfung passiert dann in der Function —
   **immer mit `supabase.auth.getUser(token)`, niemals durch eigenes
   Dekodieren des JWT.**

---

## 7. Abnahme

Erst fertig, wenn das hier stimmt:

**Jede Funktion einmal echt benutzt.** Nicht „die Abfrage ist richtig",
sondern: Kooperation aller sieben Arten angelegt und wiedergefunden, Haken
gesetzt und die Marke auf der Media-Kit-Seite gesehen, Preis übernommen und
im Media Kit geprüft, Aufgabe abgehakt und nach dem Neuladen noch abgehakt,
News-Filter mit einer Karte benutzt, die wirklich eine `bedeutung` trägt,
Teilen-Karte erzeugt und angesehen, Profil-Änderung gespeichert und die
öffentliche Seite kontrolliert.

**Die App mit echten Daten gefüllt**, bevor du sie vorzeigst (siehe Falle 1).

**Keine Sackgasse**: jede Aufgabe, jeder Hinweis, jeder Fahrplan-Schritt
führt auf eine Ansicht, die hält, was er verspricht.

**Auf dem Telefon geprüft**, nicht nur am Schreibtisch — die App wird
überwiegend dort benutzt.

**Beide Farbmodi**, falls der UI-Anhang einen Dunkelmodus vorsieht.

**Nichts Bestehendes kaputt**: `viuno.de/app/` und alle öffentlichen Seiten
verhalten sich unverändert. Beide Apps reden mit derselben Datenbank.

---

## 8. Die Reihenfolge — sie ist verbindlich

Der letzte Versuch scheiterte **nicht** an einer fehlenden Vorschau. Es gab
eine, sie war abgenommen, und gebaut wurde trotzdem etwas anderes: Die
Vorschau lag als eigene Datei daneben, und beim Bauen wurde auf die
vorhandenen Bausteine der alten App zurückgegriffen.

Deshalb ist die Vorschau hier **keine eigene Datei, sondern die erste Stufe
der App selbst.** Zwischen dem, was abgenommen wird, und dem, was stehen
bleibt, wird nichts übersetzt.

### Stufe 1 — Das Designsystem, als fertiges Stylesheet

Sieh dir den UI-Anhang an und schreibe daraus das **endgültige** Stylesheet
der neuen App: Farb-, Größen- und Abstands-Token, Komponenten, Zustände
(normal, aktiv, deaktiviert, leer, Fehler, Ladezustand). Kein
Wegwerf-Mockup, keine zweite Fassung „zum Zeigen" — das ist die Datei, die
am Ende ausgeliefert wird.

Halte in Kommentaren fest, **warum** eine Entscheidung so fiel, nicht nur,
dass sie so fiel. Was der Anhang nicht zeigt, baust du passend dazu neu und
begründest es.

Parallel dazu: über die Supabase-Werkzeuge den echten Datenbestand ansehen.
Ruf die RPCs einmal auf und sieh dir an, was tatsächlich zurückkommt — nicht,
was hier beschrieben steht.

Branch anlegen, eigenen Ordner unter `public/` wählen.

### Stufe 2 — Drei Ansichten, mit Beispieldaten. **Hier wird abgenommen.**

Baue aus diesem Stylesheet genau drei Ansichten:

| | warum diese |
|---|---|
| **Heute** | Die eine große Karte trägt den Bildschirm. Wenn die nicht trägt, trägt nichts. |
| **Analyse** | Die dichteste Ansicht: viele Zahlen, Verteilungen, Fallzahlen, Beitragsbilder. Reicht das Designsystem hier nicht, merkt man es sonst erst bei Ansicht neun. |
| **Kooperationen** | Liste, Blatt, Formular mit wechselnden Feldern. Deckt alles Interaktive ab. |

Dann **hör auf und lege vor.** Keine weiteren Ansichten, bevor diese drei
abgenommen sind.

**Baue keine Vorschau aller zwölf Ansichten.** Das ist derselbe Fehler in
langsam: viel Arbeit, bevor klar ist, ob die Grundlage stimmt.

### Stufe 3 — Dieselben drei Ansichten an die echten Daten

Nicht neu bauen: verkabeln. Das Markup bleibt, die Beispieldaten weichen den
echten. **Vorher** die Läufe von Hand anstoßen (siehe Falle 1), damit die
Ansichten mit Inhalt beurteilt werden und nicht leer.

### Stufe 4 — Der Rest

Alle übrigen Ansichten aus denselben Komponenten zusammensetzen. Entsteht
dabei eine neue Komponente, kommt sie ins Stylesheet — nicht als
Sonderfall in eine einzelne Ansicht.

Danach die Abnahme aus Abschnitt 7.

---

**Zum Schluss, und es gilt überall:** Wenn etwas fehlt, um ehrlich zu sein,
frag lieber nach, als eine Zahl zu erfinden. Eine Ansicht, die sagt „dafür
haben wir noch zu wenig gemessen", ist mehr wert als eine, die etwas
behauptet.
