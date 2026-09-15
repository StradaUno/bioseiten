# CLEANUP-PLAN — Datenbereinigung vor dem Go-Live

Stand der Analyse: **15.09.2026**, Supabase-Projekt `bzejndghppuipnedasuv` (CreatorOS),
Repo-Stand `b18558b` (frisch gezogen, 4 Commits nachgeholt).

**Es wurde nichts geändert.** Keine Zeile gelöscht, kein Code angefasst, keine
Function deployt, kein Cron berührt. Dieses Dokument ist ausschließlich Befund
und Vorschlag. Schritt 2 startet erst auf „Go".

Die beiden unantastbaren Konten:

| Konto | UUID | Rolle |
|---|---|---|
| `antonietta@viuno.de` (Antonietta) | `5620b0b6-3050-46d2-8853-5ef0f9a123c2` | unantastbar |
| `mehmet-1994@outlook.de` (Heyno, Admin) | `d5dff681-2788-4f81-8388-6b4abf7cc5bf` | unantastbar |

---

## 0. Drei Entscheidungen, die ich vor dem Go brauche

Der Auftrag enthält drei Stellen, an denen „unantastbar" und „auf null" auf
dasselbe Datum zeigen. Ich löse sie nicht eigenmächtig.

### E1 — Die Käufe von Antonietta

„Umsatz auf null" heißt: `analysis_purchases` leeren. Von den 8 Zeilen gehören
**4 Antonietta**. Alle vier sind `cs_test_…`, also Stripe-Testmodus — es ist nie
Geld geflossen. Meine Empfehlung: **löschen**, weil eine Testbuchung kein Datum
ihres Kontos im Sinne von Profil/BioLink/Analyse ist, sondern eine Fälschung in
der Umsatzstatistik. Ihre *Analyse* (`analysis_runs` `6d8fc238…`) bleibt dabei
unberührt — der Fremdschlüssel steht auf `ON DELETE SET NULL`.

→ **Löschen (Empfehlung) / behalten?**

### E2 — BioLink-Aufrufe von Heyno

Punkt 5 sagt „alle löschen, außer die von Antonietta". Das trifft **56 Zeilen von
mehmet-1994@outlook.de**, das zweite unantastbare Konto. Empfehlung: **löschen**,
denn es sind ausschließlich eigene Test-Aufrufe der Seite `viuno.de/heyno`, und
sie stehen dem Ziel „ab Go-Live sauber zählen" direkt im Weg.

→ **Nur Antonietta behalten (Empfehlung) / Antonietta + Heyno behalten?**

### E3 — Media-Kit-Aufrufe

Punkt 6 nennt keine Ausnahme. Von den 54 Zeilen gehören **31 Antonietta**,
21 Heyno, 2 Bernidal. Empfehlung: **nur Antonietta behalten**, analog zu Punkt 5
— sonst stehen die Zahlen der beiden Seiten in unterschiedlichen Zeitrechnungen.

→ **Nur Antonietta behalten (Empfehlung) / alle 54 löschen / alle behalten?**

Dazu eine vierte, kleinere Frage:

### E4 — Bernidal (`bernd1988bernd@outlook.de`)

Heute 07:07 angelegt, Instagram `@Easyglenn`, echte Analysen gekauft (2× Test,
1× **live**, 9,99 € echtes Geld), Media Kit mit 12 Bildern, BioLink live unter
`viuno.de/bernidal`. Das ist kein Testkonto im Sinne von `launchcheck.test` —
das ist Glenn. Siehe Abschnitt B.

→ **Konto und Inhalte behalten, nur die Zähldaten/Käufe bereinigen (Empfehlung)?**

---

## A. Inventar der betroffenen Daten

Zeilenzahlen: Stand 15.09.2026, 14:00. „Sonstige" = Zeilen ohne `user_id` oder
mit einer UUID, die zu keinem der drei bestehenden Konten gehört (gelöschte
Konten).

### A.0 Gesamtübersicht

| Tabelle | Gesamt | Antonietta | Heyno | Bernidal | Sonstige |
|---|---:|---:|---:|---:|---:|
| `biolink_aufrufe` | 2.107 | 2.047 | 56 | 4 | 0 |
| `biolink_klicks` | 24 | 14 | 9 | 1 | 0 |
| `mediakit_aufrufe` | 54 | 31 | 21 | 2 | 0 |
| `page_views` | 169 | 35 | 1 | 18 | 115 |
| `ai_usage_log` | 51 | 12 | 2 | 2 | 35 |
| `analysis_purchases` | 8 | 4 | 0 | 3 | 1 |
| `analysis_runs` | 5 | 1 | 1 | 3 | 0 |
| `withdrawal_consents` | 11 | 6 | 1 | 3 | 1 |
| `stripe_webhook_events` | 9 | — (kein `user_id`) | | | |
| `subscriptions` | 4 | 1 | 1 | 1 | 1 (verwaist) |
| `newsletter_subscribers` | 4 | 1 | 0 | 1 | 2 |
| `admin_errors` | 37 | 0 | 0 | 0 | 37 (alle erledigt) |
| `apify_daten` | 132 | 36 | 24 | 72 | 0 |
| `analyse_ki` / `analyse_stats` | je 5 | 1 | 2 | 2 | 0 |
| `creator_analytics` | 6 | 2 | 2 | 2 | 0 |

### A.1 Kategorie 1 — KI-Kosten

**Beteiligt:**

| Ort | Art | Zeilen | Bemerkung |
|---|---|---:|---|
| `ai_usage_log` | Tabelle | 51 | die einzige Quelle für jede KI-Kostenzahl |
| `analysis_runs.apify_kosten_usd` | Spalte | 4 von 5 gefüllt | Apify, nicht KI, aber dieselbe Kachel |
| `kosten_guthaben` | Tabelle | 2 | Anthropic 18,92 $ / Apify 3,82 $, beide vom 15.09. 11:38 |
| `daily_digest.tokens_used / tokens_input / tokens_output / model_used` | Spalten | 45 Zeilen | **zweite Haltung derselben Zahl** |
| `ai_pricing` | Tabelle | 9 | wird von **keiner** Function gelesen (Abschnitt E) |
| `admin_uebersicht()` → `kosten.*` | RPC | — | rechnet live aus `ai_usage_log` |

Verteilung der 51 Zeilen:

| Feature | Modell | Aufrufe | davon ohne `user_id` | Summe $ | Schnitt $ |
|---|---|---:|---:|---:|---:|
| `daily_digest` | `claude-opus-4-5` | 26 | 26 (so gewollt) | 11,0300 | 0,4242 |
| `daily_digest` | `claude-sonnet-5` | 2 | 2 (so gewollt) | 1,9029 | 0,9515 |
| `analyse_v2_instagram` | `claude-haiku-4-5-20251001` | 11 | **4** | 0,1120 | 0,0102 |
| `analyse_v2_instagram` | `claude-opus-5` | 3 | **1** | 0,4247 | 0,1416 |
| `analyse_v2_tiktok` | `claude-haiku-4-5-20251001` | 8 | **2** | 0,0799 | 0,0100 |
| `analyse_v2_tiktok` | `claude-opus-5` | 1 | 0 | 0,1438 | 0,1438 |
| **Summe** | | **51** | | **13,6933 $** ≈ **12,60 €** | |

**Abgeleitete Daten, die mitlaufen müssen:**
`daily_digest` hält Tokenzahlen pro Ausgabe ein zweites Mal. Wird `ai_usage_log`
geleert, stehen dort weiter Tokenwerte — heute liest sie niemand, aber sie sind
die zweite Wahrheit und gehören mit auf null oder ausdrücklich behalten.

**`kosten_guthaben` nicht auf null setzen.** Die 18,92 $ sind der *tatsächliche
Restbetrag bei Anthropic*, keine Statistik. Wird er genullt, rechnet das Admin
„Guthaben reicht 0 Tage" und die Reichweitenwarnung feuert dauerhaft. Richtig
ist: Betrag stehen lassen, `stand_am` auf den Go-Live-Zeitpunkt setzen (neue
Zeile, nicht überschreiben — die Tabelle ist bewusst append-only).

### A.2 Kategorie 2 — Umsatz

**Beteiligt:** `analysis_purchases` (8), `stripe_webhook_events` (9),
`withdrawal_consents` (11), `subscriptions` (4).
**Gelesen von:** `admin_uebersicht()` → `geld.umsatz_gesamt`, `geld.umsatz_monat`,
`geld.je_monat`, `geld.kaeufe`, `menschen.users[].umsatz`, `traffic.funnel.gekauft`,
`schnellblick.{heute,woche}.umsatz`; `admin-tagesmail`.

Alle acht Käufe:

| # | Wann | Konto | Session | Betrag | eingelöst | Bewertung |
|---|---|---|---|---:|---|---|
| 1 | 13.09. 20:58 | Antonietta | `cs_test_…GDej3Jb` | 9,99 € | ja | Testmodus |
| 2 | 13.09. 21:01 | Antonietta | `cs_test_…eYbJhc` | 9,99 € | ja | Testmodus |
| 3 | 13.09. 21:30 | Antonietta | `cs_test_…ERqrEL` | 9,99 € | ja | Testmodus |
| 4 | 13.09. 22:32 | **gelöschtes Konto** | `cs_test_…HUsor` | 9,99 € | ja | Testmodus, verwaist |
| 5 | 13.09. 23:15 | Antonietta | `cs_test_…SHfGl` | 9,99 € | ja | Testmodus |
| 6 | 15.09. 07:26 | Bernidal | `cs_test_…6TV5Qo` | 9,99 € | ja | Testmodus |
| 7 | 15.09. 07:30 | Bernidal | `cs_test_…5mBD3C` | 9,99 € | ja | Testmodus |
| 8 | 15.09. 08:49 | Bernidal | **`cs_live_…yO2Cuh`** | 9,99 € | **nein** | **echtes Geld, nicht eingelöst** |

Summe heute im Admin: **79,92 €**, davon **69,93 € Testgeld** und **9,99 € echt**.

**Kauf 8 ist der eigene Live-Testkauf.** Er steht als „offen" in der Kachel
„Nicht eingelöst" (rot) und in der Meldung „1 bezahlte Analyse noch nicht
eingelöst". Wird er erstattet, **merkt die Datenbank davon nichts**:
`analysis_purchases` hat keine Spalte für Status oder Erstattung, und
`stripe-webhook` verarbeitet ausschließlich `checkout.session.completed`
(alle 9 Ereignisse sind von diesem Typ). Eine Erstattung bleibt bis heute
unsichtbar und der Umsatz zählt sie weiter mit. Siehe F5.

`stripe_webhook_events`: 9 Zeilen, 8 passen zu einem Kauf. Die neunte
(`evt_1UE3KQ…`, 10.09. 08:27) hat **keinen Kauf** — ein Ereignis, dessen
Verarbeitung damals abgebrochen ist.

