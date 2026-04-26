// Cloudflare Pages Function: HTML interstitial redirect to TikTok
// Path: /go/tiktok/<handle>
// Returns HTML with meta refresh + JS fallback (alternative to 302)

export const onRequest: PagesFunction = ({ params }) => {
  const raw = String(params.handle || '').trim()
  const handle = raw.replace(/^@/, '').replace(/[^a-zA-Z0-9._]/g, '')
  if (!handle) {
    return new Response('Invalid handle', { status: 400 })
  }
  const target = `https://www.tiktok.com/@${handle}`
  const html = `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<meta http-equiv="refresh" content="0;url=${target}">
<title>Weiter zu TikTok…</title>
<style>body{font-family:-apple-system,sans-serif;background:#14171f;color:#f0f2f8;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:20px;text-align:center}a{color:#c4b5f5}</style>
</head><body>
<div>
<p>Weiter zu TikTok…</p>
<p><a href="${target}">Hier tippen falls nicht automatisch weitergeleitet</a></p>
</div>
<script>window.location.replace(${JSON.stringify(target)});</script>
</body></html>`
  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  })
}
