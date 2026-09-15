# LAUNCH-CHECK — viuno vor der aktiven Bewerbung

**Stand:** 15. September 2026 · **Branch:** `launch-check` · **Prüfer:** Claude (Security · Datenschutz/Recht · Backend · UX · Marketing)
**Status:** Phase 0–3 abgeschlossen (Inventar, Sicherheit, Recht, Zahlung). Phase 4–7 laufen. Go/No-Go am Ende der Datei.

Schweregrade: **Blocker** (nicht live gehen) · **Hoch** (vor Bewerbung fixen) · **Mittel** (in den ersten Wochen) · **Niedrig** (Hygiene).
Status: **gefixt** · **offen** · **braucht Mehmet**.

Zähler (wird fortgeführt): siehe Abschnitt "Befunde".

---

## Phase 0 — Inventar

### 0.1 Seiten und Routen (Cloudflare Pages, Publish-Verzeichnis `public/`)

Zugriff: **öff.** = öffentlich · **login** = Supabase-Session nötig · **bezahlt** = Freischaltung (`analysis_purchases`) nötig · **admin** = `users.is_admin` · **intern** = für den Betreiber, nicht verlinkt · **Token** = per Freigabe-Token teilbar.

| Route | Datei | Zweck | Zugriff | Anmerkung |
|---|---|---|---|---|
| `/` | `public/index.html` | Landing DE | öff. | Newsletter-Formular → `newsletter-subscribe`; Zählung `page_views` (`landing`) |
| `/it/` | `public/it/index.html` | Landing IT | öff. | Rechtstexte als Modal ("Note legali", "Privacy"), nicht aus `legal_texts`, keine Links auf `/legal` |
| `/news/`, `/news/<slug>` | `public/news/index.html` + `functions/news/[slug].js` | Creator News, öffentlich | öff. | Liest `digest_cards_today/past` mit Publishable Key; Pages Function setzt OG-Tags |
| `/analyse/<token>` | `public/analyse/index.html` | Geteilter Analyse-Ausschnitt | Token | Liest `analyse-oeffentlich`; `noindex` |
| `/brandready/<token>` | `public/brandready/index.html` | Geteilter Brand-Ready-Stand | Token | Liest `brand-ready-oeffentlich`; `noindex` |
| `/legal/` (+ `#impressum/#agb/#datenschutz/#widerruf/#biopage_terms/#mediakit_terms`) | `public/legal/index.html` | Alle Rechtstexte | öff. | Liest `legal_texts` (id=1) zur Laufzeit |
| `/impressum/`, `/agb/`, `/datenschutz/`, `/widerruf/` | je `index.html` | Weiterleitung auf `/legal#…` | öff. | 32-Zeilen-Stubs, `noindex` |
| `/app/` (`#/login #/register #/onboarding #/dashboard #/analytics #/brandready #/biolink #/mediakit #/digest #/profile`) | `public/app/index.html` (439 kB) | Die App (Hash-Router) | login (login/register/onboarding öff.) | Kauf-Flow (`create-checkout-session`), Analyse (`start-analysis`), Logout im Profil |
| `/login/`, `/register/`, `/onboarding/` | je `index.html` | Weiterleitung in die SPA | öff. | Alte Seiten liegen noch darunter (Fallback-Code), Zeile 7 leitet um |
| `/reset-password/` | `public/reset-password/index.html` | Passwort setzen | öff. (Recovery-Link) | Echte Seite, `redirectTo: https://viuno.de/reset-password` |
| `/dashboard/ /profile/ /biolink/ /mediakit/ /digest/ /analytics/` | je `index.html` | Weiterleitung auf `#/…` | – | Stubs |
| `/admin/` | `public/admin/index.html` | Admin-Cockpit (Start, Geld, Menschen, Traffic, System) | admin | RPC `admin_uebersicht`, Edge `admin-dashboard`; `noindex` |
| `/admin/news/` | `public/admin/news/index.html` | News-Redaktion | admin | Schreibt `daily_digest.cards` |
| `/admin/karusell/` | `public/admin/karusell/index.html` | Instagram-Karussell-Vorschläge | admin (RLS `ig_carousels`) | Kein `noindex` |
| `/karussell/` | `public/karussell/index.html` + `app.js` | Swipe-File | intern | Spricht **anderes Supabase-Projekt** `dodglijurmtrbwnjivlg` (`admin-api`), Admin-Token im localStorage |
| `/admina/` | `public/admina/index.html` | "Antonietta Top Konkurrenz" | intern (login) | Ruft `fetch-competitor-accounts` (Apify, kostet) |
| `/extras/` | `public/extras/index.html` | Alte "Extras"-Seite mit eigener Sidebar | login | Schreibt direkt in `contact_submissions` (scheitert an RLS) |
| `/kit/` (generisch) | `public/kit/index.html` + `kit-renderer.js` | Generischer Media-Kit-Renderer | öff. | **Kaputt**: alter Anon-Key (iat 1743702807), View `media_kit_public` existiert nicht, Links auf `veuno.de` |
| `/kit/stradauno/`, `/kit/antonietta/` | je `index.html` | Generierte Media Kits | öff. | stradauno pingt `track-mediakit-view` (Function existiert nicht) |
| `/stradauno/`, `/antonietta/` | je `index.html` | BioLinks | öff. | `track-biolink-view`/`-click`; UUID im Quelltext (by design) |
| `/test/`, `/testi/` | je `index.html` | Design-Entwürfe (Landing / BioLink) | öff. | **Indexierbar**, nicht in robots.txt, `/testi/` mit leeren OG-Tags |
| `/pitch/1/` | `public/pitch/1/index.html` | Designentwurf | öff. | `noindex` per Meta + `_headers` |
| `/news-bestaetigt/`, `/digest-unsubscribed/` | je `index.html` | Bestätigungsseiten Newsletter | öff. | |
| `/bio-template.html` | `public/bio-template.html` | Server-Template mit `{{Platzhaltern}}` | öff. abrufbar | Enthält dritten Anon-Key (iat 1774038873) |
| `/app/brand-ready-regeln.js` | | Regelwerk Brand Ready (geteiltes Modul) | öff. | Per Commit-SHA von `brand-ready-freigeben` gepinnt |
| `/sitemap.xml`, `/robots.txt` | | SEO | öff. | Sitemap: `/`, `/news`, `/it/`, `/legal` |
| **Unbekannte Pfade** (`/faq`, `/hilfe`, Tippfehler) | – | Cloudflare liefert **`index.html` mit HTTP 200** (SPA-Fallback, weil keine `404.html` existiert) | öff. | Soft-404 |
| `sidebar.js` (Repo-Root) | | Alte Sidebar-Komponente | nicht deployed | Liegt außerhalb `public/`, toter Code |

