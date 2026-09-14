import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = 'https://bzejndghppuipnedasuv.supabase.co'
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabaseAdmin = createClient(
  SUPABASE_URL,
  SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    /* 1) Aufrufer pruefen.
       Hier stand bis 14.09.2026 ein blosses Base64-Dekodieren des Token-
       Mittelteils -- die Signatur wurde NIE geprueft.
       Da die Function mit verify_jwt:false laeuft, konnte damit jeder, der eine
       User-UUID kennt -- sie steht im Tracking-Pixel jeder Creator-Seite --, ein
       selbstgebautes Token schicken und ein fremdes Konto loeschen.
       getUser(token) prueft die Signatur gegen den Auth-Server. Gleiches Muster
       wie in generate-biolink und start-analysis. */
    const authHeader = req.headers.get('Authorization') || ''
    if (!authHeader.startsWith('Bearer ')) throw new Error('Kein Authorization Header')
    const token = authHeader.slice(7)

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) throw new Error('Auth fehlgeschlagen')
    const userId = user.id

    console.log(`[delete-account] start userId=${userId}`)

    // 2) GitHub-Pages + Cloudflare-Cache aufraeumen via cleanup-user-pages
    //    Service-Role-Key + user_id im Body (Function liest user_id aus Body)
    try {
      const cleanupRes = await fetch(`${SUPABASE_URL}/functions/v1/cleanup-user-pages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ user_id: userId })
      })
      const cleanupBody = await cleanupRes.text()
      if (cleanupRes.ok) {
        console.log(`[delete-account] cleanup-user-pages OK: ${cleanupBody}`)
      } else {
        console.warn(`[delete-account] cleanup-user-pages ${cleanupRes.status}: ${cleanupBody}`)
      }
    } catch (e: any) {
      // best-effort: nicht abbrechen wenn GitHub/Cloudflare nicht erreichbar
      console.warn('[delete-account] cleanup-user-pages threw:', e.message)
    }

    // 3) Storage-Files loeschen: profile-images/{user_id}/*
    try {
      const { data: files, error: listErr } = await supabaseAdmin
        .storage
        .from('profile-images')
        .list(userId, { limit: 1000 })

      if (listErr) {
        console.warn('[delete-account] storage list failed:', listErr.message)
      } else if (files && files.length > 0) {
        const paths = files.map(f => `${userId}/${f.name}`)
        const { data: removed, error: rmErr } = await supabaseAdmin
          .storage
          .from('profile-images')
          .remove(paths)
        if (rmErr) {
          console.warn('[delete-account] storage remove failed:', rmErr.message)
        } else {
          console.log(`[delete-account] storage removed ${removed?.length ?? 0} files`)
        }
      } else {
        console.log('[delete-account] storage: keine files')
      }
    } catch (e: any) {
      console.warn('[delete-account] storage cleanup threw:', e.message)
    }

    // 4) Bezahlte Subscriptions schuetzen (10 Jahre Aufbewahrungspflicht)
    //    user_id auf NULL setzen, damit der Eintrag den User-Delete ueberlebt.
    //    Free/Trial-Subs (payment_ref IS NULL) loeschen wir explizit.
    const { error: paidSubErr } = await supabaseAdmin
      .from('subscriptions')
      .update({ user_id: null })
      .eq('user_id', userId)
      .not('payment_ref', 'is', null)
    if (paidSubErr) console.warn('[delete-account] paid sub anon failed:', paidSubErr.message)

    const { error: freeSubErr } = await supabaseAdmin
      .from('subscriptions')
      .delete()
      .eq('user_id', userId)
      .is('payment_ref', null)
    if (freeSubErr) console.warn('[delete-account] free sub delete failed:', freeSubErr.message)

    /* 4b) Gekaufte Analysen und Widerrufs-Zustimmungen pseudonymisieren.
       Beide Tabellen haben KEINEN Fremdschluessel auf users und ueberleben die
       Cascade -- bisher blieb die User-ID darin stehen. Die Datenschutzerklaerung
       (9.1) sagt zu, dass der Account-Verweis entfernt wird; die Zeilen selbst
       muessen wegen § 147 AO erhalten bleiben. */
    const { error: kaufErr } = await supabaseAdmin
      .from('analysis_purchases')
      .update({ user_id: null })
      .eq('user_id', userId)
    if (kaufErr) console.warn('[delete-account] analysis_purchases anon failed:', kaufErr.message)

    const { error: consentErr } = await supabaseAdmin
      .from('withdrawal_consents')
      .update({ user_id: null })
      .eq('user_id', userId)
    if (consentErr) console.warn('[delete-account] withdrawal_consents anon failed:', consentErr.message)

    // ai_usage_log traegt ebenfalls eine user_id ohne Fremdschluessel.
    const { error: aiErr } = await supabaseAdmin
      .from('ai_usage_log')
      .update({ user_id: null })
      .eq('user_id', userId)
    if (aiErr) console.warn('[delete-account] ai_usage_log anon failed:', aiErr.message)

    // 5) Auth-User loeschen.
    //    Cascade-Kette uebernimmt den Rest:
    //      auth.users -> public.users -> 14 abhaengige Tabellen.
    //    user_consents bleibt (keine FK = Option A: pseudonymisierter Nachweis).
    //    newsletter_subscribers bleibt (SET NULL).
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)
    if (deleteError) throw new Error('Auth delete fehlgeschlagen: ' + deleteError.message)

    console.log(`[delete-account] success userId=${userId}`)

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (err: any) {
    console.error('[delete-account] error:', err.message)
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
