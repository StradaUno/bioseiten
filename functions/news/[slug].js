/**
 * /news/<slug> — eine einzelne Meldung mit eigener Vorschau.
 *
 * WhatsApp, iMessage und Instagram fuehren kein JavaScript aus. Sie lesen nur
 * das ausgelieferte HTML. Clientseitig gesetzte og:-Tags sieht dort niemand,
 * deshalb muessen sie hier am Server in die Seite. Das ist der einzige
 * serverseitige Baustein im ansonsten rein statischen Deploy — siehe CLAUDE.md.
 *
 * Die Seite selbst bleibt public/news/index.html: sie liest den Slug aus dem
 * Pfad und klappt die Meldung auf. Diese Function tauscht nur die Kopfdaten.
 */

const REST = 'https://bzejndghppuipnedasuv.supabase.co/rest/v1'
const KEY = 'sb_publishable_vVbpikuwqnh5jBTdvxcm7g_R4pZsMXI'

async function karteHolen(slug) {
  const abfrage = `select=slug,headline,summary,date&slug=eq.${encodeURIComponent(slug)}`
  const laden = (view) =>
    fetch(`${REST}/${view}?${abfrage}`, { headers: { apikey: KEY } })
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => [])

  const [aktuell, archiv] = await Promise.all([
    laden('digest_cards_today'),
    laden('digest_cards_past'),
  ])
  return [...aktuell, ...archiv][0] || null
}

export async function onRequestGet(context) {
  const { params, env, request } = context
  const slug = String(params.slug || '')
  const origin = new URL(request.url).origin

  const seite = await env.ASSETS.fetch(new URL('/news/index.html', origin))
  if (!seite.ok) return seite

  const antwort = new Response(seite.body, seite)
  antwort.headers.set('content-type', 'text/html; charset=utf-8')
  antwort.headers.set('cache-control', 'public, max-age=300')

  const karte = await karteHolen(slug)
  // Unbekannter Slug: die Seite wird normal ausgeliefert und zeigt die
  // aktuelle Ausgabe. Besser als ein 404 auf einen geteilten Link.
  if (!karte) return antwort

  const titel = `${karte.headline} — viuno`
  const beschreibung = karte.summary || 'Creator News von viuno.'
  const kanonisch = `${origin}/news/${encodeURIComponent(slug)}`

  const setzeInhalt = (wert) => ({ element: (el) => el.setAttribute('content', wert) })

  return new HTMLRewriter()
    .on('title', { element: (el) => el.setInnerContent(titel) })
    .on('link[rel="canonical"]', { element: (el) => el.setAttribute('href', kanonisch) })
    .on('meta[name="description"]', setzeInhalt(beschreibung))
    .on('meta[property="og:type"]', setzeInhalt('article'))
    .on('meta[property="og:url"]', setzeInhalt(kanonisch))
    .on('meta[property="og:title"]', setzeInhalt(titel))
    .on('meta[property="og:description"]', setzeInhalt(beschreibung))
    .transform(antwort)
}
