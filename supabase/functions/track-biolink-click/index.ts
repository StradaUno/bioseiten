import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/* Zaehlt einen Klick auf einen Link einer oeffentlichen BioLink-Seite.
   Gleiche Bauweise wie track-biolink-view: kein Cookie, keine Kennung auf
   dem Geraet, keine IP. Die Seite ruft das per navigator.sendBeacon auf —
   der Aufruf haelt das Weiterspringen zum Ziel nicht auf.

   sendBeacon kann keine Header setzen. Der Body kommt deshalb als
   text/plain, und das ist Absicht: text/plain loest keinen
   CORS-Preflight aus, ein Klick bleibt also genau ein Request. */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

const ARTEN = ['instagram', 'tiktok', 'youtube', 'threads', 'kontakt', 'custom']
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function leseBody(req: Request): Promise<Record<string, unknown>> {
  try {
    return JSON.parse(await req.text())
  } catch (_) {
    return {}
  }
}

/* Siehe track-biolink-view: die user_id ist oeffentlich und frei
   waehlbar, mindestens die Existenz wird geprueft. */
async function userExistiert(id: unknown): Promise<boolean> {
  if (typeof id !== 'string' || !UUID.test(id)) return false
  const { data } = await supabase.from('users').select('id').eq('id', id).maybeSingle()
  return !!data
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const body = await leseBody(req)
    const userId = body.user_id
    if (!await userExistiert(userId)) throw new Error('unbekannte user_id')

    const art = ARTEN.includes(body.art as string) ? (body.art as string) : null
    if (!art) throw new Error('unbekannte art')

    /* link_id nur uebernehmen, wenn der Link diesem Account gehoert —
       sonst haengen fremde Klicks an fremden Links. */
    let linkId: string | null = null
    if (typeof body.link_id === 'string' && UUID.test(body.link_id)) {
      const { data } = await supabase
        .from('biolink_custom_links')
        .select('id')
        .eq('id', body.link_id)
        .eq('user_id', userId)
        .maybeSingle()
      linkId = data ? body.link_id : null
    }

    const label = typeof body.label === 'string' ? body.label.slice(0, 120) : null
    const hour = typeof body.hour_of_day === 'number' && body.hour_of_day >= 0 && body.hour_of_day <= 23
      ? body.hour_of_day
      : null

    await supabase.from('biolink_klicks').insert({
      user_id: userId,
      link_id: linkId,
      art,
      label,
      hour_of_day: hour,
    })
    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
  }
})
