import { deZahl } from './basis.ts'

/* Vorberechnete Befunde und Ranglisten.
   Hintergrund: der einzige echte Fehler in der geprueften Auswertung war kein
   erfundener Wert, sondern eine selbstgebaute Rangliste -- das Modell nannte drei
   Beitraege "die drei reichweitenstaerksten" und meinte drei andere. Ranglisten und
   Zusammenhaenge entstehen deshalb ab jetzt hier, in Code, und wandern als fertige
   Saetze in den Prompt. Das Modell darf sie verwenden, aber keine eigenen bilden.

   Ein reiner Regel-Text ohne Modell wurde getestet und verworfen: er kam auf 6 bis 7
   von 10 Abschnitten und rund ein Drittel der Laenge, konnte keine Captions lesen und
   behauptete an einer Stelle das Gegenteil seiner eigenen Zahl. Die Arbeitsteilung
   ist deshalb: Zahlen und Zusammenhaenge aus Code, Lesen und Formulieren aus dem Modell. */

const BERLIN = { timeZone: 'Europe/Berlin' } as const
export const tagBerlin = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('de-DE', { ...BERLIN, day: '2-digit', month: '2-digit' }) : '?'
export const uhrBerlin = (d: string | null) =>
  d ? new Date(d).toLocaleTimeString('de-DE', { ...BERLIN, hour: '2-digit', minute: '2-digit' }) : ''
/* Jeder Beitrag wird mit Datum UND Uhrzeit benannt. Bei einem geprueften Kanal
   teilten sich 7 von 12 Beitraegen ein Datum -- ohne Uhrzeit weiss weder das Modell
   noch der Leser noch die Verlinkung, welcher gemeint ist. */
export const bez = (p: any) => `${tagBerlin(p.posted_at)} um ${uhrBerlin(p.posted_at)}`

const res = (p: any) => (p.likes ?? 0) / p.views * 1000
const kom = (p: any) => (p.comments ?? 0) / p.views * 1000
const r1 = (n: number) => Math.round(n * 10) / 10
const mittel = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length