**Cloudflare-Konfiguration:** `public/_redirects` (SPA-Fallback `/app/*`, `/analyse/*`, `.html`→`/legal#…`), `public/_headers` (nur `/karussell/*` und `/pitch/*`; **keine** HSTS/CSP/X-Frame-Options für den Rest), eine Pages Function `functions/news/[slug].js`. Live-Header von `viuno.de`: nur `x-content-type-options: nosniff` und `referrer-policy: strict-origin-when-cross-origin` (Cloudflare-Standard).

### 0.2 Supabase — Projekt `bzejndghppuipnedasuv` ("CreatorOS", Region **eu-central-1 / Frankfurt**, Postgres 17)

**Konten:** 5 Auth-User (alle bestätigt, 4 in den letzten 30 Tagen aktiv), 1 Admin. 5 Käufe (alle verbraucht), 5 abgeschlossene Analyse-Läufe, 3 bestätigte Newsletter-Abonnenten, 45 News-Ausgaben.

#### Tabellen (RLS ist auf **allen** 60 Tabellen aktiv)

| Tabelle | Zweck | Policies | Bemerkung |
|---|---|---|---|
| `users` | Profil (Spiegel von `auth.users`) | eigene Zeile ALL | UPDATE für `authenticated` ist auf **14 Spalten** begrenzt (kein `is_admin`, `is_verified`) ✓ |
| `subscriptions` | Plan-Zeile (`free`), ungenutzt | eigene ALL | Nichts liest sie |
| `analysis_purchases` | Freischaltungen (Stripe) | eigene SELECT | Insert nur Service Role ✓; UNIQUE auf Session-ID |
| `analysis_runs`, `apify_daten`, `analyse_stats`, `analyse_ki` | Analyse-Pipeline | eigene SELECT | Schreiben nur Service Role ✓ |
| `withdrawal_consents` | § 356 Abs. 5 BGB Zustimmungen | eigene SELECT/INSERT | `effective_at` setzt der Webhook |
| `stripe_webhook_events` | Idempotenz | keine (nur Service Role) | ✓ |
| `stripe_prices` | Preis-IDs je Modus | keine (nur Service Role) | **nur `mode='test'`-Zeilen** |
| `setup_tokens` | Einmal-Token für `viuno-stripe-setup` | keine | alle verbraucht |
| `analyse_freigaben`, `brand_ready_freigaben` | Teil-Links mit Token | eigene SELECT/UPDATE | Öffentlicher Abruf nur über Edge Function ✓ |
| `brand_ready_angaben` | Selbstauskunft Brand Ready | eigene CRUD | |
| `biolink_viuno`, `biolink_settings`, `biolink_custom_links` | BioLink-Konfiguration | eigene | `biolink_settings` ist Altbestand (Slug-Fallback) |
| `biolink_aufrufe`, `biolink_klicks` | BioLink-Zählung (ohne Personenbezug) | eigene SELECT | Insert nur Service Role ✓ |
| `mediakit_viuno`, `mediakit_brands`, `mediakit_content_offers`, `mediakit_preise`, `mediakit_beitraege` | Media Kit | eigene + öffentlich lesbar wenn `is_mediakit_active` | by design öffentlich |
| `mediakit_aufrufe` | Media-Kit-Zählung | **INSERT für anon `true`** | jeder kann Zählungen für jede UUID einfügen |
| `page_views` | Aufrufe öffentlicher Seiten | INSERT anon, SELECT eigene/admin | by design |
| `daily_digest` | News-Ausgaben (jsonb `cards`) | auth SELECT all, admin UPDATE/DELETE | anon liest über Views |
| `newsletter_subscribers`, `digest_email_log` | Newsletter (Double-Opt-In, Token) | eigene/admin SELECT | |
| `legal_texts` (+2 Backups) | Rechtstexte | public SELECT, admin UPDATE | |
| `creator_analytics` | **Alte** wöchentliche Analytics-Pipeline | eigene SELECT **+ `anon SELECT true`** | **anon liest alle Zeilen** (Follower, ER, Captions, KI-Texte) — im Test bestätigt |
| `competitor_accounts` | Konkurrenz-Scan (Antonietta) | owner SELECT **+ `service_all` true/true für public** | **anon kann lesen/schreiben/löschen** — Lesen im Test bestätigt |
| `platform_accounts`, `brands`, `brand_ratings`, `deals`, `user_goals` | CRM-Gerüst, leer | eigene ALL | Prototyp-Reste, ungenutzt |
| `admin_errors` | Fehlerlog | admin ALL | `log_error()` ist von anon aufrufbar |
| `ai_usage_log`, `ai_pricing`, `apify_raw_runs`, `kosten_guthaben` | Kosten | keine / admin | |
| `news_images` | Stockbild-Pool (61) | keine | |
| `managed_creators`, `ig_carousels`, `karussell_log` | Betreiber-Werkzeuge | admin / keine | |
| `contact_submissions` | Kontaktformular (0 Zeilen) | keine | nur `contact-submit` schreibt |
| `niche_mappings`, `username_blacklist`, `analytics_settings`, `user_consents` | Vokabular, Sperrliste, Settings, Consent-Log | public SELECT / eigene | |
| `analyse_stats_backup_20260913/14`, `backup_antonietta_*_20260914` (4), `legal_texts_backup_20260913/14` | **Backup-Tabellen** (8 Stück) | keine, kein PK | können nach Prüfung weg |

Grants-Hygiene: `anon`/`authenticated` haben auf allen Tabellen die Standard-Grants inkl. `DELETE`, `TRUNCATE`; RLS ohne Policy blockt DML, PostgREST kennt kein TRUNCATE — aber sauber ist es nicht.

#### Views (alle 6 **SECURITY DEFINER**, absichtlich für anonyme öffentliche Seiten)

