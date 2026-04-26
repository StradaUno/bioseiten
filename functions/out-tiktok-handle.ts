// Cloudflare Pages Function: redirect to TikTok profile
// Path: /out/tiktok/<handle>
// Server-side 302 → bypasses Instagram WebView issues with TikTok deep-linking

export const onRequest: PagesFunction = ({ params }) => {
  const raw = String(params.handle || '').trim()
  const handle = raw.replace(/^@/, '').replace(/[^a-zA-Z0-9._]/g, '')
  if (!handle) {
    return new Response('Invalid handle', { status: 400 })
  }
  return Response.redirect(`https://www.tiktok.com/@${handle}`, 302)
}
