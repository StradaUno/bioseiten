import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GITHUB_TOKEN = Deno.env.get('GITHUB_TOKEN') || ''
const GITHUB_REPO = 'StradaUno/bioseiten'
const GITHUB_BRANCH = 'main'
const CF_ZONE_ID = Deno.env.get('CF_ZONE_ID') || ''
const CF_TOKEN = Deno.env.get('CF_TOKEN') || ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  SERVICE_ROLE_KEY
)

/* Identisch zu generate-biolink, generate-mediakit und change-username.
   Der Slug ist ueberall abgeleitet, nirgends gespeichert. */
function slugify(name: string): string {
  return name.toLowerCase().trim()
    .replace(/[äÄ]/g, 'ae').replace(/[öÖ]/g, 'oe').replace(/[üÜ]/g, 'ue').replace(/[ß]/g, 'ss')
    .replace(/[^a-z0-9\s_-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
}

async function deleteFromGitHub(filePath: string, commitMessage: string): Promise<{ deleted: boolean; reason?: string }> {
  const apiUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/${filePath}`
  const getRes = await fetch(apiUrl, {
    headers: { 'Authorization': `token ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'viuno-Cleanup' }
  })
  if (getRes.status === 404) return { deleted: false, reason: 'not_found' }
  if (!getRes.ok) return { deleted: false, reason: `github_get_${getRes.status}` }
  const existing = await getRes.json()
  const delRes = await fetch(apiUrl, {
    method: 'DELETE',
    headers: { 'Authorization': `token ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json', 'Content-Type': 'application/json', 'User-Agent': 'viuno-Cleanup' },
    body: JSON.stringify({ message: commitMessage, sha: existing.sha, branch: GITHUB_BRANCH })
  })
  if (!delRes.ok) return { deleted: false, reason: `github_delete_${delRes.status}` }
  return { deleted: true }
}

async function purgeCloudflareCache(urls: string[]): Promise<void> {
  if (!CF_ZONE_ID || !CF_TOKEN) return
  await fetch(`https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/purge_cache`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${CF_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ files: urls }),
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // Auth: Service-Role-Token erforderlich (nur intern aufrufbar via delete-account)
    const authHeader = req.headers.get('Authorization') || ''
    if (!authHeader.startsWith('Bearer ')) throw new Error('Kein Authorization Header')
    const token = authHeader.slice(7)
    if (token !== SERVICE_ROLE_KEY) throw new Error('Nur Service-Role darf cleanup aufrufen')

    // user_id kommt im Body (User existiert evtl. schon nicht mehr in users-Tabelle
    // wenn parallele Cascade laeuft, daher kein DB-Lookup auf users)
    let body: any = {}
    try { body = await req.json() } catch (_) {}
    const userId = body?.user_id
    if (!userId) throw new Error('user_id im Body fehlt')

    console.log(`[cleanup-user-pages] start userId=${userId}`)

    /* Slug bestimmen.
       Bis 14.09.2026 stand hier nur ein Blick in biolink_settings.slug. Diese
       Spalte fuellt der heutige Generator aber nie -- generate-biolink leitet
       den Slug aus display_name ab, und change-username setzt sie sogar aktiv
       auf null. Bei vier von fuenf Konten war sie leer, die Function meldete
       "kein slug, nichts zu loeschen", und die oeffentliche BioLink-Datei blieb
       nach der Kontoloeschung im Repo stehen -- samt display_name, Bio und
       Bildadresse in den eingebackenen og:-Tags.
       Primaerquelle ist deshalb display_name, genau wie beim Erzeugen.
       delete-account ruft uns VOR auth.admin.deleteUser auf, die Zeile ist also
       noch da; biolink_settings.slug bleibt als Rueckfallebene fuer Altbestand. */
    const [{ data: u }, { data: bls }] = await Promise.all([
      supabase.from('users').select('display_name').eq('id', userId).maybeSingle(),
      supabase.from('biolink_settings').select('slug').eq('user_id', userId).maybeSingle(),
    ])

    const slugAusName = u?.display_name ? slugify(u.display_name) : null
    const slug = slugAusName || bls?.slug || null

    const result: any = { userId, slug, slug_quelle: slugAusName ? 'display_name' : (bls?.slug ? 'biolink_settings' : 'keine'), biolink: 'skipped', mediakit: 'skipped' }

    if (slug) {
      // BioLink loeschen
      const bioRes = await deleteFromGitHub(`public/${slug}/index.html`, `Delete bio page: ${slug}`)
      result.biolink = bioRes.deleted ? 'deleted' : `skip_${bioRes.reason}`
      await purgeCloudflareCache([
        `https://viuno.de/${slug}`, `https://viuno.de/${slug}/`,
        `https://biouno.de/${slug}`, `https://biouno.de/${slug}/`
      ])

      // Media Kit loeschen (gleicher Slug)
      const kitRes = await deleteFromGitHub(`public/kit/${slug}/index.html`, `Delete media kit: ${slug}`)
      result.mediakit = kitRes.deleted ? 'deleted' : `skip_${kitRes.reason}`
      await purgeCloudflareCache([
        `https://viuno.de/kit/${slug}`, `https://viuno.de/kit/${slug}/`,
        `https://biouno.de/kit/${slug}`, `https://biouno.de/kit/${slug}/`
      ])

      /* Weicht der alte gespeicherte Slug vom abgeleiteten ab, beide abraeumen --
         sonst bleibt aus der Zeit vor der Umstellung eine Datei liegen. */
      if (bls?.slug && bls.slug !== slug) {
        const altBio = await deleteFromGitHub(`public/${bls.slug}/index.html`, `Delete bio page: ${bls.slug}`)
        const altKit = await deleteFromGitHub(`public/kit/${bls.slug}/index.html`, `Delete media kit: ${bls.slug}`)
        result.alt_slug = bls.slug
        result.alt_biolink = altBio.deleted ? 'deleted' : `skip_${altBio.reason}`
        result.alt_mediakit = altKit.deleted ? 'deleted' : `skip_${altKit.reason}`
        await purgeCloudflareCache([
          `https://viuno.de/${bls.slug}`, `https://viuno.de/${bls.slug}/`,
          `https://viuno.de/kit/${bls.slug}`, `https://viuno.de/kit/${bls.slug}/`
        ])
      }
    } else {
      result.note = 'kein slug, nichts zu loeschen'
    }

    // biolink_settings-Eintrag pflegen (falls Account-Delete nicht cascadet hat)
    await supabase.from('biolink_settings').update({
      slug: null,
      is_active: false,
    }).eq('user_id', userId)

    // users-Flags zuruecksetzen (existierende Spalten: bio_active, mediakit_active)
    await supabase.from('users').update({
      bio_active: false,
      mediakit_active: false,
    }).eq('id', userId)

    console.log(`[cleanup-user-pages] done`, result)

    return new Response(
      JSON.stringify({ success: true, ...result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (err: any) {
    console.error('[cleanup-user-pages] error:', err.message)
    try { await supabase.rpc('log_error', { function_name: 'cleanup-user-pages', error_message: err.message }) } catch (_) {}
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
