import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/* Zaehlt einen Aufruf einer oeffentlichen BioLink-Seite.
   Kein Cookie, kein localStorage, keine IP, kein User-Agent — nur
   Herkunft, Stunde und Sprache. Deshalb braucht die Seite keinen
   Einwilligungsbanner. */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

/* Der Body kommt je nach Aufrufer als application/json oder — von
   navigator.sendBeacon — als text/plain. Also selbst parsen. */
async function leseBody(req: Request): Promise<Record<string, unknown>> {
  try {
    return JSON.parse(await req.text())
  } catch (_) {
    return {}
  }
}

/* Die user_id steht im Quelltext jeder oeffentlichen Seite und kommt
   ungeprueft aus dem Body — ohne diese Pruefung liesse sich die Tabelle
   mit beliebigen UUIDs vollschreiben. Bewusst ohne bio_active-Pruefung:
   die handgebaute Seite unter /stradauno/ zaehlt auf einen Account,
   dessen generierter BioLink deaktiviert ist. */
async function userExistiert(id: unknown): Promise<boolean> {
  if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return false
  const { data } = await supabase.from('users').select('id').eq('id', id).maybeSingle()
  return !!data
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const body = await leseBody(req)
    const userId = body.user_id
    if (!await userExistiert(userId)) throw new Error('unbekannte user_id')

    const referrer = (body.referrer_source || 'direct').toString().slice(0, 200)
    const hour = typeof body.hour_of_day === 'number' && body.hour_of_day >= 0 && body.hour_of_day <= 23
      ? body.hour_of_day
      : null
    const language = ['de', 'en', 'it'].includes(body.language as string) ? body.language : null

    await supabase.from('biolink_aufrufe').insert({
      user_id: userId,
      referrer_source: referrer,
      hour_of_day: hour,
      language,
    })
    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
  } catch (err: any) {
    /* Status 200 auch im Fehlerfall: die Seite wertet die Antwort nicht
       aus, und ein 4xx wuerde nur die Konsole des Besuchers vollschreiben. */
    return new Response(JSON.stringify({ success: false, error: err.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
  }
})