function pearson(xs: number[], ys: number[]): number | null {
  const n = xs.length
  if (n < 5) return null
  const mx = mittel(xs), my = mittel(ys)
  let sxy = 0, sxx = 0, syy = 0
  for (let i = 0; i < n; i++) { const dx = xs[i] - mx, dy = ys[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy }
  if (sxx === 0 || syy === 0) return null
  return sxy / Math.sqrt(sxx * syy)
}
// Rangkorrelation statt Pearson: ein einzelner viraler Beitrag wuerde Pearson kippen.
function spearman(xs: number[], ys: number[]): number | null {
  const rang = (a: number[]) => {
    const s = a.map((v, i) => [v, i] as [number, number]).sort((p, q) => p[0] - q[0])
    const r = new Array(a.length)
    s.forEach(([_, i], k) => r[i] = k + 1)
    return r as number[]
  }
  return pearson(rang(xs), rang(ys))
}

const normText = (s: string) => (s || '').toLowerCase()
  .replace(/[#@][\wäöüß]+/g, ' ').replace(/[^\wäöüßàèéìòù ]+/g, ' ').replace(/\s+/g, ' ').trim()
const woerter = (s: string) => normText(s).split(' ').filter(Boolean)
function aehnlich(a: string, b: string): number {
  const A = new Set(woerter(a).filter(w => w.length > 3))
  const B = new Set(woerter(b).filter(w => w.length > 3))
  if (A.size < 3 || B.size < 3) return 0
  let t = 0
  for (const w of A) if (B.has(w)) t++
  return t / Math.min(A.size, B.size)
}

export function befunde(posts: any[], st: any): { ranglisten: string[]; befunde: string[]; fallback: Record<string, string> } {
  const mitViews = posts.filter(p => p.views > 0)
  const ranglisten: string[] = []
  const B: string[] = []
  const fallback: Record<string, string> = {}

  const liste = (titel: string, arr: any[], wert: (p: any) => string) =>
    arr.length ? ranglisten.push(`${titel}: ` + arr.map((p, i) => `${i + 1}. ${bez(p)} (${wert(p)})`).join(', ')) : null

  const nachLikes = [...posts].sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0))
  liste('Die stärksten Beiträge nach Likes', nachLikes.slice(0, 5), p => `${deZahl(p.likes)} Likes`)

  if (mitViews.length >= 3) {
    const nachViews = [...mitViews].sort((a, b) => b.views - a.views)
    liste('Die reichweitenstärksten Beiträge', nachViews.slice(0, 3), p => `${deZahl(p.views)} Aufrufe, Resonanz ${deZahl(r1(res(p)), 1)}`)
    liste('Die schwächsten nach Reichweite', nachViews.slice(-3).reverse(), p => `${deZahl(p.views)} Aufrufe, Resonanz ${deZahl(r1(res(p)), 1)}`)
    const nachRes = [...mitViews].sort((a, b) => res(b) - res(a))
    liste('Die stärksten nach Resonanz', nachRes.slice(0, 3), p => `${deZahl(r1(res(p)), 1)} Likes je 1.000 Aufrufe bei ${deZahl(p.views)} Aufrufen`)
    liste('Die schwächsten nach Resonanz', nachRes.slice(-3).reverse(), p => `${deZahl(r1(res(p)), 1)} Likes je 1.000 Aufrufe bei ${deZahl(p.views)} Aufrufen`)
    const nachKom = [...mitViews].sort((a, b) => kom(b) - kom(a))
    liste('Die stärksten nach Kommentarrate', nachKom.slice(0, 3), p => `${deZahl(r1(kom(p)), 1)} Kommentare je 1.000 Aufrufe`)

    // Spannweite als fertiger Faktor -- damit niemand ihn selbst ausrechnen muss.
    const hoch = res(nachRes[0]), tief = res(nachRes[nachRes.length - 1])
    if (tief > 0 && hoch / tief >= 1.8) {
      B.push(`Spannweite: zwischen dem stärksten (${bez(nachRes[0])}, ${deZahl(r1(hoch), 1)}) und dem schwächsten Beitrag ` +
        `(${bez(nachRes[nachRes.length - 1])}, ${deZahl(r1(tief), 1)}) liegt das ${deZahl(r1(hoch / tief), 1)}-Fache.`)
    }

    // Zusammenhang Reichweite und Resonanz, als Rangkorrelation.
    const rho = spearman(mitViews.map(p => p.views), mitViews.map(res))
    if (rho !== null) {
      if (rho <= -0.5) B.push(`Zusammenhang Reichweite und Resonanz: deutlich gegenläufig. Je weiter ein Beitrag ausgespielt wurde, desto seltener wurde reagiert.`)
      else if (rho >= 0.5) B.push(`Zusammenhang Reichweite und Resonanz: gleichläufig. Was weit lief, kam auch an.`)
      else B.push(`Zusammenhang Reichweite und Resonanz: keiner erkennbar. Die Ausspielung sagt bei diesem Kanal nichts darüber, ob ein Beitrag ankommt.`)
    }
  }

  /* Wortgleiche Wiederholungen. Die Richtung wird geprueft: beim ersten Testlauf
     behauptete die Regel "Wiederholung nutzt sich ab", waehrend ihre eigene Zahl das
     Gegenteil zeigte. Verglichen wird gegen die staerksten Beitraege, nicht gegen
     den Schnitt -- eine Wiederholung kann ueber dem Schnitt und trotzdem weit unter
     dem liegen, was der Kanal kann. */
  const gruppen: any[][] = []
  for (const p of posts) {
    if (woerter(p.caption || '').length < 6) continue
    const g = gruppen.find(gr => gr.some(q => aehnlich(q.caption, p.caption) >= 0.75))
    if (g) g.push(p); else gruppen.push([p])
  }
  const wieder = gruppen.filter(g => g.length > 1).sort((a, b) => b.length - a.length)[0]
  if (wieder) {
    const mitW = wieder.filter(p => p.views > 0)
    const wert = mitW.length ? r1(mittel(mitW.map(res))) : null
    const top = st?.resonanz_top, schnitt = st?.resonanz_schnitt
    let richtung = ''
    if (wert !== null && top != null) {
      richtung = wert < top * 0.85
        ? ` Das liegt unter deinen stärksten Beiträgen (${deZahl(top, 1)}) — die Wiederholung holt nicht heraus, was der Kanal kann.`
        : ` Das liegt auf dem Niveau deiner stärksten Beiträge (${deZahl(top, 1)}) — die Wiederholung schadet hier nicht.`
    }
    B.push(`Wortgleiche Wiederholung: ${wieder.length} Beiträge tragen praktisch denselben Text (${wieder.map(bez).join(', ')})` +
      (wert !== null ? `, zusammen ${deZahl(wert, 1)} Likes je 1.000 Aufrufe gegenüber ${deZahl(schnitt, 1)} im Schnitt.` : '.') + richtung)
  }

  // Frage im Text gegen keine Frage, gemessen an der Kommentarrate.
  const mitFrage = mitViews.filter(p => /\?/.test(p.caption || ''))
  const ohneFrage = mitViews.filter(p => !/\?/.test(p.caption || ''))
  if (mitFrage.length >= 2 && ohneFrage.length >= 2) {
    const a = r1(mittel(mitFrage.map(kom))), b = r1(mittel(ohneFrage.map(kom)))
    if (Math.max(a, b) >= Math.min(a, b) * 1.4) {
      B.push(`Frage im Text: Beiträge mit Fragezeichen kommen auf ${deZahl(a, 1)} Kommentare je 1.000 Aufrufe, die ohne auf ${deZahl(b, 1)} ` +
        `(${mitFrage.length} gegen ${ohneFrage.length} Beiträge).`)
    }
  }

  // Textlaenge gegen Resonanz.
  if (mitViews.length >= 6) {
    const rl = spearman(mitViews.map(p => woerter(p.caption || '').length), mitViews.map(res))
    if (rl !== null && Math.abs(rl) >= 0.5) {
      const nachLaenge = [...mitViews].sort((a, b) => woerter(b.caption || '').length - woerter(a.caption || '').length)
      const wortZahl = (p: any) => {
        const n = woerter(p.caption || '').length
        return `${deZahl(n)} ${n === 1 ? 'Wort' : 'Wörter'}`
      }
      const kurz = nachLaenge[nachLaenge.length - 1]
      B.push(`Textlänge: ${rl > 0 ? 'längere' : 'kürzere'} Captions haben durchgehend die höhere Resonanz. ` +
        `Längster Text ${bez(nachLaenge[0])} (${wortZahl(nachLaenge[0])}, Resonanz ${deZahl(r1(res(nachLaenge[0])), 1)}), ` +
        `kürzester ${bez(kurz)} (${wortZahl(kurz)}, Resonanz ${deZahl(r1(res(kurz)), 1)}).`)
    }
  }

  // Vormittag gegen Nachmittag.
  if (mitViews.length >= 8) {
    const std = (p: any) => parseInt(uhrBerlin(p.posted_at).slice(0, 2), 10)
    const frueh = mitViews.filter(p => std(p) < 12), spaet = mitViews.filter(p => std(p) >= 12)
    if (frueh.length >= 3 && spaet.length >= 3) {
      const a = r1(mittel(frueh.map(res))), b = r1(mittel(spaet.map(res)))
      if (Math.max(a, b) >= Math.min(a, b) * 1.3) {
        B.push(`Tageszeit: vormittags veröffentlicht ${deZahl(a, 1)} Likes je 1.000 Aufrufe, ab mittags ${deZahl(b, 1)} ` +
          `(${frueh.length} gegen ${spaet.length} Beiträge). Das ist eine Tendenz, keine Regel.`)
      }
    }
  }

  // Mehrere Beitraege am selben Tag.
  const tage = new Set(posts.map(p => tagBerlin(p.posted_at)))
  if (posts.length / tage.size >= 1.8) {
    B.push(`Veröffentlichungsdichte: ${deZahl(posts.length)} Beiträge verteilen sich auf ${deZahl(tage.size)} Tage, also mehrere am selben Tag.`)
  }

  if (!fallback.sound_befund && Array.isArray(st?.sound_stats) && st.sound_stats.length === 0 &&
      st?.eigener_ton && st.eigener_ton.gesamt > 0) {
    fallback.sound_befund = st.eigener_ton.mit === 0
      ? `Kein Ton kommt bei dir mehrfach vor, und eigenes Tonmaterial hast du in diesem Zeitraum nicht verwendet. Ein Vergleich zwischen Tönen ist damit nicht möglich.`
      : `Kein Ton kommt bei dir mehrfach vor. ${deZahl(st.eigener_ton.mit)} von ${deZahl(st.eigener_ton.gesamt)} Beiträgen laufen auf eigenem Ton.`
  }
  if (B.length) fallback.weitere_insights = B[B.length - 1]

  return { ranglisten, befunde: B, fallback }
}
