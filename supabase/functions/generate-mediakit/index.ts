import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/* Erzeugt die oeffentliche Media-Kit-Seite eines Creators und committet sie
   nach GitHub; Cloudflare Pages baut daraus die Seite unter /kit/<slug>/.

   NEU seit 14.09.2026: die Seite ist nur noch eine HUELLE. CSS, Aufbau und
   Datenabruf liegen in public/kit/kit-renderer.js im Repo.

   Vorher steckte alles als Zeichenkette in dieser Function, und jede
   Layout-Aenderung hiess: Function anfassen UND jede bestehende Kit-Seite
   neu erzeugen, weil das alte Markup in der committeten Datei klebte. Jetzt
   ist eine Layout-Aenderung ein Push -- die erzeugten Seiten holen sich den
   Renderer bei jedem Aufruf frisch.

   Der Slug wird wie ueberall aus users.display_name abgeleitet und NIE
   gespeichert -- dieselbe slugify() wie in generate-biolink,
   change-username und cleanup-user-pages. */

const GITHUB_TOKEN = Deno.env.get('GITHUB_TOKEN') || ''
const GITHUB_REPO = 'StradaUno/bioseiten'
const GITHUB_BRANCH = 'main'
const CF_ZONE_ID = Deno.env.get('CF_ZONE_ID') || ''
const CF_TOKEN = Deno.env.get('CF_TOKEN') || ''

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

function slugify(name: string): string {
  return name.toLowerCase().trim()
    .replace(/[äÄ]/g,'ae').replace(/[öÖ]/g,'oe')
    .replace(/[üÜ]/g,'ue').replace(/[ß]/g,'ss')
    .replace(/[^a-z0-9\s_-]/g,'').replace(/\s+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'')
}

async function commitToGitHub(path: string, html: string): Promise<void> {
  const apiUrl = 'https://api.github.com/repos/' + GITHUB_REPO + '/contents/' + path
  const kopf = { 'Authorization': 'token ' + GITHUB_TOKEN, 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'viuno-MK' }
  const getRes = await fetch(apiUrl, { headers: kopf })
  let sha: string | undefined
  if (getRes.ok) { const ex = await getRes.json(); sha = ex.sha }
  const bytes = new TextEncoder().encode(html)
  let binary = ''; bytes.forEach(b => binary += String.fromCharCode(b))
  const body: any = { message: (sha ? 'Update' : 'Create') + ' mediakit: ' + path, content: btoa(binary), branch: GITHUB_BRANCH }
  if (sha) body.sha = sha
  const putRes = await fetch(apiUrl, { method: 'PUT', headers: { ...kopf, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (!putRes.ok) throw new Error('GitHub: ' + putRes.status + ' - ' + await putRes.text())
}

async function deleteFromGitHub(path: string): Promise<void> {
  const apiUrl = 'https://api.github.com/repos/' + GITHUB_REPO + '/contents/' + path
  const kopf = { 'Authorization': 'token ' + GITHUB_TOKEN, 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'viuno-MK' }
  const getRes = await fetch(apiUrl, { headers: kopf })
  if (getRes.ok) {
    const ex = await getRes.json()
    await fetch(apiUrl, { method: 'DELETE', headers: { ...kopf, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Delete mediakit: ' + path, sha: ex.sha, branch: GITHUB_BRANCH }) })
  }
}

async function purgeCache(slug: string): Promise<void> {
  if (!CF_ZONE_ID || !CF_TOKEN) return
  await fetch('https://api.cloudflare.com/client/v4/zones/' + CF_ZONE_ID + '/purge_cache', {
    method: 'POST', headers: { 'Authorization': 'Bearer ' + CF_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ files: ['https://viuno.de/kit/' + slug, 'https://viuno.de/kit/' + slug + '/',
                                   'https://viuno.de/kit/kit-renderer.js'] })
  })
}

/* Nur so viel Stil, dass der Ladepunkt nicht ungestylt aufblitzt, bevor
   der Renderer sein CSS nachlegt. Alles Weitere kommt von dort. */
const HUELLE = (name: string) => `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${name} · Media Kit</title>
<meta name="description" content="Media Kit von ${name} — Reichweite, Zielgruppe und Leistungen für Marken.">
<meta name="theme-color" content="#EAEAEE">
<meta property="og:type" content="profile">
<meta property="og:title" content="${name} · Media Kit">
<meta property="og:description" content="Reichweite, Zielgruppe und Leistungen für Marken.">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3Ev%3C/text%3E%3C/svg%3E">
<style>
html,body{margin:0;background:#EAEAEE}
.page-loader{position:fixed;inset:0;background:#EAEAEE;display:flex;align-items:center;justify-content:center;z-index:9999;transition:opacity .25s}
.page-loader.hide{opacity:0;pointer-events:none}
.spinner{width:24px;height:24px;border:2px solid rgba(26,26,46,.15);border-top-color:rgba(26,26,46,.6);border-radius:50%;animation:spin .8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
#main{visibility:hidden}
</style>
</head>
<body>
<div class="page-loader" id="page-loader"><div class="spinner"></div></div>
<div id="main"></div>
<!-- Aufbau, Stil und Datenabruf: /kit/kit-renderer.js im Repo.
     Eine Layout-Aenderung braucht deshalb keine Neuerzeugung dieser Datei. -->
<script type="module" src="/kit/kit-renderer.js"></script>
</body>
</html>`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const antwort = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: s })
  try {
    const authHeader = req.headers.get('Authorization') || ''
    if (!authHeader) throw new Error('Kein Authorization Header')
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) throw new Error('Auth fehlgeschlagen')

    const { data: u, error: dbError } = await supabase.from('users')
      .select('id, display_name, mediakit_active').eq('id', user.id).single()
    if (dbError || !u) throw new Error('User nicht gefunden')
    if (!u.display_name) throw new Error('display_name fehlt')

    const slug = slugify(u.display_name)
    if (!slug) throw new Error('Slug konnte nicht erzeugt werden')

    const action = new URL(req.url).searchParams.get('action') || 'generate'

    if (action === 'delete') {
      await deleteFromGitHub('public/kit/' + slug + '/index.html')
      await purgeCache(slug)
      await supabase.from('users').update({ mediakit_active: false }).eq('id', user.id)
      return antwort({ success: true, action: 'deleted' })
    }

    const name = String(u.display_name).replace(/[<>"&]/g, '')
    await commitToGitHub('public/kit/' + slug + '/index.html', HUELLE(name))
    await purgeCache(slug)
    await supabase.from('users').update({ mediakit_active: true }).eq('id', user.id)

    return antwort({ success: true, url: 'https://viuno.de/kit/' + slug, slug })
  } catch (err: any) {
    console.error('generate-mediakit error:', err.message)
    return antwort({ success: false, error: err.message })
  }
})
