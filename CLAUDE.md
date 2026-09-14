# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project nature

`bioseiten` ("CreatorOS Bio Pages") is a **static site of standalone HTML files** under `public/`, deployed on **Cloudflare Pages** with publish directory `public/` — a push to GitHub triggers the deploy. There is no bundler, no framework, no tests. `npm run build` is a no-op (`echo 'No build step needed'`). All server-side logic lives in **Supabase Edge Functions** (managed in the Supabase dashboard, not in this repo). The `package.json` dependencies (`@netlify/blobs`, `@supabase/supabase-js`) are not used by the client HTML — `@netlify/blobs` is a leftover and nothing in the tree imports it.

To preview locally, serve `public/` with any static server (e.g. `npx serve public`) — opening files via `file://` breaks the ES-module imports used by the auth pages.

## Working on this repo

**The working branch is `main`, and every push goes live on viuno.de immediately.** There is no staging step: Cloudflare Pages builds `main` on push. Before you change anything, sync:

```bash
git fetch
git pull
```

The repo owner also edits files directly through the GitHub web UI, so `main` moves without local commits. Pulling first is not optional — a stale checkout has already caused one 197-commit divergence.

Push in small, reviewable commits, and check `git diff --name-only origin/main HEAD` before pushing so you know exactly which pages go live.

`app-spa` is the branch the SPA was built on. It is kept for history and is not maintained any more.

## The SPA under `/app/`

`public/app/index.html` is a single-file hash-router SPA that carries the whole logged-in app. **Since the redesign it is the only implementation.** `public/dashboard/`, `public/profile/`, `public/biolink/`, `public/mediakit/` and `public/digest/` are now 32-line redirect stubs to the matching SPA route — the same treatment `public/analytics/` already had, and for the same reason: two copies of one view had to be kept in step by hand, and that is exactly how the `saveBioHandles` bug happened. Old links, bookmarks and the weekly mail (which links `viuno.de/mediakit`) keep working through the redirect. Still real pages: `public/login/`, `public/register/`, `public/onboarding/`, `public/reset-password/` (entry points), plus the public share pages `public/news/`, `public/analyse/`, `public/brandready/` and `public/extras/` — the last one brings its own sidebar and `sidebar.js` and is untouched by the app's navigation.

- Routes: `#/login`, `#/register`, `#/onboarding`, `#/dashboard`, `#/analytics`, `#/brandready`, `#/biolink`, `#/mediakit`, `#/digest`, `#/profile`. (`#/digest` is the Creator-News view — the route name predates the rename.) Each is a `renderX(area, ctx)` that renders into `#content-area`. Unknown hashes fall back to `#/dashboard`.
- **Navigation is a bottom tab bar with five targets, not a sidebar.** Ten routes map onto five tabs via `TABS`; `SUBNAVS` gives two of them a pill row that the *router* renders into `#subnav` — `seiten` switches BioLink ↔ Media Kit, `analyse` switches Analyse ↔ Brand Ready. The views do not build that row themselves, on purpose: four views would otherwise each carry a copy of it. `setActiveMenuItem` does both jobs. `openSidebar`/`closeSidebar` survive as empty stubs because the router still calls `closeSidebar()` on every route change.
- **Logout lives in the Profil view.** It used to sit in the sidebar footer; when the sidebar went, it would have disappeared entirely.
- `ctx.stale` guards late query answers after a route change; `ctx.onCleanup` / `ctx.on` / `ctx.interval` remove listeners, timers and subscriptions when a route is left. Use them — a view must not leave anything behind.
- View state lives in one module-level object per view (`pv`, `blv`, `mkv`, `anv`, `dgv`, `rqv`, `obv`), nulled on cleanup.
- Where the source pages used the same global name for different things, the SPA renames: `saveBioProfile`, `saveBioHandles`, `mkSaveProfile`, `mkSaveImpressum`, `mkConfirmDelete`, `mkSelectLang`, `setReqFilter`, `renderAnalyticsContent`, `digestCardHtml`, `renderReqList`. **This list is load-bearing.** `saveBioHandles` was missed until 14.09.2026: the BioLink and the Analyse view both defined `window.saveHandles`, the later definition won, and the "Social Kanäle" sheet saved nothing at all — silently, because the Analyse version returns early when `anv` is null. `grep -o "^window\.[A-Za-z0-9_]*" public/app/index.html | sort | uniq -d` must stay empty.
- Three `fmt` variants coexist on purpose (`fmt`, `fmtCount`, `fmtNum`) because the source pages round differently. Don't unify them without checking every call site.

