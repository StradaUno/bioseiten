/* ═══════════════════════════════════════════════════════════════════
   BRAND-READY-REGELWERK — die einzige Stelle, an der gerechnet wird.

   Diese Datei bricht bewusst mit der Regel "kein geteiltes JS" aus
   CLAUDE.md, und zwar aus einem Grund, der die Ausnahme traegt:

   Der Punktestand ist teilbar, und auf der geteilten Seite steht
   "powered by viuno". Kaeme die Zahl aus dem Browser des Creators,
   koennte sie jeder frei setzen -- viuno wuerde dann mit seinem Namen
   fuer eine erfundene Zahl buergen. Die Freigabe rechnet deshalb
   SERVERSEITIG nach. Ohne gemeinsames Modul gaebe es das Regelwerk
   zweimal, und zwei Kopien driften. Also gibt es genau eine:

     - public/app/index.html          importiert sie fuer die Live-Ansicht
     - Edge Function brand-ready-freigeben importiert sie fuer die Freigabe

   Sie ist statisch ausgeliefert (Cloudflare Pages), kein Bundler, keine
   Abhaengigkeit. **Deno friert importierte Module beim Deploy ein: wer
   hier etwas aendert, muss brand-ready-freigeben neu deployen**, sonst
   rechnet die Freigabe nach alten Regeln weiter.

   ── Zwei Grundsaetze ──────────────────────────────────────────────

   1) ZAHLEN UND URTEILE IN CODE. Kein Modell-Aufruf, nirgends. Jeder
      Satz ist eine Vorlage mit eingesetzten Zahlen -- dieselbe
      Arbeitsteilung, die befunde.ts in der Analyse-Pipeline festhaelt.
      Ein Score, den man nicht nachrechnen kann, ist wertlos.

   2) DER CHECK MISST NICHT, WIE VIEL VIUNO JEMAND NUTZT. Wer sein
      Impressum auf der eigenen Website hat, ein Canva-Kit pflegt und
      Linktree benutzt, bekommt dieselbe Punktzahl wie jemand mit
      viuno-BioLink und viuno-Kit. Jedes Ausstattungs-Kriterium hat drei
      Wege: automatisch aus viuno erkannt, vom Creator angegeben (gleich
      viele Punkte, als "eigene Angabe" gekennzeichnet und nicht
      geprueft), oder unbeantwortet.

   UNBEANTWORTET HEISST NICHT NULL. Was der Check nicht weiss, faellt aus
   dem Maximum, statt Punkte zu kosten.

   100 Punkte: 45 gemessen, 55 Ausstattung.
   ═══════════════════════════════════════════════════════════════════ */

/* Baustein 1: warum das aus Markensicht zaehlt. Steckt in der Anzeige
   hinter dem ⓘ, damit die Seite nicht aus Dauertext besteht. */
export const BR_WARUM = {
  engagement:   'Die Interaktionsrate ist die erste Zahl, die eine Marke prüft — sie sagt mehr über einen Kanal als die Followerzahl.',
  kommentare:   'Kommentare lassen sich schwerer kaufen als Likes. Ein reiner Like-Kanal wirkt auf Marken unecht.',
  frequenz:     'Eine Marke plant Kampagnen mit Vorlauf. Wer unregelmäßig postet, ist schwer einzuplanen.',
  verlauf:      'Marken buchen lieber Kanäle, die wachsen, als Kanäle, die schrumpfen.',
  account_typ:  'Ein Profi-Konto zeigt Marken eine Kategorie und ein Kontaktfeld direkt im Profil.',
  bio:          'Die Bio ist der erste Satz, den eine Marke über dich liest. Steht dort kein Thema, muss sie raten.',
  kennzeichnung:'Werbung muss als Werbung erkennbar sein. Weil die meisten Creator noch nie eine bezahlte Kooperation hatten, gibt es hier keine Punkte — nur den Hinweis, sobald es soweit ist.',
  biolink:      'Eine Marke will einen Ort, an dem alles steht. Ein Link in der Bio ist dieser Ort.',
  impressum:    'Eine gewerbliche Seite ohne Impressum ist in Deutschland abmahnbar (§ 5 DDG) — Marken wollen keinen Partner mit offenem Rechtsrisiko.',
  kontakt:      'Findet eine Marke keinen Kontaktweg, schreibt sie den nächsten Creator an.',
  kit_vorhanden:'Das Media Kit ist das Dokument, das fast jede Marke als Erstes anfordert.',
  kit_aktuell:  'Veraltete Zahlen im Kit fallen sofort auf und kosten Vertrauen — es ist die Angabe, die eine Marke am leichtesten gegenprüfen kann.',
  kit_preise:   'Preise zu nennen bringt schnellere Anfragen — sie wegzulassen kann aber Verhandlungstaktik sein. Deshalb ohne Punkte.',
  referenzen:   'Bisherige Kooperationen sind der Beweis, dass du liefern kannst — nach den Zahlen das stärkste Signal für eine Marke.',
  demografie:   'Eine Marke bucht eine Zielgruppe, nicht eine Followerzahl.',
  rechnung:     'Ohne Rechnung kann ein Unternehmen dich nicht bezahlen — bei vielen Kooperationen ist das die erste Frage.'
}

