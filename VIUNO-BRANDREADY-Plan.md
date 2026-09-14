# viuno Brand-Ready-Check — Prüfung des Entwurfs und Bauplan

**Stand:** 14. September 2026
**Grundlage:** Repo `bioseiten` @ `main`, Supabase `bzejndghppuipnedasuv`, alle 7 `analyse_stats`-Zeilen und alle 108 `apify_daten`-Beiträge nachgerechnet
**Status:** reine Planung — **nichts geändert, nichts migriert, nichts deployt.**

---

## Kurzfassung

Der Check ist baubar und er trägt. Er misst etwas Echtes: gegen die vorhandenen Daten
gerechnet liegt das beste Konto bei **69 von 80 bewertbaren Punkten**, das schwächste bei
**12 von 72**. Ein Instrument, das nicht unterscheidet, wäre wertlos — dieses unterscheidet.

Der Entwurf enthält aber **acht Feldnamen und Regeln, die gegen die echte Datenbank nicht
laufen** — teils, weil die Spalte anders heißt, teils, weil sie leer ist. Zwei davon würden
dem Creator eine **falsche Aussage über sein eigenes Konto** machen. Die sind hier korrigiert.

Der Bauumfang ist kleiner, als der Entwurf annimmt. Nach Streichung des Modell-Laufs braucht
der Check **keine Edge Function, keine Ergebnistabelle, keinen Cron, keinen API-Key und keinen
Cent laufende Kosten.** Alle Tabellen sind vom eingeloggten Nutzer über RLS direkt lesbar; die
Rechnung ist Arithmetik. Übrig bleiben **eine Migration** (rein additiv) und **eine neue View in
der SPA**. An der Analyse-Pipeline, an den Generatoren und an den öffentlichen Seiten wird
nichts angefasst.

---

# 1. Was der Entwurf annimmt und was tatsächlich in der Datenbank steht

Acht Punkte. Die ersten beiden sind die ernsten.

## 1.1 `isBusinessAccount` existiert nicht — und die Regel würde lügen

`analyse_stats.raw_profile` ist ein **beschnittenes** Objekt, kein Apify-Rohprofil:

| Plattform | Keys in `raw_profile` |
|---|---|
| Instagram | `businessCategory`, `followersCount`, `followsCount`, `postsCount`, `verified` |
| TikTok | `fans`, `heart`, `verified`, `video` |

Es gibt kein `isBusinessAccount` und kein `businessCategoryName`. Das Feld heißt
`businessCategory` — und ist bei **antonietta_chiq `null`**, bei easyglenn `"Sports & recreation"`.

Nach der Regel des Entwurfs bekäme Antonietta den Satz *„Dein Konto ist ein privates Konto.
Marken sehen keine Kategorie und kein Kontaktfeld."* Das ist eine **Behauptung über ihr Konto,
die aus einem fehlenden Scraper-Feld erzeugt wurde**, nicht aus einer Messung. Auf TikTok gilt
dasselbe für jeden Nutzer, weil das Feld dort nie geliefert wird.

→ **Korrektur:** Kategorie vorhanden = volle Punkte. Kategorie fehlt = `nicht_bewertbar`, auf
beiden Plattformen. Nie „privates Konto".

## 1.2 Die Bio-Regel liest die falsche Bio

Der Entwurf prüft `users.bio` — das ist die Bio der **viuno-BioLink-Seite**. Die Bio, die eine
Marke liest, ist die **Kanal-Bio**, und die steht in `analyse_stats.bio`.

| Konto | `users.bio` | `analyse_stats.bio` |
|---|---|---|
| Antonietta | 0 Zeichen | 73 Zeichen (inkl. Kontaktadresse) |
| easyglenn | 14 Zeichen | 110 Zeichen |

Mit `users.bio` bekäme Antonietta **0 von 8 Punkten** für eine Bio, die tatsächlich in Ordnung ist.