**The "keep the standalone page in step with the SPA view" rule is gone** — there is no second copy left to keep in step. Do not recreate one: a new logged-in screen belongs in `public/app/index.html` as a route, not as another page under `public/`.

## The design system (redesign, 14.09.2026)

The app runs on one token block in `:root` at the top of `public/app/index.html`. There are ~1.340 `var(--…)` uses and almost no colour literals outside that block — **keep it that way**, because that is the only reason a dark mode is a second token block rather than a rewrite.

- **Light is the app.** Background `#f6f5fa`, cards white with a 1 px border *and* `--sh-card`, radius `--r-md` (18 px).
- **Numbers are monospace.** One rule near the top of the stylesheet puts `--mono` plus `tabular-nums` on every number class (`.dash-card-value`, `.kpi-value`, `.c-num`, `.bl-wert`, `.br-gewinn`, …). Equal digit width is the point: 18.400 and 19.200 are then exactly as wide as each other, so the difference shows in the digit and not in the length. **A new number class has to be added to that list**, or it silently falls back to Inter.
- **The signature is the creator's own.** `--v1/--v2/--v3` carry the gradient of the BioLink theme the creator picked. `ladeSignatur()` reads `biolink_viuno.theme` at session load and stamps `data-thema="dark"|"clean"` on `<html>`; `color` is the default and needs no attribute. Both theme pickers (`pickThemeCard`, the Design sheet) set it immediately so the choice is visible before the page is regenerated. If the query fails, the default stays — the app is never wrongly coloured, only default-coloured.
- **Colour means something.** Green = done or a best value, red = something is missing, the signature gradient = something you can still gain. `.br-gewinn` deliberately moved off green for that reason.
- **Four sizes carry the app**: `--t-2xl` page title, `--t-xl` card/section title, `--t-md` body and rows, `--t-xs`/`--t-2xs` meta. The smaller steps still exist for legacy call sites; do not introduce new ones.
- **The Analyse cockpit (`.ckpt`) stays dark on purpose** and defines its own `--c-*` palette that inherits nothing. The comment above it gives the reason: the analysis is the paid product and should read like an instrument. `body.analyse-dunkel` additionally darkens the chrome around it while that route is open — it is the one dark surface left in an otherwise light app, and it is a deliberate exception, not an oversight.

## Routing model

Each subdirectory of `public/` is a route via its `index.html`. Cloudflare Pages reads `public/_redirects` (SPA fallback for `/app/*`, plus `.html` → directory redirects for the legal pages and `/analyse/*`) and `public/_headers` (frame/robots lockdown for `/karussell/*`). There is no `_routes.json`. Two patterns coexist:

- **Hand-built creator pages** — one HTML file per creator, with the creator's UUID, copy, links, and contact form hardcoded inline. Examples: `public/stradauno/`, `public/easyglenn/`, `public/antonietta/`, `public/kit/easyg/`, `public/kit/kross/`, `public/kit/stradauno/`. These are usually heavily minified into 1–7 lines.
- **Dynamic, slug-driven page** — `public/kit/index.html` reads the slug from `window.location.pathname` and queries the `media_kit_public` view in Supabase. This is the *generic* media-kit renderer; the per-creator files under `public/kit/<slug>/` are pre-rendered overrides of it.

**One Cloudflare Pages Function exists**, at `functions/news/[slug].js` — note: repo root, *not* under `public/`, because Pages looks for `functions/` next to the build output. It serves `/news/<slug>` by fetching `public/news/index.html` through `env.ASSETS` and rewriting the `<title>`, `canonical` and `og:*` tags with that news item's headline and summary. It exists because WhatsApp, iMessage and Instagram never run JavaScript — a client-side `og:title` is invisible to them, so a shared link would have no preview. This is the only server-side piece in an otherwise purely static deploy; keep it that way unless there is the same kind of hard reason.