`withdrawal_consents`: 11 Zeilen für 8 Käufe. Die Zustimmung wird beim Start des
Checkouts geschrieben, auch wenn danach nicht bezahlt wird — 3 Zeilen ohne
Kauf, 1 davon ohne `user_id`.

`subscriptions`: 4 Zeilen, alle `plan = 'free'`. Eine ist verwaist
(`user_id = null`, 15.09. 00:20) — Rest des gelöschten Launch-Check-Kontos.
Kein Umsatz, aber eine Geisterzeile.

### A.3 Kategorie 3 — Deckungsbeitrag

**Keine eigene Tabelle.** Der Wert entsteht ausschließlich in
`public/admin/index.html`, an zwei Stellen, beide mit hartcodiertem `9.99`:

- `index.html:585` — Startseiten-Kachel: `9.99 - marge.apify_eur`
- `index.html:726` — Karte „Marge je Analyse": dasselbe je Plattform

Datenquelle ist `admin_uebersicht()` → `kosten.marge`, das ist
`avg(apify_kosten_usd) * 0,92` je `platform` aus `analysis_runs`.

**Was fehlt:** die KI-Kosten, die Stripe-Gebühr, die Fixkosten. Details und die
richtige Rechnung in Abschnitt E4.

Zusätzlich: `marge.find(x => x.erfasst > 0)` nimmt die **erste** Plattform mit
Zahlen — welche das ist, entscheidet die Reihenfolge des `group by`. Die Kachel
zeigt also mal Instagram, mal TikTok, ohne das zu sagen.

### A.4 Kategorie 4 — Kosten pro Monat

Kachel „Kosten Monat" auf der Startseite (`index.html:584`) zeigt
`d.kosten.ai_monat` — das ist `sum(cost_usd) * 0,92` aus `ai_usage_log` seit
Monatsanfang. Also:

- **enthält** Anthropic-Token- und Suchkosten
- **enthält nicht**: Apify (`analysis_runs.apify_kosten_usd`), Stripe-Gebühren,
  Supabase, Cloudflare, Domain, Resend
- **Unterzeile stimmt nicht zum Wert**: „X AI-Aufrufe im Zeitraum" zählt über
  `p_tage` (30), der Wert daneben über den Kalendermonat.

**Fixkosten sind nirgends hinterlegt** — weder Tabelle noch Spalte noch Konstante.
Die einzige Aufstellung steht in `LAUNCH-CHECK.md` als Schätzung. Siehe E5.

### A.5 Kategorie 5 — BioLink-Aufrufe

| Ort | Art | Inhalt |
|---|---|---|
| `biolink_aufrufe` | Tabelle | 2.107 Zeilen, seit 21.04.2026 |
| `biolink_klicks` | Tabelle | 24 Zeilen |
| **`users.bio_views_total`** | **Zählerspalte** | **zweite Haltung** |
| **`users.bio_views_today`** | **Zählerspalte** | **zweite Haltung** |
| **`users.bio_views_last_7_days`** | **Zählerspalte** | **zweite Haltung** |

**Das ist die wichtigste doppelt gehaltene Zahl im ganzen Projekt.**

Der Trigger `biolink_aufrufe_aggregate_trigger` läuft **nur bei INSERT**:

```
biolink_aufrufe_aggregate_trigger  →  INSERT  →  trigger_update_biolink_aggregates()
```

Bei `DELETE` passiert **nichts**. Werden Zeilen gelöscht, bleiben die drei
Spalten auf dem alten Wert stehen — dauerhaft, bis der nächste echte Aufruf
kommt, denn `update_biolink_view_aggregates()` zählt immer neu. Für ein Konto,
dessen Seite nach dem Go-Live nie aufgerufen wird, bliebe der Testwert für
immer sichtbar.

Heute sind die Zähler korrekt (2.047 / 56 / 4 = exakt die Zeilenzahlen). Nach
der Löschung wären sie es nicht mehr.

**Wer die Zählerspalten liest** (nicht die Tabelle!):

| Ort | Zeile | Anzeige |
|---|---|---|
| `admin_uebersicht()` | `menschen.users[].aufrufe` | Admin → Menschen, Zahl rechts in jeder Zeile |
| `admin_uebersicht()` | `menschen.users[].mk_aufrufe` | Admin → Akte, „Media Kit" |
| `public/admin/index.html:793,822,849` | | Userliste + Akte (2×) |
| `public/app/index.html:2557` | Dashboard-Kachel „BioLink" | `bio_views_last_7_days` |
| `public/app/index.html:3160-3162` | BioLink-Ansicht | alle drei Werte |
| `public/app/index.html:4251-4253` | Media-Kit-Ansicht | alle drei Werte |

Das heißt: **Antonietta sieht in ihrer eigenen App die Zählerspalte**, nicht die
Tabelle. Selbst wenn ihre Zeilen vollständig erhalten bleiben, muss der Zähler
nach jeder Löschung in der Tabelle neu gerechnet werden, sonst weicht ihre
Anzeige ab.

Weitere Leser (rechnen live aus der Tabelle, laufen also automatisch mit):
`biolink_herkunft()`, `biolink_stunden()`, `biolink_klick_zahlen()`,
`biolink_klickrate()`, `get_biolink_views()`, `get_bio_*`,
`get_biolink_views_last_7_days_daily()`, `traffic.*` in `admin_uebersicht()`.

**Achtung `biolink_klickrate()`:** sie zählt ab dem ersten erfassten Klick. Wenn
`biolink_klicks` geleert wird, aber `biolink_aufrufe` nicht (oder umgekehrt),
steht dort wieder der falsche Wert, vor dem CLAUDE.md warnt. Beide Tabellen
müssen für dasselbe Konto denselben Stichtag haben.

**Schreiber:** Edge Function `track-biolink-view` (`verify_jwt: false`), aufgerufen
von `public/antonietta/`, `public/heyno/`, `public/bernidal/`, `public/stradauno/`
und jeder künftig erzeugten Seite (`generate-biolink/template.ts`).

### A.6 Kategorie 6 — Media-Kit-Aufrufe

| Ort | Art | Inhalt |
|---|---|---|
| `mediakit_aufrufe` | Tabelle | 54 Zeilen |
| **`users.mediakit_views_total / _today / _last_7_days`** | **Zählerspalten** | **zweite Haltung** |

Identische Mechanik: `mediakit_aufrufe_aggregate_trigger` **nur bei INSERT**,
`update_mediakit_view_aggregates()` zählt neu.

Geschrieben wird **nicht** über eine Edge Function, sondern direkt per REST aus
`public/kit/kit-renderer.js:499` mit dem Publishable Key (Insert-Policy erlaubt
das). Eine Function `track-mediakit-view` gibt es trotz der Erwähnung in
CLAUDE.md nicht mehr.

### A.7 Kategorie 7 — Kauf-Tabellen

Siehe A.2. Die vollständige Liste der beteiligten Tabellen:
`analysis_purchases`, `stripe_webhook_events`, `withdrawal_consents`,
`subscriptions`, und indirekt `analysis_runs` (über `analysis_purchases.analysis_run_id`,
`ON DELETE SET NULL` — eine Analyse überlebt das Löschen ihres Kaufs).

`stripe_prices` enthält **4 Zeilen: 2 live, 2 test**. Die Testzeilen zeigen auf
`prod_VFpX1zJafGm21C`. Siehe D5.

---

## B. Alle anderen Accounts

Es gibt **exakt drei** Konten in `auth.users` / `public.users`. Kein
`launchcheck.test@example.com` mehr — das Konto wurde bereits gelöscht
(Spuren: verwaiste `subscriptions`-Zeile, verwaister Kauf Nr. 4, drei
verwaiste Storage-Ordner).

| Konto | Angelegt | Letzter Login | Echte Aktivität | Empfehlung |
|---|---|---|---|---|
| `antonietta@viuno.de` | 21.04.2026 22:23 | 15.09. 04:15 | ja: 2.047 BioLink-Aufrufe, echte IG-Analyse, Media Kit, Brand Ready | **behalten** (unantastbar) |
| `mehmet-1994@outlook.de` | 28.04.2026 20:31 | 15.09. 13:40 | ja: Betreiberkonto, Admin | **behalten** (unantastbar) |
| `bernd1988bernd@outlook.de` | **15.09.2026 07:07** | 15.09. 13:40 | ja: 3 Käufe (1 live), 3 Analysen, 12 Media-Kit-Bilder, BioLink live | **behalten — siehe E4** |

### Bernidal im Detail

Display-Name „Bernidal", Instagram `@Easyglenn`, TikTok `@Easyglenn_`, Newsletter
bestätigt, BioLink live unter `viuno.de/bernidal`, Media Kit angelegt aber
`mediakit_active = false`.

Die Git-History zeigt die Umbenennung heute:
`413fb27 Create biolink: glenn` → `5ede64b Delete bio page: glenn` →
und parallel `public/bernidal/`. Das ist **Glenn**, unter neuem Anzeigenamen.

Das ist kein Testkonto. Es hat einen **echten Live-Kauf über 9,99 €** getätigt
(Kauf Nr. 8) und eine fehlgeschlagene TikTok-Analyse (Handle-Problem), für die
nach heutigem Stand die Freischaltung nicht zurückgegeben wurde.

**Empfehlung: Konto und alle Inhalte behalten.** Nur die Zähldaten
(4 BioLink-Aufrufe, 2 Media-Kit-Aufrufe, 18 `page_views`) und die drei Käufe
bereinigen, damit die Statistik bei null startet. Vorher mit ihm klären, ob der
Live-Kauf erstattet wird — dann muss er auch aus `analysis_purchases` raus.

### Gelöschte Konten mit Rückständen

| UUID | Spur | Was übrig ist |
|---|---|---|
| `28d64f8c-0447-426b-8b87-f21e9a7091a1` | `profile-images/` | 2 Dateien, 72 kB |
| `9e0eb2eb-884a-4d68-acff-e74a5511b9a7` | `profile-images/` | 1 Datei, 50 kB |
| `f35003c1-fdcf-40fc-8708-1d6c8017f275` | `profile-images/` | 1 Datei, 46 kB |
| unbekannt (Launch-Check) | `subscriptions`, `analysis_purchases` #4, `withdrawal_consents` | 3 Zeilen |

**Echte fremde Nutzer, die nicht gelöscht werden dürfen: keine.** Es gibt
außer den dreien niemanden.

---

## C. Der Admin-Bereich, Kachel für Kachel

Alles kommt aus **einer** RPC: `admin_uebersicht(p_tage)`, SECURITY DEFINER,
`is_admin()` als erste Zeile. Umrechnungskurs `kurs := 0.92` steht dort fest
verdrahtet, ein zweites Mal als `KURS = 0.92` in `admin-tagesmail/index.ts:18`.

