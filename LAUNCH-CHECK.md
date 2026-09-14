# LAUNCH-CHECK — viuno vor der aktiven Bewerbung

**Stand:** 15. September 2026 · **Branch:** `launch-check` · **Prüfer:** Claude (Security · Datenschutz/Recht · Backend · UX · Marketing)
**Status:** Phase 0 (Inventar) abgeschlossen. Phasen 1–7 folgen nach Freigabe.

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

## Befunde (Stand nach Phase 0 — noch nichts gefixt)

Zähler: **Blocker 3 · Hoch 9 · Mittel 14 · Niedrig 8** — gefixt 0 · offen 34 · braucht Mehmet (siehe Liste unten)

| # | Bereich | Fund | Schwere | Status | Ort |
|---|---|---|---|---|---|
| 1 | Sicherheit | `creator_analytics` ist für **anon** komplett lesbar (Policy `anon read creator_analytics` = `true`): Follower, ER, Captions, KI-Insights aller Nutzer | **Blocker** | offen | Supabase RLS |
| 2 | Zahlung | Stripe läuft im **Testmodus**; `stripe_prices` hat keine `live`-Zeile; Live-Preis hat `tax_behavior: exclusive`; nur eine Live-Preis-ID statt zwei | **Blocker** | offen | `create-checkout-session`, `stripe_prices`, Stripe |
| 3 | Zahlung | Alter **Payment Link** ist live und aktiv: Kauf ohne Widerrufs-Zustimmung, ohne Plattform, ohne § 312j-Button — Webhook verbucht ihn als Instagram | **Blocker** | offen | Stripe `plink_1UE1bd…` |
| 4 | Sicherheit | `competitor_accounts`: Policy `service_all` (`true/true` für `public`) → anon kann lesen, schreiben, löschen | Hoch | offen | Supabase RLS |
| 5 | Sicherheit | SD-RPCs mit `p_user_id` (`get_platform_stats`, `get_bio_*`, `get_biolink_views*`, `get_mediakit_views_*`) geben Zahlen **fremder** Konten heraus; `update_biolink_view_aggregates`, `record_consent`, `track_bio_view`, `log_error`, `purge_*` von anon **schreibend** aufrufbar | Hoch | offen | Supabase Functions |
| 6 | Sicherheit | `CRON_TOKEN` steht im Repo (2 Functions) und in `cron.job` → **muss rotiert** und aus dem Code raus (Vault/Secret) | Hoch | offen | `supabase/functions/admin-tagesmail`, `apify-kosten-nachtragen` |
| 7 | Sicherheit | `generate-daily-digest` und `send-weekly-digest-email` ohne jede Auth: jeder kann KI-Generierung (Kosten) bzw. Mailversand auslösen | Hoch | offen | Edge Functions + `cron.job` |
| 8 | Sicherheit | `analysis-webhook` (Apify-Callback) ohne Secret: mit fremder Run-ID/UUID manipulierbar | Hoch | offen | `analysis-webhook` |
| 9 | Sicherheit | Altlast-Functions live und aufrufbar: `scan-managed-creator` (Apify-Kosten ohne Auth), `fetch-competitor-accounts` (jeder Login → Apify), `competitor-webhook`, `apify-webhook`, `fetch-analytics`, `send-collab-reply`, `newsletter-signup`, `get-admin-stats` | Hoch | offen | Supabase Dashboard |
| 10 | Recht | Google Fonts von `fonts.googleapis.com` auf fast allen Seiten (IP-Übermittlung in die USA, Abmahnrisiko DE) — in der Datenschutzerklärung? (Phase 2) | Hoch | offen | alle `index.html` |
| 11 | Recht | `/it/`: Rechtstexte nur als Modal, nicht aus `legal_texts`, ohne AGB/Widerruf | Hoch | offen | `public/it/index.html` |
| 12 | Betrieb | Supabase Auth: Site-URL/Redirects/SMTP/Leaked-Password-Protection nicht prüfbar per MCP; **Leaked-Password-Protection ist aus** (Advisor) | Hoch | braucht Mehmet | Supabase Dashboard |
| 13 | Sicherheit | Keine HSTS, CSP, X-Frame-Options auf `/app/`, `/admin/`, Landing | Mittel | offen | `public/_headers` |
| 14 | Sicherheit | `contact-submit` ohne Honeypot/Rate-Limit (derzeit von keiner Seite genutzt) | Mittel | offen | Edge Function |
| 15 | Sicherheit | `stripe-webhook` prüft Betrag/Preis nicht; verarbeitet Test-Events, solange `…_TEST`-Secret gesetzt ist | Mittel | offen | `stripe-webhook` |
| 16 | Sicherheit | `mediakit_aufrufe` INSERT für anon `true` (Zählungen für jede UUID fälschbar) | Mittel | offen | RLS |
| 17 | Funktion | `/kit/` generischer Renderer kaputt (alter Key, fehlende View, `veuno.de`); `track-mediakit-view` nicht deployed | Mittel | offen | `public/kit/index.html`, `public/kit/stradauno/` |
| 18 | Funktion | Keine `404.html` → jede unbekannte URL liefert die Landing mit 200 | Mittel | offen | `public/404.html` |
| 19 | SEO | `/test/`, `/testi/`, `/admina/`, `/extras/`, `/admin/karusell/` indexierbar bzw. nicht in robots.txt | Mittel | offen | `robots.txt`, `_headers` |
| 20 | Marketing | "kostenlos" an 4 Stellen; Kontaktadresse uneinheitlich (`kontakt@viuno.de`, `kontakt@stradauno.de`, `hello@viuno.de`), `office@viuno.de` fehlt überall | Mittel | offen | s. 0.6 |
| 21 | Recht | Reply-To der Kauf- und Analyse-Mails `kontakt@stradauno.de` statt office@viuno.de; Impressum nennt `kontakt@stradauno.de` | Mittel | offen / braucht Mehmet | Functions, `legal_texts.impressum` |
| 22 | Betrieb | Fehler landen nur in `admin_errors` + Tagesmail an Admin-Konto, kein Alert an office@viuno.de, kein Uptime-Check | Mittel | offen | Phase 6 |
| 23 | Betrieb | Repo-Kopien der 21 Functions ohne SHA-Abgleich mit Deploy; 10 relevante Functions (u. a. `stripe-webhook`, `create-checkout-session`, `start-analysis`) **ohne** Repo-Kopie | Mittel | offen | `supabase/functions/` |
| 24 | Datenbank | 8 Backup-Tabellen, 5 leere CRM-Tabellen, `subscriptions`, `biolink_settings`/`biopage_public` (Altbestand), 147 MB `trend-images`, Bucket `Glenn` | Mittel | offen (Löschen nur mit Freigabe) | Supabase |
| 25 | Datenbank | 21 Funktionen ohne `search_path`, `pg_net`/`vector` in `public`, 17 FKs ohne Index, 52 RLS-Policies mit `auth.uid()` statt `(select auth.uid())` | Mittel | offen | Supabase Advisor |
| 26 | Recht | `/it/` Newsletter/Kontakt-Modal: Rechtsgrundlagen prüfen (Phase 2) | Mittel | offen | |
| 27 | Sicherheit | `anon`/`authenticated` haben `DELETE`/`TRUNCATE`-Grants auf allen Tabellen (RLS deckt, aber unsauber) | Niedrig | offen | Grants |
| 28 | Sicherheit | `bio-template.html` mit drittem Anon-Key, `/kit/` mit altem Anon-Key — Keys angleichen | Niedrig | offen | |
| 29 | Funktion | `/extras/` schreibt direkt in `contact_submissions` (scheitert an RLS) | Niedrig | offen | `public/extras/index.html` |
| 30 | Funktion | `sidebar.js` im Repo-Root, `package.json` mit ungenutzten Abhängigkeiten, kein Lockfile (`npm audit` nicht möglich) | Niedrig | offen | Repo |
| 31 | Betrieb | Alle Cron-Zeiten UTC (Wochenmail 04:30 UTC = 06:30 MESZ, ok) — dokumentieren | Niedrig | offen | |
| 32 | Betrieb | DMARC `rua=hello@viuno.de` — existiert das Postfach? | Niedrig | braucht Mehmet | DNS |
| 33 | Stripe | 14 inaktive Fremdprodukte im selben Konto (Risk-Profil "Digital Content") | Niedrig | braucht Mehmet | Stripe |
| 34 | Sicherheit | `get_bio_stats_flat` verweist auf nicht existierende Tabelle (toter Code) | Niedrig | offen | Supabase |