`public/bio-template.html` is a server-side template containing `{{DISPLAY_NAME}}`, `{{BIO}}`, `{{OG_IMAGE}}` placeholders — presumably rendered by an external tool (Cloudflare Worker is mentioned in a comment as "Stufe B"). Don't edit it expecting client-side substitution.

## App pages vs. landing pages

Two very different page types share `public/`:

1. **Public landing/creator pages** (`/`, `/it/`, `/stradauno/`, `/easyglenn/`, `/agb/`, `/datenschutz/`, …) — pure HTML/CSS, may include:
   - A contact button that is a plain `mailto:` link to the creator's `users.contact_email`. There is **no** contact form and no `collab_requests` table any more — see "Anfragen removed" below.
   - A fire-and-forget tracking pixel: `POST /functions/v1/track-bio-view` or `/functions/v1/track-mediakit-view` with the creator's `user_id`.

2. **The authenticated app** (`/app/`, plus `/login/`, `/register/`, `/onboarding/`, `/reset-password/`) — loads `@supabase/supabase-js@2` from `https://esm.sh` as an ES module, does `signInWithPassword` against Supabase Auth, and reads/writes tables like `users`, `creator_analytics`, `daily_digest`, `biolink_settings`, `biolink_viuno`. Sessions persist in localStorage (`persistSession:true`).

`public/index.html` runs an early language-detection redirect: if `navigator.languages[0]` starts with `it`, it sets `sessionStorage.viuno-lang-redirected` and replaces location with `/it/`. The flag is intentional — it prevents loops if the user manually navigates back to DE.

## Backend

A single Supabase project: `https://bzejndghppuipnedasuv.supabase.co`. Two anon JWTs appear in the codebase:

- The newer one (`iat:1773653197`) is used by the auth-gated app pages and `public/onboarding/`, `public/dashboard/`, etc.
- An older one (`iat:1743702807`) is hardcoded in `public/kit/index.html`. If you touch that file, decide whether to align it with the newer key — they correspond to different key-rotation moments on the same project.

The `sb_publishable_vVbpikuwqnh5jBTdvxcm7g_R4pZsMXI` token is a Supabase publishable key, distinct from the JWT — leave it alone unless rotating both ends.

Edge Functions referenced from the client (not in this repo — managed in Supabase dashboard): `track-bio-view`, `track-mediakit-view`, `fetch-analytics`, `contact-submit`.

**Authenticating a user inside an Edge Function: always `supabase.auth.getUser(token)`.** Never decode the JWT by hand. Several functions used to do

```ts
const payload = JSON.parse(atob(token.split('.')[1]))   // NEVER DO THIS
const userId = payload.sub
```

which reads the middle of the token and checks no signature at all. Combined with `verify_jwt: false` — which every one of these functions needs, because the gateway would otherwise reject the CORS preflight — anyone who knows a user's UUID could forge a token and act as that user. The UUIDs are public: they sit in the tracking pixel of every hand-built creator page. On 14.09.2026 this was fixed in `delete-account` (foreign accounts were deletable), `change-username` (foreign BioLinks were switchable off) and `admin-dashboard` (all users, the newsletter list and the landing-page contact requests were readable without an account). `notify-new-request` had the same hole and is a 410 stub. If you add a function that acts on behalf of a user, copy the auth block from `generate-biolink` or `start-analysis`.

**Exception: the three Creator-News functions live in this repo** under `supabase/functions/` — `generate-daily-digest`, `send-weekly-digest-email`, `digest-unsubscribe`. They are still *deployed* from the Supabase dashboard (there is no CI for them), so the repo copy is documentation, not the deployment source: **after editing one, deploy it, and after changing it in the dashboard, copy it back.** They were put here because a silent, unlogged failure in `generate-daily-digest` went unnoticed for 109 days and nobody could read the code to find out why.

## Creator News

