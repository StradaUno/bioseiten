import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GITHUB_TOKEN = Deno.env.get('GITHUB_TOKEN') || ''
const GITHUB_REPO = 'StradaUno/bioseiten'
const GITHUB_BRANCH = 'main'
const CF_ZONE_ID = Deno.env.get('CF_ZONE_ID') || ''
const CF_TOKEN = Deno.env.get('CF_TOKEN') || ''

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

function slugify(name: string): string {
  return name.toLowerCase().trim()
    .replace(/[äÄ]/g, 'ae').replace(/[öÖ]/g, 'oe').replace(/[üÜ]/g, 'ue').replace(/[ß]/g, 'ss')
    .replace(/[^a-z0-9\s_-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
}

async function deleteFromGitHub(filePath: string): Promise<{ deleted: boolean; reason?: string }> {
  const apiUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/${filePath}`
  const getRes = await fetch(apiUrl, {
    headers: { 'Authorization': `token ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'viuno-ChangeUsername' }
  })
  if (getRes.status === 404) return { deleted: false, reason: 'not_found' }
  if (!getRes.ok) return { deleted: false, reason: `github_get_${getRes.status}` }
  const existing = await getRes.json()
  const delRes = await fetch(apiUrl, {
    method: 'DELETE',
    headers: { 'Authorization': `token ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json', 'Content-Type': 'application/json', 'User-Agent': 'viuno-ChangeUsername' },
    body: JSON.stringify({ message: `Delete on username change: ${filePath}`, sha: existing.sha, branch: GITHUB_BRANCH })
  })
  if (!delRes.ok) return { deleted: false, reason: `github_delete_${delRes.status}` }
  return { deleted: true }
}

async function purgeCloudflareCache(urls: string[]): Promise<void> {
  if (!CF_ZONE_ID || !CF_TOKEN) return
  try {
    await fetch(`https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/purge_cache`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${CF_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: urls }),
    })
  } catch (e) {
    console.error('[change-username] CF purge fail (non-fatal):', e)
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    /* 1) Auth: User-JWT pruefen.
       Hier stand bis 14.09.2026 ein decodeJwt(), das nur den base64-Mittelteil
       gelesen hat -- mit dem Kommentar "da supabase.auth.getUser unzuverlaessig
       ist". Die Signatur wurde nie geprueft, und weil die Function mit
       verify_jwt:false laeuft, konnte jeder mit einer fremden User-UUID deren
       BioLink und Media Kit abschalten oder sich einen fremden Namen sichern.
       getUser(token) prueft gegen den Auth-Server -- so wie generate-biolink
       und generate-mediakit es seit jeher tun. */
    const authHeader = req.headers.get('Authorization') || ''
    if (!authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ success: false, error: 'Kein Authorization Header' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 })
    }
    const token = authHeader.slice(7)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ success: false, error: 'Ungültiger Token' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 })
    }
    const userId = user.id

    // 2) Body parsen
    let body: any = {}
    try { body = await req.json() } catch (_) {}
    const newUsername: string = (body?.new_username || '').trim()
    if (!newUsername) {
      return new Response(JSON.stringify({ success: false, error: 'new_username fehlt' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
    }

    // 3) Format-Validierung (3-30 Zeichen, alphanumerisch + Unterstrich)
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(newUsername)) {
      return new Response(JSON.stringify({ success: false, error: 'Username muss 3–30 Zeichen lang sein und darf nur Buchstaben, Zahlen und _ enthalten.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
    }

    // 4) Blacklist-Check
    const { data: blacklisted } = await supabase
      .from('username_blacklist')
      .select('username')
      .ilike('username', newUsername)
      .maybeSingle()
    if (blacklisted) {
      return new Response(JSON.stringify({ success: false, error: 'Dieser Username ist reserviert.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
    }

    // 5) Aktuellen User holen + Verfügbarkeit prüfen (case-insensitive)
    const { data: currentUser, error: userErr } = await supabase
      .from('users')
      .select('id, display_name')
      .eq('id', userId)
      .single()
    if (userErr || !currentUser) {
      return new Response(JSON.stringify({ success: false, error: 'User nicht gefunden' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 })
    }

    const oldDisplayName = currentUser.display_name || ''

    // Selber Name? Dann nur Spaces/Case-Diff — nichts zu tun
    if (oldDisplayName.toLowerCase() === newUsername.toLowerCase()) {
      return new Response(JSON.stringify({ success: false, error: 'Das ist bereits dein Username.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
    }

    // Anderer User mit dem Namen?
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .ilike('display_name', newUsername)
      .neq('id', userId)
      .maybeSingle()
    if (existing) {
      return new Response(JSON.stringify({ success: false, error: 'Dieser Username ist bereits vergeben.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 409 })
    }

    // 6) Alten Slug ableiten und Cleanup machen
    const oldSlug = oldDisplayName ? slugify(oldDisplayName) : null
    const result: any = { old_display_name: oldDisplayName, new_username: newUsername, biolink: 'skipped', mediakit: 'skipped' }

    if (oldSlug) {
      const bioRes = await deleteFromGitHub(`public/${oldSlug}/index.html`)
      result.biolink = bioRes.deleted ? 'deleted' : `skip_${bioRes.reason}`

      const kitRes = await deleteFromGitHub(`public/kit/${oldSlug}/index.html`)
      result.mediakit = kitRes.deleted ? 'deleted' : `skip_${kitRes.reason}`

      await purgeCloudflareCache([
        `https://viuno.de/${oldSlug}`, `https://viuno.de/${oldSlug}/`,
        `https://viuno.de/kit/${oldSlug}`, `https://viuno.de/kit/${oldSlug}/`,
        `https://biouno.de/${oldSlug}`, `https://biouno.de/${oldSlug}/`,
        `https://biouno.de/kit/${oldSlug}`, `https://biouno.de/kit/${oldSlug}/`
      ])
    } else {
      result.note = 'kein alter slug vorhanden'
    }

    // 7) Atomar in DB updaten: display_name + Flags zurücksetzen
    const { error: updateErr } = await supabase
      .from('users')
      .update({
        display_name: newUsername,
        bio_active: false,
        mediakit_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)

    if (updateErr) {
      // Sollte durch Race-Conditions praktisch nicht passieren, aber sauberer Fallback
      const isUnique = String(updateErr.message || '').toLowerCase().includes('duplicate') || String(updateErr.code || '') === '23505'
      const errorMsg = isUnique
        ? 'Dieser Username wurde gerade von jemand anderem genommen.'
        : 'Konnte Username nicht speichern: ' + updateErr.message
      return new Response(JSON.stringify({ success: false, error: errorMsg }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 409 })
    }

    // 8) biolink_settings Slug auch nullen falls vorhanden
    await supabase.from('biolink_settings').update({
      slug: null,
      is_active: false
    }).eq('user_id', userId)

    console.log('[change-username] success', result)

    return new Response(
      JSON.stringify({ success: true, ...result, new_slug: slugify(newUsername) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (err: any) {
    console.error('[change-username] error:', err.message)
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
