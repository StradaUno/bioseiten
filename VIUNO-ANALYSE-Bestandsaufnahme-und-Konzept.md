# viuno Analyse — Bestandsaufnahme und Konzept

**Stand:** 13. September 2026
**Produkt:** „viuno Analyse", einmalig 9,99 € über Stripe (`prod_VEUNSFSahcHv1b`, `price_1UE1ZDLH6NVqx26e8yqbVlgp`, Payment Link `plink_1UE1bdLH6NVqx26efh3B0vfI`)
**Umfang:** Edge Functions, Datenbank, SPA-View, Stripe-Livedaten, Landingpage, Mails, Rechtstexte
**Status:** reine Analyse — nichts geändert.

---

## Kurzfassung vorab

Die Analyse ist technisch weiter als gedacht: eigener Run-Zustandsautomat, Verbrauchslogik pro Kauf, Δ-Felder gegen den Vorlauf, Ergebnis-Mail, Widerrufs-Protokollierung, Media-Kit-Übernahme. Das ist ein echtes Produkt, kein Prototyp.

Es steht aber auf drei Bruchstellen:

1. **Ein Live-Bug blockiert jede Webhook-Antwort.** `analysis-webhook` referenziert `corsHeaders`, ohne es zu definieren — 8 protokollierte `ReferenceError` am 10.09. Die Analyse läuft durch, aber Apify bekommt 500 und stellt erneut zu.
2. **Die Engagement Rate ist die Headline-Zahl und sie ist falsch.** Sie wechselt zwischen zwei Bezugsgrößen, mischt Zähler und Nenner aus verschiedenen Post-Mengen, und produzierte gespeicherte Werte wie **76,42 %**.
3. **Die Rechtstexte sagen, viuno sei kostenlos.** AGB § 6.1, Widerrufsbelehrung und Datenschutz 9.1 widersprechen dem laufenden Verkauf direkt.

Kommerziell: **12 Checkout-Sessions à 9,99 €, davon 1 bezahlt — und das war dein eigener Testkauf.** Es gibt bis heute null echte Kundenkäufe. Das Produkt wird nirgends beworben, wo jemand den Preis sieht, bevor er dahintersteht.

---

# Phase 1: Bestandsaufnahme

## A. Technik und Datenfluss

### A.1 Die beteiligten Edge Functions

| Function | JWT | Rolle im Analyse-Flow |
|---|---|---|
| `stripe-webhook` | nein (Signaturprüfung) | `checkout.session.completed` → Zeile in `analysis_purchases` |
| `start-analysis` | manuell via `getUser(token)` | Kauf-Check, `analysis_runs`-Zeile, zwei Apify-Runs starten |
| `analysis-webhook` | nein | Apify-Callback: Rohdaten holen, `apify_daten` + `analyse_stats` schreiben, Haiku, Kauf verbrauchen, Mail auslösen |
| `send-analysis-email` | nein | „Deine Analyse ist fertig ✓" über Resend |
| `fetch-analytics` | nein | **Legacy** — schreibt `creator_analytics`, gehört zum alten kostenlosen Flow, wird von der Analyse-View nicht mehr genutzt |

### A.2 Ablauf „Kaufen → Ergebnis sichtbar"

```
Creator klickt „Analyse freischalten – 9,99€"   (SPA, renderBtn)
   │
   ├─ Checkbox „Ich stimme zu, dass die Analyse sofort nach Zahlung beginnt…"
   │  muss gesetzt sein, sonst Toast und Abbruch
   ├─ INSERT withdrawal_consents (user_id, consent_text, agreed_at)
   └─ location.href = buy.stripe.com/…?client_reference_id=<uid>
          │
          ▼
   Stripe Checkout  (999 EUR-Cent, card/klarna/paypal/amazon_pay)
          │
          ├─ Erfolg → success_url https://viuno.de/analytics?paid=1
          └─ Abbruch → cancel_url https://stripe.com      ← Bug, siehe C.5
          │
          ▼
   stripe-webhook  (Signatur geprüft, Idempotenz über stripe_webhook_events)
          └─ INSERT analysis_purchases
               {user_id ← client_reference_id, stripe_checkout_session_id,
                stripe_payment_intent_id, amount_paid, currency, purchased_at,
                consumed_at = NULL, analysis_run_id = NULL}
          │
          ▼
   SPA: waitForPurchaseAfterPayment() pollt 8× alle 2 s auf eine Zeile
        mit consumed_at IS NULL  →  „Freigeschaltet ✓"
          │
   Creator klickt „Neue Analyse starten"
          ▼
   start-analysis
     1. SELECT analysis_purchases WHERE user_id=… AND consumed_at IS NULL
        ORDER BY purchased_at ASC LIMIT 1      → sonst HTTP 402 payment_required
     2. SELECT users.instagram_handle, tiktok_handle → sonst Fehler
     3. INSERT analysis_runs {status:'scraping'}
     4. Apify-Runs starten:
          apify~instagram-profile-scraper   { usernames:[h], resultsLimit:12 }
          clockworks~tiktok-scraper         { profiles:[h], resultsPerPage:15, … }
        Webhook-URL je Run: analysis-webhook?userId=&runId=&platform=
     5. UPDATE analysis_runs {instagram_run_id, tiktok_run_id, *_skipped}
          │
          ▼   (pro Plattform ein Callback)
   analysis-webhook
     · Frühabbruch wenn status schon 'done'/'failed'
     · fetchApifyDataset: bis zu 4 Versuche, 6 s Abstand
     · mapInstagramPost / mapTiktokPost → INSERT apify_daten (IG max 12, TT max 15)
     · TikTok: pruneOldestTiktokPosts(3) — die 3 ältesten wieder löschen
     · buildAndSaveStats → extractProfile + computeStats → INSERT analyse_stats
     · UPDATE analysis_runs {*_dataset_id, *_done_at}
     · wenn beide Plattformen fertig → status 'analyzing'
          └─ runHaikuAnalysis
               · users.niche_custom/niche/niche_category laden  ← Bug, siehe A.5
               · je Plattform runHaikuForPlatform:
                   Posts + analyse_stats + vorheriger Lauf → Prompt
                   → claude-haiku-4-5-20251001, max_tokens 3000
                   → INSERT analyse_ki
                   → INSERT ai_usage_log
               · consumePurchaseForUser  ← Kauf wird JETZT erst verbraucht
               · UPDATE analysis_runs {status:'done', haiku_done_at, completed_at}
               · sendResultEmail → send-analysis-email → Resend
          │
          ▼
   SPA pollt analysis_runs alle 5 s → status 'done'
        → loadKi() lädt analyse_ki + analyse_stats (limit 4)
        → renderAnalyticsContent()  → Toast „Analyse fertig ✓"
```

### A.3 Die Tabellen

**`analysis_purchases`** (0 Zeilen) — `id`, `user_id`, `stripe_checkout_session_id` (UNIQUE), `stripe_payment_intent_id`, `amount_paid`, `currency`, `purchased_at`, `consumed_at`, `analysis_run_id`. Teilindex `idx_analysis_purchases_user_unconsumed` auf `(user_id) WHERE consumed_at IS NULL` — genau der Zugriffspfad der Kauf-Prüfung, sauber gelöst.

**`analysis_runs`** (7 Zeilen) — `status` (`pending`/`scraping`/`analyzing`/`done`/`failed`), je Plattform `*_run_id`, `*_dataset_id`, `*_done_at`, `*_skipped`, dazu `haiku_done_at`, `error`, `started_at`, `completed_at`.

**`apify_daten`** (156 Zeilen) — die Rohposts: `post_id`, `post_url`, `caption`, `posted_at`, `likes`, `comments`, `shares`, `views`, `play_count`, `hashtags`, `mentions`, `media_type`, `duration_seconds`, `thumbnail_url`, `video_url`, **`raw_data` (komplettes Apify-JSON)**.

**`analyse_stats`** (13 Zeilen) — die berechneten Kennzahlen, inkl. `followers_prev/_change`, `avg_likes_prev/_change`, `engagement_rate_prev/_change`.

**`analyse_ki`** (9 Zeilen) — die Haiku-Ausgabe: `top_posts`, `was_gut_lief`, `verbesserungspotenzial`, `top_posts_gemeinsamkeiten`, `caption_struktur`, `analyse_ueberblick`, `tipps_zukunft`, `weitere_insights`, `vergleich_vorherige`, `raw_haiku_response`.

**`stripe_webhook_events`** (1 Zeile), **`withdrawal_consents`** (1 Zeile), **`ai_usage_log`** (41 Zeilen), **`creator_analytics`** (9 Zeilen, Legacy).

### A.4 Welche Rohdaten geholt werden — und was davon ankommt

**Instagram** (`apify~instagram-profile-scraper`, `resultsLimit: 12`)

| Feld | Quelle | Wird ausgewertet? |
|---|---|---|
| `followersCount`, `followsCount`, `postsCount`, `verified` | Profil | ✅ in `analyse_stats` |
| `biography`, `fullName`, `profilePicUrlHD` | Profil | ⚠️ gespeichert, **nirgends angezeigt oder ausgewertet** |
| `businessCategoryName` | Profil | ⚠️ nur in `raw_profile`, ungenutzt |
| `likesCount`, `commentsCount` | Post | ✅ |
| `videoViewCount`/`videoPlayCount` | nur Video/Reel | ✅ (Carousels liefern keine) |
| `caption` | Post | ✅ (auf 280 Zeichen gekürzt in den Prompt) |
| `hashtags` | Post | ⚠️ nur die der **Top-3-Posts**, sonst ungenutzt |
| `mentions` | Post | ❌ berechnet (`top_mentions`), aber **in der UI nirgends angezeigt** |
| `timestamp` | Post | ✅ für Beste-Zeit und Posting-Frequenz |
| `videoDuration` | Video | ✅ `avg_video_duration` (nur im Prompt, nicht in der UI) |
| `displayUrl`, `videoUrl` | Post | ❌ gespeichert, **nie angezeigt** — keine Thumbnails im Ergebnis |
| gesamtes `raw_data` | Post | ❌ vollständig gespeichert, nie wieder gelesen |

**TikTok** (`clockworks~tiktok-scraper`, `resultsPerPage: 15` → 3 älteste werden gelöscht → 12 bleiben)

Zusätzlich zu Instagram: `shareCount` (→ `avg_shares`, ✅ angezeigt), `heart`/`heartCount` (→ `total_hearts`, ⚠️ nur im Prompt), `playCount` für **alle** Videos.

**Ungenutztes Potenzial in einem Satz:** Thumbnails, Bio-Text, Business-Kategorie, Mentions, alle Hashtags jenseits der Top-3 und das komplette `raw_data` liegen bereits in der Datenbank und kosten keinen neuen Scraping-Call.

### A.5 Wie die Auswertung entsteht — regelbasiert plus LLM