The legal texts in `legal_texts` were brought in line on 14.09.2026: no more Anfragen feature, and the news are weekly, not a "Daily Digest".

The news pipeline runs weekly: `generate-daily-digest` (pg_cron Monday 04:00 UTC) searches a **fixed domain whitelist** — platform newsrooms plus German trade and legal press — with Claude's server-side web search, and writes up to 5 cards into `daily_digest` (`date` = that Monday, UNIQUE). Cards that are flagged `is_repeat` or that link to a rolling collection page are dropped in code, and what survives is stored sorted by `relevance_score`.

The prompt's **"Treue zur Quelle"** section is load-bearing, not boilerplate. A comparison against the original articles found the model inverting a scope exclusion (the source exempted thumbnails; the card warned exactly those creators), attributing statements to a platform that the article never quotes, and padding with invention while omitting the concrete steps the source did give. The cause was the length requirement — demanding 180–300 words from a 200-word source forces filling. Hence: length follows the source (120–300), and **`impact` may be `null`** when the source gives no concrete step. An edition with fewer cards, shorter cards, or cards without an action line is the intended outcome, not a failure.

Urgency shown in the UI comes from `relevance_score` (≥8 / ≥6 / below), **not** from the model's `level` field — that one had "hoch" on a score-7 shop item and "info" on a score-5 one.

Three consumers read the **same two views**, never the raw jsonb: `digest_cards_today` (the single most recent edition) and `digest_cards_past` (everything older). Both compute `slug` via `news_slug(date, headline)` — the slug is derived, not stored, so it also covers historical rows. The consumers are the SPA view `renderDigest`, the public page `public/news/`, and the weekly mail. Going through the views is what keeps order, slugs and content identical across app, mail and public page — do not go back to reading `cards` directly.

- **The weekly mail goes to `newsletter_subscribers`, not to `users`.** Until 14.09.2026 it queried `users` with `newsletter_subscribed = true`, so anyone who signed up on the public page without an account and confirmed by e-mail was never written to — the whole double-opt-in path collected addresses nobody mailed. `users.newsletter_subscribed` stays as the mirror that the app reads (kept in sync by the `newsletter_spiegeln` trigger); it is not the recipient list.
- **The unsubscribe link carries the row's token.** `digest-unsubscribe` was switched to `newsletter_subscribers.token` while the sender still built an HMAC over the user id, which that function rejects as `invalid` — every "Abmelden" click landed on an error page. Dedupe now runs on `digest_email_log.subscriber_id`; the column was already there.
- `public/news/` is **public, no login**, reads the two views with the publishable key, and is the target of every shared link and every link in the mail.
- `public/digest/` is the *logged-in* standalone page and a login wall. Do not link the public site at it.
- `page_views` records opens (`page`, `source` = app/public/share/mail, optional `card_slug`); anonymous insert is allowed, users read their own rows, admins read all. Without it there is no way to tell whether the news are read at all — and the sidebar dot on "Creator News" is derived from it: it shows while the newest edition is newer than that user's last `page='news'` view.
- `digest_waechter()` (pg_cron Tuesday 09:00) checks whether the week's edition exists, logs to `admin_errors` and re-triggers the generator if it does not. `weekly-digest-email-nachzuegler` (Monday 06:00) is a second, idempotent attempt at the mail.
- **`public/admin/news/`** is the editorial screen: admins fix or delete individual cards after the fact. There is deliberately **no approval gate** — the news go live as generated, and this is the correction path. It rewrites the whole `cards` array of a row, because single cards have no key of their own; removing the last card deletes the row, since an edition with zero cards would render as an empty week. RLS: `daily_digest` update/delete require `is_admin()`.
- **Images are back and must stay small.** The 61 stock photos averaged 2.2 MB (131 MB total) and were briefly switched off for that reason; they are now 900 px / ~85 kB each (5.2 MB total). Supabase image transformation is not available on this plan, and resizing inside an Edge Function fails — `imagescript` decodes JPEG to raw RGBA and blows the memory limit on files as small as 1 MB. If new images are ever added, **resize them before upload**.
- The `approved` card field is gone; nothing ever read it. `digest_bookmarks` existed briefly and was dropped again.

