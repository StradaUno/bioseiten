import { getStore } from '@netlify/blobs';

export default async (req) => {
  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const slug = pathParts[pathParts.indexOf('u') + 1];

    if (!slug) {
      return new Response('Nicht gefunden', { status: 404 });
    }

    const store = getStore('bioseiten');
    const html = await store.get(slug);

    if (!html) {
      return new Response(`<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nicht gefunden</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, sans-serif; background: #f5f5f5; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .card { background: white; border-radius: 24px; padding: 48px 40px; max-width: 400px; width: 90%; text-align: center; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    h1 { font-size: 20px; font-weight: 700; color: #111; margin-bottom: 8px; }
    p { color: #888; font-size: 14px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Seite nicht gefunden</h1>
    <p>Dieser Creator-Link existiert nicht oder wurde deaktiviert.</p>
  </div>
</body>
</html>`, {
        status: 404,
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600'
      }
    });

  } catch (err) {
    console.error('serve-bio error:', err);
    return new Response('Interner Fehler', { status: 500 });
  }
};

export const config = { path: '/u/:slug' };