`biopage_v2` (BioLink-Daten wenn `bio_active`), `biolink_links_public`, `biopage_public` (Altbestand über `biolink_settings`), `mediakit_public` (wenn `mediakit_active`, mit `contact_email`, `city`), `digest_cards_today`, `digest_cards_past`. Sie geben nur die Spalten der öffentlichen Seiten heraus; `contact_email` ist der Kontakt-Button.

#### Datenbank-Funktionen (Auszug, SECURITY DEFINER = SD)

| Funktion | SD | anon | Bemerkung |
|---|---|---|---|
| `admin_uebersicht(p_tage)` | SD | nein | prüft `is_admin()` |
| `is_admin()` | SD | ja | liest `users.is_admin` für `auth.uid()` |
| `biolink_herkunft/stunden/klick_zahlen/klickrate(p_tage)` | invoker | ja/nein | filtern auf `auth.uid()` ✓ (anon liefert `[]`, getestet) |
| `get_platform_stats(p_user_id)`, `get_bio_hourly_stats`, `get_bio_referrer_stats`, `get_bio_views_*`, `get_biolink_views`, `get_biolink_views_last_7_days_daily`, `get_mediakit_views_last_7_days_daily` | SD | **ja** | **fremde UUID → fremde Zahlen** (`get_platform_stats` gibt `display_name` + Follower jeder UUID heraus, getestet); `get_bio_stats_flat` ist kaputt (Tabelle `bio_page_views` fehlt) |
| `track_bio_view`, `increment_bio_view`, `update_biolink_view_aggregates(p_user_id)`, `record_consent`, `log_error`, `purge_alte_analysedaten`, `purge_abgelaufene_freigaben`, `fail_stale_analysis_runs`, `increment_blacklist_hit` | SD | **ja** | schreibende Funktionen ohne Auth-Prüfung, von anon aufrufbar |
| `check_username_available`, `is_username_available`, `is_mediakit_active`, `has_consent`, `nische_label`, `news_slug`, `viuno_herkunft`, `biolink_quelle`, `get_daily_text` | teils | ja | unkritisch |
| `handle_new_user()` (Trigger auf `auth.users`), `sync_user_email`, `sync_email_verified`, `sync_analytics_username`, `normalize_niche_category`, `newsletter_spiegeln`, `newsletter_zeitstempel`, `update_updated_at`, `check_biolink_max_links`, `trigger_update_*_aggregates`, `sync_total_followers`, `ig_carousels_touch`, `enforce_mediakit_username`, `set_match_order`, `append_brand_trigger`, `rls_auto_enable` | | | Trigger-Funktionen |
| `digest_waechter()`, `analyse_apify_kosten_addieren()` | SD | nein | Cron/Service |

Supabase Security Advisor: 21 Funktionen ohne festen `search_path`, `pg_net` und `vector` in `public`, **Leaked-Password-Protection aus**, 37 SD-Funktionen für anon ausführbar, 6 SD-Views.

#### Trigger

`auth.users`: `on_auth_user_created → handle_new_user` (legt `users`, `subscriptions`, `biolink_settings`, `analytics_settings` an), `on_auth_user_email_changed`, `on_auth_user_email_confirmed`. `public.users`: `normalize_niche_category`, `sync_analytics_username`, `users_updated_at`. `biolink_aufrufe`/`mediakit_aufrufe`: Aggregat-Trigger. `newsletter_subscribers`: `spiegeln`, `zeitstempel`. `biolink_custom_links`: Max-Links. `updated_at` auf `analytics_settings`, `biolink_settings`, `brands`, `deals`, `platform_accounts`, `managed_creators`, `ig_carousels`.

#### Edge Functions (47 deployed; **21 mit Repo-Kopie** unter `supabase/functions/`)

| Function | verify_jwt | Repo | Zweck | Auth im Code | Zustand |
|---|---|---|---|---|---|
| `create-checkout-session` | false | **nein** | Stripe Checkout anlegen, Consent protokollieren | `getUser` ✓ | live; liest `VIUNO_STRIPE_MODE` (Default `live`) + `stripe_prices` |
| `stripe-webhook` | false | **nein** | Freischaltung nach `checkout.session.completed` | Stripe-Signatur (Test **und** Live-Secret) ✓, Idempotenz ✓ | live; kein Betrags-/Preis-Check; Käufe ohne `platform`-Metadata → Instagram |
| `send-purchase-confirmation` | false | **nein** | Vertragsbestätigung (§ 356 Abs. 5 BGB) per Resend | Service-Role-Token ✓ | Reply-To `kontakt@stradauno.de` |
| `start-analysis` | false | **nein** | Apify-Läufe starten (IG: 2 Actors, TikTok: 1) | `getUser` ✓, Kauf-Check ✓ | live |
| `analysis-webhook` | false | ja | Apify-Callback → Stats + KI (Haiku) + Mail | **kein Secret**, nur URL-Parameter | GET mit Unsinn liefert 200 |
| `send-analysis-email` | false | **nein** | Ergebnis-Mail | Service-Role-Token ✓ | Reply-To `kontakt@stradauno.de` |
| `analyse-freigeben`, `analyse-oeffentlich` | false | **nein** | Teil-Links Analyse | `getUser` ✓ / Token ✓ | ok |
| `brand-ready-freigeben`, `brand-ready-oeffentlich` | false | ja | Teil-Links Brand Ready | ✓ | ok |
| `generate-biolink` (v17), `generate-mediakit`, `mediakit-bilder`, `change-username`, `cleanup-user-pages` | false | ja | Seiten in GitHub committen, Cloudflare-Cache leeren | `getUser` ✓ | `cleanup-user-pages` nur intern |
| `track-biolink-view`, `track-biolink-click` | false | ja | Zählung | UUID-Existenzprüfung | ok |
| `delete-account`, `datenauskunft`, `konto-warnung` | false | ja | DSGVO-Konto-Funktionen | `getUser` ✓ | ok |
| `newsletter-subscribe`, `newsletter-confirm`, `digest-unsubscribe` | false | ja | Double-Opt-In | Token | ok |
| `newsletter-signup` | false | nein | **Alt**: legt `pending`-Zeilen ohne Mail an | Rate-Limit im Speicher | Altlast, erreichbar |
| `generate-daily-digest` | false | ja | Wochen-News (Claude + Web-Suche) | **keine** | Cron ruft ohne Header; jeder kann Generierung auslösen (Kosten) |
| `send-weekly-digest-email` | false | ja | Wochenmail | **keine** | Cron ruft ohne Header; Dedupe über `digest_email_log` |
| `admin-tagesmail`, `apify-kosten-nachtragen` | false | ja | Cron | Service-Role **oder** `CRON_TOKEN` in URL | Token steht im Repo (2×) und in `cron.job` |
| `admin-dashboard` | false | ja | Admin-Schreibaktionen | `getUser` + `is_admin` | ok |
| `contact-submit` | false | nein | Kontaktformular → `contact_submissions` | keine; Längen ✓; **kein Honeypot, kein Rate-Limit** | von keiner Seite genutzt |
| `fetch-competitor-accounts` | true | nein | Apify Hashtag-Scan (Kosten) | `getUser`, **kein Admin-Check** | jeder eingeloggte Nutzer kann Apify-Läufe auslösen |
| `competitor-webhook` | false | nein | Callback; löscht/schreibt `competitor_accounts` für beliebige `ownerUserId` | keine | Altlast |
| `scan-managed-creator` | false | nein | Apify-Scan für `managed_creators` | **keine** (Kommentar: "nur intern") | jeder mit Creator-ID löst Kosten aus |
| `fetch-analytics`, `apify-webhook` | false | nein | **Alte** Analytics-Pipeline → `creator_analytics` | getUser / keine | schreibt Spalten, die es nicht mehr gibt; Webhook ohne Secret |
| `send-collab-reply` | false | nein | **Alt**: Anfragen-Antwort | getUser | liest gelöschte Tabelle `collab_requests` → Fehler |
| `get-admin-stats` | true | nein | Alt: Anthropic-Kostenreport | kein Admin-Check | liest fehlende Tabelle `admin_settings` → Fehler |
| `get-news-image`, `sync-news-images` | false | nein | Bildpool | keine | von `generate-daily-digest` genutzt? (prüfen) |
| `viuno-stripe-setup` | false | nein | Stripe-Preise anlegen (Einmal-Token) | `setup_tokens` | Live-Produkt-ID hartcodiert |
| `notify-new-request`, `viuno-config-check`, `viuno-modellvergleich`, `analysis-webhook-befunde-test`, `generate-style-mirror`, `store-news-image`, `resize-news-images` | – | – | **410-Stubs** | – | im Dashboard löschen |

