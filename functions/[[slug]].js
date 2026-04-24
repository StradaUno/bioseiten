// ═══════════════════════════════════════════════════════════════════
// functions/[[slug]].js — Cloudflare Pages Function
// ═══════════════════════════════════════════════════════════════════
//
// Fängt alle Top-Level-Slugs ab: /antonietta, /stradauno, /neuer-user
// Liefert bio-template.html aus (URL bleibt /antonietta stehen).
//
// Pfade die NICHT abgefangen werden:
// - / (Root = Landingpage)
// - /kit/* (Media Kits als statische Ordner)
// - /impressum, /datenschutz, /agb (via _redirects)
// - Dateien mit Extension: /favicon.ico, /robots.txt, etc.
// - Bestehende statische Ordner wie /antonietta/ werden automatisch
//   von Pages zuerst gefunden (statische Assets haben Vorrang)
//
// Dokumentation:
// https://developers.cloudflare.com/pages/functions/routing/
// ═══════════════════════════════════════════════════════════════════

export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // 1) Pfade mit Datei-Extension (wie /favicon.ico, /something.png) an die
  //    Asset-Pipeline durchreichen — die Function soll keine Assets blockieren.
  if (/\.[a-z0-9]{2,5}$/i.test(path)) {
    return next();
  }

  // 2) Reservierte Root-Pfade direkt durchreichen (Landingpage, API, etc.)
  const RESERVED = ['/', '/index.html', '/api'];
  if (RESERVED.includes(path) || path.startsWith('/api/')) {
    return next();
  }

  // 3) Slug aus Pfad extrahieren (erstes Segment, ohne trailing slash)
  //    "/antonietta"  → "antonietta"
  //    "/antonietta/" → "antonietta"
  const slug = path.replace(/^\/+|\/+$/g, '').split('/')[0];

  // Leerer Slug → Landingpage
  if (!slug) return next();

  // 4) Unser eigenes Template nicht rekursiv laden
  if (slug === 'bio-template') return next();

  // 5) Slug in Supabase prüfen (ist er aktiv?)
  //    Wenn ja → bio-template.html als Response zurückgeben
  //    Wenn nein → 302 Redirect zu viuno.de
  const SUPABASE_URL = 'https://bzejndghppuipnedasuv.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6ZWpuZGdocHB1aXBuZWRhc3V2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMzg4NzMsImV4cCI6MjA4OTYxNDg3M30.JERbMHkDyCrnMQCGNi9VBVbWNaE_PJXJnibxAVQcPBM';

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

    if (!checkRes.ok) {
      // API-Fehler → im Zweifel zur Landingpage
      return Response.redirect('https://viuno.de', 302);
    }

    const rows = await checkRes.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      // Slug existiert nicht → Homepage
      return Response.redirect('https://viuno.de', 302);
    }

    // 6) Slug existiert → bio-template.html laden und ausliefern
    //    (URL in der Browserleiste bleibt z.B. /antonietta stehen)
    const templateUrl = new URL('/bio-template.html', request.url);
    const templateRes = await fetch(templateUrl.toString());

    // Neue Response ohne Redirect-Header (wir liefern das HTML direkt)
    return new Response(templateRes.body, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=UTF-8',
        'Cache-Control': 'public, max-age=60', // 1 Min Edge-Cache
      },
    });
  } catch (err) {
    // Netzwerk-/Script-Fehler → Fallback Landingpage
    return Response.redirect('https://viuno.de', 302);
  }
}