**Regelbasiert** (`computeStats` in `analysis-webhook`) liefert: `avg_likes`, `avg_comments`, `avg_views`, `avg_shares`, `avg_video_duration`, `top_format` (bestes Ø-Likes-Format mit ≥2 Posts), `best_posting_hour`/`best_posting_day`, `top_hashtags`, `top_mentions`, `posts_per_week`, `max_likes`/`min_likes`, `engagement_rate` sowie die drei Δ-Werte gegen den letzten Lauf.

**LLM:** `claude-haiku-4-5-20251001`, ein Call **pro Plattform**, `max_tokens: 3000`, JSON-erzwungen über System-Prompt plus Nachsatz. Der Prompt ist gut gebaut — er enthält explizite Verbote, die aus echten Fehlern gelernt sind:

- keine visuellen Aussagen (das Modell sieht keine Bilder)
- „Erwähne NIEMALS, dass Posts keine Views haben" (Carousels)
- keine generische Hashtag-Strategie
- keine erfundenen Prozent-Schätzungen
- keine Spekulation über alte Posts beim Verlaufsvergleich

**Kosten pro Lauf, aus `ai_usage_log` gerechnet (echte Werte, ohne die Fehlläufe):**

| Posten | Betrag |
|---|---|
| Haiku Instagram, Ø aus 7 Läufen | $0,0127 |
| Haiku TikTok, Ø aus 5 Läufen | $0,0129 |
| **Modell gesamt (beide Plattformen)** | **≈ $0,026** |
| Apify IG-Profil-Scraper, 1 Result | ≈ $0,002 *(geschätzt, bitte in deiner Apify-Abrechnung gegenprüfen)* |
| Apify TikTok-Scraper, 15 Videos | ≈ $0,005–0,008 *(geschätzt)* |
| **Produktionskosten gesamt** | **≈ $0,035 ≈ 3,2 Cent** |
| Stripe-Gebühr auf 9,99 € (Karte ~1,5 % + 0,25 €) | ≈ 0,40 € |
| Stripe-Gebühr PayPal/Klarna (~2,99 % + 0,35 €) | ≈ 0,65 € |

**Das Entscheidende: die Stripe-Gebühr ist das 12- bis 20-Fache der Produktionskosten.** Deckungsbeitrag pro Verkauf ≈ **9,35–9,55 €**. Der Preis ist damit vollständig eine Wert- und Positionierungsfrage, keine Kostenfrage. Selbst 2,99 € wären noch hochprofitabel.

Zum Vergleich: ein `daily_digest`-Lauf kostet $0,41 — **16× so viel wie eine verkaufte Analyse.** Das kostenlose Feature ist das teure.

### A.6 Fehlerfälle

| Fall | Verhalten heute | Kauf verbraucht? | Bewertung |
|---|---|---|---|
| Kein Handle hinterlegt | `start-analysis` wirft; SPA öffnet vorher das Handle-Modal | nein | ✅ sauber |
| Falscher/nicht existenter Handle | Apify-Run startet, Dataset bleibt leer → `insertedCount = 0` → keine Stats → später „Keine Posts fuer Analyse" → `status: failed` | **nein** | ✅ Kauf bleibt, aber Fehlertext ist technisch |
| Privates Profil | wie oben (Scraper liefert nichts) | nein | ⚠️ Der User erfährt nicht, *warum* |
| Apify-Start scheitert (beide) | `status: failed`, Fehler „Apify-Runs konnten nicht gestartet werden" | nein | ✅ |
| Haiku scheitert (beide Plattformen) | `successCount === 0` → `status: failed` | **nein** | ✅ bewusst so gebaut, Kommentar im Code belegt es |
| Haiku scheitert bei **einer** Plattform | Kauf **wird** verbraucht, `status: done`, `error: "Teilweise: …"` | **ja** | ⚠️ Der User bekommt eine halbe Analyse und sieht den Teilfehler nirgends — die SPA zeigt `run.error` nur im `failed`-Zweig |
| Ergebnis-Mail scheitert | nur geloggt, Analyse bleibt gültig | ja | ✅ richtig entkoppelt |
| Doppelter Lauf | `checkActiveRun` findet laufende Runs; ein zweiter Kauf könnte parallel starten | — | ⚠️ keine echte Sperre, aber bei 1 Kauf = 1 Lauf praktisch unkritisch |
| Kauf ohne Lauf | Zeile bleibt ewig mit `consumed_at IS NULL` | — | ✅ Guthaben verfällt nicht |

**Erstattungslogik: existiert nicht.** Weder automatisch noch als Prozess. Bei „Analyse fehlgeschlagen" bleibt die Freischaltung erhalten — das ist der richtige Default und die SPA sagt es auch („deine Freischaltung bleibt erhalten"). Aber es gibt keinen Weg, Geld zurückzugeben, ohne manuell in Stripe zu gehen.

**Tatsächliche Fehlerquote: 2 von 7 Läufen (29 %) sind gescheitert** — beide Male mit `tokens_input: 0`, also ein kompletter Fehlschlag des Anthropic-Calls (Key fehlte oder API-Fehler), nicht ein JSON-Parse-Problem.

### A.7 Stripe: Konfiguration und Zahlen

**Produkt** `prod_VEUNSFSahcHv1b` — „viuno Analyse":
> „Einmalige Analyse deiner Instagram-/TikTok-Performance mit konkreten Handlungsempfehlungen, direkt in deinem viuno-Account. Gemäß § 19 UStG keine Umsatzsteuer."

Gut formuliert und der §-19-Hinweis steht drin, sichtbar im Checkout.

**Session-Konfiguration** (aus der bezahlten Session gelesen):

| Einstellung | Wert | Bewertung |
|---|---|---|
| `success_url` | `https://viuno.de/analytics?paid=1` | ✅ passt zum SPA-Handler |
| `cancel_url` | `https://stripe.com` | ❌ **Abbrecher landen auf stripe.com** |
| `invoice_creation.enabled` | `false` | ⚠️ es entsteht **keine Rechnung**, nur ein Stripe-Beleg |
| `automatic_tax` | aus, `amount_tax: 0` | ✅ konsistent mit Kleinunternehmer |
| `consent_collection.terms_of_service` | `"none"` | ⚠️ keine AGB-Zustimmung im Checkout |
| `custom_text.*` | alles `null` | ⚠️ kein Widerrufs-/AGB-Hinweis im Checkout selbst |
| `payment_method_types` | card, klarna, paypal, amazon_pay | ✅ gute Abdeckung |
| `billing_address_collection` | `auto` — Adresse wurde erhoben | ✅ |
| `metadata` | `{}` | ⚠️ leer; `analysis_run_id`/Quelle wären hier nützlich |

**Idempotenz:** sauber gelöst. `stripe_webhook_events.stripe_event_id` ist UNIQUE, wird vor der Verarbeitung geprüft, und `analysis_purchases.stripe_checkout_session_id` ist zusätzlich UNIQUE mit explizitem „duplicate key"-Handling. Signaturprüfung über `constructEventAsync` mit `SubtleCryptoProvider` — für Deno korrekt gelöst. Bei Fehlern 500, damit Stripe erneut zustellt. **Das ist gut gebaut.**

**Die Zahlen (Live-Account `acct_1S5Vx4LH6NVqx26e`, alle 9,99-€-Sessions erfasst):**

| Datum | client_reference_id | Ergebnis |
|---|---|---|
| 10.09. 06:27 / 06:29 / 06:32 | *keine* | expired |
| 10.09. 07:42 – 08:24 (7 Sessions) | `5769bc5f-…` | alle expired |
| **10.09. 08:26** | `df44367b-…` | **bezahlt, 9,99 €, mehmet94e@icloud.com** |
| 11.09. 07:52 | `5620b0b6-…` (Antonietta) | expired |

- **12 Checkout-Sessions gestartet, 1 bezahlt → Conversion 8,3 %**
- Der eine bezahlte Kauf ist **dein eigener Test**. **Echte Kundenkäufe: 0.**
- Die 7 Sessions von `5769bc5f-…` sind erkennbar Testläufe (Minutenabstand).
- `5769bc5f-…` und `df44367b-…` existieren **weder in `public.users` noch in `auth.users`** — beides gelöschte Testaccounts.
- Die Session vom 11.09. 07:52 korrespondiert exakt mit der einzigen `withdrawal_consents`-Zeile (07:52:37): **eine Widerrufs-Zustimmung ohne zugehörigen Kauf.** Das ist systembedingt so — die Zustimmung wird *vor* der Weiterleitung protokolliert.
- Die 81 Sessions à 12,99 € und 7 à 5,00 € aus Februar/März gehören zu einem anderen StradaUno-Produkt, nicht zu viuno.

### A.8 Bestand

- **7 Analyse-Läufe** insgesamt (29.04. bis 09.09.2026), davon 5 erfolgreich, 2 gescheitert.
- **4 verschiedene User**, alle im `free`-Tarif.
- **Mehrfach-„Käufe" gab es nie** — alle Läufe stammen aus der kostenlosen Vorgängerlogik (`users.analyse_moeglich` als Cooldown-Datum, Spalte existiert noch).
- Zeitspanne zwischen Läufen desselben Users: 29.04. → 30.04. (**1 Tag**), 30.04. → 23.05. (23 Tage), 23.05. → 09.09. (109 Tage). Kein erkennbares Muster; der 1-Tages-Abstand zeigt, dass ohne Preis auch ohne Erkenntnisgewinn nachgeschossen wird.
- `analysis_purchases` ist leer, weil die Testaccounts gelöscht wurden. **Achtung:** `analysis_purchases.user_id` hat **keinen Fremdschlüssel** (anders als `analysis_runs`, `analyse_stats`, `analyse_ki`, `apify_daten`, die alle `ON DELETE CASCADE` haben). Kaufzeilen überleben eine Accountlöschung also eigentlich — die Zeile muss manuell gelöscht worden sein.

---

## B. Was wir daraus machen — das Ergebnis

### B.1 Die Bausteine der Ergebnisansicht, ehrlich bewertet