Vom Client referenziert, aber **nicht deployed**: `track-mediakit-view` (kit/stradauno), `admin-api` (anderes Projekt). Repo-Kopien ohne Deploy-Abgleich (SHA-Vergleich steht aus): alle 21.

#### Cron (pg_cron, alle Zeiten **UTC**)

| Job | Zeitplan | Ruft | Auth |
|---|---|---|---|
| `daily-digest-generator` | Mo 04:00 | `generate-daily-digest` | keine |
| `weekly-digest-email-sender` | Mo 04:30 | `send-weekly-digest-email` | keine |
| `weekly-digest-email-nachzuegler` | Mo 06:00 | `send-weekly-digest-email` | keine |
| `digest-waechter` | Di 09:00 | SQL `digest_waechter()` | – |
| `fail-stale-analysis-runs` | alle 5 min | SQL | – |
| `purge-alte-analysedaten` | So 03:17 | SQL (24 Monate) | – |
| `purge-abgelaufene-freigaben` | 1. des Monats 03:23 | SQL | – |
| `admin-tagesmail` | täglich 05:00 | `admin-tagesmail?schluessel=…` | Token in URL |
| `apify-kosten-nachtragen` | stündlich :07 | `apify-kosten-nachtragen?schluessel=…` | Token in URL |

Letzte 14 Tage: alle Läufe `succeeded`. Fehlerbenachrichtigung: nur über `admin_errors` → Tagesmail (an `is_admin`-Konten, **nicht** an office@viuno.de).

#### Storage (alle 7 Buckets **public**)

| Bucket | Dateien | Größe | Limit / MIME | Zweck |
|---|---|---|---|---|
| `profile-images` | 18 | 11 MB | 5 MB; jpeg/png/webp/heic/heif | Profilbilder (Policies: eigener Ordner) |
| `mediakit-beitraege` | 6 | 2,2 MB | 2 MB; jpeg/png/webp | Media-Kit-Bilder (nur Edge Function) |
| `news` | 61 | 5,2 MB | – | Stockbilder News |
| `trend-images` | 74 | **147 MB** | 5 MB | **Altlast** (April), nichts liest sie |
| `Glenn` | 13 | 2,3 MB | – | **Altlast** |
| `Website`, `platform-icons` | 3 / 5 | 47 kB / 119 kB | – | Assets |

Auth-Konfiguration (Site URL, Redirect-URLs, E-Mail-Bestätigung, SMTP-Anbieter für Auth-Mails, Passwortregeln) ist **nicht per MCP lesbar** → Prüfung im Dashboard, siehe "Braucht Mehmet".

### 0.3 Stripe — Konto `acct_1S5Vx4LH6NVqx26e` ("StradaUno")

| Objekt | Live | Test |
|---|---|---|
| Produkt "viuno Analyse" | `prod_VEUNSFSahcHv1b`, tax_code `txcd_20030000` | `prod_VFpX1zJafGm21C` |
| Preise 9,99 € | `price_1UE1ZDLH6NVqx26e8yqbVlgp` (aktiv, **tax_behavior `exclusive`**), `price_1UE1P8…` (inaktiv) — **eine** Preis-ID, nicht je Plattform; **keine `stripe_prices`-Zeile mit `mode='live'`** | `price_1UFJsM…WXjnrZZ8` (instagram), `price_1UFJsM…rUwakYJ0` (tiktok) in `stripe_prices` |
| Webhook | `we_1UE28d…` → `…/functions/v1/stripe-webhook`, Event `checkout.session.completed`, enabled | (Test-Endpoints per MCP nicht abrufbar) |
| Payment Link | **`plink_1UE1bd…` aktiv** (`buy.stripe.com/6oUcN61Id8rf7ov9jc4ow0g`, Redirect `/app/?paid=1#/analytics`, ohne Consent/Plattform-Metadata) | – |
| Weitere Produkte | 14 **inaktive** Produkte aus anderem Geschäft (Logo-Erstellung, Coaching, "Unposted Set", "After Hours – Private Frames", "Buy Me a Coffee") | – |
| Checkout-Flow | SPA → `create-checkout-session` (Consent-Checkbox, `custom_text.submit` mit AGB/Widerruf/§ 19, `invoice_creation` mit Kleinunternehmer-Footer, `locale: de`) → Stripe → `success_url ?checkout=success` → SPA pollt `analysis_purchases` → Webhook trägt ein + Bestätigungsmail | |
| Modus | `VIUNO_STRIPE_MODE` = **test** (laut Admin/Käufen); Umschalten = Env + `stripe_prices`-Zeilen `live` | |