export const BR_NAME = {
  engagement: 'Engagement', kommentare: 'Kommentare', frequenz: 'Frequenz', verlauf: 'Verlauf',
  account_typ: 'Kontoart', bio: 'Bio', kennzeichnung: 'Werbekennzeichnung',
  biolink: 'Link-in-Bio-Seite', impressum: 'Impressum', kontakt: 'Kontaktweg',
  kit_vorhanden: 'Media Kit', kit_aktuell: 'Zahlen im Kit aktuell', kit_preise: 'Preise im Kit',
  referenzen: 'Referenzen', demografie: 'Zielgruppe', rechnung: 'Rechnung stellen'
}

/* Die Fragetexte stehen hier, damit Anzeige und Rechnung denselben
   Wortlaut benutzen und eine beantwortete Frage spaeter wieder mit dem
   Text auftauchen kann, mit dem sie gestellt wurde. */
export const BR_FRAGE_TEXT = {
  account_typ:  'Ist dein Konto ein Profi-Konto (Business oder Creator)?',
  biolink:      'Hast du eine Link-in-Bio-Seite?',
  impressum:    'Ist auf deiner Link-Seite oder Website ein Impressum erreichbar?',
  kontakt:      'Steht eine Kontakt-E-Mail in deiner Kanal-Bio oder auf deiner Link-Seite?',
  kit_vorhanden:'Hast du ein Media Kit?',
  kit_aktuell:  'Sind die Zahlen in deinem Kit jünger als zwei Monate?',
  kit_preise:   'Stehen Preise oder Preisspannen in deinem Kit?',
  referenzen:   'Bezahlte Kooperationen bisher',
  demografie:   'Stehen Alter, Geschlecht oder Land deiner Zielgruppe im Kit?',
  rechnung:     'Kannst du eine Rechnung stellen?'
}

/* Hashtag-Formen brauchen das #, die blanken deutschen Woerter eine
   Wortgrenze. Ein blankes \bad\b waere ein Fehler: "ad esempio" steht in
   jeder zweiten italienischen Caption und haette jede davon als
   gekennzeichnete Werbung gezaehlt. */
export const BR_KENNZ_RE = /#(werbung|anzeige|ad|adv|sponsored|gifted|paidpartnership)\b|\b(werbung|anzeige)\b|bezahlte partnerschaft|pubblicit/i
export const BR_MAIL_RE  = /[\w.+-]+@[\w-]+\.[\w.]+/

export function brZahlDe(n, d = 1) {
  if (n == null || isNaN(Number(n))) return '–'
  return Number(n).toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d })
}
export function brGanz(n) {
  return (n == null || isNaN(Number(n))) ? '–' : Number(n).toLocaleString('de-DE')
}
/* Fest auf Berliner Zeit, nicht auf die Zeitzone des Betrachters -- dieselbe
   Entscheidung wie in der Analyse-Ansicht. Ein geteilter Stand darf nicht je
   nach Standort des Lesers einen anderen Stichtag nennen. */
