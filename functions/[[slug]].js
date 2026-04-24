// ═══════════════════════════════════════════════════════════════════
// functions/[[slug]].js — Cloudflare Pages Function (v2)
// ═══════════════════════════════════════════════════════════════════
// Fängt alle Top-Level-Slugs ab und serviert bio-template.html
// URL bleibt /antonietta stehen (kein Redirect).
//
// WICHTIG: Wir nutzen env.ASSETS.fetch() statt regulärem fetch(),
// weil das der offizielle Cloudflare-Pages Weg ist um statische
// Assets aus dem Pages-Deployment zu laden.
// ═══════════════════════════════════════════════════════════════════

export async function onRequest(context) {
  const { request, env, next, params } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // 1) Dateien mit Extension durchreichen (/favicon.ico etc.)
  if (/\.[a-z0-9]{2,5}$/i.test(path)) {
    return next();
  }

  // 2) Slug aus Pfad: "/antonietta" oder "/antonietta/" → "antonietta"
  //    (params.slug kommt vom [[slug]] Catch-All, kann array sein)
  let slug = '';
  if (params && params.slug) {
    slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  } else {
    slug = path.replace(/^\/+|\/+$/g, '').split('/')[0];
  }
  slug = (slug || '').toLowerCase().trim();

  // 3) Leerer Slug oder bekanntes asset → Asset-Pipeline durchreichen
  if (!slug || slug === 'bio-template') {
    return next();
  }

  // 4) Slug in Supabase prüfen
  const SUPABASE_URL = 'https://bzejndghppuipnedasuv.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6ZWpuZGdocHB1aXBuZWRhc3V2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMzg4NzMsImV4cCI6MjA4OTYxNDg3M30.JERbMHkDyCrnMQCGNi9VBVbWNaE_PJXJnibxAVQcPBM';

  let slugExists = false;
  try {
    const checkRes = await fetch(
      `${SUPABASE_URL}/rest/v1/biopage_public?slug=eq.${encodeURIComponent(slug)}&select=slug`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      }
    );
    if (checkRes.ok) {
      const rows = await checkRes.json();
      slugExists = Array.isArray(rows) && rows.length > 0;
    }
  } catch (err) {
    // Netzwerkfehler → Fall through, behandle als "existiert nicht"
  }

  // 5) Slug existiert nicht → zur Landingpage
  if (!slugExists) {
    return Response.redirect('https://viuno.de', 302);
  }

  // 6) Slug existiert → bio-template.html aus Pages-Assets holen
  //    env.ASSETS.fetch() ist der offizielle Cloudflare Pages Weg
  try {
    if (env && env.ASSETS && typeof env.ASSETS.fetch === 'function') {
      const assetUrl = new URL('/bio-template.html', request.url);
      const assetRes = await env.ASSETS.fetch(assetUrl.toString());
      return new Response(assetRes.body, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=UTF-8',
          'Cache-Control': 'public, max-age=60',
        },
      });
    }

    // Fallback falls env.ASSETS nicht verfügbar: regulärer fetch
    const templateUrl = new URL('/bio-template.html', request.url);
    const templateRes = await fetch(templateUrl.toString(), {
      redirect: 'manual',
    });
    return new Response(templateRes.body, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=UTF-8',
        'Cache-Control': 'public, max-age=60',
      },
    });
  } catch (err) {
    return new Response('Template load error: ' + err.message, {
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}