Legende: **A** = nach der Bereinigung verfälscht · **L** = Altlast · ✓ = folgt der Bereinigung sauber

### Start

| Kachel | Rechnet aus | Status |
|---|---|---|
| Meldung „Stripe läuft im Testmodus" | `count(*) filter (mode='live') from stripe_prices` | **L** — seit 15.09. 00:26 gibt es Live-Zeilen, die Meldung **feuert nicht mehr**. Gleichzeitig sind 7 von 8 Käufen Testgeld. Die eine Warnung, die vor genau diesem Missverständnis schützt, ist aus. Schlimmer: die Entscheidung Test/Live trifft gar nicht `stripe_prices`, sondern die **Env-Variable `VIUNO_STRIPE_MODE`** in `create-checkout-session`. Das Admin liest die falsche Quelle. |
| Meldung „Apify-Kosten werden noch nicht erfasst" | `kosten.apify_erfasst` | ✓ |
| Meldung „N bezahlte Analysen nicht eingelöst" | `consumed_at is null` | ✓ (steht heute auf 1 = der Live-Testkauf) |
| Meldung „Die Startseite zählt noch nicht" | `funnel.landing == 0` | **A** — wird nach dem Leeren von `page_views` **wieder erscheinen**, obwohl der Zähler funktioniert. Erst der erste echte Besuch räumt sie ab. |
| Meldung „N Cron-Jobs fehlgeschlagen" | `cron.job_run_details` | ✓ (9 Jobs, alle aktiv) |
| Meldung „N offene Fehler" | `admin_errors where not resolved` | ✓ (heute 0 von 37) |
| **Umsatz Monat** | `sum(amount_paid)` seit Monatsanfang | **A/L** — 79,92 €, davon 69,93 € Testgeld, und der Zusatz „· Testmodus" erscheint nicht mehr (siehe oben). |
| **Kosten Monat** | `sum(cost_usd)*0,92` aus `ai_usage_log` seit Monatsanfang | **L** — heißt „Kosten", enthält aber **nur Anthropic**. Kein Apify, keine Stripe-Gebühr, keine Fixkosten. Unterzeile zählt über 30 Tage, der Wert über den Kalendermonat. |
| **Deckungsbeitrag** | `9.99 − avg(apify_kosten_usd)*0,92` | **L** — 9,90 € statt real **≈ 9,29 €**. Es fehlen KI (0,13 €) und Stripe (0,48 €). Siehe E4. |
| **User** | `count(*) from users where deleted_at is null` | ✓ |
| Heute / Diese Woche | je Tabelle live | ✓ — Umsatz steht bewusst immer da, auch bei 0 |
| „Wo die Leute herkommen" | `biolink_quelle(referrer_source)` über `biolink_aufrufe` | ✓ |

### Geld → Umsatz

| Kachel | Status |
|---|---|
| Untertitel „Stripe steht auf Live." | **L** — falsche Quelle (s.o.), und sachlich irreführend, solange 7 von 8 Käufen Testgeld sind |
| Gesamt / Diesen Monat / Zahlende / Nicht eingelöst | ✓ |
| Umsatz je Monat | ✓ |
| Jeder Kauf (Liste) | ✓ — zeigt die Session-ID nicht an, also sieht man `cs_test_` vs. `cs_live_` **nicht**. Tag „Freischaltung" prüft `session.startsWith('admin_')`; solche Zeilen gibt es noch keine. |
| Stripe-Ereignisse | ✓ — 9 Ereignisse, eines ohne zugehörigen Kauf |

### Geld → Kosten