| Baustein | Quelle | Logik | Echte Erkenntnis? |
|---|---|---|---|
| **KPI: Follower** | `analyse_stats.followers` | direkt aus dem Profil | **Umformulierte Zahl.** Steht in jeder App. |
| **KPI: Ø Likes** | `avg_likes` | Mittel über 12 Posts | **Umformulierte Zahl**, aber nützlich als Bezugspunkt |
| **KPI: Engagement Rate** | `engagement_rate` | siehe unten | **Falsch berechnet** — siehe B.2 |
| **KPI: Ø Views / Ø Kommentare** | `avg_views`/`avg_comments` | Mittel, Views nur über Posts mit Views | **Zahl**, Fallback-Logik ist sinnvoll |
| **Timing: Beste Zeit** | `best_posting_day/hour` | Top-50 % der Posts nach Likes → häufigste Stunde/Tag in Berlin-Zeit | **Halbe Erkenntnis.** Bei 12 Posts sind das 6 Datenpunkte für 24 Stunden × 7 Tage. Statistisch nicht tragfähig, wird aber als Fakt präsentiert. |
| **Timing: Top Format** | `top_format` | höchstes Ø-Likes unter Formaten mit ≥2 Posts | **Erkenntnis, aber verzerrt.** Vergleicht Video (hat Views) gegen Sidecar (hat keine) allein über Likes — und IG-Videos haben strukturell mehr Likes. Ergebnis ist fast immer „Video". In 12 von 13 Läufen steht tatsächlich „Video". |
| **Timing: Posts/Woche** | `posts_per_week` | Posts der letzten 30 Tage / Zeitspanne × 7 | **Echte, saubere Zahl.** |
| **Timing: Ø Shares** | `avg_shares` | nur TikTok | **Zahl** |
| **Analyse-Überblick** | `analyse_ueberblick` | Haiku, 2–3 Absätze | **Gemischt.** Bei den gelesenen Läufen 488–932 Zeichen, mit echten Zahlen. Die Prompt-Verbote verhindern das Schlimmste. |
| **Top-Beiträge** | `top_posts` | Haiku, Top 3 nach Likes + „warum_top" | **Echte Erkenntnis**, der stärkste Baustein — aber **ohne Thumbnail**, obwohl `thumbnail_url` in der DB liegt. |
| **Was gut läuft / Wo du wachsen kannst** | `was_gut_lief`, `verbesserungspotenzial` | Haiku | **Der Kern des Produkts.** Steht und fällt mit dem Modell. |
| **Content-Muster** | `top_posts_gemeinsamkeiten`, `caption_struktur` | Haiku | **Echte Erkenntnis** — das, was ein Creator selbst nicht sieht |
| **Nächste Schritte** | `tipps_zukunft` | Haiku, 4 Tipps | **Echte Erkenntnis**, konsistent 4 Stück in allen Läufen |
| **Weitere Erkenntnisse** | `weitere_insights` | Haiku, optional | oft leer |
| **Entwicklung** | `vergleich_vorherige` | Haiku, nur bei Vorlauf | **Echte Erkenntnis, wenn sie kommt** — nur 2 von 9 `analyse_ki`-Zeilen haben sie |
| **Teilen-Snapshot** | `shareAnalytics()` | Textblock + „👉 viuno.de" | **Cleveres Wachstumsinstrument**, aber es teilt die falsche ER |
| **Verlauf** | — | **existiert nicht** | ❌ Es gibt keinen Chart, keine Zeitreihe, keine Liste vergangener Analysen |
| **Export (PDF)** | — | **existiert nicht** | ❌ |

**Zusammengezählt:** Von 15 Bausteinen sind 5 reine Zahlenwiedergabe, 4 sind halbe Erkenntnisse mit methodischen Schwächen, und 6 sind echte Erkenntnis — und die 6 kommen alle aus demselben Haiku-Call. **Das Produkt ist ein LLM-Text mit Kennzahl-Rahmen.** Das ist nicht schlimm, aber es heißt: die Qualität des Prompts *ist* die Qualität des Produkts.

### B.2 Die Engagement Rate — der wichtigste inhaltliche Fehler

```js
const erBase = (avgViewsNow !== null && avgViewsNow > 0) ? avgViewsNow : followersNow
const er = erBase > 0 ? (avgLikesNow + avgCommentsNow) / erBase * 100 : 0
```

Drei Probleme übereinander:

**1. Zähler und Nenner stammen aus verschiedenen Post-Mengen.** `avg_likes` mittelt über **alle** Posts. `avg_views` mittelt nur über Posts **mit** Views. Bei Instagram liefern Carousels/Sidecars keine Views — im Bestand: 62 Videos mit Views, 22 Sidecars ohne. Lauf `23047f7e` hat 12 Posts, davon 6 mit Views: `avg_likes` kommt aus 12 Posts, `avg_views` aus 6. Der Quotient ist arithmetisch bedeutungslos.

**2. Die Bezugsgröße wechselt.** Von 13 gespeicherten `analyse_stats`-Zeilen wurden **12 gegen Follower** gerechnet und **1 gegen Views** — die neueste (`d689f0c7`, 09.09. 19:36). Die Views-Variante wurde also zwischen 17:12 und 19:36 am 09.09. deployt. Dieselbe Zahl im selben Feld bedeutet je nach Zeile etwas anderes.

**3. Daraus folgt ein garantiert falscher Trend.** `engagement_rate_change` vergleicht einen Follower-basierten Wert mit einem Views-basierten:

| Lauf | Plattform | gespeicherte ER | ER wenn Follower-Basis | ER wenn Views-Basis |
|---|---|---|---|---|
| `f0fd2bc2` | TikTok | **76,42 %** | 76,42 % | 3,38 % |
| `cb3864c9` | TikTok | **70,26 %** | 70,26 % | 3,41 % |
| `f0fd2bc2` | Instagram | 22,63 % | 22,63 % | 1,84 % |
| `d689f0c7` | Instagram | 5,47 % | 4,11 % | **5,47 %** |

**Konkretes Ausfallszenario:** Antonietta kauft die nächste Analyse. Ihr letzter TikTok-Wert ist 76,42 % (Follower-Basis). Der neue wird mit der Views-Basis gerechnet und landet bei ~3,4 %. Die KPI-Kachel zeigt dann **„↓ 73,02 %"** in Rot, der Haiku-Prompt bekommt `(-73.02%)` als Fakt geliefert und schreibt einen Absatz über den dramatischen Einbruch — in eine Analyse, für die sie 9,99 € bezahlt hat. Und der Teilen-Snapshot verbreitet die Zahl auf Instagram.

Zusätzlich: **76,42 % Engagement Rate ist für jeden, der die Branche kennt, offensichtlich Unsinn** (Micro-Creator liegen bei 3–8 %). Ein Brand, dem so ein Media Kit vorgelegt wird, hält es für manipuliert — und die Zahl **wird** ins Media Kit übernommen.

### B.3 Zweiter Rechenfehler: der Handle-Wechsel