## Anfragen removed (14.09.2026)

The collab-request feature is gone, root and branch. What used to exist: a
two-slide form overlay (`#cf-overlay`) on every BioLink page that POSTed
straight to `collab_requests`, an `Anfragen` view in the SPA and at
`/requests/`, four insert/update triggers, and the `notify-new-request` Edge
Function that mailed the creator.

What replaces it: the contact button on a BioLink page is a plain
`mailto:<contact_email>?subject=<localised>` link, built in `renderLinks()`.
**If `users.contact_email` is empty the button is not rendered at all** — the
address is optional and is edited in the app under BioLink → Kontakt-E-Mail
(`saveBioContactEmail`), which also triggers a page regeneration because the
page is static. The Media Kit reads the same `users.contact_email`.

Consequences worth knowing:

- `collab_requests` and `collab_request_activities` are dropped, as are
  `trigger_notify_new_request`, `update_new_requests_count`,
  `handle_collab_request_activity`, `block_empty_collab_note`, the RPC
  `get_dashboard` and the column `users.new_requests_count`.
- `handle_new_user` no longer inserts the "viuno Team" demo request. New
  accounts start with an empty app, not with a fake first request.
- `notify-new-request` is a 410 stub with `verify_jwt: true`. It was reachable
  **unauthenticated** and took the record straight from the request body, so
  anyone with a creator UUID could send mail from `noreply@viuno.de` to that
  creator with a Reply-To of their choosing. Delete the function in the
  Supabase dashboard when convenient; the stub only exists because the MCP
  tooling cannot delete functions.
- `generate-biolink` is the live source for every generated page, and a copy of
  its source now lives in `supabase/functions/generate-biolink/` — same
  deal as the Creator-News functions: the repo copy is documentation, the
  dashboard is the deployment source. **Edit one, deploy it; change it in the
  dashboard, copy it back.** Deployed version at the time of writing: v17.

## BioLink-Auswertungen

Die oeffentlichen Seiten zaehlen **ohne Einwilligung und ohne Banner**: kein
Cookie, kein localStorage, keine IP, kein User-Agent, keine Geraetekennung.
Gespeichert wird nur, *was* passiert ist — Herkunft, Stunde, Sprache, Art des
Links. Ohne Wiedererkennung gibt es keinen Personenbezug, und genau deshalb
braucht keine BioLink-Seite einen Cookie-Banner. **Wer hier etwas ergaenzt,
das einen Besucher ueber zwei Aufrufe hinweg wiedererkennbar macht, macht den
Banner noetig.** Das ist die Grenze, nicht eine Vorliebe.

Zwei Tabellen, beide nur ueber den Service Role beschreibbar (keine
Insert-Policy), lesbar nur vom eigenen Account (`auth.uid() = user_id`):

- `biolink_aufrufe` — ein Aufruf. `referrer_source`, `hour_of_day`, `language`.
- `biolink_klicks` — ein Klick. `art` (instagram, tiktok, youtube, threads,
  kontakt, custom), `label`, `link_id` (FK auf `biolink_custom_links`,
  `ON DELETE SET NULL`), `hour_of_day`.

Zwei Edge Functions schreiben sie, beide `verify_jwt: false`, beide mit
Repo-Kopie unter `supabase/functions/`: `track-biolink-view` und
`track-biolink-click`. Beide pruefen, dass die `user_id` existiert — sie steht
im Quelltext jeder oeffentlichen Seite, ohne die Pruefung liesse sich die
Tabelle mit beliebigen UUIDs vollschreiben. `track-biolink-click` uebernimmt
eine `link_id` nur, wenn der Link demselben Account gehoert.

**Der Body wird mit `req.text()` + `JSON.parse` gelesen, nicht mit
`req.json()`.** Klicks kommen per `navigator.sendBeacon`, und sendBeacon kann
keine Header setzen: der Body geht als `text/plain` raus. Das ist Absicht —
`text/plain` loest keinen CORS-Preflight aus, ein Klick bleibt genau ein
Request und haelt das Weiterspringen zum Ziel nicht auf.