→ **Korrektur:** Der Check rechnet auf `analyse_stats.bio` je Plattform. `users.bio` nur als Fallback.

## 1.3 `mentions` sind leer — die Kennzeichnungs-Ersatzregel kann nie feuern

`top_mentions` ist `[]` in **allen sieben** `analyse_stats`-Zeilen. In `apify_daten` haben
**4 von 108** Beiträgen überhaupt eine Mention, alle aus einem Lauf vom April.

Die Regel *„kein Kennzeichnungs-Treffer, aber ≥ 3 verschiedene Marken-Mentions → 0 Punkte mit
Hinweis"* setzt Daten voraus, die nicht existieren. Sie kann nie greifen. Details in 3.4.

## 1.4 `preise` widerspricht sich selbst

Der Entwurf erwartet in der Probe „Beide: `preise` = null (Spalte neu, leer)". Nach der eigenen
Regel („Angebote ohne Preis → halb") ist das falsch: Antonietta hat **4 Angebote**
(`ugc_video`, `instagram_reel`, `tiktok_post`, `story_package`), sie sind nur ohne Preis → **halb**.

## 1.5 `verlauf` ist überall tot — aber aus einem anderen Grund

`followers_prev` ist in **allen sieben** Zeilen `NULL`, `handle_changed` überall `false`. Das
Kriterium ist also bei jedem Konto `nicht_bewertbar` — nicht wegen eines Handle-Wechsels,
sondern weil **niemand eine zweite Analyse gekauft hat**. Das ist exakt die Messpuls-Lücke aus
`VIUNO-GROWTH` C.1. Das Kriterium bleibt drin und springt beim zweiten Kauf von selbst an.

## 1.6 „easyglenn TikTok" ist ein anderes Konto

Die Zeile mit ER 0,24 % gehört zu User `2f417fef` — `display_name` **„liaminini"**, Handle
`easyglenn_`, Stand **30.04.2026**, 12 Beiträge. Der Account „easyglenn" auf Instagram gehört
zwei anderen Usern (`5aec684d` und `d1eb7462`). Die Erwartung stimmt in der Zahl, nicht im Namen.

## 1.7 `analysis_runs.platform` ist bei den alten Läufen `NULL`

Option C (ein Kauf = ein Kanal) kam am 13.09. Die drei Läufe davor haben `platform = NULL` und
decken beide Plattformen ab. „Jüngster Lauf je Plattform" muss deshalb über `analyse_stats`
ermittelt werden, nie über `analysis_runs.platform`.

## 1.8 Zwei Dinge, die der Entwurf voraussetzt und die es hier nicht gibt

- **`supabase/functions/analysis-webhook/befunde.ts` liegt nicht im Repo.** `supabase/functions/`
  enthält 14 Functions; `analysis-webhook` (v22) existiert nur im Dashboard. Die Doktrin ist
  wörtlich in `VIUNO-GROWTH` A.3 zitiert und wird hier befolgt.
- **`supabase migration` geht auf dieser Maschine nicht.** Es gibt kein `supabase/migrations/`,
  keine `config.toml`, keine CLI. Alle ~250 Migrationen sind über `apply_migration` gelaufen.
  → Genauso hier, plus eine SQL-Kopie im Repo als Dokumentation (wie bei den Functions).

---

# 2. Die getroffenen Entscheidungen

| Frage | Entscheidung | Folge |
|---|---|---|
| Zugang ohne Analyse | **Harte Schranke** | Ohne fertige Analyse nur Kriterien-Vorschau ohne Punkte plus Kaufhinweis. Der Check ist Teil des Kaufprodukts. |
| `themen_fokus` (Modell-Lauf) | **Gestrichen** | **Kein LLM im Check.** Kein `ANTHROPIC_API_KEY`, kein `ai_usage_log`, kein Retry, kein Cache, keine Kosten, kein Fehlerfall, der die Seite kippen kann. Die 10 Punkte werden umverteilt (siehe 3). |
| `kennzeichnung` | **Bleibt drin, fällt heute aus dem Maximum** | Erklärung in 3.4. |
| `account_typ` bei fehlendem Feld | `nicht_bewertbar` statt „privat" | 1.1 |
| Bio-Quelle | `analyse_stats.bio` | 1.2 |

Der Wegfall des Modell-Laufs ist die **wichtigste Vereinfachung**. Damit entfällt der einzige
Grund für eine Edge Function.

---

# 3. Der Check — 15 Kriterien, 100 Punkte

Jedes Kriterium liefert `punkte`, `max`, `status`
(`erfuellt` | `teilweise` | `offen` | `nicht_bewertbar`), die tragenden Zahlen, einen deutschen
Satz mit diesen Zahlen und eine Route in der App, wo man es behebt.

**`nicht_bewertbar` zählt nicht ins Maximum.** Angezeigt wird `{punkte} / {max_punkte}` —
nie „von 100", nie ein Prozentwert ohne die Basiszahlen daneben.

## 3.1 Gruppe A — Zahlen, die eine Marke zuerst prüft (35)

| ID | Max | Regel | Quelle |
|---|---|---|---|
| `engagement` | 12 | ER gegen Benchmark der Größenklasse. **<10k:** ≥4,0 voll · 2,5–4,0 halb · <2,5 null. **10k–100k:** ≥3,0 / 1,5–3,0 / <1,5. **>100k:** ≥2,0 / 1,0–2,0 / <1,0 | `engagement_rate`, `followers` |
| `kommentare` | 8 | `avg_comments / avg_likes` ≥0,05 voll · 0,02–0,05 halb · <0,02 null | `avg_comments`, `avg_likes` |
| `frequenz` | 8 | `posts_per_week` ≥2 voll · 1–2 halb · <1 null · `NULL` → n. b. | `posts_per_week` |
| `verlauf` | 7 | nur bei `followers_prev` vorhanden **und** `handle_changed = false`: Δ ≥ 0 voll · Δ < 0 halb. Sonst n. b. | `followers_prev` |

## 3.2 Gruppe B — Profil und Auffindbarkeit (13)

| ID | Max | Regel | Quelle |
|---|---|---|---|
| `account_typ` | 5 | `raw_profile.businessCategory` gesetzt → voll. Fehlt → **n. b.** | `raw_profile` |
| `bio` | 8 | Kanal-Bio ≥ 40 Zeichen **und** enthält ein Keyword aus `niche_mappings` (oder `niche_custom`) → voll; eine Bedingung → halb; keine → null | `analyse_stats.bio`, `niche_mappings` |

## 3.3 Gruppe C — Rechtssicher und erreichbar (27)

Diese Gruppe ist viunos eigentlicher Vorteil (`VIUNO-GROWTH` N.2: deutsch und rechtssicher),
und sie ist die **einzige Gruppe mit 100 % Datenverfügbarkeit**. Deshalb wiegt sie hier
schwerer als im Entwurf (27 statt 20).

| ID | Max | Regel | Satz bei Fehlen |
|---|---|---|---|
| `biolink` | 6 | `users.bio_active` oder `biolink_settings.is_active` | — |
| `impressum` | 8 | Impressumstext vorhanden **und plausibel** (≥ 50 Zeichen, enthält eine Ziffer) | „Ohne Impressum ist eine gewerbliche Seite in Deutschland abmahnbar (§ 5 DDG)." |
| `kontakt` | 7 | `users.contact_email` gesetzt | „Ohne Kontakt-E-Mail wird der Kontaktknopf auf deiner BioLink-Seite gar nicht erst gerendert." |
| `kennzeichnung` | 6 | Regex über alle Captions des Laufs. Treffer ≥ 1 → voll. Kein Treffer → **n. b.** | siehe 3.4 |

**Die Plausibilitätsprüfung beim Impressum ist neu und nötig.** Heute reicht „nicht leer" —
ein Konto im System hat **15 Zeichen** im Impressumsfeld und würde volle 8 Punkte bekommen.
Ein Impressum, das kein Impressum ist, schützt vor nichts; ein Check, der das durchwinkt,
ist schlimmer als keiner. Die Schwelle ist bewusst niedrig gewählt (Antoniettas echtes
Impressum hat 394 Zeichen) und prüft nur auf offensichtlichen Platzhalter.

## 3.4 Was `kennzeichnung` prüft — und warum es heute nichts sagt

Kennzeichnung heißt: **Werbung muss als Werbung erkennbar sein.** Wer ein Produkt gegen
Bezahlung oder gegen ein Geschenk zeigt, muss das im Beitrag sagen — `#Werbung`, `#Anzeige`,
„bezahlte Partnerschaft". Der Check sucht diese Wörter in den Captions des jüngsten Laufs.

**Befund über alle 108 gespeicherten Beiträge aller fünf Konten: null Treffer.**
Zusätzlich: `mentions` sind praktisch leer (4 von 108 Beiträgen).

Das heißt **nicht**, dass jemand falsch handelt — es heißt, dass bisher niemand im System eine
gekennzeichnete Kooperation gepostet hat. Weil es nichts zu messen gibt, gibt der Check hier
**weder Punkte noch Abzug**: Status `nicht_bewertbar`, die 6 Punkte fallen aus dem persönlichen
Maximum. Angezeigt wird ein Satz mit der Fallzahl —
*„In deinen letzten 36 Beiträgen ist keine gekennzeichnete Kooperation zu finden. Sobald du
eine postest, zählt das hier."* — plus der Rechtshinweis ohne Punktwirkung.

Sobald ein Creator eine gekennzeichnete Kooperation veröffentlicht, springt das Kriterium von
selbst an. Dafür ist nichts weiter zu bauen. Die Alternative — die Regel über Marken-Mentions
aus dem Entwurf — ist mit 4 Mentions in 108 Beiträgen nicht umsetzbar.

## 3.5 Gruppe D — Media Kit, das Dokument, das die Marke anfordert (25)

| ID | Max | Regel |
|---|---|---|
| `kit_aktiv` | 5 | `users.mediakit_active` |
| `kit_aktuell` | 6 | Follower im Kit weichen ≤ 20 % von `analyse_stats.followers` ab **und** Analyse ≤ 60 Tage alt → voll; eine Bedingung → halb; sonst null. Kein Kit → n. b. (Logik aus `getAnalysisDrift()`, [index.html:3557](public/app/index.html:3557)) |
| `preise` | 6 | ≥ 1 Angebot mit Preis → voll; Angebote ohne Preis → halb; keine Angebote → null |
| `referenzen` | 4 | `mediakit_brands` ≥ 2 voll · 1 halb · 0 null. **Oder** Eigenangabe `bezahlte_koops_bisher` ≥ 1 → mindestens halb |
| `demografie` | 2 | Geschlecht + Top-Land ausgefüllt. Immer mit Zusatz „Eigenangabe — Marken werden einen Screenshot aus den Insights verlangen." Kein Kit → n. b. |
| `rechnung` | 2 | Eigenangabe `kann_rechnung_stellen`: `true` voll · `false` null mit Hinweis Kleinunternehmerregelung · `NULL` n. b. mit Frage auf der Seite |

Die niedrigen Punkte bei `demografie` und `rechnung` sind Absicht: **Eigenangaben sind wenig
wert, weil sie unverifizierbar sind.** Das steht so auch auf der Seite.

**`kit_aktuell` und `demografie` werden `nicht_bewertbar`, wenn gar kein Media Kit existiert** —
sonst wird dieselbe Lücke dreifach bestraft. `preise` und `referenzen` bleiben bewertbar, weil
man Angebote und Referenzen auch ohne veröffentlichtes Kit pflegen kann.

---

# 4. Probelauf gegen die echten Daten

Ohne eine Zeile Code — dieselben Regeln in SQL über alle sieben `analyse_stats`-Zeilen.

## 4.1 Antonietta / Instagram `@antonietta_chiq` — 13.09.2026, 36 Beiträge

| Kriterium | Punkte | Warum |
|---|---|---|
| `engagement` | **12 / 12** | 23,91 % bei 12.928 Followern; Klasse 10k–100k erwartet 1,5–3,0 % |
| `kommentare` | **8 / 8** | 154,3 Kommentare auf 2.937,2 Likes = 5,25 % |
| `frequenz` | **8 / 8** | 6,4 Beiträge pro Woche |
| `verlauf` | n. b. | `followers_prev` ist `NULL` — es gibt keine zweite Messung |
| `account_typ` | n. b. | `businessCategory` ist `null` |
| `bio` | **4 / 8** | 73 Zeichen ≥ 40 ✓, aber kein Nischen-Keyword darin |
| `biolink` | **6 / 6** | `bio_active` = true |
| `impressum` | **8 / 8** | 394 Zeichen |
| `kontakt` | **7 / 7** | gesetzt |
| `kennzeichnung` | n. b. | 0 Treffer in 36 Captions |
| `kit_aktiv` | **5 / 5** | aktiv |
| `kit_aktuell` | **6 / 6** | Kit 12.150 vs. gemessen 12.928 = 6,4 % Abweichung; Analyse 1 Tag alt |
| `preise` | **3 / 6** | 4 Angebote, keines mit Preis |
| `referenzen` | **0 / 4** | keine Marke hinterlegt |
| `demografie` | **2 / 2** | Geschlecht + Top-Land ausgefüllt (Eigenangabe) |
| `rechnung` | n. b. | noch nicht beantwortet |

**69 von 80 bewertbaren Punkten.** Größter Verlust: `referenzen` (−4), `bio` (−4), `preise` (−3).

## 4.2 liaminini / TikTok `@easyglenn_` — 30.04.2026, 12 Beiträge

| Kriterium | Punkte | Warum |
|---|---|---|
| `engagement` | **0 / 12** | 0,24 % bei 21.300 Followern — deutlich unter 1,5 % |
| `kommentare` | **0 / 8** | 0,8 Kommentare auf 50,8 Likes = 1,57 % |
| `frequenz` | **4 / 8** | 1,6 Beiträge pro Woche |
| `verlauf` | n. b. | `followers_prev` ist `NULL` |
| `account_typ` | n. b. | TikTok liefert das Feld nie |
| `bio` | **8 / 8** | 54 Zeichen, enthält „Sport" |
| `biolink`, `impressum`, `kontakt` | **0 / 21** | nichts davon eingerichtet |
| `kennzeichnung` | n. b. | 0 Treffer in 12 Captions |
| `kit_aktiv`, `preise`, `referenzen` | **0 / 15** | kein Kit, keine Angebote, keine Marken |
| `kit_aktuell`, `demografie`, `rechnung` | n. b. | kein Kit, keine Eigenangabe |

**12 von 72 bewertbaren Punkten.**

Beide Erwartungen aus dem Entwurf sind bestätigt: `engagement` = 0 bei 0,24 %, `frequenz` halb
bei 1,6/Woche.

## 4.3 Alle sieben Zeilen im Überblick

| Konto | Punkte | Max | Auffälligstes |
|---|---|---|---|
| Antonietta / IG `@antonietta_chiq` | 69 | 80 | Referenzen und Preise fehlen |
| Heyno / IG `@antonietta_chiquita` | 51 | 76 | kein BioLink, kein Kit |
| Heyno / TikTok `@antonietta_chiquita` | 45 | 76 | dito, ER 1,91 % |
| Glenn / IG `@easyglenn` | 41 | 76 | Zahlen stark, Geschäftsseite leer |
| liaminini / IG `@easyglenn` | 41 | 76 | dito |
| Testi / IG `@easyglenn` | 41 | 71 | `posts_per_week` `NULL` → n. b. |
| liaminini / TikTok `@easyglenn_` | 12 | 72 | schwächstes Konto im System |

Kein Kriterium stürzt an fehlenden Daten ab; jede Lücke wird `nicht_bewertbar`.

---

# 5. Was gebaut wird — nach Eingriffstiefe sortiert

## 5.1 Keine Edge Function, keine Ergebnistabelle

Der Entwurf sieht `brand-ready` als Edge Function plus `brand_readiness`-Tabelle vor. **Beides
ist ohne den Modell-Lauf überflüssig.** Geprüft und belegt:

- Jede benötigte Tabelle ist vom eingeloggten Nutzer über RLS lesbar: `analyse_stats`,
  `apify_daten`, `analysis_runs`, `analyse_ki` (`auth.uid() = user_id`), `biolink_settings`,
  `mediakit_viuno`, `mediakit_brands`, `mediakit_content_offers` (jeweils `own`-Policy).
- Die Rechnung ist Arithmetik über diese Zeilen — kein Geheimnis, keine Service Role, kein
  externer Aufruf.
- Es gibt nichts mehr zu cachen, zu drosseln oder abzurechnen.

**Was damit entfällt:** ein Deploy-Schritt, die Dashboard-↔-Repo-Synchronisation (die laut
`CLAUDE.md` schon zweimal schiefging), eine RLS-Policy-Runde, ein `log_error`-Pfad, die
Stundendrossel und der ganze Neuberechnungs-Mechanismus. Die Seite rechnet bei jedem Aufruf neu
— das ist immer aktuell und kann nie veralten.

**Was verloren geht:** kein Verlauf des Scores, keine Verwendung im späteren Wochen-Check-in
oder in einer Mail. Beides ist heute gegenstandslos: es gibt pro Konto genau eine Analyse und
`followers_prev` ist überall `NULL` — es gäbe keinen Verlauf zu zeigen.

**Wie der Weg dahin offen bleibt:** die Rechnung liegt in **einer reinen Funktion**
`brBerechnen(daten) → kriterien[]` — ohne DOM, ohne Supabase, ohne `window`. Sie bekommt ein
einfaches Datenobjekt und gibt das Ergebnis zurück. Sobald es einen Verbraucher gibt
(Wochen-Check-in, Mail), wird sie **kopiert**, nicht neu geschrieben, und die Function
drumherum gebaut. Das ist derselbe Schnitt, den `befunde.ts` schon macht.

## 5.2 Eine Migration — rein additiv

```sql
-- Eigenangaben des Creators
alter table users
  add column kann_rechnung_stellen boolean,   -- NULL = nicht beantwortet
  add column bezahlte_koops_bisher smallint;

grant update (kann_rechnung_stellen, bezahlte_koops_bisher) on users to authenticated;

-- Preise in EIGENER Tabelle, nicht in mediakit_content_offers
create table mediakit_preise (
  user_id uuid not null references users(id) on delete cascade,
  offer_type ... not null,
  preis_von numeric, preis_bis numeric,
  updated_at timestamptz not null default now(),
  primary key (user_id, offer_type)
);
-- RLS: nur der eigene Account liest und schreibt. Kein anon-Zugriff.
```

Das `grant update` ist nicht optional: seit `users_spalten_grants_einschraenken` hat
`authenticated` nur auf 14 der 44 Spalten UPDATE-Recht. Ohne die Zeile schlägt die Eigenangabe
**still** fehl.

**Warum die Preise nicht in `mediakit_content_offers` gehören:** diese Tabelle hat eine
Lese-Policy für `anon` (`is_mediakit_active(user_id)`), und `public/kit/antonietta/index.html`
liest sie mit `select('*')`. Zwei Preisspalten dort wären **für jeden über den anon-Key
abrufbar**, sobald ein Media Kit aktiv ist — auch wenn die Seite sie nicht anzeigt. Preise sind
Verhandlungsposition. Eine eigene Tabelle kostet nichts und lässt die bestehende und die
öffentliche Seite völlig unberührt.

Geprüft: `mediakit_public` joint `mediakit_content_offers` **nicht** und benutzt kein `select *`
— die View ist von beidem nicht betroffen.

## 5.3 Eine neue View in der SPA

`public/app/index.html` ist die einzige Datei mit echtem Konfliktrisiko. Was hinzukommt:

- 1 Zeile in `ROUTES` → `brandready: { title: 'Brand Ready', render: renderBrandReady }`
- `renderBrandReady(area, ctx)` mit `brv` als Zustandsobjekt, `ctx.onCleanup` setzt es auf `null`
- die reine Funktion `brBerechnen()` plus die Satzvorlagen
- 2 Einstiegspunkte: die Einrichten-Liste im Dashboard ([index.html:2021](public/app/index.html:2021))
  und das Analyse-Ergebnis
- alle neuen globalen Funktionen mit Präfix **`br`**;
  `grep -o "^window\.[A-Za-z0-9_]*" public/app/index.html | sort | uniq -d` bleibt leer

**Kein Eintrag in der Sidebar.** Der würde `sidebar.js` und die Sidebar-Definition im HTML
berühren; zwei Einstiegspunkte reichen und halten eine Datei mehr aus dem Diff.

## 5.4 Aufbau der Seite

1. **Kopf** — „Brand Ready {punkte} / {max_punkte}", Balken, Stichtag der Analyse,
   Plattform-Umschalter bei zwei Kanälen
2. **„Was dich am meisten zurückhält"** — die drei Kriterien mit dem größten Verlust
   (`max − punkte`), je ein Satz mit Zahlen und ein Knopf zur Route. Offene Eigenangaben werden
   hier direkt gefragt: Schalter „Ich kann Rechnungen stellen", Zahlenfeld „Bezahlte
   Kooperationen bisher"
3. **Alle Kriterien** in vier Gruppen, je Zeile Name, Punkte/Max, Status-Symbol, Satz.
   Nichts aufklappbar — die Zahl ist der Mehrwert
4. **Fußnote** — „Punkte aus deinen Analyse-Daten vom {datum}. Eigenangaben sind gekennzeichnet.
   Benchmarks: HypeAuditor-Engagement-Daten nach Kanalgröße."

Ohne Analyse: Kriterien-Vorschau ohne Punkte plus „Der Brand-Ready-Check ist Teil deiner viuno
Analyse (9,99 € je Kanal)" mit Link zum Kauf.

**Sprachregeln:** kein „kostenlos". Kein „perfekt", „top", „stark". Kein Status „bereit".
Keine Prozentangabe ohne die Basiszahlen daneben. „je Kanal", nicht „je Plattform" — so steht es
schon an zwei Stellen in der App.

## 5.5 Was nicht angefasst wird

Analyse-Pipeline (`start-analysis`, `analysis-webhook`, `daten.ts`, `befunde.ts`,
`auswertung.ts`) · `generate-biolink` · `generate-mediakit` · alle öffentlichen Seiten unter
`public/` · `mediakit_public` und `biopage_v2` · `sidebar.js` · die Einzelseiten unter
`public/dashboard/`, `public/mediakit/` usw. · jede bestehende Spalte, Policy, View und Function.

---

# 6. Was der Check heute nicht kann

Vier Dinge, die beim Anschauen der ersten Ergebnisse auffallen werden.

**`verlauf` ist tot, bis jemand zweimal kauft.** 7 Punkte, die bei jedem Konto aus dem Maximum
fallen. Das ist die Messpuls-Lücke aus `VIUNO-GROWTH` C.1 und mit diesem Feature nicht lösbar.

**`kennzeichnung` ist tot, bis jemand eine Kooperation postet.** Siehe 3.4.

**`account_typ` ist auf TikTok immer tot** und auf Instagram abhängig davon, ob Apify die
Kategorie mitliefert. Bei 2 von 5 Instagram-Zeilen fehlt sie.

**Sehr hohe Engagement-Raten werden nicht hinterfragt.** Antonietta hat 23,91 % ER — nach der
Benchmark-Regel volle Punkte. Eine Marke, die 23 % sieht, prüft als Erstes auf gekauftes
Engagement. Der Check sagt dazu heute nichts. Eine obere Plausibilitätsgrenze wäre möglich,
gehört aber nicht in diesen Umfang — hier nur festgehalten.

**Ein Nebenbefund außerhalb des Auftrags:** Der Check kennzeichnet die Demografie als
Eigenangabe. Die **öffentliche Media-Kit-Seite zeigt dieselbe Zahl ohne diesen Zusatz**. Wenn
der Check sie als wenig wert markiert, widerspricht sich viuno an dieser Stelle. Ich fasse das
Kit nicht an; das ist eine eigene Entscheidung.

---

# 7. Bewertung: lohnt sich das

**Ja, mit einer Einschränkung.**

**Dafür:** Der Check misst nachweislich etwas — 69/80 gegen 12/72 über die vorhandenen Konten.
Er rechnet ausschließlich aus eigenen Daten, ohne neue Quelle, ohne laufende Kosten, ohne
Modell. Er wirkt auf genau die Dinge, die viuno ohnehin verkauft: BioLink, Impressum, Kontakt,
Media Kit. Und er ist vollständig nachrechenbar — das ist nach `VIUNO-GROWTH` N.2 das
Produktversprechen, nicht nur ein Implementierungsdetail. `VIUNO-GROWTH` N.1 nennt ihn „das
stärkste Stück im ganzen Entwurf".

**Dagegen, und das steht im eigenen Papier:** `VIUNO-GROWTH` N.4 rät ausdrücklich, den
Brand-Ready-Check **als erste Karte im Wochen-Check-in** zu bauen, nicht als eigene Seite —
„Der Brand-Ready-Check ist ein **Ereignis**. Man füllt ihn einmal auf 100 und ist fertig."
Als eigene Seite wird er ein- bis zweimal geöffnet und dann nicht mehr.

Deshalb ist er hier so geschnitten, dass er **beides sein kann**: `brBerechnen()` ist eine reine
Funktion ohne Oberfläche, und die Darstellung bekommt von Anfang an einen kompakten Modus. Das
Einhängen in ein späteres `#/heute` ist dann ein Aufruf, kein Umbau.

**Die zweite Einschränkung, unverändert aus `VIUNO-GROWTH` M.1:** das alles steht vor fünf
Konten und keinem zahlenden Kunden. Der Check kostet fast nichts — eine Migration und eine
View — und ist damit gut investiert. Alles Größere sollte davon abhängen, was `page_views`
danach zeigt.

---

# 8. Offene Punkte

1. **Impressum-Plausibilität (≥ 50 Zeichen + eine Ziffer)** — neu von mir, weil ein Konto mit
   15 Zeichen sonst volle Punkte bekäme. Einverstanden?
2. **Preise in eigener Tabelle `mediakit_preise`** statt in `mediakit_content_offers` — der
   öffentlichen Lesbarkeit wegen (5.2). Einverstanden?
3. **Gewichte** — Gruppe C von 20 auf 27 angehoben, `bio` von 5 auf 8, weil die 10 Punkte des
   gestrichenen `themen_fokus` dorthin gehen, wo die Daten vollständig sind. Alternativ bleiben
   die alten Gewichte und das Maximum liegt bei 90 statt 100.
4. **Kein Sidebar-Eintrag** — zwei Einstiegspunkte, oder doch in die Navigation?