`buildAndSaveStats` sucht den Vorlauf über `user_id + platform`, **nicht** über den Username. Antonietta hat ihren TikTok-Handle von `antonietta_chiquita` (10.500 Follower) auf `antoniettadigraci` (1.212 Follower) geändert. Ergebnis in der DB: `followers_change: -9288`. Das ging als Fakt in den Haiku-Prompt („−9288 vs. letzter Run") und hätte als „↓ 9.288 **diese Woche**" in der KPI-Kachel gestanden.

### B.4 Drittes Problem: „diese Woche" stimmt nie

Die KPI-Kachel beschriftet `followers_change` fix mit **„diese Woche"** — sowohl in der Analyse-View als auch auf der Dashboard-Kachel und im Teilen-Text. Der Wert ist aber die Differenz zum letzten Lauf, und die lagen im Bestand 1, 23 und 109 Tage auseinander. Bei einem Kaufprodukt, das man alle paar Monate bucht, ist „diese Woche" strukturell falsch.

### B.5 Vergleich mit dem Markt

Der relevante Vergleich sind **nicht** HypeAuditor und Modash — das sind Brand-Tools bei 199–499 $/Monat, die Creator suchen. Der relevante Vergleich ist das, was ein Micro-Creator wirklich benutzt:

| Angebot | Preis | Was sie haben, das wir nicht haben |
|---|---|---|
| **Instagram Insights** | kostenlos | Reichweite vs. Follower/Nicht-Follower, **Saves**, Profilaufrufe, **Audience-Demografie** (Alter, Geschlecht, Orte), Story-Metriken, aktive Zeiten der *echten* Follower |
| **Not Just Analytics** | kostenlos (Basis) | **Authenticity-Score**, Follower-Wachstumskurve über Monate, „Engagement Quality"-Rating |
| **Metricool** | Free-Tier: 1 Marke, 20 Posts/Mon., **5 Konkurrenzprofile** | **Konkurrenzvergleich**, Posting-Planer, Best-Time-Heatmap über Monate statt 12 Posts |
| **Iconosquare** | ~49 $/Mon. aufwärts | **Branchen-Benchmarks**, automatisierte Reports, Follower-Qualität |
| **HypeAuditor** | ~299 $/Mon. | Fake-Follower-Erkennung, Audience-Demografie, Brand-Affinität |
| **Inflact** | Freemium | schneller öffentlicher Profil-Check |

**Was die haben und wir nicht — machbar mit unseren vorhandenen Rohdaten, ohne neue Datenquelle:**

1. **Konkurrenz-/Nischenvergleich** — `competitor_accounts` (8 Zeilen) und die Function `fetch-competitor-accounts` existieren bereits ungenutzt. `niche_mappings` (75 Keyword→Kategorie-Zeilen) ebenfalls.
2. **Verlaufskurve** — jede Analyse legt eine `analyse_stats`-Zeile an. Die Zeitreihe *ist* da, sie wird nur nie gezeichnet.
3. **Format-Vergleich mit korrekter Basis** — `media_type` liegt pro Post vor.
4. **Hashtag-Wirkung** — alle Hashtags aller Posts liegen vor, genutzt werden nur die der Top 3.
5. **Caption-Länge vs. Performance** — Caption liegt vollständig vor.
6. **Video-Länge vs. Views** — `duration_seconds` liegt vor, wird berechnet, aber nicht angezeigt.

**Was wir nicht liefern können, ohne die offizielle API:** Saves, Reichweite, Profilaufrufe, Audience-Demografie, Story-Daten. Das sind genau die Zahlen, die Instagram Insights kostenlos zeigt. **Das muss die Kommunikation berücksichtigen** — wir konkurrieren nicht mit Insights, wir ergänzen es um das, was Insights *nicht* kann: Einordnung, Vergleich, Text.

### B.6 Wiedererkennbarkeit beim zweiten Kauf

Teilweise vorhanden, aber nicht sichtbar gemacht:

**Vorhanden:** `followers_prev/_change`, `avg_likes_prev/_change`, `engagement_rate_prev/_change` werden berechnet und gespeichert. Der Haiku-Prompt bekommt einen History-Block mit den alten Zahlen **und den alten Tipps** und soll prüfen, ob sie umgesetzt wurden — das ist konzeptionell stark. Der Abschnitt „Entwicklung" rendert das Ergebnis.

**Nicht vorhanden:**
- Kein Verlauf, keine Kurve, keine Liste vergangener Analysen. `loadKi()` lädt `limit(4)` und zeigt nur die neueste je Plattform.
- Kein „seit deiner letzten Analyse am …"-Bezug in der Oberfläche.
- Die Δ-Werte erscheinen nur als kleine Zeile unter zwei KPI-Kacheln — und eine davon (ER) ist falsch, die andere falsch beschriftet.
- Die alten `analyse_ki`-Zeilen bleiben in der DB, sind aber für den User unerreichbar.

**Antwort auf die Frage:** Der zweite Kauf fühlt sich zu **80 % wie ein isolierter Schnappschuss** an. Die Verlaufsdaten existieren, der Prompt nutzt sie — die Oberfläche verschweigt sie. Das ist der teuerste Widerspruch im ganzen Feature, weil Wiederkauf genau davon abhängt.

---

## C. Wie wir es darlegen — Präsentation

### C.1 Vor dem Kauf, in der App

| Ort | Text heute | Preis sichtbar? |
|---|---|---|
| Sidebar | „Analyse" | nein |
| Dashboard, Einrichten-Karte | „Analyse starten — Sieh, was deine Beiträge leisten" | **nein** |
| Analytics-Empty-State (kein Handle) | „Kein Instagram-Handle — Verknüpfe deinen Kanal um die Analyse nutzen zu können." | nein |
| Analytics-Empty-State (Handle, keine Analyse) | „Noch keine Analyse — Starte deine erste Analyse um deine Instagram-Performance zu sehen." | **nein, und kein Button** |
| Hauptbutton | „Analyse freischalten – 9,99€" / Sub: „Einmalige Freischaltung pro Analyse" | **ja** |
| Onboarding | **kommt gar nicht vor** | — |

**Der Preis erscheint an genau einer Stelle: dem Button selbst.** Jeder Weg dorthin verspricht implizit etwas Kostenloses. Der Empty-State „Starte deine erste Analyse" hat nicht einmal einen Button — der Startknopf steht weiter oben, oberhalb der Plattform-Tabs.

**Was der Text verspricht vs. was geliefert wird:**

- „Sieh, welche Posts wirklich performen" → ✅ wird geliefert (Top-Beiträge)
- „Sieh, was deine Beiträge leisten" → ✅ wird geliefert
- „deine Instagram-Performance sehen" → ⚠️ suggeriert Instagram-Insights-artige Reichweitendaten, die wir nicht haben

Das Versprechen ist ehrlich. Es ist nur **zu klein** für 9,99 € — es verspricht Zahlen, geliefert wird eine Auswertung. Der wertvollste Teil (Content-Muster, Caption-Struktur, 4 konkrete Tipps, Vergleich zum Vorlauf) wird **nirgends angekündigt**.

**Beispiel-Analyse oder Vorschau vor dem Kauf: existiert nicht.** Niemand sieht je, wie ein Ergebnis aussieht, bevor er zahlt. Bei einem Produkt, dessen Wert ausschließlich im Ergebnistext liegt, ist das die größte einzelne Conversion-Bremse.

### C.2 Auf viuno.de

Die Analyse ist eine von vier gleichwertigen Kacheln im Hauptraster, unter der Überschrift „Deine Creator-Toolbox. Ohne Schnickschnack."

**Screenshot-Bewertung:**

Die Kachel „Analyse starten / Sieh, welche Posts wirklich performen" steht rechts oben, gleichberechtigt neben „BioLink erstellen", darunter „Creator News" und „Media Kit". Visuell: dieselbe Kachelgröße, dieselbe Typografie, dasselbe Icon-Gewicht, dieselbe Hover-Anmutung. Die Mini-Visualisierung rechts (Balkendiagramm mit „12,4k Follower") ist hübsch und lesbar, und sie ist das Einzige, was andeutet, wie ein Ergebnis aussieht.

**Das Problem ist die Gleichheit.** Drei der vier Kacheln führen zu kostenlosen Features, eine zu einem Bezahlprodukt — und nichts unterscheidet sie. Kein Preis, kein Badge, keine andere Farbe, keine Hervorhebung. Ein Besucher klickt „Analyse starten", landet auf `/analytics`, muss sich einloggen oder registrieren, muss ein Handle hinterlegen — und *dann* erfährt er, dass es 9,99 € kostet. Das ist die schlechtestmögliche Reihenfolge: maximaler Aufwand vor der Preisinformation.

Auf der gesamten Landingpage kommt **kein einziges Mal** ein Preis, ein „€", „kostenlos" oder „einmalig" vor. Das einzige Feature, mit dem viuno Geld verdient, ist auf der eigenen Website preislich unsichtbar.

### C.3 Nach dem Kauf — welche Mails rausgehen

| Mail | Absender | Wann | Inhalt |
|---|---|---|---|
| Stripe-Zahlungsbeleg | Stripe | sofort nach Zahlung | Standard-Beleg, `invoice_creation` aus → **keine Rechnung** |
| Eigene Kaufbestätigung | — | **existiert nicht** | — |
| „Deine Analyse ist fertig ✓" | `viuno <noreply@viuno.de>` via Resend | nach `status: done` | siehe unten |

**Die Fertig-Mail (`send-analysis-email`) ist gut gemacht:**

- Betreff: „Deine Analyse ist fertig ✓"
- Aufbau: viuno-Logo (26 px Quadrat, `#111110`, weißes „v") → H1 → „Hallo {Name}, hier sind deine Ergebnisse im Überblick." → pro Plattform eine Karte mit Plattform-Badge, 3 KPI-Zellen (Follower, Ø Likes, Engagement), dem `analyse_ueberblick`-Text und bis zu 4 nummerierten Tipps → CTA „Volle Auswertung ansehen" → Footer mit Impressum/Datenschutz
- Tabellenbasiertes HTML, Inline-Styles, `role="presentation"` — mailclient-sicher gebaut
- Farben passen zum Token-Set der App (`#111110`, `#f5f4f2`, `#f0efed`, `#7a7975`, `#e4e4e2`)
- Empfänger: `users.contact_email || users.email`

**Sie liefert also bereits die Top-Erkenntnisse im Mailtext und verlinkt die volle Analyse.** Das ist genau richtig.

**Drei Fehler darin:**

1. **Der CTA-Link zeigt auf `https://viuno.de/analytics`** — die alte Standalone-Seite, nicht `https://viuno.de/app/#/analytics`. Wer die SPA benutzt, landet in einer anderen Oberfläche.
2. Die Mail zeigt die **falsche Engagement Rate** prominent als eine von drei KPI-Zellen.
3. `send-analysis-email` hat `verify_jwt: false` und **keinerlei Authentifizierung**. Wer eine `analysis_run_id` errät oder kennt, kann per POST beliebig oft eine Ergebnis-Mail an den zugehörigen User auslösen. UUIDs sind praktisch nicht erratbar, aber ein Auth-Header oder ein geteiltes Secret gehört da hin.

Die Analyse selbst wird **nicht** per Mail geliefert, sondern verlinkt — mit den Top-Inhalten als Teaser. Richtige Entscheidung.

### C.4 Ergebnis-Darstellung in der App

**Hierarchie von oben nach unten:** Start-Button → (Widerrufs-Checkbox) → (Zahlungs-Banner) → (Status-Flow) → Plattform-Tabs → KPI-Raster → Timing-Kacheln → Analyse-Überblick → Top-Beiträge → Auswertung → Content-Muster → Nächste Schritte → Weitere Erkenntnisse → Entwicklung → Teilen-Button.

**Steht die wichtigste Erkenntnis oben? Nein.** Oben stehen vier Zahlen, die der Creator schon kennt (Follower, Ø Likes, ER, Ø Views), plus vier Timing-Kacheln. Das, wofür er bezahlt hat — „Was deine Top-Posts gemeinsam haben", die 4 konkreten Tipps, der Vergleich zur letzten Analyse — steht **ganz unten**, nach fünf bis sechs Bildschirmhöhen Scrollen auf dem Handy. Der Abschnitt „Entwicklung", der als einziger den Wiederkauf rechtfertigt, ist der **allerletzte** vor dem Teilen-Button.

**Weiteres:**
- **Mobile:** durchgehend mobil gedacht (`--safe-bottom`, Kachelraster, Modal als Vollbild). ✅
- **Status-Flow während des Laufs:** gut gelöst — benannte Schritte („Instagram-Beiträge werden abgerufen"), Spinner, 5-Sekunden-Polling. **Aber: keine Zeitangabe.** Aus den Daten: 42 s bis 113 s, im Mittel ~75 s. Es steht nur „Bitte warte einen Moment…". Nach 90 Sekunden ohne Fortschrittsbalken vermuten Leute einen Fehler.
- **Teilen:** `navigator.share` mit Clipboard-Fallback, Text endet auf „Analysiert mit viuno. 👉 viuno.de". Clever. Teilt aber die falsche ER und „(+X diese Woche)".
- **Export/PDF:** existiert nicht. Für ein Bezahlprodukt, dessen Ergebnis man einem Brand zeigen will, fehlt das spürbar.
- **Keine Thumbnails** bei den Top-Beiträgen, obwohl `thumbnail_url` in `apify_daten` steht. Drei Textzeilen, wo drei Bilder stehen könnten — das ist der billigste verfügbare Qualitätssprung.

### C.5 Rechtliches — nur Befund, keine Rechtsberatung

**§ 356 Abs. 5 BGB verlangt drei Dinge. Zwei sind da, eines fehlt.**

Die eigene Widerrufsbelehrung in `legal_texts.widerruf` nennt die drei Bedingungen korrekt:

1. ✅ **Ausdrückliche Zustimmung zum vorzeitigen Beginn** — Checkbox in der SPA, wird in `goToPayment()` erzwungen.
2. ✅ **Bestätigung der Kenntnis des Rechtsverlusts** — der Checkbox-Text lautet wörtlich: „Ich stimme zu, dass die Analyse sofort nach Zahlung beginnt, und verliere damit mein 14-tägiges Widerrufsrecht." Wird mit Zeitstempel in `withdrawal_consents` protokolliert. Vorbildlich.
3. ❌ **„wir dir eine Bestätigung des Vertrags mit dem Hinweis auf das Erlöschen des Widerrufsrechts in Textform zur Verfügung gestellt haben"** — **das passiert nirgends.** Es gibt keine eigene Kaufbestätigungs-Mail. Der Stripe-Beleg enthält den Hinweis nicht. Die Fertig-Mail enthält ihn nicht.

**Die Rechtstexte widersprechen dem laufenden Verkauf an drei Stellen:**

- **AGB § 6.1:** „Die Nutzung der App ist **derzeit kostenlos**. Der Anbieter behält sich vor, künftig kostenpflichtige Funktionen einzuführen."
- **Widerrufsbelehrung, Eingangshinweis:** „Die Nutzung von viuno ist **derzeit kostenlos**. Sollten in Zukunft kostenpflichtige Funktionen angeboten werden, erhältst du vor jedem entgeltlichen Vertragsabschluss eine **separate Widerrufsbelehrung**." — diese separate Belehrung existiert nicht; die Checkbox ist eine Zustimmung, keine Belehrung.
- **Datenschutz 9.1:** „Bezahlte Bestellungen werden aus steuerrechtlichen Aufbewahrungspflichten heraus pseudonymisiert aufbewahrt. **Aktuell werden keine kostenpflichtigen Leistungen angeboten.**"

**Kleinunternehmer-Hinweis:**
- ✅ Im **Impressum**: „Umsatzsteuerbefreit (Kleinunternehmerregelung)"
- ✅ In der **Stripe-Produktbeschreibung**: „Gemäß § 19 UStG keine Umsatzsteuer." — sichtbar im Checkout
- ❌ **Auf keiner Rechnung**, weil `invoice_creation.enabled = false` — es entsteht gar keine Rechnung, nur ein Stripe-Beleg

**AGB-Bezug im Bestellprozess:** `consent_collection.terms_of_service = "none"`, `custom_text` durchweg `null`. Im Checkout wird weder auf AGB noch auf Widerruf verwiesen. AGB § 6.2 sagt, es gälten „die dann jeweils im Bestellprozess ausgewiesenen Konditionen" — im Bestellprozess ist außer der Produktbeschreibung nichts ausgewiesen.

**Datenschutz zur Analyse selbst: ist gut.** Abschnitte 3.4, 4.6(b) und 5.4(b) beschreiben Apify, Anthropic, die übermittelten Felder, Drittlandtransfer über Standardvertragsklauseln und „nicht zum Training" korrekt und vollständig. Das ist sorgfältig gemacht.

**Lücke beim Scraping fremder Profile:** Ein User kann in `users.instagram_handle` **jeden beliebigen** Handle eintragen — es gibt keine Eigentümerprüfung. Die Media-Kit-Nutzungsbedingungen enthalten die Zusicherung „Du bestätigst, dass die angezeigten Werte aus deinen tatsächlichen, eigenen Profilen stammen"; **für die Analyse gibt es keine entsprechende Zusicherung.** Faktisch ist das Feature damit ein Konkurrenz-Scraper für 9,99 €.

---

# Phase 2: Konzept

## 1. Ergebnis-Qualität — die fünf wertvollsten Ergänzungen

Alle fünf sind ohne neue Datenquelle und ohne zusätzliche Scraping-Kosten machbar.

### 1.1 Verlauf sichtbar machen — Kurve plus Archiv
**Nutzen:** Der Creator sieht zum ersten Mal, ob sich etwas bewegt hat. Das ist das einzige Argument für einen zweiten Kauf, und es steht bereits vollständig in der Datenbank.
**Datenbasis:** `analyse_stats` — eine Zeile pro Lauf und Plattform, mit `created_at`, `followers`, `avg_likes`, `engagement_rate`, `posts_per_week`.
**Umsetzung:** Abschnitt „Deine Entwicklung" mit einer schlichten SVG-Linie über alle Läufe (Follower und ER), darunter eine Liste „Frühere Analysen" mit Datum, die die alte `analyse_ki`-Zeile aufklappt.
**Aufwand:** mittel (SPA-seitig, `loadKi()` von `limit(4)` auf vollständige Historie umstellen).
**Vorbedingung:** ER muss vorher korrekt und einheitlich sein, sonst zeichnet die Kurve einen Sprung von 76 % auf 3 %.

### 1.2 Nischen-Benchmark aus eigenen Daten
**Nutzen:** „Deine ER von 4,2 % liegt über dem Schnitt von 3,1 % in Lifestyle bei 5–15k Followern." Das ist die Aussage, die Instagram Insights strukturell nicht liefern kann — und die einzige, für die ein Creator wirklich zahlt.
**Datenbasis:** `analyse_stats` aller User + `users.niche_category` + `niche_mappings` (75 Zeilen liegen bereit), zusätzlich `competitor_accounts` (8 Zeilen, bereits befüllt, Function `fetch-competitor-accounts` existiert).
**Ehrliche Einschränkung:** Mit 4 Usern und 13 Zeilen gibt es noch keinen Benchmark. Das ist ein Feature, das erst ab ~30 Analysen je Nische trägt.
**Zwischenlösung, die sofort geht:** Benchmark gegen `competitor_accounts` desselben Users statt gegen eine Grundgesamtheit — „Deine ER liegt über 5 von 8 vergleichbaren Accounts in deiner Nische."
**Aufwand:** klein für die Zwischenlösung, groß für den echten Benchmark.

### 1.3 Format- und Längen-Auswertung mit sauberer Basis
**Nutzen:** „Deine Reels mit 15–25 s Länge holen im Schnitt 3,1× so viele Views wie die über 45 s." Das ist konkret, umsetzbar und niemand sonst sagt es dem Creator.
**Datenbasis:** `apify_daten.media_type`, `duration_seconds`, `views`, `likes` — alles vorhanden. `avg_video_duration` wird bereits berechnet und dann **nur an den Prompt gegeben, nie angezeigt**.
**Wichtig:** Formate nur innerhalb derselben Metrik vergleichen (Video gegen Video über Views, Carousel gegen Carousel über Likes) — genau der Fehler, den `top_format` heute macht.
**Aufwand:** klein.

### 1.4 Top-Beiträge mit Bild
**Nutzen:** Der wertvollste Abschnitt wird sofort erfassbar. Drei Thumbnails schlagen drei Textzeilen.
**Datenbasis:** `apify_daten.thumbnail_url` — liegt seit dem ersten Lauf ungenutzt in der DB.
**Vorbehalt:** Instagram-CDN-URLs laufen nach einigen Wochen ab. Für eine frische Analyse unproblematisch, für den Verlauf müsste man sie in den Supabase-Storage spiegeln.
**Aufwand:** klein.

### 1.5 Posting-Frequenz gegen Wachstum
**Nutzen:** „Du hast im letzten Monat 7,7 Posts/Woche veröffentlicht statt 5,5 wie davor — deine Follower sind in der Zeit um 62 gewachsen." Beantwortet die Frage, die jeder Creator hat: Bringt mehr posten etwas?
**Datenbasis:** `analyse_stats.posts_per_week` und `followers` über mehrere Läufe.
**Einschränkung:** braucht mindestens zwei Läufe — greift also erst beim zweiten Kauf. Genau deshalb ist es gut: es ist ein Grund, wiederzukommen.
**Aufwand:** klein, sobald 1.1 steht.

---

## 2. Preis — Entscheidungsgrundlage

### 2.1 Unsere Kosten

| Posten | pro Lauf |
|---|---|
| Haiku, beide Plattformen | $0,026 (gemessen) |
| Apify, beide Plattformen | ~$0,009 (geschätzt) |
| **Produktion gesamt** | **~$0,035 ≈ 3,2 Cent** |
| Stripe-Gebühr bei 9,99 € | 0,40 € (Karte) bis 0,65 € (PayPal/Klarna) |
| **Deckungsbeitrag bei 9,99 €** | **~9,35–9,55 €** |

Die Kosten sind bei jedem denkbaren Preis irrelevant. **Die einzige Kostengröße, die sich mit dem Preis ändert, ist die Stripe-Grundgebühr von 0,25–0,35 € — und die trifft niedrige Preise überproportional.** Bei 2,99 € gehen ~16 % an Stripe, bei 9,99 € ~4 %, bei 24,99 € ~2 %. Das spricht gegen Kleinstpreise und für Pakete.

### 2.2 Was der Markt nimmt

| Angebot | Preis | pro Analyse gerechnet |
|---|---|---|
| Instagram Insights | 0 € | 0 € |
| Not Just Analytics (Basis) | 0 € | 0 € |
| Metricool Free (1 Marke, 5 Konkurrenten) | 0 € | 0 € |
| Inflact | Freemium | — |
| Iconosquare | ab ~49 $/Mon. | ~49 $ |
| Modash Essentials | 199 $/Mon. jährlich | Brand-Tool, nicht vergleichbar |
| HypeAuditor Basic | ~299 $/Mon. jährlich | Brand-Tool, nicht vergleichbar |
| **viuno Analyse** | **9,99 € einmalig** | **9,99 €** |

**Die ehrliche Einordnung:** Zwischen „kostenlos" und „49 $/Monat" klafft eine Lücke, und wir sitzen darin allein. Das ist eine Chance und ein Risiko zugleich — es gibt keinen Ankerpreis, an dem der Creator 9,99 € messen kann, also misst er gegen null.

**Was Micro-Creator in DACH ausgeben:** Nano-Influencer (1–10k) verdienen 25–250 € pro Posting; deutsche Micro-Influencer liegen bei 3–8 % Engagement, Kosten pro Posting 100–261 $ ([opensponsorship](https://opensponsorship.com/blog/nano-micro-mega-influencer-pricing-data), [affinco](https://affinco.com/de/influencer-marketing-statistics/), [stay-digital](https://stay-digital.de/blog/micro-influencer-finden)). **9,99 € sind damit 4–10 % eines einzigen bezahlten Postings.** Das Preisniveau ist gut gewählt — wenn der Creator bereits Geld verdient. Wer noch keine Kooperation hatte, hat kein Budget-Denken für Tools; da konkurriert jeder Preis gegen null.

### 2.3 Drei Modelle

**A — Einmalig 9,99 €, wie heute**

| Pro | Contra |
|---|---|
| Kein Abo-Widerstand, sofort verständlich | Jeder Kauf muss neu überzeugt werden |
| Passt zu Kleinunternehmer-Buchhaltung | Kein planbarer Umsatz |
| Widerrufslogik bereits gebaut | Stripe-Gebühr 4 % |
| Kein Verlaufsdruck auf das Produkt | **Bestraft genau das Feature, das Wiederkauf erzeugt** — der Verlauf entsteht nur, wenn jemand zweimal zahlt |

**B — Paket: 3 Analysen für 19,99 €** *(6,66 € je Analyse)*

| Pro | Contra |
|---|---|
| `analysis_purchases` als Zeilenmodell kann das **heute schon** — 3 Zeilen einfügen statt 1, keine Schemaänderung | Höhere Einstiegshürde als 9,99 € |
| Stripe-Gebühr sinkt auf ~2,7 % | Ungenutzte Guthaben sind gebundenes Geld ohne Leistung |
| Erzeugt den Verlauf systematisch: wer 3 kauft, nutzt 3 | Widerruf über mehrere Teilleistungen ist komplizierter |
| Erhöht den Warenkorb bei gleichem Marketingaufwand | |

**C — Abo: 4,99 €/Monat, eine Analyse monatlich plus Verlauf**

| Pro | Contra |
|---|---|
| Planbarer Umsatz, höherer Lifetime Value | **Erheblicher Neubau:** Stripe Subscriptions, Kündigung, Zahlungsausfall, Statuswechsel — nichts davon existiert |
| Verlauf wird zum Kernprodukt statt zur Zugabe | Monatliches Abo für ein Feature, das ohne Verlaufsdaten nur zwölfmal dasselbe zeigt |
| Rechtfertigt Benchmark-Aufbau (Daten wachsen automatisch) | Widerrufs- und Kündigungspflichten (Kündigungsbutton) kommen dazu |
| | Bei 4 Usern ist ein Abo verfrüht |

### 2.4 Empfehlung zum Vorgehen

**Kurzfristig bei A bleiben und B daneben stellen.** Das Kaufmodell in `analysis_purchases` ist bereits zeilenbasiert — ein Dreierpaket ist ein zweiter Stripe-Preis und drei INSERTs statt einem. Kein Schema, keine neue Logik, kein Abo-Risiko.

**C ist die richtige Endform, aber erst nach dem Verlauf-Feature.** Ein Abo verkauft man über kumulierten Wert; solange jede Analyse ein Schnappschuss ist, gibt es nichts zu kumulieren. Reihenfolge: erst Verlauf bauen (Punkt 1.1), dann Paket anbieten, dann Abo prüfen.

**Zum Zwei-Spuren-Ansatz:** Das Einmalprodukt passt zur Self-Service-Spur — niedrige Hürde, kein Commitment, funktioniert ohne dich. Ein Abo würde in Konkurrenz zum Managed Service treten, statt darauf hinzuführen. **Das Paket ist die bessere Brücke:** Wer 3 Analysen kauft, hat Interesse an Kontinuität signalisiert — das ist der qualifizierteste Lead für den Managed Service, den du bekommen kannst.

---

## 3. Zusatzangebot — was sich logisch anschließt

| Idee | Umsatz? | Passt zur Plattform? | Bewertung |
|---|---|---|---|
| **Media Kit mit den Zahlen füllen** | indirekt | ✅ vollständig | **Bereits gebaut.** `loadMediakit()` liest `analyse_stats`, die SPA kennt „Analyse übernehmen", „Analyse vorausfüllen" und sogar „Neue Analyse verfügbar (…) — Zahlen aktualisieren?". Das ist die beste bestehende Verknüpfung im ganzen Produkt — und sie wird **im Analyse-Ergebnis nirgends erwähnt.** Ein Satz plus Button unter dem Ergebnis („Diese Zahlen in dein Media Kit übernehmen") ist der billigste Mehrwert überhaupt. **Aber:** solange die ER 76 % zeigt, darf sie nicht ins Media Kit. |
| **Persönliche Auswertung durch Mehmet** | ✅ direkt, hohe Marge | ✅ Brücke zum Managed Service | **Der stärkste Kandidat.** Ein Angebot direkt unter dem Ergebnis: „Willst du das mit mir durchgehen? 30 Minuten, 49 €" oder als schriftliche Zweitmeinung. Der Creator ist im Moment maximaler Aufmerksamkeit — er hat gerade gezahlt und sein Ergebnis gelesen. Die Analyse wird damit vom Endprodukt zum **qualifizierten Lead-Magneten** für die Managed-Spur. Aufwand: minimal (ein Abschnitt plus Kontaktweg). |
| **Re-Check nach 30 Tagen, reduziert** | ✅ direkt | ✅ stützt den Verlauf | **Gut, aber Reihenfolge beachten.** Erzeugt genau die zweite Datenreihe, die den Verlauf erst wertvoll macht. Sinnvoll als Mail 30 Tage nach der Analyse: „Vor 30 Tagen hast du diese 4 Tipps bekommen. Schauen wir, was sich bewegt hat — 4,99 € statt 9,99 €." **Voraussetzung:** Der Verlauf muss vorher sichtbar sein, sonst verkauft man zweimal dasselbe. |
| PDF-Export des Ergebnisses | indirekt | ✅ | Kein eigener Umsatz, aber es macht die Analyse teilbar — und damit brauchbar für Brand-Gespräche. Mittlerer Aufwand. |
| Konkurrenz-Analyse als Zusatzkauf | ✅ | ⚠️ | `competitor_accounts` und `fetch-competitor-accounts` liegen fertig da. Aber: fremde Profile scrapen und verkaufen ist datenschutzrechtlich heikler als eigene. **Erst klären, dann bauen.** |
| **Ablenkung:** Follower-Tracking als Tagesdienst | — | ❌ | Macht aus einem Kaufprodukt einen Cron-Job, vervielfacht die Apify-Kosten und konkurriert mit Not Just Analytics, die es kostenlos können. |
| **Ablenkung:** Content-Ideen-Generator aus der Analyse | — | ❌ | Klingt naheliegend, ist aber ein anderes Produkt mit anderer Qualitätsmessung. Verwässert das klare Versprechen. |

**Priorität: Media-Kit-Verknüpfung sichtbar machen (klein) → persönliche Auswertung anbieten (klein, direkter Umsatz) → Re-Check-Mail (mittel, nach dem Verlauf).**

---

## 4. Darstellung vor dem Kauf

### 4.1 Beispiel-Analyse

**Empfehlung: Demo-Account statt anonymisierter Echtdaten.** Ein fester, öffentlich einsehbarer Beispielbericht unter `viuno.de/analyse-beispiel` mit einem erfundenen Creator („Lina, Lifestyle, 8.400 Follower") — realistische Zahlen, echter Aufbau, echte Texttiefe. Gründe:

- Anonymisierung von Echtdaten ist bei Top-Post-URLs und Captions praktisch unmöglich.
- Ein Demo-Account bleibt stabil, während echte Analysen sich ändern.
- Kein Einverständnis nötig, kein Risiko.

Die Seite rendert dieselben Bausteine wie die echte View, mit einem dezenten Band oben: „Beispielanalyse — so sieht dein Ergebnis aus." Der CTA unten: „Deine eigene Analyse — 9,99 €".

### 4.2 Preisdarstellung

**In der App, Analytics-Empty-State (neuer Entwurf):**

```
┌────────────────────────────────────────────┐
│              📊                             │
│        Deine erste Analyse                  │
│                                             │
│  Wir lesen deine letzten 12 Beiträge aus    │
│  und sagen dir, was sie verbindet — welche  │
│  Captions ziehen, welches Format trägt,     │
│  und was du als Nächstes ändern solltest.   │
│                                             │
│  ✓ 4 konkrete nächste Schritte              │
│  ✓ Deine 3 stärksten Beiträge, erklärt      │
│  ✓ Ergebnis per Mail, bleibt im Account     │
│                                             │
│  ┌──────────────────────────────────────┐  │
│  │  Analyse freischalten — 9,99 €       │  │
│  └──────────────────────────────────────┘  │
│     einmalig · keine Kündigung nötig        │
│                                             │
│         Beispiel-Analyse ansehen →          │
└────────────────────────────────────────────┘
```

**Auf der Dashboard-Einrichten-Karte:** Untertitel von „Sieh, was deine Beiträge leisten" auf **„Was deine Beiträge verbindet — einmalig 9,99 €"** ändern. Der Preis muss dorthin, wo geklickt wird.

**Auf viuno.de:** Die Kachel behält Größe und Platz, bekommt aber einen dezenten Preis-Badge oben rechts und einen erweiterten Untertitel:

```
┌─────────────────────────────────────────────────┐
│  ◔                                   9,99 €     │
│                                     einmalig    │
│  Analyse starten                                │
│  Was deine Top-Posts verbindet —         ▁▃▅▂▆  │
│  und was du als Nächstes ändern solltest        │
│                                                 │
│  Beispiel ansehen →                             │
└─────────────────────────────────────────────────┘
```

Zusätzlich unterhalb des Kachelrasters ein schmaler Abschnitt:

> **Drei Features kostenlos, eines mit Preis.**
> BioLink, Creator News und Media Kit kosten nichts. Die Analyse kostet 9,99 € pro Durchlauf — weil bei jedem Lauf echte Daten geholt und ausgewertet werden. Kein Abo, keine Kündigung. [Beispiel-Analyse ansehen →]

Das nimmt dem Preis die Überraschung und macht die Kostenlosigkeit der anderen drei glaubwürdiger.

### 4.3 Textvorschlag, der exakt hält was geliefert wird

> **Deine Analyse**
> Wir lesen deine letzten 12 Instagram- und TikTok-Beiträge aus und werten sie aus: welche Beiträge am stärksten liefen und warum, was deine besten Beiträge gemeinsam haben, wie deine Captions aufgebaut sind, wann du am besten postest — und vier konkrete Dinge, die du als Nächstes anders machen kannst.
>
> Ab der zweiten Analyse vergleichen wir mit deinem letzten Stand: Follower, Likes, Engagement — und ob die Tipps von damals gewirkt haben.
>
> **Was wir nicht können:** Saves, Reichweite und die Demografie deiner Follower liegen nur in deinen Instagram Insights — dafür brauchst du keine Analyse, die stehen in deiner App. Wir liefern das, was dort nicht steht: die Einordnung.
>
> 9,99 € pro Analyse. Einmalig, kein Abo.

Der Absatz „Was wir nicht können" ist bewusst drin: Er verhindert die Enttäuschung, die entsteht, wenn jemand für 9,99 € Reichweitendaten erwartet — und er macht den Rest glaubwürdiger.

---

## 5. Mail „Analyse fertig"

**Die Mail existiert bereits und ist gut gebaut.** Betreff, Aufbau, Token-Set und Mailclient-Sicherheit stimmen. Sie braucht kein Konzept, sondern vier Korrekturen und eine Erweiterung.

### 5.1 Was bleibt

- Absender `viuno <noreply@viuno.de>` ✅
- Tabellen-HTML mit Inline-Styles ✅
- Token-Set `#111110` / `#f5f4f2` / `#f0efed` / `#7a7975` / `#e4e4e2` ✅
- Struktur: Logo → H1 → Anrede → Plattform-Karten mit 3 KPIs + Überblick + Tipps → CTA → Footer ✅
- Top-Erkenntnisse im Mailtext, volle Analyse verlinkt ✅ — genau richtig

### 5.2 Was zu korrigieren ist

1. **CTA-Link** von `https://viuno.de/analytics` auf `https://viuno.de/app/#/analytics`
2. **Engagement Rate** erst wieder anzeigen, wenn sie stimmt
3. **Auth** ergänzen — die Function nimmt heute jede `analysis_run_id` von jedem an
4. **Absenderadresse** — `noreply@` verhindert Antworten. Bei einem Bezahlprodukt mit 4 Kunden ist eine antwortbare Adresse (`hallo@viuno.de`) mehr wert als Sauberkeit.

### 5.3 Was zu ergänzen ist

**Betreff variabler machen.** Statt immer „Deine Analyse ist fertig ✓" die konkreteste Zahl in den Betreff:

- Erstanalyse: `Deine Analyse ist fertig — 3 Beiträge stechen heraus`
- Folgeanalyse: `Deine Analyse ist fertig — +62 Follower seit dem letzten Mal`

**Die wichtigste Erkenntnis nach oben.** Heute steht oben die KPI-Zeile. Besser: ein Satz aus `tipps_zukunft[0]` als hervorgehobener Block direkt unter der Anrede — „Das Wichtigste zuerst: {Tipp 1}". Dann erst die Zahlen.

**Media-Kit-Hinweis im Footer:** „Diese Zahlen kannst du mit einem Klick in dein Media Kit übernehmen. →"

### 5.4 Textentwurf

> **Betreff:** Deine Analyse ist fertig — +62 Follower seit dem letzten Mal
>
> ---
>
> **Deine Analyse ist fertig ✓**
> Hallo Antonietta, hier sind deine Ergebnisse im Überblick.
>
> **Das Wichtigste zuerst**
> Deine Reels unter 25 Sekunden holen im Schnitt das Dreifache an Views. Die drei längsten Videos der letzten Wochen liegen alle unter deinem Durchschnitt.
>
> ---
> **INSTAGRAM**
> 12,2k Follower · Ø 2,5k Likes · 4,1 % Engagement
>
> *{analyse_ueberblick}*
>
> ① {Tipp 1}
> ② {Tipp 2}
> ③ {Tipp 3}
> ④ {Tipp 4}
> ---
> **TIKTOK**
> 1,2k Follower · Ø 914 Likes · 3,4 % Engagement
> …
> ---
>
> [ Volle Auswertung ansehen ]
>
> Deine Zahlen kannst du direkt in dein Media Kit übernehmen. →
>
> Diese E-Mail wurde von viuno gesendet, weil du eine Analyse in Auftrag gegeben hast.
> Impressum · Datenschutz

### 5.5 Eigene Edge Function oder bestehender Mechanismus?

**Die eigene Function ist richtig — sie existiert bereits und soll bleiben.**

Begründung: Die Fertig-Mail braucht Daten aus vier Tabellen (`analysis_runs`, `users`, `analyse_ki`, `analyse_stats`), plattformweise Gruppierung und bedingtes Rendering. Ein generischer Trigger-Mechanismus müsste das alles abbilden. Zudem ist die Entkopplung wichtig: `analysis-webhook` ruft `send-analysis-email` per `fetch` auf und fängt jeden Fehler ab — **eine gescheiterte Mail kippt keine bezahlte Analyse.** Diese Trennung ist korrekt und sollte nicht aufgegeben werden.

Die anderen Mail-Functions im Projekt (`send-weekly-digest-email`, `notify-new-request`, `send-collab-reply`) folgen demselben Muster. Konsistent.

**Was dagegen als eigene, neue Function gehört: die Kaufbestätigung** (siehe 6.1) — ausgelöst aus `stripe-webhook`, nicht aus `analysis-webhook`, weil sie zum Zahlungszeitpunkt fällig ist, nicht zum Ergebniszeitpunkt.

---

## 6. Was fehlt, aber wichtig ist

### 6.1 Die fehlende Kaufbestätigung (rechtlich **und** produktseitig)

Zwischen „bezahlt" und „Analyse fertig" liegen 1–2 Minuten, in denen der Kunde **nichts** von viuno bekommt — nur einen Stripe-Beleg. Eine Kaufbestätigungs-Mail löst gleich drei Dinge auf einmal:

1. Sie erfüllt die dritte Bedingung aus § 356 Abs. 5 BGB (Vertragsbestätigung in Textform mit Hinweis auf das Erlöschen des Widerrufsrechts)
2. Sie gibt dem Kunden Sicherheit, dass die Zahlung angekommen ist
3. Sie kann die Wartezeit erklären („dauert etwa 1–2 Minuten")

Auslöser: `stripe-webhook`, direkt nach dem erfolgreichen `analysis_purchases`-Insert.

### 6.2 Sicherheit

| Frage | Befund |
|---|---|
| Kann jemand ohne Kauf einen Lauf auslösen? | **Nein.** `start-analysis` validiert das JWT über `supabase.auth.getUser(token)`, prüft `analysis_purchases` mit Service-Role-Rechten und gibt sonst 402. Der Kauf-Check ist serverseitig und nicht umgehbar. ✅ |
| Kann jemand sich selbst einen Kauf eintragen? | **Nein.** `analysis_purchases` hat **nur** eine SELECT-Policy (`auth.uid() = user_id`), keine INSERT-Policy. Nur die Service Role schreibt. ✅ Gleiches gilt für `analysis_runs`, `analyse_stats`, `analyse_ki`, `apify_daten`. |
| Kann jemand fremde Ergebnisse lesen? | **Nein.** Alle RLS-Policies binden an `auth.uid()`. ✅ |
| Kann jemand den Stripe-Webhook fälschen? | **Nein.** Signaturprüfung mit `constructEventAsync`, Idempotenz über UNIQUE-Constraint. ✅ |
| `client_reference_id` manipulierbar? | **Ja, theoretisch** — der User könnte eine fremde UUID in die URL setzen und die Freischaltung verschenken. Er zahlt dabei selbst, also kein Angriff mit Gewinn, nur ein Kuriosum. |
| `send-analysis-email` ungeschützt? | **Ja.** `verify_jwt: false`, kein Secret, kein Auth. Wer eine `analysis_run_id` kennt, kann beliebig oft Mails auslösen. Behebbar, siehe 5.2. |
| `analysis-webhook` ungeschützt? | **Ja, konstruktionsbedingt** (Apify ruft ohne JWT). Es gibt kein Shared Secret im Query-String. Wer `userId`, `runId` und `platform` kennt, kann den Callback nachspielen. Der Frühabbruch bei `status: done` begrenzt den Schaden. Ein Token im Webhook-Param wäre die saubere Lösung. |

**Gesamtbild: Die Bezahlschranke selbst ist solide.** Die Schwächen liegen bei den beiden unauthentifizierten Functions, nicht am Geld.

### 6.3 Datenschutz beim Scraping fremder Profile

Ein User kann jeden beliebigen Handle in `users.instagram_handle` schreiben — Format wird geprüft (`/^[a-zA-Z0-9._]{1,50}$/`), Eigentum nicht. Damit lässt sich das Feature als Konkurrenz-Scraper nutzen, und wir speichern fremde Profildaten samt Captions und Post-URLs unter unserem Verantwortungsbereich.

Die Media-Kit-Bedingungen enthalten die passende Zusicherung bereits — **für die Analyse fehlt sie.** Der billigste Schritt: ein Satz im Handle-Modal („Ich bestätige, dass dies mein eigenes Profil ist") plus die Zusicherung in den AGB, analog zu Media Kit § Datenherkunft.

### 6.4 Aufbewahrungsdauer der Rohdaten

Die Datenschutzerklärung sagt: „Analytics-Daten und KI-Auswertungen: bis zu 24 Monate, dann automatische Löschung oder Anonymisierung."

**Es gibt keine solche Löschung.** `apify_daten` enthält Posts vom 29.04.2026, inklusive vollständigem `raw_data`-JSON pro Post — also auch fremde Kommentarauszüge und CDN-URLs, die der Scraper mitliefert. Bei 156 Zeilen irrelevant, bei 10.000 Zeilen ein Versprechen, das gebrochen wird. Ein `pg_cron`-Job, der `apify_daten` nach 24 Monaten löscht, ist kleiner Aufwand — und die Aussage steht bereits schriftlich in der Datenschutzerklärung.

Zusätzlich: `raw_data` wird **nie wieder gelesen**. Es ist reiner Ballast mit Datenschutzrisiko. Entweder gezielt auf die gebrauchten Felder reduzieren oder nach 30 Tagen leeren.

### 6.5 Wartezeit und ihre Kommunikation

Gemessene Laufzeiten (Start bis `completed_at`): 42 s, 67 s, 68 s, 92 s, 113 s — **Mittel ~76 Sekunden.**

Der Status-Flow ist gut (benannte Schritte, Spinner, Polling), sagt aber nur „Bitte warte einen Moment…". Bei über einer Minute ohne Zeitangabe schließen Leute den Tab. Zwei kleine Verbesserungen:

- Zeitangabe: „Dauert etwa 1–2 Minuten. Du bekommst auch eine Mail, wenn es fertig ist."
- Der zweite Halbsatz ist der wichtigere: Er erlaubt dem User wegzugehen, und **die Mail existiert bereits** — sie wird nur nirgends angekündigt.

### 6.6 Fehlerkommunikation an den User

Heute zeigt der `failed`-Zweig `run.error` roh an. Der User liest dann:

> „Alle Plattform-Analysen fehlgeschlagen: [instagram] Haiku-Analyse fehlgeschlagen | [tiktok] Haiku-Analyse fehlgeschlagen"

Das ist eine interne Fehlermeldung, keine Nachricht an einen zahlenden Kunden. Nötig ist ein Mapping auf wenige verständliche Fälle:

| Ursache | Was der User lesen sollte |
|---|---|
| Kein Dataset / leeres Ergebnis | „Wir konnten @handle nicht auslesen. Ist das Profil öffentlich und der Name richtig geschrieben? Deine Freischaltung bleibt erhalten." |
| Haiku-Fehler | „Bei der Auswertung ist etwas schiefgelaufen. Deine Freischaltung bleibt erhalten — probier es in ein paar Minuten nochmal." |
| Teilfehler (eine Plattform) | **Wird heute gar nicht angezeigt** — der Run ist `done`, `error` steht nur in der DB. Der User müsste sehen: „Instagram ist fertig, TikTok hat nicht geklappt." |

Der Toast bei Fehlschlag sagt bereits richtig „deine Freischaltung bleibt erhalten" — dieser Satz gehört auch in den Status-Flow.

### 6.7 Supportfall „Analyse fehlgeschlagen, Geld weg"

**Kann heute in genau einem Fall eintreten:** Teilfehler, bei dem eine Plattform durchläuft und die andere nicht. Der Kauf wird verbraucht, der Run steht auf `done`, der User sieht nur eine Plattform und keinen Hinweis.

Bei komplettem Fehlschlag bleibt der Kauf erhalten — das ist gelöst und wird kommuniziert.

**Was fehlt:**
- Kein Weg für dich, eine Freischaltung manuell zurückzugeben (heute: `UPDATE analysis_purchases SET consumed_at = NULL` im SQL-Editor). Ein Admin-Knopf im `admin-dashboard` wäre klein und erspart Datenbankhandgriffe unter Zeitdruck.
- Keine Benachrichtigung an dich, wenn ein Run scheitert. `admin_errors` füllt sich, aber niemand schaut hin. Bei 29 % Fehlerquote und zahlenden Kunden sollte ein Fehlschlag eine Mail an dich auslösen.
- **Keine antwortbare Absenderadresse** — `noreply@viuno.de` ist bei einem Bezahlprodukt die falsche Wahl.

### 6.8 Weitere Auffälligkeiten

- **`analysis_purchases.user_id` hat keinen Fremdschlüssel**, während alle Nachbartabellen `ON DELETE CASCADE` haben. Nach einer Accountlöschung bleiben Kaufzeilen als Waisen zurück. Steuerrechtlich ist Aufbewahrung gewollt (Datenschutz 9.3 sagt „pseudonymisiert aufbewahrt") — dann sollte das aber bewusst dokumentiert und der Personenbezug tatsächlich entfernt werden, nicht zufällig entstehen.
- **`users.analyse_moeglich` ist tot.** Cooldown-Datum aus der kostenlosen Vorgängerlogik, wird nirgends mehr gelesen, steht aber noch bei drei Usern gefüllt.
- **`creator_analytics` und `fetch-analytics` sind Legacy.** Das Dashboard liest noch `creator_analytics` (Zeile 1718) *und* `analyse_stats` (Zeile 1722) — `followers_change` fällt über `??` auf die alte Tabelle zurück. Doppelte Wahrheit für dieselbe Zahl.
- **`analytics_settings`** (5 Zeilen, `ig_enabled`, `tt_enabled`, `next_analysis_at`) gehört ebenfalls zum alten Flow und wird nicht mehr geschrieben.
- **`users.niche` existiert nicht.** `runHaikuAnalysis` macht `.select('niche_custom, niche, niche_category')` — PostgREST antwortet mit einem Fehler, `userData` bleibt `null`, `niche` wird `''`. **Die Nischen-Personalisierung im Prompt ist seit jeher wirkungslos.** Vorhandene Spalten: `niche_category`, `niche_custom`. Einzeiler-Fix mit spürbarer Wirkung auf die Textqualität.

---

# Priorisierung

## Bug / Fehler heute — sofort

| # | Befund | Wirkung | Risiko | Aufwand | Einzeln testbar |
|---|---|---|---|---|---|
| **B1** | `corsHeaders` in `analysis-webhook` nicht definiert — 8× `ReferenceError` am 10.09. Jede Antwort an Apify wird zu 500, Apify stellt mit Backoff erneut zu. | sehr hoch | sehr niedrig | **klein** (7 Zeilen Konstante) | ✅ Run starten, `admin_errors` prüfen |
| **B2** | Engagement Rate: wechselnde Bezugsgröße, Zähler/Nenner aus verschiedenen Post-Mengen, gespeicherte 76,42 %. Fließt in UI, Prompt, Mail, Media Kit und Teilen-Text. | sehr hoch | mittel (Definition festlegen, Altbestand entscheiden) | **mittel** | ✅ gegen `apify_daten` nachrechnen |
| **B3** | `users.niche` existiert nicht → Nischen-Personalisierung im Prompt seit jeher wirkungslos | mittel | sehr niedrig | **klein** (ein Feldname) | ✅ Prompt-Log prüfen |
| **B4** | `followers_change` bei Handle-Wechsel: −9288 als „Wachstum" | mittel | niedrig | **klein** (Username in die Vorlauf-Abfrage) | ✅ |
| **B5** | KPI-Label „diese Woche" bei Abständen von 1 bis 109 Tagen — in Analyse-View, Dashboard und Teilen-Text | mittel | sehr niedrig | **klein** | ✅ |
| **B6** | `cancel_url = https://stripe.com` — Abbrecher verlassen viuno | mittel | sehr niedrig | **klein** (Stripe-Dashboard) | ✅ Abbruch klicken |
| **B7** | Fertig-Mail verlinkt `/analytics` statt `/app/#/analytics` | mittel | sehr niedrig | **klein** | ✅ |
| **B8** | Teilfehler verbraucht den Kauf, wird dem User aber nicht angezeigt | mittel | niedrig | **klein** (`error` auch bei `done` rendern) | ✅ |
| **B9** | `send-analysis-email` ohne jede Authentifizierung | niedrig | niedrig | **klein** (Shared Secret) | ✅ |

**B1 und B2 vor allem anderen.** B1, weil es jeden Lauf betrifft. B2, weil die Zahl in ein öffentliches Media Kit wandert.

## Produkt-Verbesserung — Konzept

| # | Maßnahme | Wirkung | Aufwand |
|---|---|---|---|
| **P1** | Verlauf sichtbar machen (Kurve + Archiv vergangener Analysen) | sehr hoch — der einzige Wiederkaufgrund | mittel |
| **P2** | Beispiel-Analyse unter `viuno.de/analyse-beispiel` | sehr hoch — größte Conversion-Bremse | mittel |
| **P3** | Preis vor den Klick: Landingpage-Kachel, Dashboard-Karte, Empty-State neu texten | hoch | klein |
| **P4** | Ergebnis-Hierarchie umdrehen: Tipps und Content-Muster nach oben, Zahlen nach unten | hoch | klein |
| **P5** | Kaufbestätigungs-Mail (deckt zugleich § 356 Abs. 5 Nr. 3 ab) | hoch | klein |
| **P6** | Thumbnails bei den Top-Beiträgen | mittel | klein |
| **P7** | Media-Kit-Übernahme im Ergebnis sichtbar machen | mittel | klein |
| **P8** | Wartezeit benennen + auf die Mail hinweisen | mittel | klein |
| **P9** | Fehlermeldungen in Klartext übersetzen | mittel | klein |
| **P10** | Format- und Video-Längen-Auswertung mit sauberer Basis | mittel | klein |
| **P11** | Betreffzeile der Fertig-Mail variabel machen | mittel | klein |
| **P12** | Fehler-Benachrichtigung an dich bei `status: failed` | mittel | klein |
| **P13** | Admin-Knopf „Freischaltung zurückgeben" | niedrig | klein |
| **P14** | `pg_cron`-Löschjob für `apify_daten` nach 24 Monaten | niedrig (heute) | klein |
| **P15** | PDF-Export | mittel | groß |
| **P16** | Nischen-Benchmark aus eigenen Daten | sehr hoch — aber erst ab ~30 Analysen je Nische | groß |
| **P17** | Legacy aufräumen (`creator_analytics`, `fetch-analytics`, `analytics_settings`, `analyse_moeglich`) | niedrig | mittel |

## Geschäftsentscheidung — brauche ich von dir

| # | Entscheidung | Warum du |
|---|---|---|
| **G1** | **Wie definieren wir Engagement Rate?** Likes+Kommentare / Follower (Branchenstandard, plattformübergreifend vergleichbar) oder / Views (misst Content, nicht Publikum)? Und: Bestandszeilen neu berechnen oder als „alte Methode" markieren? | Produktdefinition, nicht Technik. Bestimmt, was im Media Kit steht. |
| **G2** | **AGB, Widerruf und Datenschutz auf „kostenpflichtig" umstellen** — inklusive separater Widerrufsbelehrung für den Analyse-Kauf. Selbst formulieren oder anwaltlich prüfen lassen? | Rechtsfrage mit Geld dahinter. |
| **G3** | **Rechnung statt nur Beleg?** `invoice_creation` in Stripe aktivieren, damit eine Rechnung mit § 19 UStG entsteht? | Buchhaltung und Kundenerwartung. |
| **G4** | **Paket (3 für 19,99 €) einführen?** Technisch heute schon möglich. | Preisstrategie. |
| **G5** | **Persönliche Auswertung durch dich als Zusatz anbieten** — und zu welchem Preis? | Dein Zeitbudget, deine Managed-Spur. |
| **G6** | **Handle-Eigentum bestätigen lassen?** Bremst die Conversion minimal, schließt die Datenschutzlücke. | Risikoabwägung. |
| **G7** | **Konkurrenz-Analyse als Produkt?** `competitor_accounts` liegt fertig da, ist aber datenschutzrechtlich heikler. | Produkt- und Risikoentscheidung. |
| **G8** | **Landingpage: Preis offen zeigen oder nicht?** Ich empfehle ja — aber es ändert die Wahrnehmung von „Toolbox ist kostenlos". | Positionierung. |

---

# Offene Fragen

1. **Apify-Kosten:** Meine 0,9 Cent pro Lauf sind aus öffentlichen Actor-Preisen geschätzt. Was steht in deiner tatsächlichen Apify-Abrechnung für die Läufe vom 09./10.09.?
2. **Die zwei Fehlläufe** (23.05. und 09.09.) hatten `tokens_input: 0` — war der `ANTHROPIC_API_KEY` abgelaufen, gab es ein Ratelimit, oder etwas anderes? Die Ursache entscheidet, ob 29 % Fehlerquote ein Einzelfall oder die Norm ist.
3. **Die gelöschte Kaufzeile:** Der Kauf vom 10.09. wurde offenbar manuell aus `analysis_purchases` entfernt (kein Fremdschlüssel, also kein Cascade). Bewusst als Testaufräumen, oder ist da etwas anderes passiert?
4. **Die 7 abgebrochenen Sessions von `5769bc5f-…`** in 40 Minuten — waren das deine Tests, oder hat da jemand real sieben Mal abgebrochen? Falls real: Warum?
5. **Widerrufs-Zustimmung ohne Kauf** (11.09., Antonietta): Sie hat zugestimmt und dann nicht gezahlt. Soll die Zeile bestehen bleiben, oder erst beim tatsächlichen Kauf geschrieben werden?
6. **`resultsLimit: 12` bei Instagram, 15 minus 3 bei TikTok** — warum genau 12? Mehr Posts kosten fast nichts und würden Beste-Zeit und Format-Vergleich statistisch tragfähig machen.
7. **Zwei Oberflächen:** `/analytics/index.html` und die SPA-View tragen beide die volle Bezahllogik. Welche ist die maßgebliche? Doppelpflege ist bei Bezahlcode besonders riskant.
8. **`analyse_moeglich`** steht bei drei Usern noch auf einem Datum. Löschen, oder hat es eine Bedeutung, die ich nicht sehe?
9. **Wer bekommt die Fertig-Mail?** Heute `contact_email || email`. Zwei der fünf User haben keine `contact_email` — das ist so gewollt, oder?

---

**Quellen zum Marktvergleich:**
[HypeAuditor Pricing 2026](https://www.flinque.com/hypeauditor-pricing/) ·
[Influencer Analytics Tools 2026](https://influencerfee.com/blog/influencer-analytics-tools-comparison/) ·
[Best Instagram Analytics Tools 2026](https://kompozy.io/roundups/best-instagram-analytics-tools-2026) ·
[Free Instagram Analytics Tools](https://kicksta.co/blog/free-instagram-analytics-tools) ·
[Nano vs Micro Influencer Pricing 2026](https://opensponsorship.com/blog/nano-micro-mega-influencer-pricing-data) ·
[Influencer-Marketing-Statistiken 2026 (DACH)](https://affinco.com/de/influencer-marketing-statistics/) ·
[Micro Influencer finden (DACH)](https://stay-digital.de/blog/micro-influencer-finden) ·
[Apify Instagram Scraper](https://apify.com/apify/instagram-scraper)