Die Anzeige in der SPA (`renderBiolink`) liest vier SECURITY-INVOKER-RPCs, alle
mit `p_tage` und **ohne** `user_id`-Parameter — sie filtern selbst auf
`auth.uid()`, damit eine fremde UUID nichts herausgibt: `biolink_herkunft`,
`biolink_stunden` (linker Join auf `generate_series(0,23)`, damit leere Stunden
als Luecke erscheinen), `biolink_klick_zahlen` und `biolink_klickrate`.

**Die Klickrate hat eine eigene Funktion, weil beide Seiten des Bruchs ab
demselben Moment zaehlen muessen.** Aufrufe gibt es seit April, Klicks erst,
seit die Seite mit dem Zaehler erzeugt wurde. Gegen 30 Tage Aufrufe gerechnet
stand dort 1 % statt 44 % — und das waere 30 Tage lang so geblieben, also
genau so lange, wie jemand die Zahl zum ersten Mal anschaut.
`biolink_klickrate` zaehlt ab dem ersten erfassten Klick (hoechstens `p_tage`
zurueck) und gibt `seit` mit heraus, damit die App den Stichtag nennen kann. Rohe Referrer werden von
`biolink_quelle(roh text)` auf Namen abgebildet (Instagram, Threads, TikTok,
YouTube, Facebook, LinkedIn, X, WhatsApp, Pinterest, Google, viuno, Direkt,
Andere) — `l.instagram.com` und `instagram.com` landen dadurch im selben Topf.

Gezaehlt wird der Aufruf **nach** `applyLanguage()`, nicht davor: vorher stand
`currentLang` noch auf dem Startwert und die Spalte `language` enthielt
ausnahmslos `'de'`.

`public/stradauno/` ist handgebaut und zaehlt auf denselben Account mit. Deshalb
prueft `track-biolink-view` bewusst **nicht** auf `bio_active` — der generierte
BioLink dieses Accounts ist aus.

## The Profil view

Rebuilt 14.09.2026. Structure: the **outside view** on top — a card showing exactly what stands on the BioLink and the Media Kit, with links to both — then two groups of compact rows, "Öffentliche Angaben" and "Nur für dich". Each row opens a sheet (`pf-*-sheet`), the same mechanism as the Media-Kit edit menu. Everything is prefixed `pf-` so it cannot collide with the BioLink and Media-Kit views that live in the same file.

What the redesign fixed, and what not to undo:

- **`full_name` and `city` are not in the form any more.** Neither is rendered on any public page — the BioLink template never reads `city`, the Media Kit renders only the niche tag. The columns stay; the fields were collecting data nobody sees.
- **Saving is per group, not one big patch.** Only `bio` sits in the baked-in `og:` tags, so only a changed bio triggers a page rebuild. Handles, niche and contact email are read at runtime from `biopage_v2` — do not add a rebuild for them.
- **The rebuild is visible.** `regenerateBioPageQuietly(uid, {leise})` returns `{ok, unveraendert, uebersprungen, fehler}` and the profile renders it as a status line with a retry, because a missed error toast means a page sits online with a stale link preview. `commit: 'unchanged'` from `generate-biolink` shows nothing at all.
- **Changing an already-analysed handle asks first.** The trigger `sync_analytics_username` rewrites the existing `creator_analytics` row, so the old numbers survive under the new name and can no longer be attributed. That used to happen silently.
- **Deleting the account needs the username typed.** The old two-step "are you sure / really sure" was two reflex clicks with identical buttons.
- **Photos are downscaled to 800 px in the browser and the previous file is deleted.** Before, up to 5 MB went straight onto both public pages and every upload left the old file in the bucket forever.

**YouTube is not offered.** The profile edits Instagram, TikTok and Threads; `youtube_handle` stays in the table, stays in `biopage_v2`/`mediakit_public` and still renders on a public page if a value is there — `pfKanaeleSchreiben` deliberately leaves the column alone rather than nulling it. The BioLink and Media-Kit editors still offer the field; pulling it from those two is a separate decision.