Kontoeinstellungen (Statement Descriptor, Support-E-Mail, Branding) sind per MCP nicht lesbar → "Braucht Mehmet".

### 0.4 Umgebungsvariablen und Secrets

| Variable | Wo | Genutzt von |
|---|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` | Supabase (automatisch) | alle Functions |
| `STRIPE_SECRET_KEY`, `STRIPE_SECRET_KEY_TEST`, `STRIPE_WEBHOOK_SIGNING_SECRET`, `STRIPE_WEBHOOK_SIGNING_SECRET_TEST`, `VIUNO_STRIPE_MODE` | Supabase Secrets | `create-checkout-session`, `stripe-webhook`, `viuno-stripe-setup` |
| `RESEND_API_KEY` | Supabase Secrets | alle Mail-Functions |
| `APIFY_TOKEN`, `APIFY_TOKEN_2` | Supabase Secrets | `start-analysis`, `analysis-webhook`, `apify-kosten-nachtragen`, Altlasten |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_ADMIN_KEY` | Supabase Secrets | `analysis-webhook`, `generate-daily-digest`, `get-admin-stats` (alt) |
| `GITHUB_TOKEN`, `CF_ZONE_ID`, `CF_TOKEN` | Supabase Secrets | `generate-biolink`, `generate-mediakit`, `change-username`, `cleanup-user-pages` |
| Cloudflare Pages Env | **keine** | `functions/news/[slug].js` nutzt den Publishable Key hartcodiert |
| `.env` im Repo | **keine** (ignoriert per `.gitignore`) | |
| **Hartcodiert im Repo** | Anon-JWT (3 Varianten: iat 1743702807 in `/kit/`, 1773653197 überall, 1774038873 in `bio-template.html`), Publishable Key `sb_publishable_…`, **`CRON_TOKEN`** in `admin-tagesmail` + `apify-kosten-nachtragen` (+ `cron.job`) | |
| Git-History (670 Commits) | keine `sk_`, `whsec_`, Service-Role-JWT, Resend-/Apify-/Anthropic-Keys gefunden; nur Anon-JWTs (+ einer eines fremden Projekts `jvdozdzvoqzvacqpyynd`) | `gitleaks` nicht installiert, Scan per Regex |

### 0.5 Externe Dienste und Kostenmodell

| Dienst | Wofür | Daten | Kosten |
|---|---|---|---|
| Cloudflare Pages + DNS | Hosting `viuno.de`, Cache-Purge per API | Zugriffslogs bei Cloudflare | Free |
| Supabase (Frankfurt) | DB, Auth, Storage, Edge Functions, Cron | alle Nutzerdaten | Plan unbekannt (Free/Pro) → prüfen |
| Stripe | Zahlung, Rechnung/Beleg | Name, E-Mail, Zahlungsdaten | 1,5 % + 0,25 € je EU-Karte ≈ 0,40 € pro 9,99 € |
| Apify (`apify~instagram-profile-scraper`, `apify~instagram-post-scraper`, `clockworks~tiktok-scraper`) | Öffentliche Profil-/Beitragsdaten | Handle, öffentliche Posts | ≈ 0,09 $ je Analyse (gemessen) |
| Anthropic API (Haiku 4.5 für Analyse; News-Generator mit Web-Suche) | KI-Texte | pseudonymisierte Kennzahlen, Captions | 1–3 ct je Analyse; News wöchentlich |
| Resend (`noreply@viuno.de`, `send.viuno.de` via Amazon SES eu-west-1) | Transaktions- und Wochenmails | E-Mail, Name | Free bis 3.000/Monat, 100/Tag |
| Google Workspace (MX `aspmx.l.google.com`) | Posteingang viuno.de | | bestehend |
| Supabase Auth Mails (Registrierung, Reset) | SMTP-Anbieter **unbekannt** (Supabase-Default = 2 Mails/h) | | prüfen |
| Google Fonts (`fonts.googleapis.com`) auf **fast jeder Seite**, `esm.sh` (supabase-js), `cdn.jsdelivr.net` (nur `/kit/`) | Schrift/JS von US-CDNs | IP-Adresse jedes Besuchers | Free, **DSGVO-relevant** |
| GitHub API | Seiten-Commits durch Generatoren | | Free |
| Zweites Supabase-Projekt `dodglijurmtrbwnjivlg` | Swipe-File `/karussell/` | intern | separat |

DNS `viuno.de`: SPF (`_spf.mx.cloudflare.net`, `amazonses.com`, `_spf.google.com` ~all) ✓ · DKIM `resend._domainkey` ✓ · DMARC `p=quarantine`, `rua=mailto:hello@viuno.de` (Postfach prüfen) ✓ · `send.viuno.de` SPF+MX für Resend ✓. `viuno.pro` ist **kein** DNS-Name, sondern der Instagram-Handle (`instagram.com/viuno.pro`).

### 0.6 Navigation und Verlinkung (Sitemap)

```
/  (Landing DE) ──► /app/ (Login) ──► #/dashboard ──► #/biolink | #/mediakit | #/analytics | #/brandready | #/digest | #/profile
   ├─ /app/#/analytics (Kachel "Analyse 9,99 € je Kanal")
   ├─ /news (Creator News) ──► /news/<slug>
   ├─ /legal#impressum | #agb | #datenschutz   (Footer)
   └─ Newsletter-Formular ──► Mail ──► /news-bestaetigt
/it/ (Landing IT) ──► /app/ ; Rechtstexte nur als Modal
/register  ──► /app/#/register ──► Mail ──► /onboarding ──► /app/#/onboarding
/reset-password (aus Mail)
/<slug> BioLink ──► mailto:contact_email, /kit/<slug>, Impressum-Sheet
/kit/<slug> Media Kit
/analyse/<token>, /brandready/<token> ──► / (CTA)
Mails: Kaufbestätigung/Analyse ──► /app/#/analytics ; Wochenmail ──► /news/<slug>, Abmelden ──► /digest-unsubscribed
Admin: /admin ──► /admin/news ; /admin/karusell ; /karussell ; /admina
Nicht verlinkt, aber live: /test/, /testi/, /pitch/1/, /extras/, /kit/ (generisch), /bio-template.html
```