export function brDatum(s) {
  return s ? new Date(s).toLocaleDateString('de-DE',
    { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric' }) : '–'
}
function brStatus(p, max) {
  if (p == null) return 'nicht_bewertbar'
  if (max === 0)  return 'hinweis'
  if (p >= max)   return 'erfuellt'
  if (p <= 0)     return 'offen'
  return 'teilweise'
}
function brK(o) {
  return Object.assign({
    id: '', gruppe: 'Gemessen', name: '', punkte: null, max: 0,
    status: 'nicht_bewertbar', quelle: 'keine', satz: '', warum: '',
    tun: null, knopf: null, frage: null, lern_link: null
  }, o)
}

/* Kriterium mit drei Wegen. `viuno` ist gesetzt, wenn das viuno-Feature in
   Betrieb ist -- dann ist SEIN Inhalt die Wahrheit und die Frage wird nicht
   gestellt. Ein aktives Kit ohne Preise ist also "offen" mit Weg in die App,
   nicht die Frage "Stehen Preise in deinem Kit?". */
function brDrittelweg(id, gruppe, max, viuno, ang, t) {
  const name = BR_NAME[id]
  if (viuno) {
    return brK({ id, gruppe, name, max, punkte: viuno.punkte, status: brStatus(viuno.punkte, max),
      quelle: viuno.quelle || 'viuno', satz: viuno.satz, warum: BR_WARUM[id],
      tun: viuno.punkte < max ? t.tun : null, knopf: t.knopf || null })
  }
  const w = ang ? ang.wert : null
  if (w === true) {
    return brK({ id, gruppe, name, max, punkte: max, status: 'erfuellt', quelle: 'eigene_angabe',
      satz: t.ja, warum: BR_WARUM[id], knopf: t.knopf || null })
  }
  if (w === false) {
    return brK({ id, gruppe, name, max, punkte: 0, status: 'offen', quelle: 'eigene_angabe',
      satz: t.nein, warum: BR_WARUM[id], tun: t.tun, knopf: t.knopf || null })
  }
  return brK({ id, gruppe, name, max, punkte: null, status: 'nicht_bewertbar', quelle: 'keine',
    satz: 'Noch nicht beantwortet.', warum: BR_WARUM[id], knopf: t.knopf || null,
    frage: { id, text: BR_FRAGE_TEXT[id], hint: t.hint || '', typ: t.typ || 'jn', max } })
}

/* ═════════════════════════════════════════════════════════════════
   Die Rechnung. REINE FUNKTION -- kein DOM, kein Supabase, kein window,
   kein Datum ausser dem uebergebenen. Genau deshalb laeuft sie im
   Browser und in Deno identisch.
   ═════════════════════════════════════════════════════════════════ */
export function brBerechnen(d) {
  const s   = d.stats || {}
  const p   = d.profil || {}
  const bl  = d.bl || {}
  const mk  = d.mk || {}
  const ang = d.angaben || {}
  const jetzt = d.jetzt ? new Date(d.jetzt).getTime() : Date.now()
  const k   = []

  /* ═══ GEMESSEN (45) ═══════════════════════════════════════════ */

  // engagement (12) — Benchmark nach Groessenklasse (HypeAuditor)
  const foll = s.followers == null ? null : Number(s.followers)
  const er   = s.engagement_rate == null ? null : Number(s.engagement_rate)
  if (er == null || foll == null) {
    k.push(brK({ id: 'engagement', name: BR_NAME.engagement, max: 12, warum: BR_WARUM.engagement,
      satz: 'Für diesen Kanal liegen keine Engagement-Zahlen vor.' }))
  } else {
    const bm = foll < 10000 ? [2.5, 4.0] : foll < 100000 ? [1.5, 3.0] : [1.0, 2.0]
    const pk = er >= bm[1] ? 12 : er >= bm[0] ? 6 : 0
    k.push(brK({ id: 'engagement', name: BR_NAME.engagement, max: 12, punkte: pk, quelle: 'gemessen',
      status: brStatus(pk, 12), warum: BR_WARUM.engagement,
      satz: `${brZahlDe(er, 2)} % bei ${brGanz(foll)} Followern. Marken erwarten in dieser Größe ${brZahlDe(bm[0], 1)}–${brZahlDe(bm[1], 1)} %.`,
      tun: pk < 12 ? { art: 'route', label: 'Zur Analyse', route: '#/analytics' } : null }))
  }

  // kommentare (8) — Echtheitssignal: reine Like-Kanaele wirken gekauft
  const al = s.avg_likes == null ? null : Number(s.avg_likes)
  const ac = s.avg_comments == null ? null : Number(s.avg_comments)
  if (al == null || ac == null || al === 0) {
    k.push(brK({ id: 'kommentare', name: BR_NAME.kommentare, max: 8, warum: BR_WARUM.kommentare,
      satz: 'Für diesen Kanal liegen keine Likes vor, gegen die sich Kommentare rechnen lassen.' }))
  } else {
    const q  = ac / al
    const pk = q >= 0.05 ? 8 : q >= 0.02 ? 4 : 0
    k.push(brK({ id: 'kommentare', name: BR_NAME.kommentare, max: 8, punkte: pk, quelle: 'gemessen',
      status: brStatus(pk, 8), warum: BR_WARUM.kommentare,
      satz: `${brZahlDe(ac, 1)} Kommentare auf ${brZahlDe(al, 1)} Likes je Beitrag — ${brZahlDe(q * 100, 1)} %.`,
      tun: pk < 8 ? { art: 'route', label: 'Zur Analyse', route: '#/analytics' } : null }))
  }

  // frequenz (7)
  const ppw = s.posts_per_week == null ? null : Number(s.posts_per_week)
  if (ppw == null) {
    k.push(brK({ id: 'frequenz', name: BR_NAME.frequenz, max: 7, warum: BR_WARUM.frequenz,
      satz: 'Für diesen Kanal wurde keine Veröffentlichungsdichte erfasst.' }))
  } else {
    const pk = ppw >= 2 ? 7 : ppw >= 1 ? 4 : 0
    k.push(brK({ id: 'frequenz', name: BR_NAME.frequenz, max: 7, punkte: pk, quelle: 'gemessen',
      status: brStatus(pk, 7), warum: BR_WARUM.frequenz,
      satz: `${brZahlDe(ppw, 1)} Beiträge pro Woche.`,
      tun: pk < 7 ? { art: 'text', label: 'Ab zwei Beiträgen pro Woche gilt ein Kanal als planbar.' } : null }))
  }

  /* verlauf (7) — nur mit Vorlauf UND ohne Handle-Wechsel. Der Wechsel wird
     in analyse_stats erkannt; ohne diese Pruefung stuende hier
     "−9.288 Follower", weil zwei verschiedene Konten verglichen wuerden. */
  const fprev = s.followers_prev == null ? null : Number(s.followers_prev)
  if (fprev == null || s.handle_changed) {
    k.push(brK({ id: 'verlauf', name: BR_NAME.verlauf, max: 7, warum: BR_WARUM.verlauf,
      satz: s.handle_changed
        ? 'Dein Handle hat sich seit der letzten Analyse geändert — die alten Zahlen sind nicht mehr vergleichbar.'
        : 'Es gibt erst eine Messung. Mit deiner nächsten Analyse steht hier die Entwicklung.' }))
  } else {
    const pk = foll >= fprev ? 7 : 3
    k.push(brK({ id: 'verlauf', name: BR_NAME.verlauf, max: 7, punkte: pk, quelle: 'gemessen',
      status: brStatus(pk, 7), warum: BR_WARUM.verlauf,
      satz: `${brGanz(fprev)} → ${brGanz(foll)} Follower seit deiner letzten Analyse${d.statsPrev && d.statsPrev.created_at ? ' vom ' + brDatum(d.statsPrev.created_at) : ''}.` }))
  }

  /* account_typ (4) — raw_profile ist beschnitten und enthaelt nur
     businessCategory, kein isBusinessAccount. Fehlt die Kategorie, wird das
     NICHT als "privates Konto" ausgelegt -- das waere eine Behauptung ueber
     das Konto, erzeugt aus einem fehlenden Scraper-Feld. TikTok liefert sie
     nie, deshalb darf der Creator hier selbst antworten. */
  const kat = s.raw_profile && s.raw_profile.businessCategory ? String(s.raw_profile.businessCategory) : null
  k.push(brDrittelweg('account_typ', 'Gemessen', 4,
    kat ? { punkte: 4, quelle: 'gemessen', satz: `Dein Konto ist als „${kat}“ eingerichtet.` } : null,
    ang.account_typ, {
      ja: 'Du hast angegeben, dass dein Konto ein Profi-Konto ist.',
      nein: 'Du hast angegeben, dass dein Konto kein Profi-Konto ist.',
      tun: { art: 'text', label: 'Ein Profi-Konto stellst du in den Einstellungen deines Kanals um — es kostet nichts und zeigt Marken Kategorie und Kontaktfeld.' } }))

  /* bio (7) — die KANAL-Bio aus analyse_stats, nicht users.bio. users.bio ist
     der Text der viuno-BioLink-Seite; eine Marke liest die Bio im Profil. */
  const bioTxt = (s.bio && s.bio.trim()) ? s.bio : (p.bio || '')
  const bioLow = bioTxt.toLowerCase()
  /* Geprueft wird auf TEILSTRING gegen das Nischen-Vokabular: "Sportlerin"
     trifft ueber "sport", "Ernaehrungsberatung" ueber "ernaehrung". Eine
     Umschreibung trifft NICHT -- "ich helfe dir, fitter zu werden" enthaelt
     weder "fitness" noch "training". Das ist Absicht: Bedeutung zu erkennen
     waere Modellarbeit, und ein Modell darf hier nicht urteilen. Damit das
     nicht als Willkuer wirkt, nennt der Hinweis unten die Woerter, auf die
     bei DIESER Nische geprueft wird. */
  const vok = (d.nischen && d.nischen.length)
    ? d.nischen
    : (d.keywords || []).map(w => ({ keyword: w, niche_category: null }))
  const treffer = vok
    .filter(x => x.keyword && bioLow.includes(String(x.keyword).toLowerCase()))
    .map(x => x.keyword)
  const eigeneNische = String(p.niche_category || '').trim()
  const beispiele = vok
    .filter(x => x.niche_category && x.niche_category === eigeneNische && String(x.keyword).length > 3)
    .map(x => x.keyword).slice(0, 3)
  const eigenes = (p.niche_custom || '').trim().toLowerCase()
  const thema = treffer.length > 0 || (eigenes.length >= 3 && bioLow.includes(eigenes))
  /* Zeichen, nicht UTF-16-Einheiten: eine Bio aus zwanzig Emoji haette sonst
     "40 Zeichen" und damit die Schwelle genommen. */
  const bioLen = [...bioTxt.trim()].length
  const lang = bioLen >= 40
  const bioPk = (lang && thema) ? 7 : (lang || thema) ? 4 : 0
  k.push(brK({ id: 'bio', name: BR_NAME.bio, max: 7, punkte: bioTxt ? bioPk : null,
    quelle: bioTxt ? 'gemessen' : 'keine', status: bioTxt ? brStatus(bioPk, 7) : 'nicht_bewertbar',
    warum: BR_WARUM.bio,
    satz: !bioTxt ? 'Für diesen Kanal wurde keine Bio erfasst.'
      : `${bioLen} Zeichen, ${thema ? 'nennt „' + (treffer[0] || eigenes) + '“ als Thema' : 'nennt kein Thema deiner Nische'}.`,
    tun: (bioTxt && bioPk < 7) ? { art: 'text', label: thema
      ? 'Unter 40 Zeichen bleibt für eine Marke zu wenig übrig. Die Bio änderst du direkt in deinem Kanal.'
      : 'Nimm ein Wort auf, das dein Thema benennt'
        + (beispiele.length ? ' — bei deiner Nische zählt zum Beispiel ' + beispiele.map(w => '„' + w + '“').join(', ') : '')
        + '. Gesucht wird das Wort selbst: eine Umschreibung erkennt der Check nicht. Die Bio änderst du direkt in deinem Kanal.' } : null }))

  /* kennzeichnung (0) — HINWEIS OHNE PUNKTE. Wer noch nie eine bezahlte
     Kooperation hatte, kann hier nichts vorweisen; Punkte dafuer wuerden den
     Stand zwischen Creatorn unvergleichbar machen. Der Hinweis bleibt, weil
     die Kennzeichnungspflicht real ist, sobald der erste Deal kommt. */
  const posts = d.posts || []
  const mitK  = posts.filter(x => BR_KENNZ_RE.test(x.caption || '')).length
  k.push(brK({ id: 'kennzeichnung', name: BR_NAME.kennzeichnung, max: 0, punkte: null,
    status: 'hinweis', quelle: 'gemessen', warum: BR_WARUM.kennzeichnung, hinweis: true,
    satz: !posts.length ? 'Für diesen Kanal liegen keine Beiträge vor.'
      : mitK > 0 ? `In ${mitK} von ${posts.length} Beiträgen kennzeichnest du Werbung — das sehen Marken als Professionalität.`
      : `Keine gekennzeichnete Kooperation in ${posts.length} Beiträgen. Sobald du eine postest, muss sie als Werbung erkennbar sein.` }))

  /* ═══ AUSSTATTUNG (55) ════════════════════════════════════════ */

  const zumBio = { label: 'Zum BioLink', route: '#/biolink' }
  const zumKit = { label: 'Zum Media Kit', route: '#/mediakit' }

  // biolink (6)
  k.push(brDrittelweg('biolink', 'Ausstattung', 6,
    (p.bio_active || bl.is_active) ? { punkte: 6, satz: 'Deine BioLink-Seite ist online.' } : null,
    ang.biolink, { hint: 'viuno, Linktree, eigene Website …',
      ja: 'Du hast angegeben, dass du eine Link-in-Bio-Seite hast.',
      nein: 'Du hast angegeben, keine Link-in-Bio-Seite zu haben.',
      tun: { art: 'route', label: 'BioLink-Seite erstellen', route: '#/biolink' }, knopf: zumBio }))

  /* impressum (8) — ein Text, der kein Impressum ist, schuetzt vor nichts.
     Steht in viuno etwas, aber zu wenig, ist das "offen" mit Weg in die App
     und NICHT die Frage nach einem Impressum anderswo: ein Ja darauf gaebe
     volle Punkte, waehrend in viuno eine unvollstaendige Seite online steht. */
  const impTxt = ((p.impressum_text || '').length >= (bl.impressum_text || '').length
    ? (p.impressum_text || '') : (bl.impressum_text || '')).trim()
  const impOk  = impTxt.length >= 50 && /[0-9]/.test(impTxt)
  k.push(brDrittelweg('impressum', 'Ausstattung', 8,
    impTxt ? (impOk
      ? { punkte: 8, satz: `Hinterlegt, ${impTxt.length} Zeichen.` }
      : { punkte: 0, satz: `In viuno steht ein Impressum mit ${impTxt.length} Zeichen — zu kurz für eine vollständige Anbieterkennzeichnung.` }) : null,
    ang.impressum, {
      ja: 'Du hast angegeben, dass dein Impressum erreichbar ist.',
      nein: 'Du hast angegeben, dass kein Impressum erreichbar ist.',
      tun: { art: 'route', label: 'Impressum hinterlegen', route: '#/biolink' } }))

  // kontakt (7) — zaehlt auch, wenn die Adresse nur in der Kanal-Bio steht
  const mailInBio = BR_MAIL_RE.test(bioTxt)
  const mail = (p.contact_email || '').trim()
  k.push(brDrittelweg('kontakt', 'Ausstattung', 7,
    (mail || mailInBio) ? { punkte: 7, satz: mail && mailInBio
        ? `${mail} — in viuno hinterlegt, und in deiner Kanal-Bio steht ebenfalls eine Adresse.`
        : mail ? `${mail} — in viuno hinterlegt.`
        : 'In deiner Kanal-Bio steht eine E-Mail-Adresse.' } : null,
    ang.kontakt, {
      ja: 'Du hast angegeben, dass eine Kontakt-E-Mail auffindbar ist.',
      nein: 'Du hast angegeben, dass keine Kontakt-E-Mail auffindbar ist.',
      tun: { art: 'route', label: 'Kontakt-E-Mail hinterlegen', route: '#/biolink' } }))

  // kit_vorhanden (5)
  const kitViuno  = p.mediakit_active === true
  const kitAngabe = ang.kit_vorhanden ? ang.kit_vorhanden.wert : null
  const kitDa     = kitViuno || kitAngabe === true
  const kitNein   = !kitViuno && kitAngabe === false
  k.push(brDrittelweg('kit_vorhanden', 'Ausstattung', 5,
    kitViuno ? { punkte: 5, satz: 'Dein Media Kit ist öffentlich erreichbar.' } : null,
    ang.kit_vorhanden, { hint: 'PDF, Canva, Notion …',
      ja: 'Du hast angegeben, dass du ein Media Kit hast.',
      nein: 'Du hast angegeben, kein Media Kit zu haben.',
      tun: { art: 'route', label: 'Media Kit erstellen', route: '#/mediakit' }, knopf: zumKit }))

  /* Die Kit-INHALTS-Kriterien haengen am Kit: ohne Kit gibt es nichts, das
     aktuell sein oder eine Zielgruppe nennen koennte. `referenzen` haengt
     bewusst NICHT daran -- bezahlte Kooperationen existieren unabhaengig
     davon, ob jemand ein Kit pflegt. */
  const kitInhalt = (id, max, viuno, t) => {
    if (kitNein) {
      return brK({ id, gruppe: 'Ausstattung', name: BR_NAME[id], max, punkte: 0, status: 'offen',
        quelle: 'eigene_angabe', satz: t.ohneKit, warum: BR_WARUM[id],
        tun: { art: 'route', label: 'Media Kit erstellen', route: '#/mediakit' } })
    }
    if (!kitDa) {
      return brK({ id, gruppe: 'Ausstattung', name: BR_NAME[id], max, warum: BR_WARUM[id],
        satz: 'Noch nicht beantwortet.',
        frage: { id, text: BR_FRAGE_TEXT[id], hint: t.hint || '', typ: 'jn', max } })
    }
    return brDrittelweg(id, 'Ausstattung', max, kitViuno ? viuno : null, ang[id], t)
  }

  // kit_aktuell (12) — Logik aus getAnalysisDrift(), hier mit Stichtag
  const kitFoll = d.platform === 'tiktok' ? mk.followers_tiktok : mk.followers_instagram
  let kaViuno = null
  if (kitViuno) {
    if (kitFoll == null || !foll) {
      kaViuno = { punkte: 0, satz: `Für ${d.platform === 'tiktok' ? 'TikTok' : 'Instagram'} stehen keine Followerzahlen in deinem Media Kit.` }
    } else {
      const abw  = Math.abs(foll - Number(kitFoll)) / Number(kitFoll)
      const jung = s.created_at && (jetzt - new Date(s.created_at).getTime()) < 60 * 864e5
      const pk   = (abw <= 0.2 && jung) ? 12 : (abw <= 0.2 || jung) ? 7 : 0
      kaViuno = { punkte: pk, satz: `Im Kit stehen ${brGanz(kitFoll)} Follower, gemessen sind ${brGanz(foll)} — ${brZahlDe(abw * 100, 0)} % Abweichung. Analyse vom ${brDatum(s.created_at)}.` }
    }
  }
  k.push(kitInhalt('kit_aktuell', 12, kaViuno, {
    ohneKit: 'Ohne Media Kit gibt es keine Zahlen, die aktuell sein könnten.',
    ja: 'Du hast angegeben, dass die Zahlen in deinem Kit aktuell sind.',
    nein: 'Du hast angegeben, dass die Zahlen in deinem Kit älter sind.',
    tun: { art: 'route', label: 'Zahlen im Kit aktualisieren', route: '#/mediakit' } }))

  /* kit_preise (0) — HINWEIS OHNE PUNKTE. Preise wegzulassen ist eine
     legitime Verhandlungstaktik, kein Mangel. */
  const nOffers = d.offers || 0
  const nPreise = d.preise || 0
  k.push(brK({ id: 'kit_preise', gruppe: 'Ausstattung', name: BR_NAME.kit_preise, max: 0, punkte: null,
    status: 'hinweis', quelle: kitViuno ? 'viuno' : 'keine', warum: BR_WARUM.kit_preise, hinweis: true,
    satz: !kitDa ? 'Ohne Media Kit gibt es keinen Ort, an dem Preise stehen könnten.'
      : nPreise > 0 ? `${nPreise} von ${nOffers} Angeboten haben einen Preis.`
      : nOffers > 0 ? `${nOffers} Angebote im Kit, keines mit Preis. Das kann Absicht sein.`
      : 'Kein Angebot mit Preis hinterlegt.',
    knopf: kitViuno ? zumKit : null }))

  /* referenzen (9) — zwei Quellen, der hoehere Wert zaehlt. Wer keine Marken
     im Kit hat, aber drei bezahlte Kooperationen angibt, hat drei. */
  const nBrands = d.brands || 0
  const zahl    = ang.referenzen && ang.referenzen.zahl != null ? Number(ang.referenzen.zahl) : null
  const stufe   = n => n >= 3 ? 9 : n === 2 ? 7 : n === 1 ? 4 : 0
  const ausB    = kitViuno ? stufe(nBrands) : null
  const ausZ    = zahl == null ? null : stufe(zahl)
  if (ausB == null && ausZ == null) {
    k.push(brK({ id: 'referenzen', gruppe: 'Ausstattung', name: BR_NAME.referenzen, max: 9,
      warum: BR_WARUM.referenzen, satz: 'Noch nicht beantwortet.',
      frage: { id: 'referenzen', text: BR_FRAGE_TEXT.referenzen, hint: 'Anzahl', typ: 'zahl', max: 9 } }))
  } else {
    const pk = Math.max(ausB == null ? -1 : ausB, ausZ == null ? -1 : ausZ)
    const ausEigen = ausZ != null && ausZ >= (ausB == null ? -1 : ausB)
    k.push(brK({ id: 'referenzen', gruppe: 'Ausstattung', name: BR_NAME.referenzen, max: 9, punkte: pk,
      status: brStatus(pk, 9), quelle: ausEigen ? 'eigene_angabe' : 'viuno', warum: BR_WARUM.referenzen,
      satz: ausEigen
        ? `Du hast ${brGanz(zahl)} bezahlte ${zahl === 1 ? 'Kooperation' : 'Kooperationen'} angegeben.`
        : nBrands > 0 ? `${brGanz(nBrands)} ${nBrands === 1 ? 'Marke' : 'Marken'} im Media Kit hinterlegt.`
        : 'Keine Marke im Media Kit hinterlegt.',
      tun: pk < 9 ? { art: 'route', label: 'Marken im Kit eintragen', route: '#/mediakit' } : null,
      frage: zahl == null ? { id: 'referenzen', text: BR_FRAGE_TEXT.referenzen, hint: 'Anzahl', typ: 'zahl', max: 9 } : null }))
  }

  /* demografie (4) — bewusst niedrig gewichtet, und der Zusatz steht immer
     dabei: eine selbst eingetippte Zielgruppe ist unverifizierbar. */
  const demoOk = mk.gender_female_pct != null && mk.top_country_1
  const dmViuno = kitViuno ? (demoOk
    ? { punkte: 4, satz: `${brGanz(mk.gender_female_pct)} % weiblich, ${mk.top_country_1} als Top-Land. Eigenangabe — Marken verlangen einen Screenshot aus deinen Insights.` }
    : { punkte: 0, satz: 'In deinem Kit stehen keine Angaben zur Zielgruppe.' }) : null
  k.push(kitInhalt('demografie', 4, dmViuno, {
    ohneKit: 'Ohne Media Kit gibt es keinen Ort, an dem deine Zielgruppe steht.',
    ja: 'Du hast angegeben, dass deine Zielgruppe im Kit steht. Eigenangabe — Marken verlangen einen Screenshot aus deinen Insights.',
    nein: 'Du hast angegeben, dass keine Zielgruppen-Angaben im Kit stehen.',
    tun: { art: 'route', label: 'Zielgruppe eintragen', route: '#/mediakit' } }))

  // rechnung (4) — nie automatisch, immer Eigenangabe
  k.push(brDrittelweg('rechnung', 'Ausstattung', 4, null, ang.rechnung, {
    hint: 'Gewerbe oder Kleinunternehmer',
    ja: 'Du hast angegeben, dass du eine Rechnung stellen kannst.',
    nein: 'Du hast angegeben, keine Rechnung stellen zu können.',
    tun: { art: 'text', label: 'Für die meisten Creator ist die Kleinunternehmerregelung (§ 19 UStG) der Weg: Gewerbe anmelden, keine Umsatzsteuer ausweisen, solange du unter der Grenze bleibst. Das ist ein Formular beim Gewerbeamt.' } }))

  /* nicht_bewertbar und Hinweise fallen aus dem Maximum -- sie kosten nichts. */
  let punkte = 0, max = 0
  for (const x of k) { if (x.punkte != null) { punkte += x.punkte; max += x.max } }
  const fragen = k.filter(x => x.frage).map(x => x.frage)

  return {
    kriterien: k, punkte, max, fragen,
    offen: k.filter(x => x.punkte == null && !x.hinweis).length,
    stichtag: s.created_at || null,
    plattform: d.platform === 'tiktok' ? 'TikTok' : 'Instagram',
    plattformKey: d.platform,
    username: s.username || null
  }
}

/* ═════════════════════════════════════════════════════════════════
   Zwei Kanaele, ein Stand
   Von den 16 Kriterien haengen sieben am Kanal (Engagement, Kommentare,
   Frequenz, Verlauf, Kontoart, die Kanal-Bio und der Kennzeichnungs-
   Hinweis, zusammen 45 Punkte). Die uebrigen neun -- BioLink, Impressum,
   Kontaktweg, Media Kit, Preise, Referenzen, Zielgruppe, Rechnung, aktuelle
   Zahlen, zusammen 55 Punkte -- gelten fuer das KONTO und sind in jedem
   Lauf identisch.

   Bis 15.09.2026 stand deshalb "Instagram kommt auf 90 von 93 Punkten",
   obwohl mehr als die Haelfte davon gar nichts mit Instagram zu tun hat.

   Zusammengefuehrt wird so: Kontokriterien einmal, Kanalkriterien vom
   staerkeren Kanal. Nicht summiert (das zaehlte die Kontokriterien doppelt)
   und nicht gemittelt -- ein zweiter, schwaecherer Kanal wuerde den Stand
   sonst SENKEN, und damit waere die zweite Analyse eine Strafe.
   ═════════════════════════════════════════════════════════════════ */
export const BR_KANAL_IDS = new Set(
  ['engagement', 'kommentare', 'frequenz', 'verlauf', 'account_typ', 'bio', 'kennzeichnung'])

export function brZusammenfuehren(ergebnisse) {
  const gueltig = (ergebnisse || []).filter(Boolean)
  if (!gueltig.length) return null

  /* Staerkster Kanal = hoechster Anteil der erreichten an den bewertbaren
     KANAL-Punkten. Nicht die absolute Summe: ein Kanal, bei dem drei von
     sieben Kriterien mangels Daten ausfallen, soll nicht deshalb verlieren.
     Gleichstand entscheidet die groessere bewertbare Basis. */
  const wert = r => {
    const ks = r.kriterien.filter(x => BR_KANAL_IDS.has(x.id) && x.punkte != null && x.max > 0)
    const max = ks.reduce((a, x) => a + x.max, 0)
    const pk = ks.reduce((a, x) => a + x.punkte, 0)
    return { max, anteil: max > 0 ? pk / max : -1 }
  }
  const sortiert = gueltig
    .map(r => ({ r, w: wert(r) }))
    .sort((a, b) => (b.w.anteil - a.w.anteil) || (b.w.max - a.w.max))

  const stark = sortiert[0].r
  const basis = gueltig[0]   // Kontokriterien sind in allen Laeufen gleich

  const kriterien = [
    ...stark.kriterien.filter(x => BR_KANAL_IDS.has(x.id)),
    ...basis.kriterien.filter(x => !BR_KANAL_IDS.has(x.id))
  ]

  let punkte = 0, max = 0
  for (const x of kriterien) { if (x.punkte != null) { punkte += x.punkte; max += x.max } }

  /* Fragen koennen aus beiden Laeufen kommen; je id nur einmal, und bei
     Kanalfragen gilt die des staerkeren Kanals. */
  const fragen = []
  const gesehen = new Set()
  for (const f of [...stark.fragen, ...basis.fragen]) {
    if (gesehen.has(f.id)) continue
    gesehen.add(f.id); fragen.push(f)
  }

  return {
    kriterien, punkte, max, fragen,
    offen: kriterien.filter(x => x.punkte == null && !x.hinweis).length,
    stichtag: stark.stichtag,
    plattform: stark.plattform,
    username: stark.username,
    /* Fuer die Anzeige: woran die gemessenen Kriterien haengen und welche
       Kanaele ueberhaupt vorlagen. */
    gemessenAn: stark.plattform,
    gemessenAnKey: stark.plattformKey,
    kanaele: gueltig.map(r => r.plattform),
    mehrkanalig: gueltig.length > 1
  }
}

/* ═════════════════════════════════════════════════════════════════
   Die zwei bis drei Saetze unter dem Punktestand. Ebenfalls Vorlagen mit
   eingesetzten Zahlen -- kein Modell. Sie stehen in der App und auf der
   geteilten Seite, damit beide dasselbe sagen.
   ═════════════════════════════════════════════════════════════════ */
export function brSaetze(r) {
  const saetze = []
  const anteil = r.max > 0 ? r.punkte / r.max : 0
  const stand = anteil >= 0.8 ? 'Das meiste, was eine Marke prüft, ist vorhanden.'
    : anteil >= 0.55 ? 'Die Grundlagen stehen, einzelne Bausteine fehlen noch.'
    : 'Mehrere Dinge, auf die Marken zuerst schauen, fehlen noch.'
  /* Der Stand gilt dem KONTO, nicht einem Kanal -- mehr als die Haelfte der
     Punkte haengt an Dingen, die es nur einmal gibt. Woran die gemessenen
     Kriterien haengen, steht als eigener Halbsatz dahinter, damit die Zahl
     nachvollziehbar bleibt. */
  const woran = r.mehrkanalig
    ? ` Gemessen an ${r.gemessenAn}, deinem stärkeren Kanal.`
    : (r.plattform ? ` Gemessen an ${r.plattform}.` : '')
  saetze.push(`Dein Konto kommt auf ${r.punkte} von ${r.max} bewertbaren Punkten. ${stand}${woran}`)

  const voll = r.kriterien.filter(x => x.punkte != null && x.punkte >= x.max && x.max >= 6)
    .sort((a, b) => b.max - a.max)[0]
  if (voll) saetze.push(`Am stärksten: ${voll.name} — ${entkapitalisieren(voll.satz)}`)

  const luecke = r.kriterien.filter(x => x.punkte != null && x.punkte < x.max)
    .sort((a, b) => (b.max - b.punkte) - (a.max - a.punkte))[0]
  if (luecke) {
    saetze.push(`Die größte Lücke: ${luecke.name} — ${entkapitalisieren(luecke.satz)}`)
  } else if (r.offen > 0) {
    saetze.push(`${r.offen} ${r.offen === 1 ? 'Kriterium ist' : 'Kriterien sind'} noch ohne Wertung — beantwortet zählen sie mit.`)
  }
  return saetze
}

function entkapitalisieren(s) {
  const t = String(s || '').trim()
  if (!t) return ''
  // Beginnt der Satz mit einer Zahl oder einem Eigennamen, bleibt er wie er ist.
  return /^[A-ZÄÖÜ][a-zäöüß]/.test(t) ? t[0].toLowerCase() + t.slice(1) : t
}
