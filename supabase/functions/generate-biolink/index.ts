import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getTemplate } from './template.ts'

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
    .replace(/[äÄ]/g,'ae').replace(/[öÖ]/g,'oe').replace(/[üÜ]/g,'ue').replace(/[ß]/g,'ss')
    .replace(/[^a-z0-9\s_-]/g,'').replace(/\s+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'')
}

async function commitToGitHub(slug: string, html: string): Promise<boolean> {
  const filePath = 'public/'+slug+'/index.html'
  const apiUrl = 'https://api.github.com/repos/'+GITHUB_REPO+'/contents/'+filePath
  const getRes = await fetch(apiUrl,{headers:{'Authorization':'token '+GITHUB_TOKEN,'Accept':'application/vnd.github.v3+json','User-Agent':'viuno-BioGenerator'}})
  let sha: string|undefined
  if(getRes.ok){const ex=await getRes.json();sha=ex.sha;try{const existing=atob(ex.content.replace(/\n/g,''));if(existing===html)return false}catch(_){}}
  // Use TextEncoder for correct UTF-8 base64 encoding
  const bytes = new TextEncoder().encode(html)
  let binary = ''
  bytes.forEach(b => binary += String.fromCharCode(b))
  const encoded = btoa(binary)
  const body:any={message:sha?'Update biolink: '+slug:'Create biolink: '+slug,content:encoded,branch:GITHUB_BRANCH}
  if(sha)body.sha=sha
  const putRes=await fetch(apiUrl,{method:'PUT',headers:{'Authorization':'token '+GITHUB_TOKEN,'Accept':'application/vnd.github.v3+json','Content-Type':'application/json','User-Agent':'viuno-BioGenerator'},body:JSON.stringify(body)})
  if(!putRes.ok){const err=await putRes.text();throw new Error('GitHub: '+putRes.status+' - '+err)}
  return true
}

async function deleteFromGitHub(slug: string): Promise<void> {
  const filePath = 'public/'+slug+'/index.html'
  const apiUrl = 'https://api.github.com/repos/'+GITHUB_REPO+'/contents/'+filePath
  const getRes=await fetch(apiUrl,{headers:{'Authorization':'token '+GITHUB_TOKEN,'Accept':'application/vnd.github.v3+json','User-Agent':'viuno-BioGenerator'}})
  if(getRes.ok){const ex=await getRes.json();await fetch(apiUrl,{method:'DELETE',headers:{'Authorization':'token '+GITHUB_TOKEN,'Accept':'application/vnd.github.v3+json','Content-Type':'application/json','User-Agent':'viuno-BioGenerator'},body:JSON.stringify({message:'Delete biolink: '+slug,sha:ex.sha,branch:GITHUB_BRANCH})})}
}

async function purgeCache(slug: string): Promise<void> {
  if(!CF_ZONE_ID||!CF_TOKEN)return
  const urls=['https://biouno.de/'+slug,'https://biouno.de/'+slug+'/','https://viuno.de/'+slug,'https://viuno.de/'+slug+'/']
  await fetch('https://api.cloudflare.com/client/v4/zones/'+CF_ZONE_ID+'/purge_cache',{method:'POST',headers:{'Authorization':'Bearer '+CF_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({files:urls})})
}
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const authHeader = req.headers.get('Authorization') || ''
    if (!authHeader) throw new Error('Kein Authorization Header')
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) throw new Error('Auth fehlgeschlagen')

    const { data: u, error: dbError } = await supabase.from('users').select('id, display_name, bio_active, bio, profile_image_url').eq('id', user.id).single()
    if (dbError || !u) throw new Error('User nicht gefunden')
    if (!u.display_name) throw new Error('display_name fehlt')

    const slug = slugify(u.display_name)
    if (!slug) throw new Error('Slug konnte nicht erzeugt werden')

    const url = new URL(req.url)
    const action = url.searchParams.get('action') || 'generate'

    if (action === 'delete') {
      await deleteFromGitHub(slug)
      await purgeCache(slug)
      await supabase.from('users').update({ bio_active: false }).eq('id', user.id)
      return new Response(JSON.stringify({ success: true, action: 'deleted' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    }

    const { data: bls } = await supabase.from('biolink_viuno').select('theme').eq('user_id', user.id).maybeSingle()
    const theme = bls?.theme || 'color'
    if (!bls) await supabase.from('biolink_viuno').insert({ user_id: user.id })

    const html = getTemplate(theme, { display_name: u.display_name, bio: u.bio, profile_image_url: u.profile_image_url, slug })
    const pushed = await commitToGitHub(slug, html)
    await purgeCache(slug)
    await supabase.from('users').update({ bio_active: true }).eq('id', user.id)

    return new Response(JSON.stringify({ success: true, url: 'https://viuno.de/' + slug, slug, theme, commit: pushed ? 'pushed' : 'unchanged' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
  } catch (err: any) {
    console.error('generate-biolink error:', err.message)
    try { await supabase.rpc('log_error', { function_name: 'generate-biolink', error_message: err.message }) } catch (_) {}
    return new Response(JSON.stringify({ success: false, error: err.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
  }
})