Footer mit Rechtslinks haben: `/`, `/news/`, `/analyse/`, `/app/`, `/register`, `/stradauno/`. **Ohne** Rechtslinks: `/it/` (nur Modal), `/login/`, `/reset-password/`, `/legal/` selbst, `/kit/*`, `/antonietta/` (Impressum-Sheet aus `impressum_text`?), `/brandready/`, `/news-bestaetigt/`, `/digest-unsubscribed/`.

Kontaktadressen im Code: `mailto:kontakt@viuno.de` (6×), Reply-To `kontakt@stradauno.de` (Mails), Impressum `kontakt@stradauno.de` + Telefon, DMARC `hello@viuno.de`. **`office@viuno.de` kommt nirgends vor.**

Das Wort "kostenlos": `public/index.html:378`, `public/register/index.html:71`, `public/news/index.html:343–356`, `public/app/index.html:1800`.

---

## Was in Phase 1–3 passiert ist (Kurzfassung)

**Phase 1 — Sicherheit** (Commit `9b4964b`, Migrationen `launch_check_sicherheit_1`, `launch_check_digest_waechter_schluessel`, `launch_check_users_last_active_at`; Rückweg `ROLLBACK.sql`)
- RLS: `creator_analytics` nicht mehr anonym lesbar, `competitor_accounts` nicht mehr anonym schreibbar, `mediakit_aufrufe` nur für aktive Kits.
- 22 Funktionsrechte entzogen (Legacy-RPCs mit `p_user_id`, schreibende SD-Funktionen), `get_mediakit_views_last_7_days_daily` prüft `auth.uid()`.
- Tabellenrechte auf 16 Tabellen ohne Policy entzogen, TRUNCATE überall, DELETE auf `users`. `search_path` auf 21 Funktionen.
- Zwei Schlüssel im Supabase-Vault (`cron_schluessel`, `apify_webhook_schluessel`), nur Service Role darf sie prüfen/holen. Cron-Jobs 6/16/21/22/23 und `digest_waechter()` schicken den Schlüssel im Header `x-schluessel`. Alter `CRON_TOKEN` aus dem Code entfernt und **nicht mehr akzeptiert**. `generate-daily-digest`, `send-weekly-digest-email`, `admin-tagesmail`, `apify-kosten-nachtragen` verlangen ihn; `analysis-webhook` verlangt den Apify-Schlüssel, `start-analysis` hängt ihn an.
- 10 Altlast-Functions als 410-Stub mit `verify_jwt`; `contact-submit` mit Honeypot und Rate-Limit.
- Cloudflare `_headers`: HSTS, X-Frame-Options, Permissions-Policy, CSP (frame-ancestors scharf, Rest Report-Only), noindex für interne Pfade; `robots.txt` erweitert; `404.html`.
- Verifiziert per curl mit dem Anon-Key und per `SET ROLE authenticated` (Testkonto): eigene Daten lesbar, fremde nicht, öffentliche Views und Register-RPCs unverändert, alle Guards liefern 403, Stubs 410, Cron-Pfad end-to-end 200.

**Phase 2 — Recht** (Commit `f535518`, `LEGAL-CHANGES.md`, Sicherung `legal_texts_backup_20260915`)
- 19 Änderungen an den sechs Rechtstexten (Adressen, Sprachregel, tote OS-Plattform, Double-Opt-In-Nachweis, Local Storage, `page_views`, Edge-Function-Standort, Media-Kit-Datenherkunft).
- Google Fonts (22 Seiten) und esm.sh (16 Seiten/Skripte) durch lokale Dateien ersetzt — kein Aufruf an US-CDNs mehr beim Seitenaufruf.
- `/it/` mit Links auf `/legal`, ohne itrk.legal-iframe. "kostenlos" überall raus.