---

## Braucht Mehmet (wird fortgeführt)

1. **Supabase Dashboard → Auth:** Site URL = `https://viuno.de`, Redirect-URLs auf `https://viuno.de/**` begrenzen; Leaked-Password-Protection einschalten; prüfen, welcher SMTP-Anbieter Auth-Mails verschickt (Default: 2 Mails/Stunde — zu wenig für eine Bewerbung).
2. **Stripe Dashboard:** Statement Descriptor "VIUNO", Support-E-Mail `office@viuno.de`, Branding; alten Payment Link deaktivieren (kann ich per API, wenn du freigibst).
3. **Postfächer:** existieren `office@viuno.de` und `hello@viuno.de`? Wenn nein: anlegen oder DMARC-`rua` ändern.
4. **`CRON_TOKEN` rotieren** (ich bereite Code + Cron-Befehl vor, du setzt das neue Secret im Dashboard).
5. **Live-Keys** (nach Phase 3): `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SIGNING_SECRET` in Supabase Secrets; `VIUNO_STRIPE_MODE=live`; `STRIPE_WEBHOOK_SIGNING_SECRET_TEST` entfernen.
6. **Supabase-Plan** und Backup-Stand nennen (Free: keine PITR, 7 Tage Backups nur Pro).
7. Freigabe zum **Löschen** von Altlasten: 7 Stub-Functions, 8 Backup-Tabellen, Buckets `trend-images`/`Glenn`, Alt-Functions aus #9.
