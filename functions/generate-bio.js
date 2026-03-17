import { createClient } from '@supabase/supabase-js';
import { getStore } from '@netlify/blobs';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const templates = {
  classic: (data) => `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${data.name} – Creator</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, sans-serif; background: #f5f5f5; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .card { background: white; border-radius: 24px; padding: 40px; max-width: 420px; width: 90%; text-align: center; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .avatar { width: 100px; height: 100px; border-radius: 50%; object-fit: cover; margin-bottom: 16px; }
    .avatar-placeholder { width: 100px; height: 100px; border-radius: 50%; background: #e0e0e0; margin: 0 auto 16px; }
    h1 { font-size: 24px; font-weight: 700; margin-bottom: 8px; color: #111; }
    .niche { color: #888; font-size: 14px; margin-bottom: 24px; }
    .links { display: flex; flex-direction: column; gap: 12px; margin-bottom: 32px; }
    .link-btn { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 14px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 15px; transition: opacity 0.2s; }
    .link-btn:hover { opacity: 0.85; }
    .instagram { background: linear-gradient(135deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888); color: white; }
    .tiktok { background: #000; color: white; }
    .cta { background: #111; color: white; padding: 16px; border-radius: 14px; text-decoration: none; font-weight: 700; font-size: 16px; display: block; transition: background 0.2s; }
    .cta:hover { background: #333; }
  </style>
</head>
<body>
  <div class="card">
    ${data.photo_url
      ? `<img src="${data.photo_url}" alt="${data.name}" class="avatar">`
      : `<div class="avatar-placeholder"></div>`
    }
    <h1>${data.name}</h1>
    <p class="niche">${data.niche || 'Creator'}</p>
    <div class="links">
      ${data.instagram ? `<a href="https://instagram.com/${data.instagram}" target="_blank" class="link-btn instagram">Instagram @${data.instagram}</a>` : ''}
      ${data.tiktok ? `<a href="https://tiktok.com/@${data.tiktok}" target="_blank" class="link-btn tiktok">TikTok @${data.tiktok}</a>` : ''}
    </div>
    <a href="/anfrage/?creator=${data.slug}" class="cta">Kooperation anfragen</a>
  </div>
</body>
</html>`,

  dark: (data) => `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${data.name} – Creator</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, sans-serif; background: #0a0a0a; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .card { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 24px; padding: 40px; max-width: 420px; width: 90%; text-align: center; }
    .avatar { width: 100px; height: 100px; border-radius: 50%; object-fit: cover; margin-bottom: 16px; border: 2px solid #333; }
    .avatar-placeholder { width: 100px; height: 100px; border-radius: 50%; background: #2a2a2a; margin: 0 auto 16px; }
    h1 { font-size: 24px; font-weight: 700; margin-bottom: 8px; color: #fff; }
    .niche { color: #666; font-size: 14px; margin-bottom: 24px; }
    .links { display: flex; flex-direction: column; gap: 12px; margin-bottom: 32px; }
    .link-btn { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 14px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 15px; border: 1px solid #333; color: #fff; background: #222; transition: border-color 0.2s; }
    .link-btn:hover { border-color: #666; }
    .cta { background: white; color: black; padding: 16px; border-radius: 14px; text-decoration: none; font-weight: 700; font-size: 16px; display: block; transition: opacity 0.2s; }
    .cta:hover { opacity: 0.85; }
  </style>
</head>
<body>
  <div class="card">
    ${data.photo_url
      ? `<img src="${data.photo_url}" alt="${data.name}" class="avatar">`
      : `<div class="avatar-placeholder"></div>`
    }
    <h1>${data.name}</h1>
    <p class="niche">${data.niche || 'Creator'}</p>
    <div class="links">
      ${data.instagram ? `<a href="https://instagram.com/${data.instagram}" target="_blank" class="link-btn">Instagram @${data.instagram}</a>` : ''}
      ${data.tiktok ? `<a href="https://tiktok.com/@${data.tiktok}" target="_blank" class="link-btn">TikTok @${data.tiktok}</a>` : ''}
    </div>
    <a href="/anfrage/?creator=${data.slug}" class="cta">Kooperation anfragen</a>
  </div>
</body>
</html>`,

  minimal: (data) => `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${data.name} – Creator</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, sans-serif; background: white; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .card { max-width: 380px; width: 90%; text-align: center; padding: 40px 0; }
    .avatar { width: 80px; height: 80px; border-radius: 50%; object-fit: cover; margin-bottom: 12px; }
    .avatar-placeholder { width: 80px; height: 80px; border-radius: 50%; background: #f0f0f0; margin: 0 auto 12px; }
    h1 { font-size: 20px; font-weight: 600; margin-bottom: 4px; color: #111; }
    .niche { color: #aaa; font-size: 13px; margin-bottom: 28px; }
    .links { display: flex; flex-direction: column; gap: 8px; margin-bottom: 28px; }
    .link-btn { padding: 12px; border-radius: 8px; text-decoration: none; font-size: 14px; color: #111; background: #f5f5f5; transition: background 0.2s; }
    .link-btn:hover { background: #eee; }
    .cta { border: 2px solid #111; color: #111; padding: 14px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 15px; display: block; transition: all 0.2s; }
    .cta:hover { background: #111; color: white; }
  </style>
</head>
<body>
  <div class="card">
    ${data.photo_url
      ? `<img src="${data.photo_url}" alt="${data.name}" class="avatar">`
      : `<div class="avatar-placeholder"></div>`
    }
    <h1>${data.name}</h1>
    <p class="niche">${data.niche || 'Creator'}</p>
    <div class="links">
      ${data.instagram ? `<a href="https://instagram.com/${data.instagram}" target="_blank" class="link-btn">Instagram @${data.instagram}</a>` : ''}
      ${data.tiktok ? `<a href="https://tiktok.com/@${data.tiktok}" target="_blank" class="link-btn">TikTok @${data.tiktok}</a>` : ''}
    </div>
    <a href="/anfrage/?creator=${data.slug}" class="cta">Kooperation anfragen</a>
  </div>
</body>
</html>`
};

