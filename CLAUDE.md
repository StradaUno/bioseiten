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

`public/app/index.html` is a single-file hash-router SPA that carries the whole logged-in app. It is a *port* of the standalone pages, not a replacement — the pages under `public/dashboard/`, `public/profile/`, `public/biolink/`, `public/mediakit/`, `public/analytics/`, `public/digest/`, `public/requests/`, `public/onboarding/`, `public/login/` and `public/register/` still exist and still work.

- Routes: `#/login`, `#/register`, `#/onboarding`, `#/dashboard`, `#/analytics`, `#/biolink`, `#/mediakit`, `#/digest`, `#/requests`, `#/profile`. Each is a `renderX(area, ctx)` that renders into `#content-area`. Unknown hashes fall back to `#/dashboard`.
- The sidebar is defined once in the HTML; the router sets `.active` from `data-route`.
- `ctx.stale` guards late query answers after a route change; `ctx.onCleanup` / `ctx.on` / `ctx.interval` remove listeners, timers and subscriptions when a route is left. Use them — a view must not leave anything behind.
- View state lives in one module-level object per view (`pv`, `blv`, `mkv`, `anv`, `dgv`, `rqv`, `obv`), nulled on cleanup.
- Where the source pages used the same global name for different things, the SPA renames: `saveBioProfile`, `mkSaveProfile`, `mkSaveImpressum`, `mkConfirmDelete`, `mkSelectLang`, `setReqFilter`, `renderAnalyticsContent`, `digestCardHtml`, `renderReqList`.
- Three `fmt` variants coexist on purpose (`fmt`, `fmtCount`, `fmtNum`) because the source pages round differently. Don't unify them without checking every call site.

**When a standalone page changes, the matching SPA view has to be changed too** — they are not generated from a shared source. Port queries and logic 1:1; the views are meant to behave identically to their page, bugs included.

## Routing model

Each subdirectory of `public/` is a route via its `index.html`. Cloudflare Pages reads `public/_redirects` (SPA fallback for `/app/*`, plus `.html` → directory redirects for the legal pages); there is no `_headers` and no `_routes.json`. Two patterns coexist:

- **Hand-built creator pages** — one HTML file per creator, with the creator's UUID, copy, links, and contact form hardcoded inline. Examples: `public/stradauno/`, `public/easyglenn/`, `public/antonietta/`, `public/kit/easyg/`, `public/kit/kross/`, `public/kit/stradauno/`. These are usually heavily minified into 1–7 lines.
- **Dynamic, slug-driven page** — `public/kit/index.html` reads the slug from `window.location.pathname` and queries the `media_kit_public` view in Supabase. This is the *generic* media-kit renderer; the per-creator files under `public/kit/<slug>/` are pre-rendered overrides of it.

`public/bio-template.html` is a server-side template containing `{{DISPLAY_NAME}}`, `{{BIO}}`, `{{OG_IMAGE}}` placeholders — presumably rendered by an external tool (Cloudflare Worker is mentioned in a comment as "Stufe B"). Don't edit it expecting client-side substitution.

## App pages vs. landing pages

Two very different page types share `public/`:

1. **Public landing/creator pages** (`/`, `/it/`, `/stradauno/`, `/easyglenn/`, `/agb/`, `/datenschutz/`, …) — pure HTML/CSS, may include:
   - A collab form that POSTs to `https://bzejndghppuipnedasuv.supabase.co/rest/v1/collab_requests` with the `sb_publishable_*` key as `apikey` (publishable key, intended to be public — RLS on `collab_requests` allows anonymous inserts).
   - A fire-and-forget tracking pixel: `POST /functions/v1/track-bio-view` or `/functions/v1/track-mediakit-view` with the creator's `user_id`.

2. **Authenticated app pages** (`/dashboard/`, `/profile/`, `/onboarding/`, `/Requests/`, `/digest/`, `/trends/`, `/analytic/`) — load `@supabase/supabase-js@2` from `https://esm.sh` as an ES module, do `signInWithPassword` against Supabase Auth, and read/write tables like `users`, `creator_analytics`, `bio_stats`, `collab_requests`, `daily_digest`, `live_hashtags`, `deals`, `user_goals`, `biolink_settings`. Sessions persist in localStorage (`persistSession:true`).

`public/index.html` runs an early language-detection redirect: if `navigator.languages[0]` starts with `it`, it sets `sessionStorage.viuno-lang-redirected` and replaces location with `/it/`. The flag is intentional — it prevents loops if the user manually navigates back to DE.

## Backend

A single Supabase project: `https://bzejndghppuipnedasuv.supabase.co`. Two anon JWTs appear in the codebase:

- The newer one (`iat:1773653197`) is used by the auth-gated app pages and `public/onboarding/`, `public/dashboard/`, etc.
- An older one (`iat:1743702807`) is hardcoded in `public/kit/index.html`. If you touch that file, decide whether to align it with the newer key — they correspond to different key-rotation moments on the same project.

The `sb_publishable_vVbpikuwqnh5jBTdvxcm7g_R4pZsMXI` token used in collab form POSTs is a Supabase publishable key, distinct from the JWT — leave it alone unless rotating both ends.

Edge Functions referenced from the client (not in this repo — managed in Supabase dashboard): `track-bio-view`, `track-mediakit-view`, `fetch-analytics`, `contact-submit`.

## Editing conventions to be aware of

- **Creator pages are intentionally minified** into a few long lines. Reformatting them just to read them creates noisy diffs — read them in their compact form, edit surgically, and keep the layout. The non-minified template lives in `public/bio-template.html` and (loosely) the generic `public/kit/index.html`.
- **Hardcoded UUIDs everywhere.** Each per-creator page has the creator's `user_id` (UUID) baked into the collab `creator_id`, the tracking pixel `user_id`, and image URLs under `…/storage/v1/object/public/profile-images/<UUID>/…`. When duplicating a page for a new creator, update *all three* and the avatar/image URL. Easy to miss one.
- **No shared CSS/JS files.** Every page inlines its own styles and scripts. Don't add a `/assets/` shared bundle without checking whether the static-only deploy assumption still holds.
- **Language:** UI copy is German by default; `/it/` mirrors `/` in Italian. Match the existing language of the page you're editing.