**The data request is not a self-service export.** `datenauskunft` mails the raw JSON to `kontakt@stradauno.de` with the creator as Reply-To, and the user sees "within 48 hours" in the app. A JSON dump of database rows is not an answer a person can use; it gets prepared by hand. The DSGVO deadline (one month, Art. 12 (3)) is comfortably met either way.

`niche_category` has exactly one value domain: the 16 keys in `NICHES_PROFILE`. The Media-Kit sheet used to have a free-text field writing the same column ("Italian Lifestyle & Fashion" → `italian_lifestyle_&_fashion` via the `normalize_niche_category` trigger); it now uses the same picker via `mkSelectNiche`. The public label comes from `public.nische_label()` **inside the `mediakit_public` view**, not from the generator — that way pages already generated show "Fashion" instead of "fashion" without anyone regenerating.

## Plan display

There is one model and every feature is free, so nothing in the UI mentions Free, Pro, a plan badge or an upgrade banner any more (removed 14.09.2026 from the SPA, the five standalone app pages and `sidebar.js`). **The data stays**: `users.subscription_type` with its `'free'` default, the `subscriptions` table, the insert in `handle_new_user`, and the column in the existing `select` lists. Nothing in RLS, no database function and no Edge Function reads it. Bringing a second model back is a display change, not a rebuild.

## Account deletion

`delete-account` (repo copy under `supabase/functions/`) runs, in order:
`cleanup-user-pages` → storage `profile-images/<uid>/*` → `subscriptions`
(paid rows anonymised, free rows deleted) → `analysis_purchases`,
`withdrawal_consents`, `ai_usage_log` anonymised → `auth.admin.deleteUser`,
whose cascade takes the rest.

**The slug is derived from `users.display_name` everywhere — it is never
stored.** `generate-biolink`, `generate-mediakit` and `change-username` all
call the same `slugify()`. `cleanup-user-pages` used to look the slug up in
`biolink_settings.slug` instead, a column the current generator never writes
and `change-username` actively nulls; it was `null` for four of five accounts,
so deleting an account left the public HTML in this repo — with name, bio and
image URL baked into the `og:` tags. Fixed 14.09.2026: `display_name` is the
primary source, `biolink_settings.slug` only a fallback for old rows. The
call happens *before* `auth.admin.deleteUser`, so the row is still there.

Leftovers from before the fix (`public/stradi/`, `public/antika/`,
`public/kit/stradi/`) were removed in the same commit.

`newsletter_subscribers` is now **deleted**, by `user_id` and by address — the
FK is `ON DELETE SET NULL`, so the row used to survive with the e-mail address
in clear text while the privacy policy claimed the personal reference was gone.
`user_consents` is pseudonymised. `subscriptions` finally has a foreign key
(`ON DELETE SET NULL`, not CASCADE — paid rows must survive) and `user_id` is
nullable, without which the existing "anonymise paid subscriptions" step would
have failed silently the first time anyone paid.

Two Edge Functions exist for the account, both with repo copies:
`datenauskunft` mails the full Art.-15 export as a JSON attachment to the login
address (AGB 7.4 promised it; there was no way to get it), and `konto-warnung`
mails the **previous** address whenever the password or the login e-mail
changes. That mail is the account protection for this audience — two-factor
would be overbuilt for a profile page with no payment data behind it.

## Editing conventions to be aware of

- **Creator pages are intentionally minified** into a few long lines. Reformatting them just to read them creates noisy diffs — read them in their compact form, edit surgically, and keep the layout. The non-minified template lives in `public/bio-template.html` and (loosely) the generic `public/kit/index.html`.
- **Hardcoded UUIDs everywhere.** Each per-creator page has the creator's `user_id` (UUID) baked into the tracking pixel `user_id` and image URLs under `…/storage/v1/object/public/profile-images/<UUID>/…`. When duplicating a page for a new creator, update *both* and the avatar/image URL. Easy to miss one.
- **No shared CSS/JS files.** Every page inlines its own styles and scripts. Don't add a `/assets/` shared bundle without checking whether the static-only deploy assumption still holds.
- **Language:** UI copy is German by default; `/it/` mirrors `/` in Italian. Match the existing language of the page you're editing.