**Phase 3 — Zahlung** (dieser Commit)
- Stripe live: zwei neue Preise 9,99 € mit `tax_behavior: inclusive` (`price_1UFkAqLH6NVqx26ev8jnPcG7` Instagram, `price_1UFkAtLH6NVqx26eRgc5bEqh` TikTok), Zeilen `mode='live'` in `stripe_prices`. Alter Payment Link **deaktiviert**.
- `stripe-webhook` v9: Betrag/Währung werden geprüft (999 EUR, sonst Meldung statt Freischaltung), verzögerte Zahlarten über `checkout.session.async_payment_succeeded`, Test-Events werden im Live-Betrieb ignoriert. Repo-Kopie angelegt.
- `send-purchase-confirmation` v3, `send-analysis-email` v7: Reply-To `office@viuno.de`, Hinweis auf die Stripe-Rechnung. Repo-Kopien angelegt.
- Umschaltung Test → Live geschieht **nur** über Secrets (`VIUNO_STRIPE_MODE`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SIGNING_SECRET`); kein Key im Repo, Test-IDs nur in `stripe_prices`.
- Fehlerfälle geprüft: Webhook ohne/mit falscher Signatur → 400; Mail-Functions ohne Service-Role → 401; `start-analysis` ohne Login → Klartext ohne interne Details; Abbruch im Checkout → `?checkout=cancel` mit Toast; doppelter Kauf → zweite Freischaltung derselben Plattform (gewollt, kein Abo); Kauf ohne Login unmöglich (Checkout entsteht nur serverseitig mit JWT).

### Live-Schaltung: exakte Checkliste (Braucht Mehmet)

| Schritt | Wo | Wert |
|---|---|---|
| 1 | Stripe Dashboard → Entwickler → API-Schlüssel | `sk_live_…` kopieren |
| 2 | Supabase → Edge Functions → Secrets | `STRIPE_SECRET_KEY` = `sk_live_…` |
| 3 | Stripe Dashboard → Webhooks → Endpoint `we_1UE28dLH6NVqx26eJCcUtU1T` (Live) | Signing Secret `whsec_…` kopieren; **Events ergänzen**: `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed` (API-Änderung wurde vom Werkzeug abgelehnt) |
| 4 | Supabase → Secrets | `STRIPE_WEBHOOK_SIGNING_SECRET` = `whsec_…` (Live) |
| 5 | Supabase → Secrets | `VIUNO_STRIPE_MODE` = `live` |
| 6 | Supabase → Secrets | `STRIPE_WEBHOOK_SIGNING_SECRET_TEST` und `STRIPE_SECRET_KEY_TEST` **entfernen** (oder lassen — der Webhook ignoriert Test-Events im Live-Betrieb, aber weniger Secrets sind weniger Angriffsfläche) |
| 7 | Stripe → Produkt `prod_VEUNSFSahcHv1b` | Default-Preis auf `price_1UFkAqLH6NVqx26ev8jnPcG7` setzen, alten Preis `price_1UE1ZDLH6NVqx26e8yqbVlgp` archivieren (per API nicht möglich, weil er Default ist) |
| 8 | Stripe → Einstellungen → Öffentliche Details | Statement Descriptor `VIUNO`, Support-E-Mail `office@viuno.de`, Website `viuno.de` |
| 9 | Stripe → Einstellungen → E-Mails | „Rechnungen an Kunden senden" aktivieren (sonst gibt es keinen Beleg per Mail; die App zeigt keinen) |
| 10 | Test **vor** Schritt 5 | Einen Kauf im Testmodus mit Testkarte durchspielen: Checkout → Rückkehr → „Freigeschaltet ✓" → Kaufbestätigungs-Mail → Analyse starten → Ergebnis-Mail. Ich konnte den Checkout selbst nicht abschließen (keine Karteneingabe durch mich). |

---

## Befunde (Stand nach Phase 3)

Zähler: **Blocker 3 · Hoch 12 · Mittel 16 · Niedrig 8** — **gefixt 24 · offen 6 · braucht Mehmet 9**

| # | Bereich | Fund | Schwere | Status | Ort |
|---|---|---|---|---|---|
| 1 | Sicherheit | `creator_analytics` für anon komplett lesbar | **Blocker** | **gefixt** (Policy entfernt, getestet) | RLS |
| 2 | Zahlung | Stripe im Testmodus, keine `live`-Zeile in `stripe_prices`, Live-Preis `tax_behavior: exclusive` | **Blocker** | **gefixt** bis auf Keys: neue Live-Preise inklusive, `stripe_prices` befüllt; Keys + `VIUNO_STRIPE_MODE=live` → **braucht Mehmet** (Checkliste oben) | Stripe, `stripe_prices` |
| 3 | Zahlung | Alter Payment Link aktiv (ohne Widerrufs-Zustimmung, ohne Plattform) | **Blocker** | **gefixt** (deaktiviert) | Stripe `plink_1UE1bd…` |
| 4 | Sicherheit | `competitor_accounts` anon lesbar/schreibbar | Hoch | **gefixt** | RLS |
| 5 | Sicherheit | SD-RPCs geben fremde Zahlen heraus; schreibende SD-Funktionen von anon aufrufbar | Hoch | **gefixt** (22 Revokes, Guard in `get_mediakit_views_last_7_days_daily`) | Funktionen |
| 6 | Sicherheit | `CRON_TOKEN` im Repo und in `cron.job` | Hoch | **gefixt**: Vault-Schlüssel, alter Token wird nicht mehr akzeptiert. Wert: Supabase → Vault → `cron_schluessel` | Functions, Cron |
| 7 | Sicherheit | News-Functions ohne Auth (KI-Kosten, Mailversand) | Hoch | **gefixt** (Schlüssel im Header, 403 sonst) | `generate-daily-digest`, `send-weekly-digest-email` |
| 8 | Sicherheit | `analysis-webhook` ohne Secret | Hoch | **gefixt** (`schluessel` aus Vault, 403 sonst) | `analysis-webhook`, `start-analysis` |
| 9 | Sicherheit | Acht Altlast-Functions live aufrufbar | Hoch | **gefixt** (10 Stubs, 410, `verify_jwt`) | Supabase |
| 10 | Recht | Google Fonts von Google geladen | Hoch | **gefixt** (lokal) | alle Seiten |
| 11 | Recht | `/it/` ohne AGB/Widerruf, Privacy-iframe von itrk.legal (404) | Hoch | **gefixt** (Links auf `/legal`) | `public/it/index.html` |
| 12 | Betrieb | Auth-Einstellungen nicht prüfbar; Leaked-Password-Protection aus | Hoch | **braucht Mehmet** | Supabase Dashboard |
| 13 | Sicherheit | Keine HSTS/CSP/X-Frame-Options | Mittel | **gefixt** (CSP Report-Only, Rest scharf) — wirkt nach Merge | `public/_headers` |
| 14 | Sicherheit | `contact-submit` ohne Spam-Schutz | Mittel | **gefixt** (Honeypot `firma`, 3/h je IP, Header-Injection blockiert) | Edge Function |
| 15 | Sicherheit | `stripe-webhook` prüft Betrag nicht, verarbeitet Test-Events | Mittel | **gefixt** (v9) | `stripe-webhook` |
| 16 | Sicherheit | `mediakit_aufrufe` INSERT anon `true` | Mittel | **gefixt** (`is_mediakit_active`) | RLS |
| 17 | Funktion | `/kit/` generischer Renderer kaputt; `track-mediakit-view` nicht deployed | Mittel | offen → Phase 4 | `public/kit/` |
| 18 | Funktion | Keine `404.html` | Mittel | **gefixt** | `public/404.html` |
| 19 | SEO | Entwürfe/interne Seiten indexierbar | Mittel | **gefixt** (`robots.txt`, `X-Robots-Tag`) | |
| 20 | Marketing | "kostenlos", uneinheitliche Kontaktadresse | Mittel | **gefixt** (office@ überall; `hello@` nur in DMARC belassen → braucht Mehmet) | |
| 21 | Recht | Reply-To/Impressum `kontakt@stradauno.de` | Mittel | **gefixt** (office@viuno.de) | Functions, `legal_texts` |
| 22 | Betrieb | Fehler nur in `admin_errors`/Tagesmail an Admin-Konto | Mittel | offen → Phase 6 | |
| 23 | Betrieb | Functions ohne Repo-Kopie / ohne Abgleich | Mittel | **gefixt** für `start-analysis`, `stripe-webhook`, `send-purchase-confirmation`, `send-analysis-email`, `contact-submit`, `analysis-webhook` (alle 5 Dateien); Abgleich geprüft für `analysis-webhook`, `generate-biolink` | `supabase/functions/` |
| 24 | Datenbank | Backup-Tabellen, leere CRM-Tabellen, 147 MB `trend-images`, Bucket `Glenn` | Mittel | **braucht Mehmet** (Löschen nicht freigegeben; Rechte für anon/auth sind entzogen) | Supabase |
| 25 | Datenbank | Advisor: `search_path`, Extensions in `public`, FK-Indizes, RLS-Initplan | Mittel | `search_path` **gefixt**; Rest offen → Phase 4 | |
| 26 | Recht | Datenschutzerklärung unvollständig (DOI-Nachweis, Local Storage, `page_views`, Edge-Standort, App Stores) | Mittel | **gefixt** — anwaltlich gegenlesen (LEGAL-CHANGES D-5, D-6) → braucht Mehmet | `legal_texts` |
| 27 | Sicherheit | `DELETE`/`TRUNCATE`-Grants für anon/auth | Niedrig | **gefixt** | Grants |
| 28 | Sicherheit | Drei Anon-Key-Varianten | Niedrig | offen → Phase 4 | `bio-template.html`, `/kit/` |
| 29 | Funktion | `/extras/` schreibt direkt in `contact_submissions` | Niedrig | offen (Seite ist intern, noindex) | |
| 30 | Funktion | `sidebar.js`, ungenutzte `package.json`-Abhängigkeiten | Niedrig | offen → Phase 4 | Repo |
| 31 | Betrieb | Cron-Zeiten UTC | Niedrig | dokumentiert (0.2) | |
| 32 | Betrieb | DMARC `rua=hello@viuno.de` | Niedrig | **braucht Mehmet** (Postfach bestätigen oder auf office@ umstellen — DNS-Änderung, nicht von mir) | DNS |
| 33 | Stripe | 14 inaktive Fremdprodukte im Konto | Niedrig | **braucht Mehmet** (Stripe-Risk sieht "Digital Content"; Produkte löschen oder Konto trennen) | Stripe |
| 34 | Sicherheit | `get_bio_stats_flat` toter Code | Niedrig | **gefixt** (Rechte entzogen) | |
| 35 | Funktion | `users.last_active_at` wurde nie geschrieben — `authenticated` hatte kein UPDATE-Recht auf der Spalte, `merkeAktiv()` scheiterte still | Mittel | **gefixt** (Spaltenrecht) | Migration |
| 36 | Zahlung | Verzögerte Zahlarten (SEPA, Klarna) wurden nie freigeschaltet: `checkout.session.completed` kam mit `unpaid`, `async_payment_succeeded` war nicht abonniert | Hoch | **gefixt** im Code; Event am Endpoint ergänzen → **braucht Mehmet** (Schritt 3) | `stripe-webhook`, Stripe |
| 37 | Zahlung | Beleg: Stripe-Rechnung wird erzeugt, aber ob sie gemailt wird, hängt an einer Dashboard-Einstellung; die App zeigt keinen Beleg | Mittel | **braucht Mehmet** (Schritt 9) | Stripe |
| 38 | Funktion | Generierte BioLinks (`generate-biolink`) laden supabase-js von esm.sh; die Umstellung auf `/vendor/` ist im Repo (`template.ts`), aber **nicht deployed**, weil `/vendor/` erst nach dem Merge auf viuno.de liegt | Mittel | offen → **nach Merge deployen** (v19 = alter Stand) | `supabase/functions/generate-biolink` |

---

## Braucht Mehmet (wird fortgeführt)

1. **Live-Schaltung Stripe**: Checkliste oben (Schritte 1–10). Danach `stripe_webhook_events` beobachten.
2. **Supabase Dashboard → Auth**: Site URL `https://viuno.de`, Redirect-URLs auf `https://viuno.de/**`; Leaked-Password-Protection an; SMTP-Anbieter für Auth-Mails prüfen (Default: 2 Mails/h) → betrifft auch LEGAL-CHANGES D-6.
3. **Postfächer**: `office@viuno.de` bestätigt. `hello@viuno.de` (DMARC-Reports) unbestätigt → bestätigen oder DNS-Eintrag auf `office@` ändern.
4. **Neuer Cron-Schlüssel**: liegt im Supabase-Vault (`cron_schluessel`, `apify_webhook_schluessel`). Du musst nichts eintragen; die Functions lesen ihn per RPC. Bei Rotation: `select vault.update_secret(id, neuer_wert)` — sonst nichts.
5. **Rechtstexte gegenlesen lassen**: `LEGAL-CHANGES.md`, besonders D-5 (Edge-Functions außerhalb EU) und D-6 (Auth-Mails). Optional: Edge Functions per `x-region: eu-central-1` an Frankfurt binden.
6. **AV-Verträge** akzeptieren/abschließen: Supabase, Cloudflare, Stripe, Resend, Apify, Anthropic, GitHub (Liste in LEGAL-CHANGES).
7. **Instagram/TikTok-Scraping über Apify**: Plattformrisiko bewusst tragen (Sperre des Abruf-Dienstes möglich).
8. **Löschen freigeben**: 8 Backup-Tabellen (`analyse_stats_backup_*`, `backup_antonietta_*`, `legal_texts_backup_20260913/14`; `legal_texts_backup_20260915` erst nach Freigabe der Texte), Buckets `trend-images` (147 MB) und `Glenn`, 7 Stub-Functions (`notify-new-request`, `viuno-config-check`, `viuno-modellvergleich`, `analysis-webhook-befunde-test`, `generate-style-mirror`, `store-news-image`, `resize-news-images`) plus die 10 neuen Stubs, `viuno-stripe-setup` (Einmal-Werkzeug). Testkonto `launchcheck.test@example.com` (Auth-User + `users`-Zeile + Vault-Eintrag `launchcheck_testkonto`) nach dem Launch-Check löschen.
9. **Nach dem Merge**: `generate-biolink` aus dem Repo deployen (template.ts mit `/vendor/`), dann `/antonietta` einmal neu generieren; CSP-Report-Only eine Woche in der Browser-Konsole beobachten, dann scharf stellen.
10. **Supabase-Plan und Backups** nennen (Free: keine PITR).
11. **Stripe-Konto**: 14 inaktive Produkte eines anderen Geschäfts — entfernen oder getrenntes Konto.