| Kachel | Status |
|---|---|
| Zeitraum / Heute / Seit Anfang | ✓ (rein `ai_usage_log`) |
| **Apify erfasst „4 / 5"** | **L** — der Lauf vom 29.04. (`23047f7e…`) hat Apify-Run-IDs, aber Apify kennt die Läufe nicht mehr. `apify-kosten-nachtragen` fragt sie **stündlich weiter ab**, für immer. Der Zähler kommt nie auf 5/5. |
| **Guthaben Anthropic** | **A** — „verbraucht seit Stichtag" rechnet gegen `ai_usage_log`. Wird die Tabelle geleert, steht dort 0,00 € verbraucht, „reicht – Tage", und die Warnkette ist tot, bis wieder etwas anfällt. Deshalb muss `stand_am` auf den Go-Live gesetzt werden. |
| **Guthaben Apify** | **A** — dito gegen `analysis_runs.apify_kosten_stand` |
| **Marge je Analyse** | **L** — siehe Deckungsbeitrag |
| AI-Kosten nach Feature / nach Modell / Letzte Aufrufe | ✓ |
| `apify_zeitraum` (in die Kachel „je Tag" eingerechnet) | **L** — filtert auf `apify_kosten_stand >= seit`, also auf den **Nachtrags**zeitpunkt, nicht auf den Zeitpunkt des Laufs. Ein Lauf vom 13.09., dessen Kosten am 14.09. nachgetragen wurden, zählt in den 14.09. |

### Menschen → User

| Kachel | Status |
|---|---|
| **Zahl rechts in jeder Zeile („aufrufe")** | **A** — `users.bio_views_total`, Zählerspalte. Ohne Neuberechnung steht dort nach der Löschung der alte Wert. |
| **Akte → BioLink-Aufrufe / Media Kit** | **A** — dieselben Spalten |
| Akte → Klicks / Käufe / Umsatz / Analysen / Fehler | ✓ (live gezählt) |
| Akte → Seiten-Links `viuno.de/<slug>` | ✓ — Slug wird im Frontend aus `display_name` gebildet, gleiche Regel wie `slugify()` |
| Filter „Zahlend / Seite live / Nichts aktiv" | ✓ |

### Menschen → Newsletter

| Kachel | Status |
|---|---|
| Aktiv / Unbestätigt / Ohne Konto / Abgemeldet | ✓ — heute 2 aktiv, 2 unbestätigt, 0 ohne Konto (aktiv), 0 abgemeldet |
| Letzte Anmeldungen | ✓ |

Die zwei unbestätigten (`meinhoti@outlook.de` 29.04., `mehmet94e@icloud.com`
10.09.) sind eigene Adressen. Sie stehen dauerhaft rot in der Kachel
„Unbestätigt". Siehe D4.

### Traffic

| Kachel | Status |
|---|---|
| BioLink-Aufrufe / Klicks / Media Kit / Startseite | ✓ (live aus den Tabellen) |
| „Wie die Leute auf viuno.de kommen" (`viuno_herkunft`) | ✓ |
| „Herkunft der BioLink-Besucher" (`biolink_quelle`) | ✓ |
| **Trichter „Vom Besuch zum Kauf"** | **L** — `registriert = count(*) from users` zählt das Admin-Konto und Antonietta mit. Bei 3 Konten ist der Trichter aussagelos; nach der Bereinigung zeigt er `0 → 3 → 3 → 3 → 0`. |
| Aufrufe je Monat | ✓ — zeigt nach der Bereinigung nur noch Antoniettas Monate |
| Wann gelesen wird / Sprache / Gezählte Seiten | ✓ |

### System

| Kachel | Status |
|---|---|
| Offene Fehler | ✓ — 0 von 37 |
| Analysen gesamt / fertig / fehlgeschlagen | ✓ |
| Seiten live / Freigaben | ✓ |
| Zeitpläne (9 Cron-Jobs) | ✓ |
| Analyse-Läufe (letzte 20) | ✓ |
| Redaktion → Karussell-Ideen | **L** (klein) — zeigt auf `/karussell/`, das ein **anderes Supabase-Projekt** (`dodglijurmtrbwnjivlg`) mit Admin-Token im localStorage anspricht. Kein Bereinigungsfall, aber erwähnenswert. |
| Tagesmail „Jetzt einmal schicken" | ✓ |

---

## D. Supabase-Altlasten

### D1 — Backup-Tabelle aus dem Launch-Check

| Tabelle | Zeilen | Empfehlung |
|---|---:|---|
| `public.legal_texts_backup_20260915` | 1 | **behalten bis zur Freigabe.** Sie ist die einzige Kopie der Rechtstexte vor der Launch-Check-Änderung; `LEGAL-CHANGES.md` beschreibt die Änderungen, aber der alte Volltext steht nur hier. Nach Freigabe löschen. |

Keine weiteren `_old` / `_bak` / `_tmp`-Tabellen. Keine Materialized Views.
Sechs normale Views (`biolink_links_public`, `biopage_public`, `biopage_v2`,
`digest_cards_past`, `digest_cards_today`, `mediakit_public`) — alle live
benutzt, keine Caches.

### D2 — Verwaiste Storage-Objekte

`profile-images` (öffentlich): **18 Objekte, 11 MB, davon nur 3 verlinkt.**

| Datei | Größe | Besitzer | Empfehlung |
|---|---:|---|---|
| `28d64f8c…/1774046334163000.jpeg` | 36 kB | gelöschtes Konto | **löschen** |
| `28d64f8c…/1775902881939000.jpeg` | 38 kB | gelöschtes Konto | **löschen** |
| `9e0eb2eb…/1777410314537.jpeg` | 52 kB | gelöschtes Konto | **löschen** |
| `f35003c1…/1775603868359000.jpeg` | 47 kB | gelöschtes Konto | **löschen** |
| `Profilbild_BioUno.png` | 17 kB | kein Ordner, keine Referenz | **löschen** |
| `d5dff681…/1788969837894.jpeg` | 1,3 MB | Heyno, alt | **löschen** (nicht verlinkt) |
| `5620b0b6…/` 9 alte Dateien | **8,0 MB** | **Antonietta**, alt, nicht verlinkt | **fragen** — technisch verwaist, aber ihr Konto ist unantastbar |
| `5620b0b6…/1789423724881.jpg` | 128 kB | Antonietta | **verlinkt, behalten** |
| `581d459b…/1789456103390.jpg` | 232 kB | Bernidal | **verlinkt, behalten** |
| `d5dff681…/1789319578259.png` | 1,6 MB | Heyno | **verlinkt, behalten** |

Sechs der neun verwaisten Antonietta-Dateien sind 1,2–1,5 MB groß und vom
09./13.09., also **vor** dem Profil-Umbau vom 14.09., der auf 800 px verkleinert
und die Vorgängerdatei löscht. Die Datei vom 14.09. ist 128 kB — der Umbau
wirkt. Die alten großen Dateien sind Rückstand, keine laufende Fehlfunktion.

Es gibt eine Edge Function `storage-aufraeumen` (angelegt 15.09., v2,
`verify_jwt: true`) — **ohne Repo-Kopie** unter `supabase/functions/`.
Vor dem Einsatz Quelltext aus dem Dashboard prüfen und ins Repo legen.

Andere Buckets: `news` (61, alle in `news_images` referenziert, 5,2 MB),
`mediakit-beitraege` (18, 6,2 MB, alle zu bestehenden Konten),
`platform-icons` (5), `Website/biolink/` (3 Theme-Vorschaubilder) — alles sauber.

### D3 — Test-Einträge in `stripe_prices`

| mode | platform | product_id | price_id | Empfehlung |
|---|---|---|---|---|
| live | instagram | `prod_VEUNSFSahcHv1b` | `price_1UFkAq…` | **behalten** |
| live | tiktok | `prod_VEUNSFSahcHv1b` | `price_1UFkAt…` | **behalten** |
| test | instagram | `prod_VFpX1zJafGm21C` | `price_1UFJsM…` | **behalten, aber siehe unten** |
| test | tiktok | `prod_VFpX1zJafGm21C` | `price_1UFJsM…` | **behalten, aber siehe unten** |

Die Testzeilen **nicht** löschen: `create-checkout-session` wählt über
`VIUNO_STRIPE_MODE`; ohne Testzeile gibt es keinen Weg mehr zurück in den
Testmodus. Stattdessen: `admin_uebersicht()` soll `VIUNO_STRIPE_MODE` anzeigen
statt aus `stripe_prices` zu raten (siehe G6).

**Vor dem Go-Live prüfen: steht `VIUNO_STRIPE_MODE` wirklich auf `live`?**
Der Live-Kauf vom 15.09. 08:49 belegt es, aber die Variable steht nicht im Repo.

### D4 — Log- und Ereignis-Tabellen

| Tabelle | Zeilen | Empfehlung |
|---|---:|---|
| `admin_errors` | 37, davon **0 offen** | **archivieren und leeren.** Enthält u. a. eine `generate-daily-digest`-Meldung mit 300 Zeichen Modellantwort — keine personenbezogenen Daten, aber Rauschen. Nach dem Go-Live sollen die ersten echten Fehler allein dastehen. |
| `stripe_webhook_events` | 9 | **archivieren und leeren.** Reine Idempotenz-Sperre; leeren bedeutet nur, dass ein alter Stripe-Event theoretisch erneut verarbeitet würde — bei Testevents belanglos. |
| `digest_email_log` | 0 | nichts zu tun |
| `contact_submissions` | 0 | nichts zu tun |
| `user_consents` | 0 | nichts zu tun |
| `apify_raw_runs` | 2 (21.04.) | **löschen** — Rohantworten eines Trend-Scrapes, den es nicht mehr gibt |
| `competitor_accounts` | 8 (01.05.) | **fragen** — gehören per `owner_user_id`; Feature ist im UI nicht erreichbar |
| `karussell_log` / `ig_carousels` | je 6 (10.09.) | **behalten** — aktives Swipe-File, kein Statistik-Datum |
| `setup_tokens` | 1 | **prüfen** — ein Einmal-Token aus dem Setup; wenn er noch gültig ist, ist er ein offener Schlüssel |
| `niche_mappings` | 199 | **behalten** — Vokabular |
| `news_images` | 61 | **behalten** |
| `daily_digest` | 45 Ausgaben (04.04.–14.09.) | **behalten** — das ist Inhalt, keine Statistik. Nur die `tokens_*`-Spalten gehören zu Kategorie 1. |
| `managed_creators` | 1 | **behalten** |
| `mediakit_brands` | 1 | **fragen** |
| `analyse_freigaben` | 3 (1 Antonietta, 2 Bernidal) | **behalten** — Cron `purge-abgelaufene-freigaben` räumt monatlich selbst |
| `brand_ready_freigaben` | 1 (Antonietta) | **behalten** |

Newsletter: 4 Zeilen. **Löschen empfohlen: die zwei unbestätigten eigenen
Adressen** (`meinhoti@outlook.de` seit 29.04. pending, `mehmet94e@icloud.com`
seit 10.09. pending). Sie stehen dauerhaft in der roten Kachel „Unbestätigt"
und sind kein echtes Abo. Die zwei aktiven (Antonietta, Bernidal) bleiben.

### D5 — Verwaiste Zeilen

| Tabelle | Zeile | Empfehlung |
|---|---|---|
| `subscriptions` | 1× `user_id = null`, 15.09. 00:20 | **löschen** (Launch-Check-Rest, `plan='free'`, kein Zahlungsbezug) |
| `analysis_purchases` | Kauf #4, `user_id = null` | **löschen** (Testmodus) |
| `withdrawal_consents` | 1× `user_id = null` + 3 ohne Kauf | **löschen** zusammen mit den Käufen |

### D6 — Rückstände im Repo (nicht Supabase, aber dieselbe Baustelle)

| Pfad | Befund | Empfehlung |
|---|---|---|
| `public/test/` | 19 kB, kein Konto-Bezug, kein Zähler, `noindex` gesetzt | **löschen** — erreichbar unter `viuno.de/test` |
| `public/admina/` | 23 kB, enthält **Antoniettas UUID**, kein Zähler, `noindex` | **löschen** — alte Admin-Kopie, doppelte Wahrheit |
| `public/pitch/` | Designentwürfe, `noindex` | **fragen** |
| `robots.txt` / `_headers` | sperren `/testi/` — **das Verzeichnis gibt es nicht mehr** | Zeilen entfernen |
| `CLAUDE.md` | nennt `public/easyglenn/`, `public/kit/easyg/`, `public/kit/kross/` als bestehend | **stimmen nicht mehr**, nachziehen |

---

## E. KI-Preise und Kosten-Erfassung

### E1 — Jede Stelle, an der ein bezahlter Fremdaufruf passiert

| Function | Anbieter | Modell / Actor | Preis hinterlegt wo | Kosten erfasst? |
|---|---|---|---|---|
| `generate-daily-digest` | Anthropic | `claude-sonnet-5` + Web-Suche (max. 12) | **hartcodiert** `index.ts:11-12`, Suche `:20` | **ja**, `ai_usage_log`, `user_id = null` |
| `analysis-webhook` (`auswertung.ts` über `basis.ts`) | Anthropic | `claude-opus-5` | **hartcodiert** `basis.ts:13-14` | **ja**, `ai_usage_log`, mit `user_id` |
| `start-analysis` | Apify | `apify~instagram-profile-scraper`, `apify~instagram-post-scraper`, `clockworks~tiktok-scraper` | — | **nein** — bewusst; nachträglich |
| `apify-kosten-nachtragen` | Apify (nur Abfrage) | liest `usageTotalUsd` | — | schreibt `analysis_runs.apify_kosten_usd` |
| `send-weekly-digest-email` | Resend | — | — | **nein** |
| `send-purchase-confirmation` | Resend | — | — | **nein** |
| `send-analysis-email` | Resend | — | — | **nein** |
| `konto-warnung` | Resend | — | — | **nein** |
| `datenauskunft` | Resend | — | — | **nein** |
| `newsletter-subscribe` | Resend | — | — | **nein** |
| `admin-tagesmail` | Resend | — | — | **nein** |
| `create-checkout-session` / `stripe-webhook` | Stripe | — | — | **nein** — Gebühr wird nirgends erfasst |

Weitere Functions mit Anthropic-Bezug im Dashboard, aber ohne Repo-Kopie und
ohne aktiven Pfad: `generate-style-mirror`, `scan-managed-creator`,
`viuno-modellvergleich`, `analysis-webhook-befunde-test`. **Vor dem Go-Live
prüfen, ob sie noch erreichbar sind** — `viuno-modellvergleich` und
`analysis-webhook-befunde-test` stehen beide auf `verify_jwt: false`.

### E2 — Abgleich mit den offiziellen Preislisten

Geprüft am 15.09.2026 gegen `platform.claude.com/docs/en/about-claude/pricing`.

| Modell | Im Code / in `ai_pricing` | Offiziell | Abweichung |
|---|---|---|---|
| `claude-opus-5` | 5,00 / 25,00 $ je MTok (`basis.ts`) | 5,00 / 25,00 | **keine** ✓ |
| `claude-sonnet-5` | 2,00 / 10,00 $ (`generate-daily-digest`) | 2,00 / 10,00 | **keine** ✓ |
| `claude-haiku-4-5` | 1,00 / 5,00 $ (`ai_pricing`) | 1,00 / 5,00 | **keine** ✓ |
| `claude-opus-4-5` | 5,00 / 25,00 $ (`ai_pricing`) | 5,00 / 25,00 | **keine** ✓ |
| `claude-opus-4-6` / `-4-7` | 5,00 / 25,00 $ (`ai_pricing`) | 5,00 / 25,00 | **keine** ✓ |
| `claude-sonnet-4-5` / `-4-6` | 3,00 / 15,00 $ (`ai_pricing`) | 3,00 / 15,00 | **keine** ✓ |
| Web-Suche | 10 $ / 1.000 Suchen | 10 $ / 1.000 | **keine** ✓ |
| Gemini-Zeilen in `ai_pricing` | 3 Zeilen | — | **tote Daten**, kein Google-Aufruf im Projekt |

**Die Preise stimmen. Das Problem ist ein anderes:**

> **`ai_pricing` wird von keiner einzigen Function gelesen.**
> Beide KI-Aufrufe rechnen mit hartcodierten Konstanten. Die Tabelle ist reine
> Dokumentation — und als solche **unvollständig**: `claude-opus-5` und
> `claude-sonnet-5`, die beiden tatsächlich benutzten Modelle, **fehlen darin**.
> `claude-haiku-4-5-20251001` (der Name im Log) trifft `claude-haiku-4-5` (der
> Name in der Tabelle) auch bei exakter Suche nicht.
>
> Wer künftig einen Preis „in der Preistabelle" ändert, ändert nichts.
> Wer das Modell wechselt, muss an zwei Dateien denken.

### E3 — Wird richtig erfasst?

| Prüfung | Befund |
|---|---|
| Input-Tokens | ✓ `usage.input_tokens` |
| Output-Tokens | ✓ `usage.output_tokens` |
| **Cache-Tokens** | **nicht erfasst** — `cache_creation_input_tokens` / `cache_read_input_tokens` werden nirgends gelesen. Heute folgenlos: es gibt **kein** `cache_control` im Projekt, also keine Cache-Tokens. Wird Prompt-Caching später eingeschaltet, sind die Kosten **still zu niedrig**. |
| Web-Suche | ✓ `(server_tool_use + web_search_tool_result) / 2 × 0,01 $` — korrekt, auch die Regel „Suchergebnisse zählen zusätzlich als Input-Tokens" ist automatisch abgedeckt, weil `input_tokens` sie enthält |
| **Nicht erfasste Aufrufe** | **Resend (7 Functions) und Stripe** schreiben nichts. Resend liegt im Free-Tarif (3.000 Mails/Monat) — heute 0 €, ab ~750 Abonnenten 20 $/Monat. Stripe kostet ab dem ersten echten Kauf. |
| **Doppelt erfasste Aufrufe** | **nein** — `generate-daily-digest` hat zwei `insert`-Zweige (Zeile 482 und 516), aber der erste endet mit `return`. Geprüft: 28 Log-Zeilen bei 45 Ausgaben, keine Dubletten. |
| **Falsche `user_id`** | **ja, 7 Zeilen.** 4× `analyse_v2_instagram` (Haiku), 1× `analyse_v2_instagram` (Opus 5), 2× `analyse_v2_tiktok` (Haiku) haben `user_id = null`, obwohl es eine Analyse eines Kontos war. Der Deckungsbeitrag pro Nutzer ist damit für diese Läufe nicht zuordenbar. (Die 28 `daily_digest`-Zeilen haben zu Recht `null` — die Wochennews gehören niemandem.) |

### E4 — Die Deckungsbeitragsrechnung

**Was das Admin heute rechnet:**

```
DB = 9,99 € − Apify
```

**Was fehlt:** die KI-Kosten und die Stripe-Gebühr. Richtig, mit den gemessenen
Werten dieses Projekts (Kurs 0,92):

| Posten | Instagram | TikTok | Quelle |
|---|---:|---:|---|
| Verkaufspreis | 9,9900 € | 9,9900 € | `stripe_prices.amount` |
| − Apify | 0,0918 € | 0,1235 € | `analysis_runs.apify_kosten_usd`: 0,0998 $ / 0,1342 $ |
| − KI (Opus 5) | 0,1303 € | 0,1323 € | `ai_usage_log`: Schnitt 0,1416 $ / 0,1438 $ |
| − Stripe netto (1,5 % + 0,25 €) | 0,3999 € | 0,3999 € | stripe.com/de/pricing |
| − 19 % USt auf die Stripe-Gebühr | 0,0760 € | 0,0760 € | **siehe Hinweis** |
| **= Deckungsbeitrag** | **9,2920 €** | **9,2583 €** | |
| Admin zeigt heute | 9,8982 € | 9,8665 € | |
| **Fehler** | **+0,61 €** (6,5 %) | **+0,61 €** (6,5 %) | |

**Kleinunternehmer § 19 UStG:** Auf den Umsatz wird keine Umsatzsteuer
ausgewiesen — das ist in `create-checkout-session` korrekt hinterlegt
(`INVOICE_FOOTER`). Auf die **Eingangsseite** wirkt das aber umgekehrt: die
19 % USt, die Stripe auf die eigene Gebühr erhebt, sind **nicht als Vorsteuer
abziehbar** und damit echte Kosten. Stripe schreibt selbst nur „Stripe ist
verpflichtet, auf bestimmte Produkte und Dienstleistungen Steuern zu erheben"
— **ob 19 % tatsächlich auf der Rechnung stehen, ist auf der ersten echten
Stripe-Monatsrechnung zu prüfen.** Ohne USt wäre der DB 9,3680 € / 9,3343 €.
Anthropic und Apify rechnen als US-Anbieter im Reverse-Charge — dafür braucht
es eine USt-IdNr.; ohne sie stellen beide ebenfalls Steuer in Rechnung. **Auch
das gehört auf die erste Rechnung geprüft.**

Zum Vergleich: `LAUNCH-CHECK.md` nennt „Marge je Analyse ≈ 9,35 €" — das ist die
Rechnung ohne USt auf die Stripe-Gebühr und mit einer KI-Schätzung von 0,15 $.
Die gemessenen Werte liegen nah dran.

### E5 — Fixkosten pro Monat

**Sie sind nirgends hinterlegt.** Keine Tabelle, keine Spalte, keine Konstante.
Die einzige Aufstellung ist eine Schätzung in `LAUNCH-CHECK.md:397-410`.

Stand heute, real:

| Posten | Heute | Ab wann | Aktuell? |
|---|---:|---|---|
| Cloudflare Pages + DNS | 0 € | praktisch nie (500 Builds/Monat) | ✓ |
| Domain `viuno.de` | **unbekannt** | laufend | **fehlt** — typ. 10–20 €/Jahr, steht nirgends |
| Supabase | 0 € (Free) | ab ~5.000 Aufrufen/Tag Egress; Pro = 25 $/Monat | **Plan ist nicht dokumentiert** (LAUNCH-CHECK Punkt 10 offen) |
| Resend | 0 € (Free, 3.000/Monat, 100/Tag) | ab ~750 Abonnenten: 20 $/Monat | ✓ |
| Apify | verbrauchsabhängig, Guthaben 3,82 $ | sofort, linear mit Käufen | ✓ |
| Anthropic — Creator News | **≈ 3,81 €/Monat** | sofort, unabhängig von Käufen | gemessen: 0,9515 $ × 4,33 Wochen × 0,92 |
| Anthropic — Analysen | verbrauchsabhängig, Guthaben 18,92 $ | je Kauf 0,13 € | ✓ |

**Einziger echter Fixkostenblock ohne einen einzigen Verkauf: die Wochennews,
rund 3,80 €/Monat.** Der Sprung von Opus 4.5 auf Sonnet 5 hat den Preis je Lauf
*erhöht* (0,42 $ → 0,95 $), nicht gesenkt — nicht wegen des Modells, sondern
weil `WEB_SEARCH_MAX_USES` auf 12 steht und tatsächlich 10 Suchen gelaufen sind
(vorher im Schnitt 1,1). Der Kommentar im Code rechnet mit 1,55 $ bei zwölf
Suchen; gemessen sind es 0,95 $ bei zehn. Die Rechnung stimmt, der Anstieg ist
gewollt — aber er sollte als das benannt werden, was er ist.

**Vorschlag (eigener Schritt, nicht Teil der Bereinigung):** eine Tabelle
`fixkosten (posten, betrag_eur, intervall, gilt_ab, notiz)` und eine Kachel
„Kosten Monat = KI + Apify + Stripe + Fixkosten". Erst dann stimmt Punkt 4 des
Auftrags dauerhaft und nicht nur einmal.

---

## F. Was die Statistik nach dem Go-Live sonst noch verfälscht

### F1 — Eigene Aufrufe (eigene IP, eigenes Handy)

**Wird mitgezählt. Vollständig.** `track-biolink-view` prüft ausschließlich, ob
die `user_id` existiert — kein Cookie, kein localStorage, keine IP, kein
User-Agent. Das ist Absicht (CLAUDE.md: „Wer hier etwas ergänzt, das einen
Besucher über zwei Aufrufe hinweg wiedererkennbar macht, macht den Banner
nötig").

**Genau deshalb ist `is_internal` pro Besucher nicht machbar.** Jede Kennung,
die den eigenen Browser wiedererkennt, ist genau die Wiedererkennung, die den
Cookie-Banner auslöst.

Was ohne diese Grenze zu überschreiten geht:

| Vorschlag | Wirkung | Kosten |
|---|---|---|
| **Kontoweiter Ausschluss in den Auswertungen** — `admin_uebersicht()` bekommt eine Liste interner `user_id` und zählt deren BioLink-/Media-Kit-Aufrufe getrennt aus | trennt „Seiten der Betreiber" von „Seiten der Kundschaft" in der **Plattform**statistik | eine RPC-Änderung. **Ändert nichts** an der Statistik, die der Creator selbst sieht — und soll es auch nicht |
| **`referrer_source` auswerten** — Aufrufe mit Referrer `viuno.de/app` oder `viuno.de/admin` sind Vorschauklicks aus der eigenen App | greift heute schon: `page_views` hat 6 Zeilen mit `https://viuno.de/app` | `biolink_quelle()` mappt `viuno.de` bereits auf „viuno"; eine eigene Stufe „Eigene Vorschau" wäre ein Zweizeiler |
| **Nichts tun und es wissen** | Antoniettas 2.047 Aufrufe enthalten unbekannt viele eigene | 0 |

**Empfehlung:** die zweite Variante plus eine klare Zeile im Admin. Die erste
lohnt bei drei Konten noch nicht.

### F2 — Bots und Crawler

**Werden praktisch nicht mitgezählt.** Alle drei Zähler
(`track-biolink-view`, `kit-renderer.js`, `page_views`) feuern aus JavaScript
nach dem Laden. Suchmaschinen-Crawler, die WhatsApp-/iMessage-/Slack-Vorschau
und `curl` führen kein JavaScript aus — sie erscheinen nicht.

**Ausnahme:** Googlebot rendert JavaScript. `robots.txt` sperrt `/app/`,
`/admin/`, `/analyse/`, `/brandready/` usw., aber **nicht** die BioLink-Seiten
und nicht `/kit/` — die sollen ja gefunden werden. Ein gerenderter Googlebot-
Besuch landet in `biolink_aufrufe` mit `referrer_source = 'direct'`.

**Vorschlag:** in `track-biolink-view` **serverseitig** auf den User-Agent-Header
prüfen und bekannte Bot-Kennungen verwerfen (`bot`, `crawler`, `spider`,
`headless`, `preview`, `monitor`). **Das ist DSGVO-unbedenklich**, solange der
User-Agent nur geprüft und **nicht gespeichert** wird — es entsteht keine
Wiedererkennung über zwei Aufrufe. Die Grenze aus CLAUDE.md bleibt gewahrt.

### F3 — Preview-Deployments `*.pages.dev`

**Wird mitgezählt, ungefiltert.** Cloudflare Pages liefert jeden Branch und
jeden Commit zusätzlich unter `<hash>.bioseiten.pages.dev` aus — mit demselben
HTML, demselben Zähler, derselben `user_id`. `track-biolink-view` setzt
`Access-Control-Allow-Origin: '*'` und prüft den `Origin`-Header **nicht**.

Jeder Blick auf eine Vorschau-URL erhöht die Aufrufzahl der echten Seite.

**Vorschlag:** in `track-biolink-view` und im REST-Insert der Media-Kit-Seite
den `Origin`-Header prüfen und nur `https://viuno.de` zählen. Auch das speichert
nichts und braucht keinen Banner.

### F4 — Uptime-Monitor und Cron-Jobs

| Quelle | Zählt mit? |
|---|---|
| Uptime-Monitor per `curl`/HEAD | **nein** (kein JS) |
| Uptime-Monitor mit echtem Browser | **ja** — falls einer eingerichtet wird, Seiten-URL ausnehmen oder über F2/F3 filtern |
| Die 9 Cron-Jobs | **nein** — keiner ruft eine öffentliche Seite auf; sie sprechen Edge Functions und SQL an |
| `digest_waechter()`, `fail_stale_analysis_runs()` | **nein** |

### F5 — Käufe nach dem Go-Live

| Fall | Zählt mit? | Vorschlag |
|---|---|---|
| **Eigener 9,99-€-Live-Testkauf** (Kauf #8, bereits getätigt) | **ja** | vor dem Go-Live löschen (Abschnitt G) |
| **Erstattung dieses Kaufs** | **wird nicht bemerkt** — `stripe-webhook` verarbeitet nur `checkout.session.completed`, `analysis_purchases` hat keine Statusspalte | **Spalte `erstattet_am timestamptz` ergänzen**, `charge.refunded` im Webhook verarbeiten, `admin_uebersicht()` auf `where erstattet_am is null` filtern. Ohne das steht jede Erstattung für immer als Umsatz. |
| **Stripe-Testkäufe nach dem Go-Live** | **ja, ununterscheidbar** — die Kaufliste zeigt die Session-ID nicht an | **Spalte `ist_test boolean generated always as (stripe_checkout_session_id like 'cs_test_%') stored`**, im Admin als Tag anzeigen und aus dem Umsatz herausrechnen. Eine erzeugte Spalte kann nicht falsch gepflegt werden. |
| **Freischaltungen durch den Admin** (`session` beginnt mit `admin_`) | **ja, als 0 € oder 9,99 €?** — `admin-dashboard` schreibt solche Zeilen; das Frontend kennt den Tag „Freischaltung" bereits, aber der Betrag fließt in den Umsatz | prüfen, mit welchem `amount_paid` diese Zeilen geschrieben werden, und sie wie Testkäufe behandeln |

### F6 — Eigene Analysen zum Testen

Jede Analyse kostet echtes Geld (0,22 € Fremdkosten) und erscheint unter
System → Analysen, in `kosten.marge` und im Guthabenverbrauch. Ein Testlauf nach
dem Go-Live verschiebt den Deckungsbeitrag.

**Vorschlag:** `analysis_runs` bekommt `ist_test boolean default false`; das
Admin setzt es beim Freischalten über `admin-dashboard`, und `kosten.marge`
rechnet ohne diese Läufe.

### F7 — Übersicht: was ohne Gegenmaßnahme ab Tag 1 falsch zählt

| # | Quelle | Betroffene Zahl | Ohne Gegenmaßnahme |
|---|---|---|---|
| F1 | eigene Besuche | BioLink-/Media-Kit-Aufrufe | dauerhaft zu hoch, unbekannt um wie viel |
| F2 | Googlebot | BioLink-Aufrufe | leicht zu hoch |
| F3 | `*.pages.dev` | BioLink-/Media-Kit-Aufrufe | zu hoch bei jedem Deployment-Test |
| F5a | Erstattungen | Umsatz, Deckungsbeitrag | dauerhaft zu hoch |
| F5b | Stripe-Testkäufe | Umsatz | dauerhaft zu hoch |
| F6 | eigene Testanalysen | Kosten, Marge | Marge zu niedrig |
| E3 | fehlende `user_id` | Deckungsbeitrag je Nutzer | einzelne Läufe nicht zuordenbar |
| A.5 | Zählerspalten | Admin → Menschen, App-Kacheln | nach jeder Löschung stehengeblieben |

---

## G. Vorgehen

**Grundsätze:** erst sichern, dann löschen · jede Löschung in einer Transaktion ·
nach jeder Transaktion eine Kontrollabfrage · Sicherungstabellen bleiben stehen,
bis sie freigegeben werden.

Alles Folgende ist **Vorschlag**. Kein Statement wurde ausgeführt.

### G0 — Vorher (einmalig, vor allem anderen)

```sql
-- 1) Vollständiger Export als CSV über die Supabase-UI oder:
--    pg_dump --data-only --schema=public > sicherung_vor_bereinigung_20260915.sql
--    (Der MCP-Weg kann das nicht; das muss über die Supabase-UI oder psql laufen.)

-- 2) Zeilenzahlen festhalten
create schema if not exists sicherung;

create table sicherung.zaehlung_vorher as
select 'biolink_aufrufe' t, count(*) n from biolink_aufrufe
union all select 'biolink_klicks',       count(*) from biolink_klicks
union all select 'mediakit_aufrufe',     count(*) from mediakit_aufrufe
union all select 'page_views',           count(*) from page_views
union all select 'ai_usage_log',         count(*) from ai_usage_log
union all select 'analysis_purchases',   count(*) from analysis_purchases
union all select 'stripe_webhook_events',count(*) from stripe_webhook_events
union all select 'withdrawal_consents',  count(*) from withdrawal_consents
union all select 'subscriptions',        count(*) from subscriptions
union all select 'admin_errors',         count(*) from admin_errors
union all select 'newsletter_subscribers',count(*) from newsletter_subscribers
union all select 'apify_raw_runs',       count(*) from apify_raw_runs;

-- 3) Der Zustand der beiden unantastbaren Konten, Zeile für Zeile
create table sicherung.unantastbar_vorher as
select u.id, u.email, u.display_name,
       u.bio_views_total, u.bio_views_today, u.bio_views_last_7_days,
       u.mediakit_views_total, u.mediakit_views_today, u.mediakit_views_last_7_days,
       u.bio_active, u.mediakit_active, u.contact_email, u.niche_category,
       u.instagram_handle, u.tiktok_handle, u.threads_handle, u.profile_image_url,
       (select count(*) from biolink_aufrufe  x where x.user_id=u.id) n_bio,
       (select count(*) from biolink_klicks   x where x.user_id=u.id) n_klick,
       (select count(*) from mediakit_aufrufe x where x.user_id=u.id) n_mk,
       (select count(*) from analysis_runs    x where x.user_id=u.id) n_runs,
       (select count(*) from analyse_ki       x where x.user_id=u.id) n_ki,
       (select count(*) from analyse_stats    x where x.user_id=u.id) n_stats,
       (select count(*) from apify_daten      x where x.user_id=u.id) n_apify,
       (select count(*) from mediakit_beitraege x where x.user_id=u.id) n_mkb,
       (select count(*) from brand_ready_angaben x where x.user_id=u.id) n_br,
       (select count(*) from biolink_custom_links x where x.user_id=u.id) n_links
from users u
where u.id in ('5620b0b6-3050-46d2-8853-5ef0f9a123c2',
               'd5dff681-2788-4f81-8388-6b4abf7cc5bf');
```

Erwartete Werte in `unantastbar_vorher` (zur Gegenprobe):
Antonietta `n_bio=2047, n_klick=14, n_mk=31, n_runs=1, n_ki=1, n_stats=1, n_apify=36, n_mkb=6, n_br=3` ·
Heyno `n_bio=56, n_klick=9, n_mk=21, n_runs=1, n_ki=2, n_stats=2, n_apify=24, n_mkb=0, n_br=0`

### G1 — Sicherungskopien aller betroffenen Tabellen

```sql
create table sicherung.biolink_aufrufe_20260915       as select * from biolink_aufrufe;
create table sicherung.biolink_klicks_20260915        as select * from biolink_klicks;
create table sicherung.mediakit_aufrufe_20260915      as select * from mediakit_aufrufe;
create table sicherung.page_views_20260915            as select * from page_views;
create table sicherung.ai_usage_log_20260915          as select * from ai_usage_log;
create table sicherung.analysis_purchases_20260915    as select * from analysis_purchases;
create table sicherung.stripe_webhook_events_20260915 as select * from stripe_webhook_events;
create table sicherung.withdrawal_consents_20260915   as select * from withdrawal_consents;
create table sicherung.subscriptions_20260915         as select * from subscriptions;
create table sicherung.admin_errors_20260915          as select * from admin_errors;
create table sicherung.newsletter_subscribers_20260915 as select * from newsletter_subscribers;
create table sicherung.apify_raw_runs_20260915        as select * from apify_raw_runs;
create table sicherung.analysis_runs_kosten_20260915  as
  select id, user_id, platform, apify_kosten_usd, apify_kosten_stand from analysis_runs;
create table sicherung.daily_digest_tokens_20260915   as
  select date, model_used, tokens_used, tokens_input, tokens_output from daily_digest;

-- Das Schema gehört niemandem ausser dem Service Role:
revoke all on schema sicherung from anon, authenticated;
```

**Kontrolle:** jede Sicherungstabelle muss dieselbe Zeilenzahl haben wie ihr
Original. Erst danach weiter.

### G2 — Aufrufe (Kategorien 5 und 6)

Die Variante hängt an **E2** und **E3**. Unten die Empfehlung (nur Antonietta
behalten):

```sql
begin;

  delete from biolink_aufrufe
   where user_id is distinct from '5620b0b6-3050-46d2-8853-5ef0f9a123c2';
  -- erwartet: 60 Zeilen (56 Heyno + 4 Bernidal)

  delete from biolink_klicks
   where user_id is distinct from '5620b0b6-3050-46d2-8853-5ef0f9a123c2';
  -- erwartet: 10 Zeilen. MUSS zusammen mit biolink_aufrufe passieren,
  -- sonst rechnet biolink_klickrate() gegen zwei Stichtage.

  delete from mediakit_aufrufe
   where user_id is distinct from '5620b0b6-3050-46d2-8853-5ef0f9a123c2';
  -- erwartet: 23 Zeilen

commit;
```

**Sofort danach — die Zählerspalten (ohne das bleibt die Statistik falsch):**

```sql
select update_biolink_view_aggregates(id)  from users;
select update_mediakit_view_aggregates(id) from users;
```

**Kontrolle:**

```sql
select u.email,
       u.bio_views_total,      (select count(*) from biolink_aufrufe  b where b.user_id=u.id) soll_bio,
       u.mediakit_views_total, (select count(*) from mediakit_aufrufe m where m.user_id=u.id) soll_mk
from users u order by u.created_at;
-- bio_views_total MUSS soll_bio entsprechen, mediakit_views_total MUSS soll_mk entsprechen.
-- Antonietta: 2047 / 31. Alle anderen: 0 / 0.
```

### G3 — Käufe, Umsatz, Ereignisse (Kategorien 2 und 7)

```sql
begin;

  -- 7 Testmodus-Käufe. Der achte (cs_live_) nur, wenn er erstattet wird.
  delete from analysis_purchases where stripe_checkout_session_id like 'cs_test_%';
  -- erwartet: 7 Zeilen

  -- Nur mit ausdrücklichem Go, siehe E1/F5:
  -- delete from analysis_purchases where stripe_checkout_session_id like 'cs_live_%';

  -- Zustimmungen ohne zugehörigen Kauf
  delete from withdrawal_consents w
   where not exists (select 1 from analysis_purchases p
                      where p.stripe_checkout_session_id = w.stripe_checkout_session_id);
  -- erwartet: 10 Zeilen (bleibt: die zum Live-Kauf)

  -- Idempotenz-Sperre der Testphase
  delete from stripe_webhook_events;   -- erwartet: 9 Zeilen

  -- Verwaiste Abo-Zeile des gelöschten Launch-Check-Kontos
  delete from subscriptions where user_id is null;   -- erwartet: 1 Zeile

commit;
```

**Kontrolle:**

```sql
select count(*) kaeufe, coalesce(sum(amount_paid),0) cent from analysis_purchases;
-- erwartet: 1 / 999   (oder 0 / 0, wenn der Live-Kauf erstattet wird)

select count(*) from subscriptions;   -- erwartet: 3, je eine pro Konto
```

### G4 — KI-Kosten (Kategorie 1)

```sql
begin;

  delete from ai_usage_log;                              -- erwartet: 51 Zeilen

  update analysis_runs
     set apify_kosten_usd = null, apify_kosten_stand = null;  -- erwartet: 5 Zeilen

  update daily_digest
     set tokens_used = null, tokens_input = null, tokens_output = null;  -- erwartet: 45

commit;
```

**Achtung — `apify-kosten-nachtragen` läuft stündlich (`7 * * * *`).** Nach dem
`update` stehen alle fünf Läufe wieder auf `null` und die Function trägt die
Werte beim nächsten Durchgang **erneut ein** — für die Läufe, die Apify noch
kennt. Zwei Wege:

- **a)** Die alten Läufe zusammen mit den Käufen löschen (siehe G5), dann kann
  nichts nachgetragen werden. **Empfohlen.**
- **b)** Cron-Job `apify-kosten-nachtragen` bis zum Go-Live auf `active = false`
  setzen und danach wieder an. Erfordert einen Eingriff in `cron.job` —
  der Auftrag nennt Cron-Jobs ausdrücklich als unantastbar, also nur mit Go.

**Guthaben-Stichtag neu setzen (nicht auf 0, siehe A.1):**

```sql
-- Neue Zeile, nicht überschreiben — die Tabelle ist bewusst append-only.
insert into kosten_guthaben (anbieter, betrag_usd, stand_am, notiz, erfasst_von)
values ('anthropic', 18.92, now(), 'Stichtag Go-Live', 'd5dff681-2788-4f81-8388-6b4abf7cc5bf'),
       ('apify',      3.82, now(), 'Stichtag Go-Live', 'd5dff681-2788-4f81-8388-6b4abf7cc5bf');
-- Beträge vor dem Ausführen in den Anbieter-Konsolen gegenprüfen.
```

**Kontrolle:**

```sql
select count(*) zeilen, coalesce(sum(cost_usd),0) usd from ai_usage_log;  -- erwartet: 0 / 0
select anbieter, betrag_usd, stand_am from kosten_guthaben order by anbieter, stand_am desc;
```

### G5 — Analyse-Läufe der Testphase

Nur für Läufe, die **nicht** zu einem der beiden unantastbaren Konten gehören
und keine echte Analyse sind. Antoniettas Lauf `6d8fc238…` und Heynos Lauf
`23047f7e…` bleiben.

```sql
begin;
  -- Der fehlgeschlagene TikTok-Lauf von Bernidal (Handle-Problem), ohne Ergebnis:
  delete from analysis_runs where id = '1a1d7e4e-58e9-40a7-adb7-f845e684f017';
  -- CASCADE räumt analyse_ki, analyse_stats, apify_daten, analyse_freigaben mit ab.
commit;
```

**Bernidals zwei erfolgreiche Läufe nicht löschen** — er hat sie bezahlt und
sieht sie in seiner App. Nur wenn E4 anders entschieden wird.

**Wenn `23047f7e…` (Heyno, 29.04., Apify kennt ihn nicht mehr) mit weg soll** —
das räumt die Dauerabfrage von `apify-kosten-nachtragen` ab, greift aber ein
unantastbares Konto an. **Fragen.**

### G6 — Aufräumarbeiten (Altlasten aus D)

```sql
begin;
  delete from admin_errors where resolved;     -- erwartet: 37
  delete from apify_raw_runs;                  -- erwartet: 2
  delete from newsletter_subscribers
   where confirmed_at is null and status <> 'unsubscribed';   -- erwartet: 2
  delete from page_views where page = 'launchcheck_test';     -- erwartet: 1
commit;
```

`page_views` insgesamt (169 Zeilen, ab 14.09.): **fragen.** Die Zeilen
dokumentieren die Creator-News-Nutzung und den Landing-Zähler. Auf null zu
setzen, lässt die Meldung „Die Startseite zählt noch nicht" wieder erscheinen
(siehe C) und löscht den Punkt, an dem der Sidebar-Punkt „Creator News"
hängt (`page='news'` je Konto). Empfehlung: **nur die 115 anonymen
Landing-/News-Zeilen der Testphase löschen, die Zeilen der drei Konten
behalten** — oder alles behalten.

Storage (über die Supabase-UI oder `storage-aufraeumen`, nicht über SQL):

```
profile-images/28d64f8c-0447-426b-8b87-f21e9a7091a1/*       (2 Dateien)
profile-images/9e0eb2eb-884a-4d68-acff-e74a5511b9a7/*       (1 Datei)
profile-images/f35003c1-fdcf-40fc-8708-1d6c8017f275/*       (1 Datei)
profile-images/Profilbild_BioUno.png                        (1 Datei)
profile-images/d5dff681-.../1788969837894.jpeg              (1 Datei, nicht verlinkt)
```

Antoniettas 9 verwaiste Dateien (8,0 MB): **fragen** (siehe D2).

Repo:

```
git rm -r public/test public/admina
# robots.txt und _headers: Zeilen fuer /testi/ entfernen
# CLAUDE.md: public/easyglenn, public/kit/easyg, public/kit/kross streichen
```

### G7 — Codeänderungen (eigener Commit, nach der Datenbereinigung)

Diese sind **nicht** Teil der Bereinigung und brauchen ein eigenes Go. Sie
sorgen dafür, dass die bereinigten Zahlen auch bereinigt bleiben.

| # | Datei | Änderung | Warum |
|---|---|---|---|
| 1 | `admin_uebersicht()` | `kosten.marge` um die KI-Kosten und die Stripe-Gebühr ergänzen; Deckungsbeitrag in der RPC rechnen statt im Frontend | E4 — heute 6,5 % zu hoch, und `9.99` steht zweimal im HTML |
| 2 | `public/admin/index.html:584` | Kachel „Kosten Monat" = KI + Apify (+ Fixkosten, wenn es sie gibt); Unterzeile auf denselben Zeitraum | A.4 |
| 3 | `admin_uebersicht()` | `apify_zeitraum` auf `started_at` filtern, nicht auf `apify_kosten_stand` | C, Geld → Kosten |
| 4 | `admin_uebersicht()` | `modus.stripe` aus `VIUNO_STRIPE_MODE` beziehen (über `admin-dashboard`), nicht aus `stripe_prices` | C, D3 |
| 5 | `analysis_purchases` | `ist_test boolean generated always as (stripe_checkout_session_id like 'cs_test_%') stored` + `erstattet_am timestamptz`; Umsatz filtert beides | F5 |
| 6 | `stripe-webhook` | `charge.refunded` verarbeiten und `erstattet_am` setzen | F5 |
| 7 | `track-biolink-view`, `kit-renderer.js` | `Origin` prüfen, nur `https://viuno.de` zählen | F3 |
| 8 | `track-biolink-view` | Bot-User-Agents verwerfen (**prüfen, nicht speichern**) | F2 |
| 9 | `analysis-webhook/basis.ts` | `user_id` zuverlässig durchreichen | E3 — 7 Zeilen ohne Zuordnung |
| 10 | `ai_pricing` | entweder befüllen *und* aus dem Code lesen, oder ersatzlos löschen | E2 — halb gepflegte Preistabelle ist schlimmer als keine |
| 11 | `basis.ts` + `generate-daily-digest` | Cache-Tokens mitschreiben, falls Prompt-Caching kommt | E3 |
| 12 | `kurs` 0,92 | steht an **zwei** Stellen (`admin_uebersicht()`, `admin-tagesmail:18`) | bekannt, in CLAUDE.md dokumentiert — beim Ändern beide |

### G8 — Reihenfolge

```
G0  Export + Zählung + Zustand der unantastbaren Konten
G1  Sicherungstabellen            → Zeilenzahlen gegenprüfen
G2  Aufrufe löschen               → Zähler neu rechnen → Kontrolle
G3  Käufe und Ereignisse          → Kontrolle
G5  Analyse-Läufe (vor G4!)       → Kontrolle
G4  KI-Kosten + Guthaben-Stichtag → Kontrolle
G6  Altlasten, Storage, Repo      → Kontrolle
--- Admin öffnen, jede Kachel gegen die erwarteten Werte halten ---
--- Antonietta-Konto in der App öffnen: BioLink, Media Kit, Analyse ---
G7  Codeänderungen, eigener Commit, eigenes Go
```

**G5 vor G4**, damit `apify-kosten-nachtragen` nicht nachträgt, was G4 gerade
geleert hat.

### G9 — Abnahme

Nach jedem Schritt:

```sql
-- 1) Die beiden unantastbaren Konten, Soll gegen Ist
select v.email,
       v.n_bio,   (select count(*) from biolink_aufrufe  x where x.user_id=v.id) ist_bio,
       v.n_klick, (select count(*) from biolink_klicks   x where x.user_id=v.id) ist_klick,
       v.n_mk,    (select count(*) from mediakit_aufrufe x where x.user_id=v.id) ist_mk,
       v.n_runs,  (select count(*) from analysis_runs    x where x.user_id=v.id) ist_runs,
       v.n_ki,    (select count(*) from analyse_ki       x where x.user_id=v.id) ist_ki,
       v.n_stats, (select count(*) from analyse_stats    x where x.user_id=v.id) ist_stats,
       v.n_apify, (select count(*) from apify_daten      x where x.user_id=v.id) ist_apify,
       v.n_mkb,   (select count(*) from mediakit_beitraege x where x.user_id=v.id) ist_mkb,
       v.n_br,    (select count(*) from brand_ready_angaben x where x.user_id=v.id) ist_br,
       v.n_links, (select count(*) from biolink_custom_links x where x.user_id=v.id) ist_links
from sicherung.unantastbar_vorher v;
-- Für Heyno weichen n_bio/n_klick/n_mk ab, falls E2/E3 auf "löschen" stehen.
-- Alles andere MUSS gleich sein. Für Antonietta MUSS alles gleich sein.

-- 2) Profil, Seiten, Einstellungen unverändert
select v.email,
       v.bio_active   = u.bio_active   as bio_ok,
       v.mediakit_active = u.mediakit_active as mk_ok,
       v.contact_email is not distinct from u.contact_email as mail_ok,
       v.niche_category is not distinct from u.niche_category as nische_ok,
       v.profile_image_url is not distinct from u.profile_image_url as bild_ok,
       v.instagram_handle is not distinct from u.instagram_handle as ig_ok
from sicherung.unantastbar_vorher v join users u on u.id=v.id;
-- Alle Spalten MÜSSEN true sein.

-- 3) Zähler stimmen zur Tabelle
select u.email, u.bio_views_total, (select count(*) from biolink_aufrufe b where b.user_id=u.id) soll
from users u;
```

Und im Browser, mit Augen:

- Admin → **Start**: Umsatz Monat 0,00 € (oder 9,99 €), Kosten Monat 0,00 €,
  Deckungsbeitrag „–", Meldung „Apify-Kosten werden noch nicht erfasst"
- Admin → **Geld → Kosten**: Guthaben mit neuem Stichtag, „reicht – Tage"
- Admin → **Menschen**: Antonietta 2.047, alle anderen 0
- Admin → **Traffic**: BioLink 2.047, Media Kit 31
- App als Antonietta: Dashboard-Kachel, BioLink-Auswertung, Media Kit, Analyse
  — alles wie vorher
- `viuno.de/antonietta` und `viuno.de/kit/antonietta` laden

---

## Schritt 2 — Ergebnis

Ausgeführt am **15.09.2026 ab 16:05**. Entscheidungen des Betreibers:
**E1 = löschen · E2 = löschen · E3 = nur Antonietta behalten.**

### Was in der Zwischenzeit passiert ist

Zwischen Analyse und Ausführung lief echter Betrieb weiter:

- **15:26–15:28** — Glenn (`bernd1988bernd@outlook.de`) hat den **Live-Kauf
  eingelöst**: Instagram-Analyse `811ab96b…`, fertig, Apify 0,0998 $,
  KI 0,155435 $. Die 9,99 € sind damit ein geliefertes Geschäft, kein Testkauf
  mehr.
- **16:23** — Admin-Freischaltung für Antonietta (`admin_fr…`, `amount_paid = 0`).
  Nebenbefund zu F5: Freischaltungen fließen mit **0 €** ein und verzerren den
  Umsatz nicht. Die Zeile bleibt stehen.
- Antoniettas BioLink hat während der Arbeit einen echten Aufruf bekommen
  (2.047 → 2.048); der INSERT-Trigger hat den Zähler selbst nachgezogen.

### Drei Abweichungen vom Plan

**1. `ai_usage_log` wurde nicht vollständig geleert — eine Zeile bleibt.**
Die KI-Kosten der um 15:28 gelieferten Live-Analyse (0,155435 $ ≈ 0,14 €).
Diese Kosten zu löschen, während die zugehörigen 9,99 € Umsatz stehen bleiben,
hätte genau die Verzerrung erzeugt, gegen die diese Bereinigung läuft: ein
Verkauf ohne Kosten, Deckungsbeitrag 100 %. Umsatz und Kosten desselben
Geschäfts gehören zusammen. Soll es trotzdem eine harte Null sein:
`delete from ai_usage_log;`

**2. `analysis_runs.apify_kosten_usd` wurde *nicht* auf `null` gesetzt.**
Der Plan sah das vor. Drei Gründe dagegen:

- `apify-kosten-nachtragen` läuft stündlich (`7 * * * *`) und greift genau die
  Zeilen, bei denen die Spalte `null` ist. Die Werte wären innerhalb einer
  Stunde **wieder da** — dann aber mit `apify_kosten_stand = heute`.
- Damit fielen alte Testkosten **in den neuen Guthaben-Zeitraum**
  (`verbraucht_eur` filtert auf `apify_kosten_stand >= stand_am`). Das Nullen
  hätte die Statistik also nicht sauberer, sondern schmutziger gemacht.
- So wie es steht, liegen alle alten Stände auf dem 13.–15.09. vor 11:38 und
  damit **vor** dem Guthaben-Stichtag. Der Apify-Verbrauch startet von selbst
  bei null.

**3. Keine neuen `kosten_guthaben`-Zeilen angelegt.** Nicht nötig: die
bestehenden Zeilen stehen auf dem **15.09. 11:38** und damit bereits hinter der
Testphase. Der ausgewiesene Verbrauch seit Stichtag ist jetzt exakt die eine
echte Analyse (0,14 €). Die Beträge 18,92 $ / 3,82 $ bitte trotzdem vor dem
Go-Live in den Anbieter-Konsolen gegenprüfen und bei Abweichung im Admin unter
*Geld → Kosten* neu eintragen.

### Ergebnis je Tabelle

| Tabelle | vorher | nachher | Antonietta | Heyno | Status |
|---|---:|---:|:--:|:--:|---|
| `biolink_aufrufe` | 2.107 | 2.048 | 2.047 → **2.048** (echter Neuaufruf) ✓ | 56 → 0 (so entschieden) | **erledigt** |
| `biolink_klicks` | 24 | 14 | 14 → 14 ✓ | 9 → 0 (so entschieden) | **erledigt** |
| `mediakit_aufrufe` | 54 | 31 | 31 → 31 ✓ | 21 → 0 (so entschieden) | **erledigt** |
| `users.bio_views_*` | — | neu gerechnet | 2.048 / stimmt zur Tabelle ✓ | 0 / 0 / 0 ✓ | **erledigt** |
| `users.mediakit_views_*` | — | neu gerechnet | 31 / stimmt zur Tabelle ✓ | 0 / 0 / 0 ✓ | **erledigt** |
| `ai_usage_log` | 52 | **1** (0,14 €) | unberührt ✓ | unberührt ✓ | **erledigt**, siehe Abweichung 1 |
| `daily_digest.tokens_*` | 45 gefüllt | 45 × `null` | Inhalt (45 Ausgaben, `cards`) unberührt ✓ | ✓ | **erledigt** |
| `admin_errors` | 37 | **0** | ✓ | ✓ | **erledigt** |
| `analysis_runs` | 6 | 6 | 1 → 1 ✓ | 1 → 1 ✓ | bewusst unberührt, Abweichung 2 |
| `analysis_purchases` | 8 (+1) | **9** | — | — | **offen, blockiert** |
| `withdrawal_consents` | 11 | 11 | — | — | **offen, blockiert** |
| `stripe_webhook_events` | 9 | 9 | — | — | **offen, blockiert** |
| `subscriptions` | 4 | 4 | ✓ | ✓ | **offen, blockiert** |
| `apify_raw_runs` | 2 | 2 | — | — | **offen, blockiert** |
| `newsletter_subscribers` | 4 | 4 | ✓ | ✓ | **offen, blockiert** |
| `page_views` | 171 | 171 | ✓ | ✓ | **offen, blockiert** |

**Kontrolle der unantastbaren Konten** (`sicherung.unantastbar_vorher` gegen Ist):

| Prüfung | Antonietta | Heyno |
|---|:--:|:--:|
| `analysis_runs` / `analyse_ki` / `analyse_stats` | ✓ | ✓ |
| `apify_daten` | ✓ (36) | ✓ (24) |
| `mediakit_beitraege` / `brand_ready_angaben` | ✓ (6 / 3) | ✓ (0 / 0) |
| `biolink_custom_links` / `creator_analytics` / `analyse_freigaben` | ✓ | ✓ |
| Profil (`bio_active`, `mediakit_active`, `contact_email`, `niche_category`, `profile_image_url`, alle Handles) | ✓ | ✓ |
| BioLink-/Media-Kit-Aufrufe | ✓ unverändert | 0, wie entschieden |

### Was noch offen ist

Der Auto-Modus dieser Sitzung hat die restlichen Löschungen abgelehnt
(*Modify Shared Resources* bzw. *Cloud Storage Mass Delete*). Sie sind **nicht**
ausgeführt. Die Sicherungskopien liegen vollständig vor, die Statements sind
unverändert gültig:

```sql
begin;
  -- 7 Testmodus-Kaeufe raus. Es bleiben: der eingeloeste Live-Kauf (999)
  -- und die Admin-Freischaltung fuer Antonietta (0).
  delete from analysis_purchases where stripe_checkout_session_id like 'cs_test_%';

  -- Zustimmungen ohne zugehoerigen Kauf
  delete from withdrawal_consents w
   where w.stripe_checkout_session_id is null
      or not exists (select 1 from analysis_purchases p
                      where p.stripe_checkout_session_id = w.stripe_checkout_session_id);

  -- Das Ereignis des Live-Kaufs BLEIBT: es ist die Idempotenz-Sperre.
  -- Ohne sie koennte ein Stripe-Retry denselben Kauf ein zweites Mal anlegen.
  delete from stripe_webhook_events
   where stripe_event_id <> 'evt_1UFs2yLH6NVqx26efiTyMJOg';

  delete from subscriptions where user_id is null;

  delete from apify_raw_runs where scrape_date = date '2026-04-21';
  delete from newsletter_subscribers where confirmed_at is null and status = 'pending';
  delete from page_views where page = 'launchcheck_test';
commit;

-- Kontrolle
select count(*) kaeufe, coalesce(sum(amount_paid),0) cent from analysis_purchases;
-- erwartet: 2 / 999   (9,99 EUR echter Umsatz, 0 EUR Freischaltung)
```

Ebenfalls offen, weil nicht über SQL machbar:

- **Storage**: 6 verwaiste Dateien in `profile-images` (siehe D2). Über die
  Supabase-UI oder `storage-aufraeumen` — diese Function hat **keine
  Repo-Kopie**, ihr Quelltext gehört vor dem Einsatz geprüft und ins Repo.
- **Antoniettas 9 verwaiste Profilbilder (8,0 MB)**: weiterhin offen, siehe D2.
- **`page_views` im Ganzen**: bewusst nicht angefasst, weil daran der
  Sidebar-Punkt „Creator News" hängt (`page='news'` je Konto). Siehe G6.
- **Repo**: `public/test/`, `public/admina/`, die `/testi/`-Zeilen in
  `robots.txt` und `_headers`, die veralteten Pfade in `CLAUDE.md`.
- **G7**: die zwölf Codeänderungen. Eigener Commit, eigenes Go.

### Die Sicherungen

Schema `sicherung`, für `anon` und `authenticated` gesperrt. **Stehen lassen
bis zur ausdrücklichen Freigabe.**

```
sicherung.zaehlung_vorher              sicherung.unantastbar_vorher
sicherung.users_zaehler_20260915       sicherung.biolink_aufrufe_20260915 (2107)
sicherung.biolink_klicks_20260915      sicherung.mediakit_aufrufe_20260915
sicherung.page_views_20260915          sicherung.ai_usage_log_20260915 (52)
sicherung.analysis_purchases_20260915  sicherung.stripe_webhook_events_20260915
sicherung.withdrawal_consents_20260915 sicherung.subscriptions_20260915
sicherung.admin_errors_20260915 (37)   sicherung.newsletter_subscribers_20260915
sicherung.apify_raw_runs_20260915      sicherung.analysis_runs_kosten_20260915
sicherung.daily_digest_tokens_20260915
```

Jede Kopie wurde gegen ihr Original gezählt, alle Zeilenzahlen stimmten überein.
</content>
</invoke>