export default async (req) => {
  // Sicherheit: nur POST erlaubt
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Geheimer Key damit nicht jeder die Function aufrufen kann
  const authHeader = req.headers.get('x-secret-key');
  if (authHeader !== process.env.FUNCTION_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const { user_id } = await req.json();
    if (!user_id) {
      return new Response('user_id fehlt', { status: 400 });
    }

    // 1. User-Daten laden
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('full_name, profile_image_url, niche, bio_page_slug')
      .eq('id', user_id)
      .single();

    if (userError || !user) {
      return new Response('User nicht gefunden', { status: 404 });
    }

    if (!user.bio_page_slug) {
      return new Response('Kein Slug gesetzt', { status: 400 });
    }

    // 2. Platform-Accounts laden
    const { data: platforms } = await supabase
      .from('platform_accounts')
      .select('platform, username')
      .eq('user_id', user_id)
      .eq('is_active', true);

    const instagram = platforms?.find(p => p.platform === 'instagram')?.username || '';
    const tiktok = platforms?.find(p => p.platform === 'tiktok')?.username || '';

    // 3. Bio-Page-Einstellungen laden
    const { data: bioPage } = await supabase
      .from('bio_pages')
      .select('design_template, is_active')
      .eq('user_id', user_id)
      .single();

    if (!bioPage?.is_active) {
      return new Response('Bio-Page ist deaktiviert', { status: 400 });
    }

    // 4. Template befüllen
    const templateFn = templates[bioPage.design_template] || templates.classic;
    const html = templateFn({
      name: user.full_name || 'Creator',
      photo_url: user.profile_image_url || '',
      niche: user.niche || '',
      instagram,
      tiktok,
      slug: user.bio_page_slug,
    });

    // 5. HTML in Netlify Blobs speichern
    const store = getStore('bioseiten');
    await store.set(`u/${user.bio_page_slug}`, html, {
      metadata: { contentType: 'text/html' }
    });

    // 6. Netlify-Pfad in bio_pages speichern
    await supabase
      .from('bio_pages')
      .update({ netlify_path: `/u/${user.bio_page_slug}`, updated_at: new Date().toISOString() })
      .eq('user_id', user_id);

    return new Response(JSON.stringify({
      success: true,
      url: `/u/${user.bio_page_slug}`
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('generate-bio error:', err);
    return new Response('Interner Fehler', { status: 500 });
  }
};

export const config = {
  path: '/api/generate-bio'
};
