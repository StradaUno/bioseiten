/* ═══════════════════════════════════════════════════════════════════════
   viuno App (Neubau 17.09.2026). Eine Datei, ein Hash-Router, die
   Bausteine aus /design/. Grundsatz: ein Creator traegt jede Angabe genau
   einmal ein (Profil), die Seiten BioLink und Media Kit werden mit
   Schaltern daraus zusammengesetzt.
   ═══════════════════════════════════════════════════════════════════════ */
import { createClient } from '/vendor/supabase-js.mjs'

const SB_URL = 'https://bzejndghppuipnedasuv.supabase.co'
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6ZWpuZGdocHB1aXBuZWRhc3V2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2NTMxOTcsImV4cCI6MjA4OTIyOTE5N30.TShH1cIABQCtKgLkhCS9ymUJ36ZUYnlvCnGTok6EKTo'
const FN = SB_URL + '/functions/v1/'
const BILD_BASIS = SB_URL + '/storage/v1/object/public/'
const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })

/* ── Helfer ─────────────────────────────────────────────────────────── */
const $ = (s, el) => (el || document).querySelector(s)
const $$ = (s, el) => Array.from((el || document).querySelectorAll(s))
const es = v => String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const fm = n => n == null || isNaN(n) ? '–' : Number(n).toLocaleString('de-DE', { maximumFractionDigits: 0 })
const dez = (n, k = 1) => n == null || isNaN(n) ? '–' : Number(n).toLocaleString('de-DE', { minimumFractionDigits: k, maximumFractionDigits: k })
const euro = n => n == null || n === '' ? '–' : Number(n).toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
const dat = s => s ? new Date(s).toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric' }) : '–'
const datKurz = s => s ? new Date(s).toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin', day: 'numeric', month: 'short' }) : '–'
const tageSeit = s => s ? Math.floor((Date.now() - new Date(s).getTime()) / 86400000) : null
const handleRein = h => String(h || '').trim().replace(/^@+/, '')
const urlRein = u => { u = String(u || '').trim(); return u && !/^https?:\/\//i.test(u) ? 'https://' + u : u }
const slugify = n => String(n || '').toLowerCase().trim().replace(/[äÄ]/g, 'ae').replace(/[öÖ]/g, 'oe').replace(/[üÜ]/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9\s_-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
const schlaf = ms => new Promise(r => setTimeout(r, ms))

const SVG = (p, extra = '') => `<svg class="v-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"${extra}>${p}</svg>`
const ICO = {
  start: SVG('<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>'),
  seiten: SVG('<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>'),
  analyse: SVG('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  news: SVG('<path d="M4 5h16v14H4zM8 9h8M8 13h5"/>'),
  profil: SVG('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
  zurueck: SVG('<path d="M15 6l-6 6 6 6"/>'),
  pfeil: SVG('<path d="M9 6l6 6-6 6"/>'),
  ab: SVG('<path d="M6 9l6 6 6-6"/>'),
  auf: SVG('<path d="M6 15l6-6 6 6"/>'),
  x: SVG('<path d="M6 6l12 12M18 6L6 18"/>'),
  haken: SVG('<path d="M5 12l5 5 9-11"/>', ' stroke-width="3"'),
  plus: SVG('<path d="M12 5v14M5 12h14"/>'),
  extern: SVG('<path d="M7 17L17 7M8 7h9v9"/>'),
  kopie: SVG('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5h10"/>'),
  stift: SVG('<path d="M4 20h4l10-10-4-4L4 16z"/>'),
  muell: SVG('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
  warn: SVG('<path d="M12 3l10 18H2zM12 10v4M12 17h.01"/>'),
  info: SVG('<circle cx="12" cy="12" r="9"/><path d="M12 8h.01M12 11v5"/>'),
  stern: SVG('<path d="M12 3l2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4z"/>'),
  link: SVG('<path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>'),
  mail: SVG('<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>'),
  foto: SVG('<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-8 8"/>'),
  neu: SVG('<path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5"/>'),
  schloss: SVG('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
  teilen: SVG('<path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M12 15V3M8 7l4-4 4 4"/>'),
  instagram: SVG('<rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>'),
  tiktok: SVG('<path d="M21 7.9v4a10 10 0 0 1-5-2v4.6a6.5 6.5 0 1 1-8-6.3v4.3a2.5 2.5 0 1 0 4 2V3h4.1A6 6 0 0 0 21 7.9z"/>'),
  youtube: SVG('<path d="M2.5 17a24.1 24.1 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.6 49.6 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.1 24.1 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.6 49.6 0 0 1-16.2 0A2 2 0 0 1 2.5 17"/><path d="m10 15 5-3-5-3z"/>'),
  threads: SVG('<path d="M18.6 8c-1.1-3.2-3.4-5-6.4-5C7.4 3 4.9 6.9 4.9 12c0 5.1 2.6 9 7.4 9 4.1 0 6.7-2.2 6.7-5.4 0-2.9-2.3-4.8-5.6-4.8-2.1 0-3.6 1-3.6 2.5 0 1.4 1.2 2.3 2.7 2.3 2 0 3.3-1.6 3.3-4.2"/>'),
  sonne: SVG('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  mond: SVG('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'),
  raus: SVG('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>'),
  herz: SVG('<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/>'),
  uhr: SVG('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  ziel: SVG('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>'),
  euro: SVG('<path d="M18 6a7 7 0 1 0 0 12M4 10h9M4 14h9"/>'),
  gruppe: SVG('<circle cx="9" cy="8" r="3.5"/><path d="M2 20a7 7 0 0 1 14 0M16 4a3.5 3.5 0 0 1 0 7M22 20a7 7 0 0 0-5-6.7"/>'),
  sprache: SVG('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>'),
  palette: SVG('<path d="M12 3a9 9 0 0 0 0 18c1.2 0 2-.8 2-2 0-.6-.3-1-.6-1.4-.3-.4-.4-.8-.4-1.1 0-.9.7-1.5 1.5-1.5H16a5 5 0 0 0 5-5c0-4-4-7-9-7z"/><circle cx="7.5" cy="10.5" r="1"/><circle cx="12" cy="7.5" r="1"/><circle cx="16.5" cy="10.5" r="1"/>'),
  doc: SVG('<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>'),
  bild: SVG('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="M21 16l-6-6-9 9"/>'),
  griff: SVG('<circle cx="9" cy="6" r="1.3"/><circle cx="15" cy="6" r="1.3"/><circle cx="9" cy="12" r="1.3"/><circle cx="15" cy="12" r="1.3"/><circle cx="9" cy="18" r="1.3"/><circle cx="15" cy="18" r="1.3"/>', ' fill="currentColor" stroke="none"'),
}
const KANAELE = [
  { key: 'instagram', label: 'Instagram', spalte: 'instagram_handle', url: h => 'https://instagram.com/' + h },
  { key: 'tiktok', label: 'TikTok', spalte: 'tiktok_handle', url: h => 'https://tiktok.com/@' + h },
  { key: 'threads', label: 'Threads', spalte: 'threads_handle', url: h => 'https://threads.net/@' + h },
  { key: 'youtube', label: 'YouTube', spalte: 'youtube_handle', url: h => 'https://youtube.com/@' + h },
]
const NISCHEN = [['lifestyle', 'Lifestyle'], ['fashion', 'Fashion'], ['beauty', 'Beauty'], ['food', 'Food'], ['fitness', 'Fitness'], ['travel', 'Travel'], ['gaming', 'Gaming'], ['music', 'Music'], ['comedy', 'Comedy'], ['education', 'Bildung & Wissen'], ['business', 'Business'], ['tech', 'Tech'], ['art', 'Art'], ['family', 'Family'], ['mental_health', 'Mental Health'], ['general', 'Allgemein'], ['sonstiges', 'Sonstiges']]
const nischeLabel = k => (NISCHEN.find(n => n[0] === k) || [k, k])[1]
const LEISTUNGEN = [['ugc_video', 'UGC Video'], ['instagram_reel', 'Instagram Reel'], ['tiktok_post', 'TikTok Video'], ['story_package', 'Story-Paket']]
const leistungLabel = k => (LEISTUNGEN.find(l => l[0] === k) || [k, k])[1]

/* ── Zustand ─────────────────────────────────────────────────────────── */
const Z = {
  session: null, p: null, bl: null, mk: null,
  links: [], marken: [], offers: [], preise: [], eigene: [], beitraege: [],
  geladen: false, ansicht: { seiten: 'biolink', analyse: 'analyse' },
  letzterTab: '#/start', cache: {},
}
const uid = () => Z.session?.user?.id
const token = () => Z.session?.access_token
const slug = () => slugify(Z.p?.display_name || '')

/* Abo: aktiv, solange Stripe bezahlt hat (drei Tage Karenz fuer verspaetete Buchungen). */
const aboAktiv = () => !!(Z.abo && Z.abo.is_active && (!Z.abo.expires_at || new Date(Z.abo.expires_at).getTime() > Date.now() - 3 * 86400000))
async function aboNeuLaden() {
  const { data } = await sb.from('subscriptions').select('*').eq('user_id', uid()).eq('plan', 'abo').order('updated_at', { ascending: false }).limit(1).maybeSingle()
  Z.abo = data || null
}

/* ── Oberflaeche: Toast, Sheet, Modal ────────────────────────────────── */
let toastTimer = null
function toast(text, art) {
  const el = $('#toast')
  el.className = 'v-toast' + (art === 'fehler' ? ' v-toast--fehler' : art === 'gut' ? ' v-toast--gut' : '')
  el.innerHTML = (art === 'fehler' ? ICO.warn : ICO.haken) + es(text)
  el.classList.add('offen')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => el.classList.remove('offen'), art === 'fehler' ? 3200 : 1800)
}
const fehler = (e, text) => { console.error(e); toast(text || (e && e.message) || 'Hat gerade nicht geklappt', 'fehler') }

let sheetZuCb = null
function sheet(html, { titel, beimSchliessen } = {}) {
  const el = $('#sheet')
  el.innerHTML = `<div class="v-sheet-griff"></div>${titel ? `<div class="v-sheet-kopf"><h2>${es(titel)}</h2><button class="v-ibtn v-ibtn--rund v-ibtn--klein" data-sheet-zu aria-label="Schließen">${ICO.x}</button></div>` : ''}${html}`
  sheetZuCb = beimSchliessen || null
  $('#overlay').classList.add('offen'); el.classList.add('offen')
  $('[data-sheet-zu]', el)?.addEventListener('click', sheetZu)
  return el
}
function sheetZu() {
  $('#overlay').classList.remove('offen'); $('#sheet').classList.remove('offen'); $('#modal').classList.remove('offen')
  const cb = sheetZuCb; sheetZuCb = null; if (cb) cb()
}
$('#overlay').addEventListener('click', sheetZu)
document.addEventListener('keydown', e => { if (e.key === 'Escape') sheetZu() })
function modal(html) {
  const el = $('#modal')
  el.innerHTML = `<div class="v-modal">${html}</div>`
  $('#overlay').classList.add('offen'); el.classList.add('offen')
  $$('[data-modal-zu]', el).forEach(b => b.addEventListener('click', sheetZu))
  return el
}
function bestaetigen({ titel, text, ja = 'Ja', nein = 'Abbrechen', gefahr = false }) {
  return new Promise(res => {
    const el = modal(`<h2>${es(titel)}</h2><p>${es(text)}</p><div class="v-btn-reihe"><button class="v-btn v-btn--rand" data-modal-zu>${es(nein)}</button><button class="v-btn ${gefahr ? 'v-btn--gefahr' : 'v-btn--dunkel'}" data-ja>${es(ja)}</button></div>`)
    $('[data-ja]', el).addEventListener('click', () => { sheetZu(); res(true) })
    $('[data-modal-zu]', el).addEventListener('click', () => res(false), { once: true })
  })
}
function laden(btn, an) {
  if (!btn) return
  btn.disabled = an
  if (an) { btn.dataset.text = btn.innerHTML; btn.innerHTML = '<span class="v-spin" style="width:16px;height:16px;border-width:2px"></span>' + (btn.dataset.lade || '') }
  else if (btn.dataset.text) btn.innerHTML = btn.dataset.text
}

/* ── Supabase-Helfer ─────────────────────────────────────────────────── */
async function fn(name, body, { method = 'POST', query = '' } = {}) {
  const res = await fetch(FN + name + query, {
    method, headers: { 'Content-Type': 'application/json', apikey: SB_KEY, Authorization: 'Bearer ' + token() },
    body: method === 'POST' ? JSON.stringify(body || {}) : undefined,
  })
  let d = null; try { d = await res.json() } catch (_) {}
  if (!res.ok || (d && d.success === false) || (d && d.error && !d.url && !d.status)) {
    const e = new Error((d && (d.message || d.error)) || ('Fehler ' + res.status)); e.daten = d; e.status = res.status; throw e
  }
  return d
}
async function rpc(name, args) {
  const { data, error } = await sb.rpc(name, args || {})
  if (error) throw error
  return data
}
async function userSpeichern(patch) {
  const { error } = await sb.from('users').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', uid())
  if (error) throw error
  Object.assign(Z.p, patch)
}
async function mkSpeichern(patch) {
  if (Z.mk && Z.mk.id) {
    const { error } = await sb.from('mediakit_viuno').update({ ...patch, updated_at: new Date().toISOString() }).eq('user_id', uid())
    if (error) throw error
    Object.assign(Z.mk, patch)
  } else {
    const { data, error } = await sb.from('mediakit_viuno').insert({ user_id: uid(), ...patch }).select('*').single()
    if (error) throw error
    Z.mk = data
  }
}
async function blSpeichern(patch) {
  if (Z.bl) {
    const { error } = await sb.from('biolink_viuno').update({ ...patch, updated_at: new Date().toISOString() }).eq('user_id', uid())
    if (error) throw error
    Object.assign(Z.bl, patch)
  } else {
    const { data, error } = await sb.from('biolink_viuno').insert({ user_id: uid(), ...patch }).select('*').single()
    if (error) throw error
    Z.bl = data
  }
}
/* Die BioLink-Seite traegt Name, Bio und Bild fest im HTML (OG-Tags). Nach
   einer Aenderung daran wird sie neu erzeugt. Handles, Links, Kontakt
   liest die Seite zur Laufzeit -- dafuer ist kein Neuerzeugen noetig. */
async function bioNeuErzeugen({ leise } = {}) {
  if (!Z.p?.bio_active) return { uebersprungen: true }
  try {
    const d = await fn('generate-biolink')
    if (!leise) toast(d.commit === 'unchanged' ? 'BioLink ist aktuell' : 'BioLink aktualisiert')
    return d
  } catch (e) { if (!leise) fehler(e, 'BioLink konnte nicht neu erzeugt werden'); return { fehler: e.message } }
}

async function ladeKonto() {
  const { data, error } = await sb.from('users').select('*').eq('id', uid()).maybeSingle()
  if (error) throw error
  Z.p = data
}
async function ladeAlles() {
  const id = uid()
  const [bl, mk, links, marken, offers, preise, eigene, beitraege, angaben, abo] = await Promise.all([
    sb.from('biolink_viuno').select('*').eq('user_id', id).maybeSingle(),
    sb.from('mediakit_viuno').select('*').eq('user_id', id).maybeSingle(),
    sb.from('biolink_custom_links').select('*').eq('user_id', id).order('position'),
    sb.from('mediakit_brands').select('*').eq('user_id', id).order('position'),
    sb.from('mediakit_content_offers').select('*').eq('user_id', id),
    sb.from('mediakit_preise').select('*').eq('user_id', id),
    sb.from('mediakit_eigene_leistungen').select('*').eq('user_id', id).order('position'),
    sb.from('mediakit_beitraege').select('*').eq('user_id', id).order('position'),
    sb.from('brand_ready_angaben').select('kriterium,wert').eq('user_id', id),
    sb.from('subscriptions').select('*').eq('user_id', id).eq('plan', 'abo').order('updated_at', { ascending: false }).limit(1).maybeSingle(),
  ])
  Z.angaben = {}; (angaben.data || []).forEach(a => { Z.angaben[a.kriterium] = !!a.wert })
  Z.abo = abo.data || null
  Z.bl = bl.data; Z.mk = mk.data; Z.links = links.data || []; Z.marken = marken.data || []
  Z.offers = offers.data || []; Z.preise = preise.data || []; Z.eigene = eigene.data || []; Z.beitraege = beitraege.data || []
  Z.geladen = true
  signaturSetzen()
}
function signaturSetzen() {
  const t = Z.bl?.theme || 'color'
  document.documentElement.dataset.thema = t
  try { localStorage.setItem('viuno-thema', t) } catch (_) {}
}
/* users.last_active_at, hoechstens einmal pro Stunde. */
async function merkeAktiv() {
  try {
    const k = 'viuno-aktiv-' + uid(); const z = Number(localStorage.getItem(k) || 0)
    if (Date.now() - z < 3600000) return
    localStorage.setItem(k, String(Date.now()))
    await sb.from('users').update({ last_active_at: new Date().toISOString() }).eq('id', uid())
  } catch (_) {}
}

/* ── Router ──────────────────────────────────────────────────────────── */
const ROUTEN = {
  login: { titel: 'Anmelden', frei: true, render: renderLogin },
  register: { titel: 'Konto anlegen', frei: true, render: renderRegister },
  reset: { titel: 'Passwort vergessen', frei: true, render: renderReset },
  'neues-passwort': { titel: 'Neues Passwort', frei: true, render: renderNeuesPasswort },
  onboarding: { titel: 'Willkommen', ohneKopf: true, render: renderOnboarding },
  start: { titel: 'Start', tab: 'start', render: renderStart },
  seiten: { titel: 'Seite', tab: 'seiten', pillen: [['biolink', 'BioLink'], ['mediakit', 'Media Kit']], render: renderSeiten },
  analyse: { titel: 'Analyse', tab: 'analyse', pillen: [['analyse', 'Analyse'], ['brandready', 'Brand Ready']], render: renderAnalyse },
  news: { titel: 'Creator News', tab: 'news', render: renderNews },
  profil: { titel: 'Profil', tab: 'profil', render: renderProfil },
  kanaele: { titel: 'Kanäle', zurueck: true, render: renderKanaele },
  links: { titel: 'Links', zurueck: true, render: renderLinks },
  marken: { titel: 'Zusammenarbeit', zurueck: true, render: renderMarken },
  leistungen: { titel: 'Leistungen & Preise', zurueck: true, render: renderLeistungen },
  zielgruppe: { titel: 'Zielgruppe', zurueck: true, render: renderZielgruppe },
  referenzen: { titel: 'Referenzen', zurueck: true, render: renderReferenzen },
}
const TABS = [['start', 'Start'], ['seiten', 'Seiten'], ['analyse', 'Analyse'], ['news', 'News'], ['profil', 'Profil']]
let renderNr = 0, aufraeumen = []
const geh = h => { location.hash = h }
function zurueck() {
  if (Z.zurueckZu) { const z = Z.zurueckZu; Z.zurueckZu = null; geh(z) } else geh(Z.letzterTab || '#/profil')
}
function ctxNeu(nr) {
  const c = { stale: () => nr !== renderNr }
  c.on = (el, ev, fn2) => { if (!el) return; el.addEventListener(ev, fn2); aufraeumen.push(() => el.removeEventListener(ev, fn2)) }
  c.interval = (fn2, ms) => { const i = setInterval(fn2, ms); aufraeumen.push(() => clearInterval(i)); return i }
  return c
}
async function render() {
  aufraeumen.forEach(f => { try { f() } catch (_) {} }); aufraeumen = []
  const nr = ++renderNr
  const teile = (location.hash || '#/start').replace(/^#\/?/, '').split('/').filter(Boolean)
  let name = teile[0] || 'start'
  if (!ROUTEN[name]) name = 'start'
  const r = ROUTEN[name]

  if (!Z.session && !r.frei) { geh('#/login'); return }
  if (Z.session && r.frei) { geh('#/start'); return }
  if (Z.session && !Z.geladen) { const ok = await ladeStart(); if (!ok || nr !== renderNr) return }
  if (Z.session && Z.p && !Z.p.onboarding_completed && name !== 'onboarding') { geh('#/onboarding'); return }

  if (r.pillen && teile[1] && r.pillen.some(p => p[0] === teile[1])) Z.ansicht[name] = teile[1]
  if (r.tab) Z.letzterTab = '#/' + name + (r.pillen ? '/' + Z.ansicht[name] : '')
  sheetZu()
  window.scrollTo(0, 0)

  // Kopf
  const kopf = $('#kopf')
  if (r.ohneKopf) { kopf.innerHTML = '' }
  else if (r.zurueck) {
    kopf.innerHTML = `<div class="v-topbar"><button class="v-ibtn v-ibtn--rund v-ibtn--klein" data-zurueck aria-label="Zurück">${ICO.zurueck}</button><h1 class="mitte">${es(r.titel)}</h1><span style="width:32px"></span></div>`
    $('[data-zurueck]', kopf).addEventListener('click', zurueck)
  } else if (r.frei) {
    kopf.innerHTML = ''
  } else {
    const p = Z.p || {}
    kopf.innerHTML = `<div class="v-topbar"><h1>${es(r.titel)}</h1><button class="v-avatar v-avatar--rund" data-profil aria-label="Profil" style="border:0;cursor:pointer;padding:0">${avatarInnen(p, 36)}</button></div>`
    $('[data-profil]', kopf).addEventListener('click', () => geh('#/profil'))
  }
  // Pillen
  const sub = $('#subnav')
  if (r.pillen) {
    sub.innerHTML = `<div class="v-pillen">${r.pillen.map(([k, l]) => `<button class="v-pille${Z.ansicht[name] === k ? ' aktiv' : ''}" data-pille="${k}">${es(l)}</button>`).join('')}</div>`
    $$('[data-pille]', sub).forEach(b => b.addEventListener('click', () => geh('#/' + name + '/' + b.dataset.pille)))
  } else sub.innerHTML = ''
  // Tabs
  const tb = $('#tabbar')
  const mitTabs = !!r.tab
  tb.hidden = !mitTabs
  $('#app').classList.toggle('ohne-tabs', !mitTabs)
  if (mitTabs) {
    tb.innerHTML = `<nav class="v-tabbar">${TABS.map(([k, l]) => `<a class="v-tab${r.tab === k ? ' aktiv' : ''}" href="#/${k}"><span class="v-tab-ico">${ICO[k]}</span>${l}${k === 'news' && Z.newsNeu ? '<span class="v-tab-punkt"></span>' : ''}</a>`).join('')}</nav>`
  }
  // Inhalt
  const area = $('#inhalt')
  area.innerHTML = skelett()
  try { await r.render(area, ctxNeu(nr)) }
  catch (e) { if (nr === renderNr) { console.error(e); area.innerHTML = leer('Da ist etwas schiefgegangen', es(e.message || ''), 'Neu laden', 'reload') ; $('[data-reload]', area)?.addEventListener('click', () => location.reload()) } }
}
function avatarInnen(p, px) {
  return p.profile_image_url ? `<img src="${es(p.profile_image_url)}" alt="">` : es((p.display_name || '?')[0].toUpperCase())
}
const skelett = () => `<div class="v-skel-stapel"><div class="v-skel v-skel--titel"></div><div class="v-skel-kacheln"><div class="v-skel v-skel--kachel"></div><div class="v-skel v-skel--kachel"></div></div><div class="v-skel"></div><div class="v-skel v-skel--kurz"></div></div>`
function leer(titel, text, knopf, aktion) {
  return `<div class="v-leer v-leer--karte"><div class="sym">${ICO.info}</div><h3>${es(titel)}</h3><p>${text}</p>${knopf ? `<button class="v-btn v-btn--dunkel" data-${aktion}>${es(knopf)}</button>` : ''}</div>`
}
async function ladeStart() {
  try {
    await ladeKonto()
    /* Sitzung ohne Konto (z. B. geloescht): abmelden statt Fehlerseite. */
    if (!Z.p) { await sb.auth.signOut(); Z.session = null; Z.geladen = false; geh('#/login'); return false }
    await ladeAlles(); merkeAktiv()
  }
  catch (e) { console.error(e); Z.geladen = true }
  return true
}

/* ── Bausteine als Funktionen ────────────────────────────────────────── */
const kpi = (label, wert, delta, deltaKlasse) => `<div class="v-kpi"><div class="v-kpi-label">${es(label)}</div><div class="v-kpi-wert v-num">${wert}</div>${delta ? `<div class="v-kpi-delta${deltaKlasse ? ' ' + deltaKlasse : ''}">${delta}</div>` : ''}</div>`
const karte = (inhalt, klasse = '') => `<div class="v-karte ${klasse}">${inhalt}</div>`
const karteKopf = (titel, sub, rechts = '') => `<div class="v-karte-kopf"><div><h3>${es(titel)}</h3>${sub ? `<p>${sub}</p>` : ''}</div>${rechts}</div>`
const feld = (label, inner, hint) => `<div class="v-feld">${label ? `<label>${es(label)}</label>` : ''}${inner}${hint ? `<span class="v-hint">${hint}</span>` : ''}</div>`
const input = (id, wert, attrs = '') => `<input class="v-input" id="${id}" value="${es(wert ?? '')}" ${attrs}>`
const toggle = (an, attrs = '', klasse = '') => `<button type="button" class="v-toggle${an ? ' an' : ''} ${klasse}" role="switch" aria-checked="${an ? 'true' : 'false'}" ${attrs}><i></i></button>`
const badge = (text, art) => `<span class="v-badge v-badge--ohne${art ? ' v-badge--' + art : ''}">${es(text)}</span>`
function listeZeile({ sym, symKlasse = '', text, small, wert, wertKlasse = '', pfeil = true, attrs = '', klasse = '', rechts = '' }) {
  return `<button type="button" class="v-liste-zeile ${klasse}" ${attrs}>${sym ? `<span class="sym ${symKlasse}">${sym}</span>` : ''}<span class="text">${es(text)}${small ? `<small>${small}</small>` : ''}</span>${wert != null ? `<span class="wert ${wertKlasse}">${wert}</span>` : ''}${rechts}${pfeil ? `<svg class="v-ico pfeil" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>` : ''}</button>`
}
function balkenListe(zeilen, { leerText = 'Noch nichts gezählt.', bunt = false } = {}) {
  if (!zeilen.length) return `<p class="text-klein">${es(leerText)}</p>`
  const max = Math.max(...zeilen.map(z => z.wert), 1)
  const farben = ['var(--v1)', 'var(--v2)', 'var(--v3)', 'var(--green)', 'var(--blue)', 'var(--orange)']
  return `<div class="v-balkenliste">${zeilen.map((z, i) => `<div class="v-balkenzeile${i === 0 && z.wert > 0 && !bunt ? ' best' : ''}"><span>${es(z.label)}</span><div class="v-balken"><i style="width:${Math.round(z.wert / max * 100)}%${bunt ? ';background:' + farben[i % farben.length] : ''}"></i></div><b class="v-num">${fm(z.wert)}</b></div>`).join('')}</div>`
}
const ring = (p, text, klasse = '') => `<div class="v-ring ${klasse}" style="--p:${Math.max(0, Math.min(1, p))}"><svg viewBox="0 0 88 88"><circle class="spur" cx="44" cy="44" r="36"/><circle class="wert" cx="44" cy="44" r="36"/></svg><b class="v-num">${text}</b></div>`
function linienChart(werte, { hoehe = 120 } = {}) {
  const w = werte.filter(v => v != null)
  if (w.length < 2) return `<p class="text-klein">Ab der zweiten Messung steht hier ein Verlauf.</p>`
  const min = Math.min(...w), max = Math.max(...w), sp = max - min || 1
  const X = i => Math.round(i / (w.length - 1) * 300), Y = v => Math.round(10 + (1 - (v - min) / sp) * (hoehe - 20))
  const pts = w.map((v, i) => `${X(i)} ${Y(v)}`)
  return `<svg class="v-chart" viewBox="0 0 300 ${hoehe}" preserveAspectRatio="none"><line class="raster" x1="0" y1="10" x2="300" y2="10"/><line class="raster" x1="0" y1="${hoehe / 2}" x2="300" y2="${hoehe / 2}"/><line class="raster" x1="0" y1="${hoehe - 10}" x2="300" y2="${hoehe - 10}"/><path class="flaeche" d="M${pts.join('L')}L300 ${hoehe}L0 ${hoehe}Z"/><path class="linie" d="M${pts.join('L')}"/><circle class="punkt" cx="${X(w.length - 1)}" cy="${Y(w[w.length - 1])}" r="4"/></svg>`
}
function bearbeitenBox(zeilen) {
  return `<div class="v-bearbeiten"><button class="v-btn v-btn--breit v-bearbeiten-knopf" data-ausklappen aria-expanded="false">Bearbeiten<svg class="v-ico v-bearbeiten-pfeil" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></button><div class="v-bearbeiten-panel"><div class="v-bearbeiten-liste">${zeilen.map(([t, a]) => `<button type="button" class="v-bearbeiten-zeile" data-aktion="${a}"><span>${es(t)}</span>${ICO.pfeil}</button>`).join('')}</div></div></div>`
}
/* Ausklapper mit Inhalt: Knopf mit Titel und Untertitel, darunter die Karten. */
function ausklappBox(titel, sub, inner) {
  return `<div class="v-bearbeiten"><button class="v-btn v-btn--breit v-bearbeiten-knopf" data-ausklappen aria-expanded="false" style="height:auto;padding:12px 18px;flex-direction:column;gap:2px;align-items:center"><span style="display:flex;align-items:center;gap:8px">${es(titel)}<svg class="v-ico v-bearbeiten-pfeil" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></span><span class="text-klein" style="font-weight:var(--fw-md)">${es(sub)}</span></button><div class="v-bearbeiten-panel"><div class="v-bearbeiten-liste"><div style="display:flex;flex-direction:column;gap:12px;padding:12px">${inner}</div></div></div></div>`
}
function bearbeitenBinden(area, ctx, aktionen) {
  $$('[data-ausklappen]', area).forEach(k => ctx.on(k, 'click', () => { const box = k.closest('.v-bearbeiten'); const o = box.classList.toggle('offen'); k.setAttribute('aria-expanded', o ? 'true' : 'false') }))
  $$('.v-bearbeiten-zeile', area).forEach(z => ctx.on(z, 'click', () => { const a = z.dataset.aktion; if (aktionen[a]) aktionen[a](); else if (a.startsWith('#')) { Z.zurueckZu = location.hash; geh(a) } }))
}
async function kopieren(text, meldung = 'Kopiert') {
  try { await navigator.clipboard.writeText(text); toast(meldung) } catch (_) { toast(text) }
}

/* ═══════════════════════════════════════════════════════════════════════
   Einstieg: Anmelden, Konto anlegen, Passwort
   ═══════════════════════════════════════════════════════════════════════ */
function authRahmen(titel, lead, inner, fuss) {
  return `<div class="auth"><div class="logo">v</div><div><h1>${es(titel)}</h1>${lead ? `<p class="lead">${lead}</p>` : ''}</div><form class="formular" data-form novalidate>${inner}</form>${fuss ? `<p class="fuss">${fuss}</p>` : ''}</div>`
}
async function renderLogin(area, ctx) {
  area.innerHTML = authRahmen('Willkommen zurück', 'Melde dich mit deiner E-Mail-Adresse an.',
    feld('E-Mail', input('email', '', 'type="email" autocomplete="email" inputmode="email" placeholder="du@beispiel.de"')) +
    feld('Passwort', input('pw', '', 'type="password" autocomplete="current-password" placeholder="••••••••"')) +
    `<button class="v-btn v-btn--dunkel v-btn--breit" type="submit">Anmelden</button>
     <p class="fuss"><a href="#/reset">Passwort vergessen?</a></p>`,
    `Noch kein Konto? <a href="#/register">Konto anlegen</a>`)
  ctx.on($('[data-form]', area), 'submit', async e => {
    e.preventDefault()
    const btn = $('button[type=submit]', area); laden(btn, true)
    const { data, error } = await sb.auth.signInWithPassword({ email: $('#email', area).value.trim(), password: $('#pw', area).value })
    laden(btn, false)
    if (error) return toast(error.message.includes('Invalid') ? 'E-Mail oder Passwort stimmt nicht' : error.message, 'fehler')
    Z.session = data.session; Z.geladen = false; geh('#/start')
  })
}
async function renderRegister(area, ctx) {
  area.innerHTML = authRahmen('Konto anlegen', 'Dein Username wird deine Adresse: viuno.de/<b>name</b>.',
    feld('Username', `<div class="v-input-huelle"><span class="praefix">@</span>${input('name', '', 'autocapitalize="none" autocomplete="username" placeholder="deinname" maxlength="30"')}</div>`, '<span data-name-hint>3–30 Zeichen, Buchstaben, Zahlen, Unterstrich.</span>') +
    feld('E-Mail', input('email', '', 'type="email" autocomplete="email" inputmode="email" placeholder="du@beispiel.de"')) +
    feld('Passwort', input('pw', '', 'type="password" autocomplete="new-password" placeholder="mindestens 8 Zeichen"')) +
    `<label class="v-checkbox"><input type="checkbox" id="agb"><span>Ich akzeptiere die <a href="https://viuno.de/legal#agb" target="_blank" rel="noopener">AGB</a> und habe die <a href="https://viuno.de/legal#datenschutz" target="_blank" rel="noopener">Datenschutzerklärung</a> gelesen.</span></label>
     <button class="v-btn v-btn--dunkel v-btn--breit" type="submit">Konto anlegen</button>`,
    `Schon ein Konto? <a href="#/login">Anmelden</a>`)
  const nameEl = $('#name', area), hint = $('[data-name-hint]', area)
  let pruefTimer = null, frei = false
  ctx.on(nameEl, 'input', () => {
    clearTimeout(pruefTimer); frei = false
    const v = nameEl.value.trim()
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(v)) { hint.textContent = '3–30 Zeichen, Buchstaben, Zahlen, Unterstrich.'; hint.parentElement.className = 'v-hint'; return }
    pruefTimer = setTimeout(async () => {
      try {
        const r = await rpc('is_username_available', { p_username: v })
        if (ctx.stale() || nameEl.value.trim() !== v) return
        frei = !!r?.available
        hint.textContent = frei ? 'viuno.de/' + v.toLowerCase() + ' ist frei.' : (r?.reason === 'reserved' ? 'Dieser Name ist reserviert.' : 'Dieser Name ist schon vergeben.')
        hint.parentElement.className = 'v-hint ' + (frei ? 'gut' : 'fehler')
      } catch (_) {}
    }, 400)
  })
  ctx.on($('[data-form]', area), 'submit', async e => {
    e.preventDefault()
    const name = nameEl.value.trim(), email = $('#email', area).value.trim(), pw = $('#pw', area).value
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(name)) return toast('Bitte einen gültigen Username wählen', 'fehler')
    if (pw.length < 8) return toast('Das Passwort braucht mindestens 8 Zeichen', 'fehler')
    if (!$('#agb', area).checked) return toast('Bitte AGB und Datenschutz bestätigen', 'fehler')
    const btn = $('button[type=submit]', area); laden(btn, true)
    try {
      const r = await rpc('is_username_available', { p_username: name })
      if (!r?.available) throw new Error('Dieser Username ist nicht verfügbar')
      const { data, error } = await sb.auth.signUp({ email, password: pw, options: { data: { display_name: name }, emailRedirectTo: location.origin + location.pathname.replace(/[^/]*$/, '') } })
      if (error) throw error
      if (data.session) { Z.session = data.session; Z.geladen = false; geh('#/onboarding') }
      else area.innerHTML = `<div class="auth"><div class="logo">v</div><div><h1>Fast geschafft</h1><p class="lead">Wir haben dir eine Mail an <b>${es(email)}</b> geschickt. Klick auf den Link darin, dann kannst du dich anmelden.</p></div><a class="v-btn v-btn--rand v-btn--breit" href="#/login">Zur Anmeldung</a></div>`
    } catch (e2) { fehler(e2) } finally { laden(btn, false) }
  })
}
async function renderReset(area, ctx) {
  area.innerHTML = authRahmen('Passwort vergessen', 'Wir schicken dir einen Link, mit dem du ein neues Passwort setzt.',
    feld('E-Mail', input('email', '', 'type="email" autocomplete="email" inputmode="email" placeholder="du@beispiel.de"')) +
    `<button class="v-btn v-btn--dunkel v-btn--breit" type="submit">Link schicken</button>`,
    `<a href="#/login">Zurück zur Anmeldung</a>`)
  ctx.on($('[data-form]', area), 'submit', async e => {
    e.preventDefault()
    const btn = $('button[type=submit]', area); laden(btn, true)
    const { error } = await sb.auth.resetPasswordForEmail($('#email', area).value.trim(), { redirectTo: location.origin + location.pathname.replace(/[^/]*$/, '') + '#/neues-passwort' })
    laden(btn, false)
    if (error) return fehler(error)
    toast('Mail ist unterwegs', 'gut')
  })
}
async function renderNeuesPasswort(area, ctx) {
  area.innerHTML = authRahmen('Neues Passwort', 'Mindestens 8 Zeichen.',
    feld('Neues Passwort', input('pw', '', 'type="password" autocomplete="new-password"')) +
    `<button class="v-btn v-btn--dunkel v-btn--breit" type="submit">Speichern</button>`)
  ctx.on($('[data-form]', area), 'submit', async e => {
    e.preventDefault()
    const pw = $('#pw', area).value
    if (pw.length < 8) return toast('Mindestens 8 Zeichen', 'fehler')
    const { data, error } = await sb.auth.updateUser({ password: pw })
    if (error) return fehler(error)
    toast('Passwort gesetzt', 'gut')
    const { data: s } = await sb.auth.getSession(); Z.session = s.session; Z.geladen = false; geh('#/start')
  })
}

/* ═══════════════════════════════════════════════════════════════════════
   Onboarding: Name steht schon, Rest in drei Schritten
   ═══════════════════════════════════════════════════════════════════════ */
async function renderOnboarding(area, ctx) {
  if (!Z.p) { area.innerHTML = leer('Konto wird vorbereitet', 'Einen Moment …'); await schlaf(1500); if (!ctx.stale()) { Z.geladen = false; render() } return }
  let schritt = 0
  const daten = { niche_category: Z.p.niche_category || 'general', contact_email: Z.p.contact_email || Z.session.user.email || '' }
  KANAELE.forEach(k => daten[k.spalte] = Z.p[k.spalte] || '')
  const zeichne = () => {
    const stepper = `<div class="v-stepper">${['Nische', 'Kanäle', 'Kontakt'].map((t, i) => `${i ? `<div class="v-step-linie${i <= schritt ? ' fertig' : ''}"></div>` : ''}<div class="v-step${i < schritt ? ' fertig' : i === schritt ? ' aktiv' : ''}"><span class="v-step-n">${i < schritt ? ICO.haken : i + 1}</span><span>${t}</span></div>`).join('')}</div>`
    let inner = ''
    if (schritt === 0) inner = `<h1 style="margin:0;font-size:var(--t-2xl);letter-spacing:-.03em">Hallo ${es(Z.p.display_name)}</h1><p class="text-muted" style="margin:0;line-height:var(--lh-body)">Womit beschäftigt sich dein Kanal? Danach richten sich Preisempfehlung und Vergleiche.</p>` +
      feld('Nische', `<select class="v-input v-select" id="ob-nische">${NISCHEN.map(([k, l]) => `<option value="${k}"${k === daten.niche_category ? ' selected' : ''}>${es(l)}</option>`).join('')}</select>`)
    if (schritt === 1) inner = `<h1 style="margin:0;font-size:var(--t-2xl);letter-spacing:-.03em">Deine Kanäle</h1><p class="text-muted" style="margin:0;line-height:var(--lh-body)">Einmal eintragen. Sie stehen dann auf BioLink und Media Kit und sind die Quelle für deine Analyse. Du kannst jeden Kanal später pro Seite ein- oder ausschalten.</p>` +
      KANAELE.map(k => feld(k.label, `<div class="v-input-huelle"><span class="praefix">@</span>${input('ob-' + k.key, daten[k.spalte].replace(/^@/, ''), 'autocapitalize="none" placeholder="deinname"')}</div>`)).join('')
    if (schritt === 2) inner = `<h1 style="margin:0;font-size:var(--t-2xl);letter-spacing:-.03em">Wie erreichen dich Marken?</h1><p class="text-muted" style="margin:0;line-height:var(--lh-body)">Diese Adresse steht hinter dem Kontakt-Knopf auf deinen Seiten. Ohne sie gibt es keinen Knopf.</p>` +
      feld('Kontakt-E-Mail', input('ob-kontakt', daten.contact_email, 'type="email" inputmode="email" placeholder="du@beispiel.de"'))
    area.innerHTML = `<div class="auth" style="padding-top:12px">${stepper}${inner}<div class="v-btn-reihe">${schritt ? `<button class="v-btn v-btn--rand" data-ob-zurueck>Zurück</button>` : ''}<button class="v-btn v-btn--dunkel" data-ob-weiter>${schritt === 2 ? 'Fertig' : 'Weiter'}</button></div></div>`
    const lesen = () => {
      if (schritt === 0) daten.niche_category = $('#ob-nische', area).value
      if (schritt === 1) KANAELE.forEach(k => daten[k.spalte] = handleRein($('#ob-' + k.key, area).value))
      if (schritt === 2) daten.contact_email = $('#ob-kontakt', area).value.trim()
    }
    ctx.on($('[data-ob-zurueck]', area), 'click', () => { lesen(); schritt--; zeichne() })
    ctx.on($('[data-ob-weiter]', area), 'click', async () => {
      lesen()
      if (schritt < 2) { schritt++; zeichne(); return }
      if (daten.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(daten.contact_email)) return toast('Das sieht nicht nach einer E-Mail-Adresse aus', 'fehler')
      const btn = $('[data-ob-weiter]', area); laden(btn, true)
      try {
        const patch = { niche_category: daten.niche_category, contact_email: daten.contact_email || null, onboarding_completed: true }
        KANAELE.forEach(k => patch[k.spalte] = daten[k.spalte] ? '@' + daten[k.spalte] : null)
        await userSpeichern(patch)
        try { await rpc('erstanalyse_freischalten') } catch (_) {}
        toast('Willkommen bei viuno', 'gut')
        geh('#/start')
      } catch (e) { fehler(e); laden(btn, false) }
    })
  }
  zeichne()
}

/* ═══════════════════════════════════════════════════════════════════════
   Start: muss ich diese Woche etwas tun?
   ═══════════════════════════════════════════════════════════════════════ */
/* Montag der laufenden Woche als JJJJ-MM-TT in Ortszeit. Nicht ueber toISOString:
   das ist UTC, und zwischen Mitternacht und zwei Uhr stand dort der Vortag, im
   Sonntagsfall also der Montag der Vorwoche -- und die Aufgaben blieben leer. */
function montag(d = new Date()) { const t = new Date(d); const w = (t.getDay() + 6) % 7; t.setDate(t.getDate() - w); return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0') }
/* Beleg einer Aufgabe: Begruendung als Satz, dazu die Punkte, die im Brand-Ready-Wert offen sind. */
const aufgabeBeleg = a => es(a.begruendung || '') + (a.beleg && a.beleg.max ? ` <span class="text-muted">· ${Number(a.beleg.punkte || 0)} von ${a.beleg.max} Punkten</span>` : '')
async function renderStart(area, ctx) {
  const woche = montag()
  const [aufgQ, berQ, newsQ, blQ] = await Promise.all([
    sb.from('growth_aufgaben').select('*').eq('user_id', uid()).eq('woche', woche).order('prioritaet'),
    sb.from('growth_wochenbericht').select('text,woche').eq('user_id', uid()).order('woche', { ascending: false }).limit(1).maybeSingle(),
    sb.from('digest_cards_today').select('slug,headline,platform,platform_label,date,published_date,relevance_score').limit(3),
    sb.from('biolink_aufrufe').select('viewed_at').eq('user_id', uid()).gte('viewed_at', new Date(Date.now() - 7 * 86400000).toISOString()),
  ])
  if (ctx.stale()) return
  const aufgaben = aufgQ.data || [], bericht = berQ.data, news = newsQ.data || []
  const heute = new Date().toDateString()
  const aufrufeHeute = (blQ.data || []).filter(a => new Date(a.viewed_at).toDateString() === heute).length
  const aufrufe7 = (blQ.data || []).length
  const p = Z.p, stunde = new Date().getHours()
  const gruss = stunde < 11 ? 'Guten Morgen' : stunde < 18 ? 'Hallo' : 'Guten Abend'

  // Wochenbericht laesst sich erst nach den Signalen schreiben; ohne Aufgaben wird die Berechnung angestossen.
  let aufgabenHtml
  if (aufgaben.length) {
    aufgabenHtml = `<ul class="v-check v-check--karten">${aufgaben.map(a => `<li class="${a.status === 'erledigt' ? 'fertig' : 'offen'}" data-aufgabe="${a.id}"><i>${a.status === 'erledigt' ? ICO.haken : ''}</i><span style="flex:1"><span style="display:block;font-weight:var(--fw-sb)">${es(a.titel)}</span><small class="text-klein" style="display:block;margin-top:3px;line-height:var(--lh-body)">${aufgabeBeleg(a)}</small></span>${a.status === 'offen' ? `<button class="v-btn v-btn--dunkel v-btn--klein" data-erledigt="${a.id}">Erledigt</button>` : ''}</li>`).join('')}</ul>`
  } else {
    aufgabenHtml = `<div class="v-leer v-leer--gestrichelt"><div class="sym akzent">${ICO.ziel}</div><h3>Noch keine Aufgaben diese Woche</h3><p>Sobald dein Kanal gemessen ist, stehen hier bis zu drei Aufgaben mit Beleg.</p><button class="v-btn v-btn--rand v-btn--klein" data-growth>Jetzt berechnen</button></div>`
  }
  area.innerHTML = `
    <div><div style="font-size:var(--t-2xl);font-weight:var(--fw-b);letter-spacing:-.03em">${gruss}, ${es(p.display_name)}</div><div class="text-klein" style="margin-top:4px">${new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}</div></div>
    ${bericht ? karte(`<p style="margin:0;font-size:var(--t-md);line-height:var(--lh-body)">${es(bericht.text)}</p><div class="v-karte-fuss"><span>Dein Wochenbericht · ${datKurz(bericht.woche)}</span></div>`) : ''}
    <div class="abschnitt"><div class="abschnitt-titel">Diese Woche</div>${aufgabenHtml}</div>
    <div class="v-kpi-reihe">
      ${kpi('BioLink heute', fm(aufrufeHeute), Z.p.bio_active ? '<span class="gut">live</span>' : '<span class="fehlt">aus</span>')}
      ${kpi('BioLink 7 Tage', fm(aufrufe7), Z.p.mediakit_active ? 'Media Kit live' : 'Media Kit aus')}
    </div>
    ${news.length ? `<div class="abschnitt"><div class="abschnitt-titel">Creator News</div><div class="v-liste">${news.map(k => `<button type="button" class="v-liste-zeile" data-geh="#/news" style="align-items:flex-start"><span class="text"><span class="news-kopf" style="margin-bottom:4px">${plattformPille(k)}${dringPille(k)}</span><span style="display:block;font-weight:var(--fw-sb);line-height:var(--lh-tight)">${es(k.headline)}</span></span>${ICO.pfeil}</button>`).join('')}</div></div>` : ''}
  `
  $$('[data-geh]', area).forEach(el => ctx.on(el, 'click', () => geh(el.dataset.geh)))
  $$('[data-erledigt]', area).forEach(b => ctx.on(b, 'click', async e => {
    e.stopPropagation()
    try { await rpc('aufgabe_setzen', { p_id: Number(b.dataset.erledigt), p_status: 'erledigt' }); toast('Erledigt', 'gut'); if (!ctx.stale()) renderStart(area, ctx) } catch (er) { fehler(er) }
  }))
  ctx.on($('[data-growth]', area), 'click', async e => {
    laden(e.currentTarget, true)
    try { const r = await rpc('growth_jetzt'); toast(r?.gestartet ? 'Wird berechnet, dauert eine Minute' : 'Für diese Woche schon berechnet'); await schlaf(4000); if (!ctx.stale()) renderStart(area, ctx) } catch (er) { fehler(er) }
  })
}

/* ═══════════════════════════════════════════════════════════════════════
   Seiten: BioLink und Media Kit
   ═══════════════════════════════════════════════════════════════════════ */
const WOCHENTAGE = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag']
const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']
async function renderSeiten(area, ctx) {
  if (Z.ansicht.seiten === 'mediakit') return renderMediakitSeite(area, ctx)
  return renderBiolinkSeite(area, ctx)
}
function statusZeile({ an, titel, url, schalterAttr }) {
  return `<div class="v-status ${an ? 'v-status--aktiv' : 'v-status--aus'}"><i></i><div class="text"><strong>${es(titel)} ist ${an ? 'live' : 'aus'}</strong><span>${an ? es(url) : 'Niemand kann die Seite sehen.'}</span></div>${an ? `<button class="v-btn v-btn--rand v-btn--klein" data-kopieren="https://${es(url)}">Kopieren</button>` : ''}${toggle(an, schalterAttr)}</div>`
}
async function renderBiolinkSeite(area, ctx) {
  const seit30 = new Date(Date.now() - 30 * 86400000).toISOString()
  const [aufrQ, gesamtQ, herkQ, klickQ, rateQ] = await Promise.all([
    sb.from('biolink_aufrufe').select('viewed_at').eq('user_id', uid()).gte('viewed_at', seit30),
    sb.from('biolink_aufrufe').select('id', { count: 'exact', head: true }).eq('user_id', uid()),
    sb.rpc('biolink_herkunft', { p_tage: 30 }), sb.rpc('biolink_klick_zahlen', { p_tage: 30 }), sb.rpc('biolink_klickrate', { p_tage: 30 }),
  ])
  if (ctx.stale()) return
  const aufrufe = aufrQ.data || []
  const heuteS = new Date().toDateString(), seit7 = Date.now() - 7 * 86400000
  const heute = aufrufe.filter(a => new Date(a.viewed_at).toDateString() === heuteS).length
  const tage7 = aufrufe.filter(a => new Date(a.viewed_at).getTime() >= seit7).length
  const proTag = WOCHENTAGE.map(t => ({ label: t, wert: 0 }))
  aufrufe.forEach(a => { proTag[(new Date(a.viewed_at).getDay() + 6) % 7].wert++ })
  const tageSortiert = [...proTag].sort((a, b) => b.wert - a.wert)
  const herkunft = (herkQ.data || []).map(h => ({ label: h.quelle, wert: Number(h.anzahl) }))
  const klicks = (klickQ.data || []).map(k => ({ label: k.label || k.art, wert: Number(k.anzahl) }))
  const rate = rateQ.data && rateQ.data[0]
  const url = 'viuno.de/' + slug()
  area.innerHTML = `
    ${statusZeile({ an: !!Z.p.bio_active, titel: 'BioLink', url, schalterAttr: 'data-bio-schalter' })}
    <div class="v-kpi-reihe v-kpi-reihe--drei">${kpi('Heute', fm(heute))}${kpi('7 Tage', fm(tage7))}${kpi('Gesamt', fm(gesamtQ.count || 0))}</div>
    ${karte(`<div class="zeile-zwischen" style="margin-bottom:12px"><strong>Aufrufe</strong><span>30 Tage</span></div>${balkenListe(tageSortiert.filter(t => t.wert > 0).length ? tageSortiert : [], { leerText: 'In den letzten 30 Tagen hat niemand deinen BioLink geöffnet.' })}`)}
    ${karte(`<div class="zeile-zwischen" style="margin-bottom:12px"><strong>Von hier kommen sie</strong><span>30 Tage</span></div>${balkenListe(herkunft)}`)}
    ${karte(`<div class="zeile-zwischen" style="margin-bottom:12px"><strong>Hier klicken sie</strong><span>${rate && rate.seit ? 'seit ' + datKurz(rate.seit) : '30 Tage'}</span></div>${balkenListe(klicks, { leerText: 'Noch kein Klick gezählt.' })}${rate && rate.aufrufe > 0 ? `<div class="v-karte-fuss"><span>Klickrate</span><b class="v-num">${dez(rate.klicks / rate.aufrufe * 100, 0)} %</b></div>` : ''}`)}
    ${bearbeitenBox([['Design', 'design'], ['Links', '#/links'], ['Sprache', 'sprache']])}
    ${Z.p.bio_active ? `<a class="v-btn v-btn--leise v-btn--breit" href="https://${es(url)}" target="_blank" rel="noopener">Seite ansehen ${ICO.extern}</a>` : ''}
  `
  bearbeitenBinden(area, ctx, { design: designSheet, sprache: spracheSheet })
  ctx.on($('[data-kopieren]', area), 'click', e => kopieren(e.currentTarget.dataset.kopieren, 'Adresse kopiert'))
  ctx.on($('[data-bio-schalter]', area), 'click', e => seiteSchalten('biolink', e.currentTarget, () => renderBiolinkSeite(area, ctx)))
}
async function renderMediakitSeite(area, ctx) {
  const seit365 = new Date(Date.now() - 365 * 86400000).toISOString()
  const [aufrQ, gesamtQ] = await Promise.all([
    sb.from('mediakit_aufrufe').select('viewed_at').eq('user_id', uid()).gte('viewed_at', seit365),
    sb.from('mediakit_aufrufe').select('id', { count: 'exact', head: true }).eq('user_id', uid()),
  ])
  if (ctx.stale()) return
  const aufrufe = aufrQ.data || []
  const seit7 = Date.now() - 7 * 86400000, seit30 = Date.now() - 30 * 86400000
  const tage7 = aufrufe.filter(a => new Date(a.viewed_at).getTime() >= seit7).length
  const tage30 = aufrufe.filter(a => new Date(a.viewed_at).getTime() >= seit30).length
  const jetzt = new Date(), monate = []
  for (let i = 11; i >= 0; i--) { const d = new Date(jetzt.getFullYear(), jetzt.getMonth() - i, 1); monate.push({ label: MONATE[d.getMonth()], y: d.getFullYear(), m: d.getMonth(), wert: 0 }) }
  aufrufe.forEach(a => { const d = new Date(a.viewed_at); const z = monate.find(x => x.y === d.getFullYear() && x.m === d.getMonth()); if (z) z.wert++ })
  const url = 'viuno.de/kit/' + slug()
  area.innerHTML = `
    ${statusZeile({ an: !!Z.p.mediakit_active, titel: 'Media Kit', url, schalterAttr: 'data-kit-schalter' })}
    <div class="v-kpi-reihe v-kpi-reihe--drei">${kpi('7 Tage', fm(tage7))}${kpi('30 Tage', fm(tage30))}${kpi('Gesamt', fm(gesamtQ.count || 0))}</div>
    ${karte(`<div class="zeile-zwischen" style="margin-bottom:12px"><strong>Aufrufe</strong><span>12 Monate</span></div>${balkenListe(aufrufe.length ? [...monate].sort((a, b) => b.wert - a.wert) : [], { leerText: 'Noch keine Aufrufe gezählt.' })}`)}
    ${bearbeitenBox([['Zielgruppe', '#/zielgruppe'], ['Leistungen & Preise', '#/leistungen'], ['Zusammenarbeit', '#/marken'], ['Referenzen', '#/referenzen']])}
    ${Z.p.mediakit_active ? `<a class="v-btn v-btn--leise v-btn--breit" href="https://${es(url)}" target="_blank" rel="noopener">Seite ansehen ${ICO.extern}</a>` : ''}
  `
  bearbeitenBinden(area, ctx, {})
  ctx.on($('[data-kopieren]', area), 'click', e => kopieren(e.currentTarget.dataset.kopieren, 'Adresse kopiert'))
  ctx.on($('[data-kit-schalter]', area), 'click', e => seiteSchalten('mediakit', e.currentTarget, () => renderMediakitSeite(area, ctx)))
}
/* "Habe ich bei einem anderen Anbieter": Eigenangabe in brand_ready_angaben
   (kriterium biolink / kit_vorhanden), zaehlt im Profilcheck als erfuellt. */
function externZeile(kriterium, text) {
  const an = !!(Z.angaben && Z.angaben[kriterium])
  return `<div class="v-schalter-zeile" style="padding:10px 16px 12px 60px;border-bottom:1px solid var(--border)"><div><span style="font-size:var(--t-sm)">${es(text)}</span><small>Zählt hier als erfüllt.</small></div>${toggle(an, `data-extern="${kriterium}"`, 'v-toggle--akzent')}</div>`
}
function externBinden(area, ctx, danach) {
  $$('[data-extern]', area).forEach(t => ctx.on(t, 'click', async () => {
    const an = !t.classList.contains('an'); t.classList.toggle('an', an)
    const { error } = await sb.from('brand_ready_angaben').upsert({ user_id: uid(), kriterium: t.dataset.extern, wert: an, updated_at: new Date().toISOString() }, { onConflict: 'user_id,kriterium' })
    if (error) { fehler(error); t.classList.toggle('an', !an) } else { Z.angaben = Z.angaben || {}; Z.angaben[t.dataset.extern] = an; toast(an ? 'Gemerkt' : 'Zurückgesetzt'); danach && danach() }
  }))
}
/* Ein- und Ausschalten erzeugt bzw. loescht die oeffentliche Datei im Repo.
   Ausschalten fragt, weil der Link danach ins Leere fuehrt. */
async function seiteSchalten(art, btn, danach) {
  const bio = art === 'biolink', an = bio ? Z.p.bio_active : Z.p.mediakit_active
  const name = bio ? 'BioLink' : 'Media Kit'
  if (an) {
    const ok = await bestaetigen({ titel: name + ' ausschalten?', text: 'Die Seite ist danach nicht mehr erreichbar. Deine Angaben bleiben gespeichert, du kannst sie jederzeit wieder einschalten.', ja: 'Ausschalten', gefahr: true })
    if (!ok) return
  } else {
    if (!Z.p.display_name) return toast('Erst einen Username festlegen', 'fehler')
    /* Impressum ist Pflicht fuer beide Seiten (§ 5 DDG). Ohne geht die Seite nicht an. */
    if (!(Z.p.impressum_text || '').trim()) {
      const el = modal(`<h2>Impressum fehlt</h2><p>Für ${es(name)} ist ein Impressum Pflicht. Trag es einmal ein, es steht dann im Fuß beider Seiten.</p><div class="v-btn-reihe"><button class="v-btn v-btn--rand" data-modal-zu>Später</button><button class="v-btn v-btn--dunkel" data-imp>Impressum eintragen</button></div>`)
      $('[data-imp]', el).addEventListener('click', () => { sheetZu(); impressumSheet(() => danach && danach()) })
      return
    }
  }
  if (!an) { const ok = await nutzungsbedingungenPruefen(bio ? 'biopage_terms' : 'mediakit_terms', name); if (!ok) return }
  btn.disabled = true; btn.classList.toggle('an', !an)
  const schirm = an ? null : ladeSchirm({ titel: name + ' wird erzeugt', text: 'Die Seite wird gebaut und veröffentlicht. Das dauert etwa eine Minute.' })
  try {
    await fn(bio ? 'generate-biolink' : 'generate-mediakit', {}, { query: an ? '?action=delete' : '' })
    Z.p[bio ? 'bio_active' : 'mediakit_active'] = !an
    if (schirm) {
      const url = bio ? 'https://viuno.de/' + slug() + '/' : 'https://viuno.de/kit/' + slug() + '/'
      const ok = await warteAufSeite(url, null, schirm)
      schirm.schliessen()
      toast(ok ? name + ' ist live' : name + ' ist live, die Seite braucht noch einen Moment', 'gut')
    } else toast(name + ' ist aus', 'gut')
  } catch (e) { schirm && schirm.schliessen(); fehler(e, name + ' konnte nicht umgeschaltet werden'); btn.classList.toggle('an', an) }
  btn.disabled = false
  danach && danach()
}
/* Zustimmung zu den Nutzungsbedingungen der Seite, einmal je Fassung der
   legal_texts. Festgehalten in user_consents ueber nutzungsbedingungen_zustimmen(). */
async function nutzungsbedingungenPruefen(typ, name) {
  const [lt, uc] = await Promise.all([
    sb.from('legal_texts').select('updated_at').order('id').limit(1).maybeSingle(),
    sb.from('user_consents').select('version').eq('user_id', uid()).eq('consent_type', typ).order('accepted_at', { ascending: false }).limit(1).maybeSingle(),
  ])
  const version = lt.data ? new Date(lt.data.updated_at).toISOString().slice(0, 10) : '1'
  if (uc.data && uc.data.version === version) return true
  return new Promise(res => {
    const el = modal(`<h2>Nutzungsbedingungen</h2><p>Bevor ${es(name)} online geht, brauchen wir deine Zustimmung zu den Nutzungsbedingungen für diese Seite.</p><button type="button" class="v-btn v-btn--leise v-btn--klein" data-lesen style="margin-top:10px">Nutzungsbedingungen lesen</button><div data-text class="news-text" style="display:none;max-height:38vh;overflow:auto;margin-top:10px;padding:12px;border:1px solid var(--border);border-radius:var(--r-sm);font-size:var(--t-sm);color:var(--muted)"></div><label class="v-checkbox" style="margin-top:14px"><input type="checkbox" id="nb-ok"><span style="font-size:var(--t-sm)">Ich habe die Nutzungsbedingungen gelesen und stimme ihnen zu.</span></label><div class="v-btn-reihe"><button class="v-btn v-btn--rand" data-modal-zu>Abbrechen</button><button class="v-btn v-btn--dunkel" data-nb-weiter disabled>Zustimmen und einschalten</button></div>`)
    const weiter = $('[data-nb-weiter]', el), box = $('#nb-ok', el)
    box.addEventListener('change', () => { weiter.disabled = !box.checked })
    $('[data-lesen]', el).addEventListener('click', async e => {
      const t = $('[data-text]', el); if (t.style.display !== 'none') { t.style.display = 'none'; return }
      laden(e.currentTarget, true)
      const { data } = await sb.from('legal_texts').select(typ).order('id').limit(1).maybeSingle()
      laden(e.currentTarget, false)
      t.textContent = (data && data[typ]) || 'Der Text ist gerade nicht abrufbar. Er steht auch unter viuno.de/legal.'; t.style.display = 'block'
    })
    $('[data-modal-zu]', el).addEventListener('click', () => res(false), { once: true })
    weiter.addEventListener('click', async () => {
      laden(weiter, true)
      try { await rpc('nutzungsbedingungen_zustimmen', { p_typ: typ }); sheetZu(); res(true) }
      catch (e) { fehler(e); laden(weiter, false) }
    })
  })
}
/* Ladeschirm: Vollbild, Spinner, Balken, der ueber eine Minute fuellt. */
function ladeSchirm({ titel, text }) {
  let el = $('#ladeschirm')
  if (!el) { el = document.createElement('div'); el.id = 'ladeschirm'; document.body.appendChild(el) }
  el.innerHTML = `<div class="v-lade-block"><div class="v-spin v-spin--verlauf"></div><strong style="font-size:var(--t-xl);color:var(--text)">${es(titel)}</strong><span>${es(text)}</span><div class="v-balken v-balken--verlauf" style="width:100%;max-width:260px;margin-top:8px"><i style="width:2%"></i></div><small class="text-klein" data-stand>0 %</small></div>`
  el.classList.add('offen')
  const start = Date.now()
  const timer = setInterval(() => { const p = Math.min(96, Math.round((Date.now() - start) / 600)); const i = $('.v-balken i', el); if (i) i.style.width = p + '%'; const st = $('[data-stand]', el); if (st) st.textContent = p + ' %' }, 500)
  return {
    el,
    schliessen() { clearInterval(timer); const i = $('.v-balken i', el); if (i) i.style.width = '100%'; setTimeout(() => el.classList.remove('offen'), 250) },
  }
}
/* Wartet, bis die oeffentliche Seite da ist. Auf viuno.de selbst wird sie
   abgefragt (gleiche Herkunft), sonst gilt die Minute als Richtwert. */
async function warteAufSeite(url, pruefe, schirm, maxSek = 120) {
  const gleicheHerkunft = url.startsWith(location.origin)
  const start = Date.now()
  while (Date.now() - start < maxSek * 1000) {
    await schlaf(5000)
    if (!gleicheHerkunft) { if (Date.now() - start >= 60000) return true; continue }
    try {
      const r = await fetch(url, { cache: 'no-store' })
      if (r.ok) { const t = await r.text(); if (!pruefe || pruefe(t)) return true }
    } catch (_) {}
  }
  return false
}
const THEME_FARBE = { color: '#1A1025', dark: '#0D1B2A', clean: '#FAFAFA' }
function designSheet() {
  const aktuell = Z.bl?.theme || 'color'
  const el = sheet(`<div class="wahl-reihe">${[['clean', 'Weiß', 'weiss'], ['dark', 'Schwarz', 'schwarz'], ['color', 'Color', 'color']].map(([k, l, c]) => `<button type="button" class="wahl${k === aktuell ? ' aktiv' : ''}" data-wert="${k}"><span class="wahl-kreis wahl-kreis--${c}"></span>${l}</button>`).join('')}</div><p style="margin:12px 0 0">Färbt deinen BioLink und die App.</p><div class="v-btn-reihe" style="margin-top:16px"><button class="v-btn v-btn--rand" data-sheet-zu>Abbrechen</button><button class="v-btn v-btn--dunkel" data-speichern>Speichern</button></div>`,
    { titel: 'Design', beimSchliessen: () => signaturSetzen() })
  $$('.wahl', el).forEach(w => w.addEventListener('click', () => { $$('.wahl', el).forEach(x => x.classList.toggle('aktiv', x === w)); document.documentElement.dataset.thema = w.dataset.wert }))
  $('[data-speichern]', el).addEventListener('click', async e => {
    const wert = $('.wahl.aktiv', el).dataset.wert; laden(e.currentTarget, true)
    try {
      await blSpeichern({ theme: wert }); signaturSetzen(); sheetZuCb = null; sheetZu()
      if (Z.p.bio_active) {
        const schirm = ladeSchirm({ titel: 'BioLink wird neu gefärbt', text: 'Die Seite wird mit dem neuen Design veröffentlicht. Das dauert etwa eine Minute.' })
        const r = await bioNeuErzeugen({ leise: true })
        const ok = r && !r.fehler ? await warteAufSeite('https://viuno.de/' + slug() + '/', t => t.includes('content="' + THEME_FARBE[wert] + '"'), schirm) : false
        schirm.schliessen(); toast(ok ? 'Design ist live' : 'Design gespeichert', 'gut')
      } else toast('Design gespeichert')
    } catch (er) { fehler(er); laden(e.currentTarget, false) }
  })
}
function spracheSheet() {
  const aktuell = Z.bl?.default_language || 'de'
  const el = sheet(`<div class="wahl-reihe">${[['de', 'DE', 'Deutsch'], ['en', 'EN', 'English'], ['it', 'IT', 'Italiano']].map(([k, kz, l]) => `<button type="button" class="wahl${k === aktuell ? ' aktiv' : ''}" data-wert="${k}"><span class="wahl-kreis">${kz}</span>${l}</button>`).join('')}</div><p style="margin:12px 0 0">Die Sprache, in der BioLink und Media Kit zuerst erscheinen. Besucher können umschalten.</p><div class="v-btn-reihe" style="margin-top:16px"><button class="v-btn v-btn--rand" data-sheet-zu>Abbrechen</button><button class="v-btn v-btn--dunkel" data-speichern>Speichern</button></div>`, { titel: 'Sprache' })
  $$('.wahl', el).forEach(w => w.addEventListener('click', () => $$('.wahl', el).forEach(x => x.classList.toggle('aktiv', x === w))))
  $('[data-speichern]', el).addEventListener('click', async e => {
    const wert = $('.wahl.aktiv', el).dataset.wert; laden(e.currentTarget, true)
    try { await blSpeichern({ default_language: wert }); await mkSpeichern({ default_language: wert }); sheetZu(); toast('Sprache gespeichert') } catch (er) { fehler(er); laden(e.currentTarget, false) }
  })
}

/* ═══════════════════════════════════════════════════════════════════════
   Analyse und Brand Ready
   ═══════════════════════════════════════════════════════════════════════ */
const PLATTFORM_LABEL = { instagram: 'Instagram', tiktok: 'TikTok' }
async function renderAnalyse(area, ctx) {
  if (Z.ansicht.analyse === 'brandready') return renderBrandReady(area, ctx)
  // Rueckkehr aus dem Bezahlvorgang
  const q = new URLSearchParams(location.search)
  if (q.get('checkout')) {
    const art = q.get('checkout')
    history.replaceState(null, '', location.pathname + location.hash)
    if (art === 'abo') {
      toast('Danke! Dein Abo wird gerade aktiviert.', 'gut')
      /* Der Stripe-Webhook schreibt die Abo-Zeile ein paar Sekunden spaeter. */
      for (let i = 0; i < 6 && !aboAktiv(); i++) { await schlaf(2500); await aboNeuLaden() }
    } else toast(art === 'success' ? 'Bezahlt. Du kannst die Analyse jetzt starten.' : 'Bezahlvorgang abgebrochen', art === 'success' ? 'gut' : 'fehler')
  }
  Z.plattform = Z.plattform || (Z.p.instagram_handle ? 'instagram' : Z.p.tiktok_handle ? 'tiktok' : 'instagram')
  const pf = Z.plattform
  const woche = montag()
  const [statsQ, kiQ, runQ, kaufQ, verlaufQ, aufgQ, pcQ, brQ] = await Promise.all([
    sb.from('analyse_stats').select('*').eq('user_id', uid()).eq('platform', pf).order('created_at', { ascending: false }).limit(14),
    sb.from('analyse_ki').select('*').eq('user_id', uid()).eq('platform', pf).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    sb.from('analysis_runs').select('id,status,platform,started_at,completed_at,error').eq('user_id', uid()).order('started_at', { ascending: false }).limit(1).maybeSingle(),
    sb.from('analysis_purchases').select('id,platform,purchased_at,grund').eq('user_id', uid()).is('consumed_at', null),
    sb.rpc('viuno_verlauf', { p_tage: 90, p_plattform: pf }),
    sb.from('growth_aufgaben').select('*').eq('user_id', uid()).eq('woche', woche).order('prioritaet'),
    aboAktiv() ? sb.rpc('viuno_profilcheck') : Promise.resolve({ data: null }),
    sb.from('brand_readiness').select('stichtag,punkte,max_punkte').eq('user_id', uid()).order('stichtag', { ascending: false }).limit(2),
  ])
  if (ctx.stale()) return
  const statsAlle = statsQ.data || [], stats = statsAlle[0], vorher = statsAlle[1], ki = kiQ.data, run = runQ.data
  const kaeufe = (kaufQ.data || []).filter(k => k.platform === pf)
  const verlauf = (verlaufQ.data || [])
  const aufgaben = aufgQ.data || [], pc = pcQ.data, brVerlauf = brQ.data || []
  const laeuft = run && ['scraping', 'analyzing', 'pending'].includes(run.status) && run.platform === pf && (Date.now() - new Date(run.started_at).getTime()) < 20 * 60000
  const handle = Z.p[pf + '_handle']

  // Beitraege und Bilder des letzten Laufs
  let posts = [], bilder = new Map()
  if (stats && stats.analysis_run_id) {
    const [pQ, bQ] = await Promise.all([
      sb.from('apify_daten').select('post_id,post_url,caption,likes,comments,views,media_type,duration_seconds,posted_at,thumbnail_url').eq('analysis_run_id', stats.analysis_run_id).eq('platform', pf),
      sb.from('analyse_beitragsbilder').select('post_id,pfad').eq('user_id', uid()).eq('platform', pf),
    ])
    if (ctx.stale()) return
    posts = pQ.data || []; (bQ.data || []).forEach(b => bilder.set(b.post_id, b.pfad))
    /* Bilder fehlen noch (aelterer Lauf)? Einmal nachholen, dann neu zeichnen. */
    if (posts.length && !bilder.size && !Z['bilderGeholt_' + stats.analysis_run_id]) {
      Z['bilderGeholt_' + stats.analysis_run_id] = true
      fn('analyse-bilder', { analysis_run_id: stats.analysis_run_id, platform: pf }).then(r => { if (r && r.gesichert > 0 && !ctx.stale()) renderAnalyse(area, ctx) }).catch(() => {})
    }
  }

  const seg = `<div class="v-seg v-seg--dunkel v-seg--voll">${['instagram', 'tiktok'].map(k => `<button class="${k === pf ? 'aktiv' : ''}" data-pf="${k}">${PLATTFORM_LABEL[k]}</button>`).join('')}</div>`
  let kopf = ''
  const fehlerHtml = run && run.status === 'failed' && run.platform === pf ? `<div class="v-hinweis v-hinweis--fehler" style="margin-top:12px">${ICO.warn}<div class="text"><p style="margin:0">${es(run.error || 'Der letzte Lauf ist gescheitert.')}</p></div></div>` : ''
  if (laeuft) {
    kopf = karte(`<ul class="v-zeitlinie"><li class="fertig"><strong>Analyse gestartet</strong><small>${datKurz(run.started_at)} · ${new Date(run.started_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</small></li><li class="laeuft"><strong>${run.status === 'scraping' ? 'Beiträge werden gelesen' : 'Auswertung läuft'}</strong><small>dauert etwa zwei Minuten</small></li><li class="offen"><strong>Ergebnis hier und per Mail</strong><small>ausstehend</small></li></ul>`)
    ctx.interval(async () => { const { data } = await sb.from('analysis_runs').select('status').eq('id', run.id).maybeSingle(); if (data && data.status !== run.status && !ctx.stale()) renderAnalyse(area, ctx) }, 8000)
  } else if (!handle) {
    kopf = leer('Kein ' + PLATTFORM_LABEL[pf] + '-Kanal hinterlegt', 'Trag deinen @Namen unter Kanäle ein, dann kann viuno messen.', 'Kanäle öffnen', 'kanaele')
  } else if (kaeufe.length > 0) {
    kopf = karte(`${karteKopf(stats ? 'Neue Analyse' : 'Erste Analyse', kaeufe[0].grund === 'willkommen' ? 'Deine erste Analyse ist inklusive.' : kaeufe[0].grund === 'abo' ? 'Deine Wochenanalyse steht bereit.' : 'Freischaltung vorhanden, noch nicht verbraucht.')}<button class="v-btn v-btn--premium v-btn--breit" data-analyse-start>${ICO.stern}Analyse starten</button>${fehlerHtml}`)
  } else if (!aboAktiv()) {
    kopf = aboKasten(fehlerHtml)
  } else if (fehlerHtml) {
    kopf = karte(`${karteKopf('Letzter Lauf', 'Sonntag versucht viuno es wieder.')}${fehlerHtml}`)
  }

  let inhalt = ''
  if (stats) {
    const absaetze = t => String(t || '').split(/\n\s*\n/).map(x => x.trim()).filter(Boolean).map(x => `<p class="news-text" style="margin:0 0 10px;font-size:var(--t-md)">${es(x)}</p>`).join('')
    const textKarte = (titel, text, sub) => text && String(text).trim() ? karte(`${karteKopf(titel, sub || '')}${absaetze(text)}`) : ''

    // 1 · Kernaussage
    if (ki && ki.kernaussage) inhalt += karte(`<h3 style="margin:0;font-size:var(--t-xl);font-weight:var(--fw-b);letter-spacing:-.02em;line-height:var(--lh-tight)">${es(ki.kernaussage)}</h3><div class="v-karte-fuss"><span>${datKurz(ki.created_at)} · ${PLATTFORM_LABEL[pf]}</span><button class="v-btn v-btn--rand v-btn--klein" data-satz="${es(ki.kernaussage)}">${ICO.kopie} Satz kopieren</button></div>`)

    // 2 · Resonanz-Kachel
    const rNeu = stats.resonanz_schnitt, rAlt = vorher ? vorher.resonanz_schnitt : null
    inhalt += `<div class="v-kpi v-kpi--verlauf"><div class="v-kpi-label">Resonanz · Likes je 1.000 Aufrufe</div><div class="v-kpi-wert v-num">${rNeu != null ? dez(rNeu, 1) : '–'}</div><div class="v-kpi-delta">${pfeilText(rNeu, rAlt, 'zur letzten Analyse', 1)}</div></div>`

    // 3 · Drei Aufgaben
    inhalt += `<div class="abschnitt"><div class="abschnitt-titel">Deine Aufgaben diese Woche</div>${aufgaben.length ? `<ul class="v-check v-check--karten">${aufgaben.map(a => `<li class="${a.status === 'erledigt' ? 'fertig' : 'offen'}"><i>${a.status === 'erledigt' ? ICO.haken : ''}</i><span style="flex:1"><span style="display:block;font-weight:var(--fw-sb)">${es(a.titel)}</span><small class="text-klein" style="display:block;margin-top:3px;line-height:var(--lh-body)">${aufgabeBeleg(a)}</small></span>${a.status === 'offen' ? `<button class="v-btn v-btn--dunkel v-btn--klein" data-erledigt="${a.id}">Erledigt</button>` : ''}</li>`).join('')}</ul>` : `<div class="v-leer v-leer--gestrichelt"><div class="sym akzent">${ICO.ziel}</div><h3>Noch keine Aufgaben diese Woche</h3><p>Sie kommen montags aus deinen Zahlen, bis zu drei mit Beleg.</p><button class="v-btn v-btn--rand v-btn--klein" data-growth>Jetzt berechnen</button></div>`}</div>`

    // 4 · Verlauf: drei Linien ueber 12 Wochen
    const seit = Date.now() - 84 * 86400000
    const resPunkte = [...statsAlle].reverse().filter(x => x.resonanz_schnitt != null && new Date(x.created_at).getTime() >= seit).map(x => Number(x.resonanz_schnitt))
    const follPunkte = verlauf.filter(v => v.followers != null).map(v => Number(v.followers))
    const ppwPunkte = verlauf.filter(v => v.posts_pro_woche != null).map(v => Number(v.posts_pro_woche))
    const genug = resPunkte.length >= 2 || follPunkte.length >= 2
    const linie = (label, werte, k, farbe) => `<div class="v-kpi v-kpi--spark" style="--spark:${farbe}"><div class="v-kpi-label">${label}</div><div class="v-kpi-wert v-num">${werte.length ? dez(werte[werte.length - 1], k) : '–'}<small>${werte.length >= 2 ? pfeilKurz(werte[werte.length - 1], werte[werte.length - 2]) : ''}</small></div>${spark(werte)}</div>`
    inhalt += `<div class="abschnitt"><div class="abschnitt-titel">Verlauf · 12 Wochen</div><div style="position:relative"><div class="drei-spalten${genug ? '' : ' verschwommen'}">${linie('Resonanz', resPunkte, 1, 'var(--v1)')}${linie('Follower', follPunkte, 0, 'var(--v2)')}${linie('Posts / Woche', ppwPunkte, 1, 'var(--v3)')}</div>${genug ? '' : `<div class="verschwommen-hinweis"><strong>Ab der zweiten Analyse</strong><span>Dann siehst du, ob es aufwärts geht und ob es an dir lag.</span></div>`}</div></div>`

    // 5 · Beitragskarten
    if (posts.length) {
      const mit = posts.filter(p => p.views > 0)
      const r = p => p.views > 0 ? (p.likes || 0) / p.views * 1000 : null, k = p => p.views > 0 ? (p.comments || 0) / p.views * 1000 : null
      const listen = mit.length >= 3
        ? { top: [...mit].sort((a, b) => r(b) - r(a)).slice(0, 6), flop: [...mit].sort((a, b) => r(a) - r(b)).slice(0, 6), kommentar: [...mit].sort((a, b) => k(b) - k(a)).slice(0, 6) }
        : { top: [...posts].sort((a, b) => (b.likes || 0) - (a.likes || 0)).slice(0, 6), flop: [...posts].sort((a, b) => (a.likes || 0) - (b.likes || 0)).slice(0, 6), kommentar: [...posts].sort((a, b) => (b.comments || 0) - (a.comments || 0)).slice(0, 6) }
      Z.beitragsListe = Z.beitragsListe || 'top'
      const karteHtml = p => {
        const a = ampel(p, stats), bild = bilder.get(p.post_id) ? BILD_BASIS + 'beitragsbilder/' + bilder.get(p.post_id) : (p.thumbnail_url && tageSeit(p.posted_at) <= 3 ? p.thumbnail_url : null)
        return `<a class="beitrag-karte" href="${es(p.post_url || '#')}" target="_blank" rel="noopener"><div class="beitrag-bild">${bild ? `<img src="${es(bild)}" alt="" loading="lazy" onerror="this.remove()">` : ICO.bild}</div><div class="text"><div class="news-kopf" style="margin-bottom:4px">${badge(a.label, a.art)}<span class="text-klein">${datKurz(p.posted_at)} · ${new Date(p.posted_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</span></div><p>${es(beitragSatz(p, stats))}</p></div>${ICO.extern}</a>`
      }
      inhalt += karte(`<div class="v-pillen" style="margin-bottom:12px">${[['top', 'Top'], ['flop', 'Flop'], ['kommentar', 'Kommentar']].map(([k2, l]) => `<button class="v-pille${Z.beitragsListe === k2 ? ' aktiv' : ''}" data-liste="${k2}">${l}</button>`).join('')}</div><div class="beitraege-liste">${listen[Z.beitragsListe].map(karteHtml).join('')}</div><p class="text-klein" style="margin:10px 0 0">Ampel gegen deinen Schnitt von ${dez(stats.resonanz_schnitt, 1)} Likes je 1.000 Aufrufe. Beiträge ohne Aufrufzahl nach Likes.</p>`)
    }

    // 6 · Brand-Ready-Zeile
    const brNeu = pc ? pc.punkte : (brVerlauf[0] ? brVerlauf[0].punkte : null)
    const brMax = pc ? pc.max : (brVerlauf[0] ? brVerlauf[0].max_punkte : null)
    const brAlt = brVerlauf.length > 1 ? brVerlauf[1].punkte : (pc && brVerlauf[0] && brVerlauf[0].punkte !== pc.punkte ? brVerlauf[0].punkte : null)
    inhalt += `<div class="v-liste">${listeZeile({ sym: ICO.ziel, symKlasse: aboAktiv() ? 'akzent' : '', text: 'Brand Ready', small: aboAktiv() ? 'Media Kit, Preise, Impressum – was Marken sehen' : 'Teil des Abos', wert: brNeu != null ? `<b class="v-num">${brNeu}/${brMax}</b> ${pfeilKurz(brNeu, brAlt)}` : 'ansehen', attrs: 'data-geh="#/analyse/brandready"' })}</div>`

    // 7 · Tiefenanalyse (zugeklappt)
    if (ki) {
      let tief = ''
      tief += textKarte('Einordnung', ki.einordnung)
      tief += textKarte('Was gut lief', ki.was_gut_lief)
      tief += textKarte('Wo Wirkung verloren geht', ki.verbesserungspotenzial)
      tief += textKarte('Reichweite und Resonanz', ki.reichweite_resonanz, 'Resonanz = Likes je 1.000 Aufrufe')
      tief += textKarte('Was die stärksten Beiträge verbindet', ki.top_posts_gemeinsamkeiten)
      tief += textKarte('So sind deine Texte gebaut', ki.caption_struktur, 'starke gegen schwache Beiträge')
      tief += textKarte('Töne', ki.sound_befund)
      tief += textKarte('Was weniger werden sollte', ki.weglassen)
      if (Array.isArray(ki.tipps_zukunft) && ki.tipps_zukunft.length) tief += karte(`${karteKopf('Sechs Tipps', 'jeder mit Grund aus deinen Zahlen')}<ul class="v-check">${ki.tipps_zukunft.map(t => `<li class="offen"><i></i><span style="font-size:var(--t-md);line-height:var(--lh-body)">${es(typeof t === 'string' ? t : t.text || JSON.stringify(t))}</span></li>`).join('')}</ul>`)
      tief += textKarte('Noch ein Befund', ki.weitere_insights)
      tief += textKarte('Seit der letzten Analyse', ki.vergleich_vorherige)
      tief += `<button class="v-btn v-btn--rand v-btn--breit" data-teilen>${ICO.teilen} Auswertung teilen</button>`
      inhalt += ausklappBox('Tiefenanalyse', `${posts.length || 36} Beiträge, alle Abschnitte · ${dat(ki.created_at)}`, tief)
    }

    // 8 · Alle Zahlen (zugeklappt), mit Pfeilen zum Vorlauf
    const v = vorher || {}
    let zahlen = `<div class="v-kpi-reihe">${kpi('Follower', fm(stats.followers), pfeilText(stats.followers, v.followers, '', 0))}${kpi('Engagement', dez(stats.engagement_rate, 1) + ' %', pfeilText(stats.engagement_rate, v.engagement_rate, 'je Follower', 1))}${kpi(pf === 'tiktok' ? 'Ø Aufrufe' : 'Ø Likes', fm(pf === 'tiktok' ? stats.avg_views : stats.avg_likes), pfeilText(pf === 'tiktok' ? stats.avg_views : stats.avg_likes, pf === 'tiktok' ? v.avg_views : v.avg_likes, '', 0))}${kpi('Beiträge / Woche', dez(stats.posts_per_week, 1), pfeilText(stats.posts_per_week, v.posts_per_week, '', 1))}</div>`
    const zeilen = [
      ['Ø Kommentare', stats.avg_comments, v.avg_comments, 0], ['Ø Aufrufe', pf === 'tiktok' ? null : stats.avg_views, v.avg_views, 0], ['Ø geteilt', stats.avg_shares, v.avg_shares, 0],
      ['Kommentarrate je 1.000', stats.kommentarrate_schnitt, v.kommentarrate_schnitt, 1], ['Stärkste Resonanz', stats.resonanz_top, v.resonanz_top, 1], ['Schwächste Resonanz', stats.resonanz_flop, v.resonanz_flop, 1],
      ['Ø Videolänge (s)', stats.avg_video_duration, v.avg_video_duration, 0], ['Beiträge gesamt', stats.posts_count, v.posts_count, 0], ['Folgt', stats.following, v.following, 0],
    ].filter(z => z[1] != null)
    if (zeilen.length) zahlen += karte(`<div class="zeile-zwischen" style="margin-bottom:6px"><strong>Größen und Resonanz</strong><span>gegen letzte Analyse</span></div>${zeilen.map(([l, n, a, k2]) => `<div class="v-kpi-zeile"><span>${es(l)}</span><b class="v-num">${k2 ? dez(n, k2) : fm(n)} ${pfeilKurz(n, a)}</b></div>`).join('')}`)
    if (stats.best_posting_day) zahlen += karte(`<div class="v-kpi-zeile"><span>Beste Zeit</span><b>${es(stats.best_posting_day)}${stats.best_posting_hour != null ? ', ' + stats.best_posting_hour + ' Uhr' : ''}</b></div><p class="text-klein" style="margin:6px 0 0">Über ${fm(stats.best_time_sample || 0)} Beiträge${(stats.best_time_sample || 0) < 20 ? ' – eine Tendenz, keine Regel' : ''}.</p>`)
    const fs = Array.isArray(stats.format_stats) ? stats.format_stats.filter(f => f.n >= 1) : []
    if (fs.length > 1) zahlen += karte(`<div class="zeile-zwischen" style="margin-bottom:12px"><strong>Formate</strong><span>Ø Likes</span></div>${balkenListe(fs.map(f => ({ label: f.typ + ' (' + f.n + ')', wert: Math.round(f.avg_likes || 0) })).sort((a, b) => b.wert - a.wert), { bunt: true })}`)
    const ds = Array.isArray(stats.duration_stats) ? stats.duration_stats.filter(d => d.n >= 1 && d.avg_views != null) : []
    if (ds.length > 1) zahlen += karte(`<div class="zeile-zwischen" style="margin-bottom:12px"><strong>Videolänge</strong><span>Ø Aufrufe</span></div>${balkenListe(ds.map(d => ({ label: d.bucket + ' (' + d.n + ')', wert: Math.round(d.avg_views || 0) })).sort((a, b) => b.wert - a.wert), { bunt: true })}`)
    const sounds = Array.isArray(stats.sound_stats) ? stats.sound_stats : []
    if (sounds.length) zahlen += karte(`<div class="zeile-zwischen" style="margin-bottom:6px"><strong>Töne, die mehrfach vorkommen</strong><span>Resonanz</span></div>${sounds.map(x => `<div class="v-kpi-zeile"><span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${es(x.sound)} · ${x.n}×</span><b class="v-num">${(x.werte || []).map(w => dez(w, 1)).join(' / ')}</b></div>`).join('')}`)
    if (stats.ausreisser && stats.ausreisser.views) zahlen += karte(`<div class="zeile-zwischen" style="margin-bottom:8px"><strong>Größte Reichweite</strong><span>${datKurz(stats.ausreisser.datum)}</span></div><p class="text-muted" style="margin:0;font-size:var(--t-sm);line-height:var(--lh-body)">${fm(stats.ausreisser.views)} Aufrufe, aber nur ${dez(stats.ausreisser.resonanz, 1)} Reaktionen je 1.000 – dein Schnitt liegt bei ${dez(stats.resonanz_schnitt, 1)}. Viel Reichweite, wenig Reaktion.</p>${stats.ausreisser.url ? `<a class="v-btn v-btn--leise v-btn--klein" style="margin-top:10px" href="${es(stats.ausreisser.url)}" target="_blank" rel="noopener">Beitrag ansehen ${ICO.extern}</a>` : ''}`)
    inhalt += ausklappBox('Alle Zahlen', 'Follower, Engagement, Formate, Töne, beste Zeit', zahlen)
    if (!ki) inhalt += karte(`${karteKopf('Auswertung fehlt', 'Die Zahlen sind da, der Text nicht.')}<p class="text-muted" style="margin:0;font-size:var(--t-sm)">Die Auswertung dieses Laufs ist nicht angekommen. Schreib an <a href="mailto:office@viuno.de">office@viuno.de</a>, wir sehen nach.</p>`)
  } else if (!laeuft && handle) {
    inhalt = leer('Noch keine Analyse für ' + PLATTFORM_LABEL[pf], 'Nach der ersten Analyse stehen hier Kernaussage, Resonanz, Aufgaben, Verlauf und deine Beiträge.')
  }
  area.innerHTML = seg + kopf + inhalt
  $$('[data-pf]', area).forEach(b => ctx.on(b, 'click', () => { Z.plattform = b.dataset.pf; renderAnalyse(area, ctx) }))
  $$('[data-ausklappen]', area).forEach(k => ctx.on(k, 'click', () => { const box = k.closest('.v-bearbeiten'); const o = box.classList.toggle('offen'); k.setAttribute('aria-expanded', o ? 'true' : 'false') }))
  $$('[data-liste]', area).forEach(b => ctx.on(b, 'click', () => { Z.beitragsListe = b.dataset.liste; renderAnalyse(area, ctx) }))
  $$('[data-geh]', area).forEach(el => ctx.on(el, 'click', () => geh(el.dataset.geh)))
  $$('[data-erledigt]', area).forEach(b => ctx.on(b, 'click', async e => {
    e.stopPropagation()
    try { await rpc('aufgabe_setzen', { p_id: Number(b.dataset.erledigt), p_status: 'erledigt' }); toast('Erledigt', 'gut'); if (!ctx.stale()) renderAnalyse(area, ctx) } catch (er) { fehler(er) }
  }))
  ctx.on($('[data-growth]', area), 'click', async e => {
    laden(e.currentTarget, true)
    try { const r = await rpc('growth_jetzt'); toast(r?.gestartet ? 'Wird berechnet, dauert eine Minute' : 'Für diese Woche schon berechnet'); await schlaf(4000); if (!ctx.stale()) renderAnalyse(area, ctx) } catch (er) { fehler(er) }
  })
  ctx.on($('[data-satz]', area), 'click', e => kopieren(e.currentTarget.dataset.satz, 'Satz kopiert'))
  ctx.on($('[data-kanaele]', area), 'click', () => { Z.zurueckZu = location.hash; geh('#/kanaele') })
  ctx.on($('[data-analyse-start]', area), 'click', e => analyseStarten(pf, true, e.currentTarget, () => renderAnalyse(area, ctx)))
  ctx.on($('[data-abo-start]', area), 'click', e => aboStarten(e.currentTarget))
  ctx.on($('[data-teilen]', area), 'click', async e => {
    laden(e.currentTarget, true)
    try { const r = await fn('analyse-freigeben', { analysis_run_id: stats.analysis_run_id }); await kopieren('https://viuno.de/analyse/' + r.token, 'Link kopiert · gilt 90 Tage') } catch (er) { fehler(er) } finally { laden(e.currentTarget, false) }
  })
}
/* Pfeile: hoch, runter, gleich -- gegen den Vorlauf. */
function pfeilKurz(neu, alt) {
  if (neu == null || alt == null) return ''
  const d = Number(neu) - Number(alt); const p = Number(alt) !== 0 ? d / Math.abs(Number(alt)) : 0
  if (Math.abs(p) < 0.02) return `<span class="pfeil-gleich">→</span>`
  return d > 0 ? `<span class="pfeil-hoch">↑</span>` : `<span class="pfeil-runter">↓</span>`
}
function pfeilText(neu, alt, was, k = 0) {
  if (neu == null) return was || ''
  if (alt == null) return was ? was + ' · erste Messung' : 'erste Messung'
  const d = Number(neu) - Number(alt); const p = Number(alt) !== 0 ? d / Math.abs(Number(alt)) * 100 : 0
  const txt = Math.abs(p) < 2 ? 'unverändert' : (d > 0 ? '+' : '−') + dez(Math.abs(p), 0) + ' %'
  return `${pfeilKurz(neu, alt)} ${txt}${was ? ' ' + was : ''}`
}
/* Ampel je Beitrag gegen den eigenen Schnitt: ueber, um, unter. */
function ampel(p, st) {
  let f = null
  if (p.views > 0 && st.resonanz_schnitt) f = ((p.likes || 0) / p.views * 1000) / st.resonanz_schnitt
  else if (st.avg_likes) f = (p.likes || 0) / st.avg_likes
  if (f == null) return { label: 'ohne Zahl', art: '' }
  if (f >= 1.15) return { label: 'über Schnitt', art: 'gruen' }
  if (f <= 0.85) return { label: 'unter Schnitt', art: 'rot' }
  return { label: 'um Schnitt', art: 'orange' }
}
/* Der eine Satz je Beitrag, aus Code: Zahl, Verhaeltnis zum Schnitt, ein Merkmal. */
function beitragSatz(p, st) {
  const teile = []
  if (p.views > 0 && st.resonanz_schnitt) {
    const r = (p.likes || 0) / p.views * 1000, f = r / st.resonanz_schnitt
    teile.push(`${dez(r, 1)} Likes je 1.000 Aufrufe bei ${fm(p.views)} Aufrufen, ${f >= 1.15 ? 'das ' + dez(f, 1) + '-Fache deines Schnitts' : f <= 0.85 ? dez(f * 100, 0) + ' % deines Schnitts' : 'auf deinem Schnitt'}`)
  } else if (st.avg_likes) {
    const f = (p.likes || 0) / st.avg_likes
    teile.push(`${fm(p.likes)} Likes ohne Aufrufzahl, ${f >= 1.15 ? 'das ' + dez(f, 1) + '-Fache deiner üblichen Likes' : f <= 0.85 ? dez(f * 100, 0) + ' % deiner üblichen Likes' : 'wie üblich'}`)
  }
  const m = []
  if (/\?/.test(p.caption || '')) m.push('Frage im Text')
  if (p.duration_seconds > 0) m.push(dez(p.duration_seconds, 0) + ' Sekunden')
  else if (p.media_type && p.media_type !== 'Video') m.push(p.media_type === 'Sidecar' ? 'Karussell' : p.media_type === 'Image' ? 'Bild' : p.media_type)
  if (p.views > 0 && st.kommentarrate_schnitt && (p.comments || 0) / p.views * 1000 >= st.kommentarrate_schnitt * 1.5) m.push(fm(p.comments) + ' Kommentare, deutlich über deinem Schnitt')
  if (m.length) teile.push(m.join(', '))
  return teile.join('. ') + (teile.length ? '.' : '')
}
/* Kleine Linie wie in der Bibliothek (v-spark), Farbe ueber --spark. */
function spark(werte) {
  const w = (werte || []).filter(v => v != null)
  if (w.length < 2) return `<svg class="v-spark" viewBox="0 0 200 40" preserveAspectRatio="none"><path d="M0 30L200 30"/></svg>`
  const min = Math.min(...w), max = Math.max(...w), sp = max - min || 1
  const X = i => Math.round(i / (w.length - 1) * 200), Y = v => Math.round(4 + (1 - (v - min) / sp) * 30)
  const pts = w.map((v, i) => `${X(i)} ${Y(v)}`)
  return `<svg class="v-spark" viewBox="0 0 200 40" preserveAspectRatio="none"><path class="flaeche" d="M${pts.join('L')}L200 40L0 40Z"/><path d="M${pts.join('L')}"/><circle cx="${X(w.length - 1)}" cy="${Y(w[w.length - 1])}" r="3"/></svg>`
}

/* Der Abo-Kasten: steht in der Analyse ohne Freischaltung und bei Brand Ready
   ohne Abo. Brand Ready ist nie inklusive. */
function aboKasten(extra = '') {
  return `<div class="v-preis v-preis--premium"><span class="v-pro-tag v-preis-tag">ABO</span><div class="v-preis-name">viuno Abo</div><div class="v-preis-wert v-num">4,99 €<small> im Monat</small></div><ul><li>${ICO.haken}Jede Woche eine Analyse, sonntags automatisch</li><li>${ICO.haken}Aktuelle Zahlen im Media Kit, dazu Ø Aufrufe der letzten 30 Tage</li><li>${ICO.haken}Brand-Ready-Check mit teilbarem Stand</li><li>${ICO.haken}Monatlich kündbar</li></ul><button class="v-btn v-btn--premium v-btn--breit" data-abo-start>${ICO.stern}Abo starten</button><div class="v-preis-hinweis">Kleinunternehmer nach § 19 UStG, keine Umsatzsteuer</div>${extra}</div>`
}
function naechsterSonntag() {
  const d = new Date(); const t = (7 - d.getDay()) % 7 || 7; d.setDate(d.getDate() + t)
  return d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })
}
async function analyseStarten(pf, frei, btn, danach) {
  const ok = await bestaetigen({ titel: 'Analyse starten?', text: '36 Beiträge werden gelesen und ausgewertet. Dauert etwa zwei Minuten, das Ergebnis kommt hierher und per Mail.', ja: 'Jetzt starten' })
  if (!ok) return
  laden(btn, true)
  try { await fn('start-analysis', { platform: pf }); toast('Analyse läuft'); danach() } catch (e) { fehler(e); laden(btn, false) }
}
/* Abo abschliessen: Zustimmung zur sofortigen Ausfuehrung, dann Stripe Checkout
   (Abo-Modus). Zurueck kommt man mit ?checkout=abo, der Webhook schreibt die Zeile. */
function aboStarten(btn) {
  const el = modal(`<h2>viuno Abo</h2><p>4,99 € im Monat, monatlich kündbar. Jede Woche eine Analyse, aktuelle Zahlen im Media Kit, Brand-Ready-Check.</p><label class="v-checkbox" style="margin-top:14px"><input type="checkbox" id="widerruf"><span style="font-size:var(--t-sm)">Ich stimme zu, dass das Abo sofort nach Zahlung beginnt, und verliere damit mein 14-tägiges Widerrufsrecht für die begonnene Laufzeit.</span></label><div class="v-btn-reihe"><button class="v-btn v-btn--rand" data-modal-zu>Abbrechen</button><button class="v-btn v-btn--premium" data-zahlen>Zur Zahlung</button></div>`)
  $('[data-zahlen]', el).addEventListener('click', async e => {
    if (!$('#widerruf', el).checked) return toast('Bitte der sofortigen Ausführung zustimmen', 'fehler')
    laden(e.currentTarget, true)
    try {
      const r = await fn('create-checkout-session', { art: 'abo', consent: true, rueckkehr: location.origin + location.pathname.replace(/[^/]*$/, '') })
      if (r.url) location.href = r.url; else throw new Error('Kein Bezahl-Link erhalten')
    } catch (er) { fehler(er); laden(e.currentTarget, false) }
  })
}
/* Abo-Sheet im Profil: Stand, Kuendigung zum Monatsende, Ruecknahme. */
function aboSheet(neu) {
  const a = Z.abo, aktiv = aboAktiv()
  const stand = !aktiv ? '<p>Du hast kein aktives Abo. Die erste Analyse je Kanal ist inklusive, alles Weitere kommt mit dem Abo.</p>'
    : a.kuendigung_zum ? `<div class="v-status v-status--warn"><i></i><div class="text"><strong>Gekündigt zum ${dat(a.kuendigung_zum)}</strong><span>Bis dahin läuft alles weiter. Du kannst die Kündigung zurücknehmen.</span></div></div>`
    : `<div class="v-status v-status--aktiv"><i></i><div class="text"><strong>Abo aktiv</strong><span>4,99 € im Monat · bezahlt bis ${dat(a.expires_at)}${a.status === 'past_due' ? ' · Zahlung offen' : ''}</span></div></div>`
  const el = sheet(`${stand}<div class="v-btn-stapel" style="margin-top:14px">${!aktiv ? `<button class="v-btn v-btn--premium" data-abo-geh>Abo starten</button>` : a.kuendigung_zum ? `<button class="v-btn v-btn--dunkel" data-abo-zurueck>Kündigung zurücknehmen</button>` : `<button class="v-btn v-btn--gefahr" data-abo-kuendigen>Zum Monatsende kündigen</button>`}</div><p class="text-klein" style="margin:12px 0 0">Rechnungen schickt dir Stripe per Mail. Fragen an <a href="mailto:office@viuno.de">office@viuno.de</a>.</p>`, { titel: 'Abo' })
  $('[data-abo-geh]', el)?.addEventListener('click', () => { sheetZu(); geh('#/analyse/analyse') })
  $('[data-abo-kuendigen]', el)?.addEventListener('click', async e => {
    const ok = await bestaetigen({ titel: 'Abo kündigen?', text: 'Es endet zum ' + dat(a.expires_at) + '. Bis dahin läuft alles weiter, danach gibt es keine Wochenanalysen mehr.', ja: 'Kündigen', gefahr: true })
    if (!ok) return
    laden(e.currentTarget, true)
    try { const r = await fn('abo-verwalten', { aktion: 'kuendigen' }); Z.abo = r.abo; sheetZu(); toast('Gekündigt zum ' + dat(r.abo.kuendigung_zum)); neu && neu() } catch (er) { fehler(er); laden(e.currentTarget, false) }
  })
  $('[data-abo-zurueck]', el)?.addEventListener('click', async e => {
    laden(e.currentTarget, true)
    try { const r = await fn('abo-verwalten', { aktion: 'zurueck' }); Z.abo = r.abo; sheetZu(); toast('Abo läuft weiter', 'gut'); neu && neu() } catch (er) { fehler(er); laden(e.currentTarget, false) }
  })
}
const BR_ZIEL = { bio: '#/kanaele', kontakt: '#/profil', takt: '#/analyse/analyse', biolink: '#/seiten/biolink', mediakit: '#/seiten/mediakit', preise: '#/leistungen', impressum: '#/profil', referenzen: '#/marken', kategorie: '#/profil', messung: '#/analyse/analyse' }
async function renderBrandReady(area, ctx) {
  if (!aboAktiv()) {
    area.innerHTML = `<p class="text-muted" style="margin:0;font-size:var(--t-sm);line-height:var(--lh-body)">Brand Ready prüft zehn Punkte, auf die Marken vor einer Zusammenarbeit schauen, und zeigt, was noch fehlt. Das ist Teil des Abos.</p>${aboKasten()}`
    ctx.on($('[data-abo-start]', area), 'click', e => aboStarten(e.currentTarget))
    return
  }
  const [pcQ, scQ] = await Promise.all([sb.rpc('viuno_profilcheck'), sb.rpc('viuno_score')])
  if (ctx.stale()) return
  const pc = pcQ.data, sc = scQ.data
  if (!pc) { area.innerHTML = leer('Noch nicht berechenbar', es(pcQ.error?.message || '')); return }
  const zustand = { erfuellt: ['gut', ICO.haken], teilweise: ['warn', ICO.uhr], offen: ['', ICO.x], nicht_bewertbar: ['', ICO.info] }
  area.innerHTML = `
    ${karte(`<div class="v-ring-reihe">${ring(pc.prozent / 100, pc.prozent + ' %', pc.prozent >= 70 ? 'v-ring--gruen' : '')}<div><strong>Brand Ready</strong><span>${pc.punkte} von ${pc.max} Punkten · ${pc.offen.length ? pc.offen.length + ' Punkte offen' : 'alles erfüllt'}</span></div></div>`)}
    ${sc ? karte(`<div class="zeile-zwischen" style="margin-bottom:12px"><strong>Score ${sc.gesamt}</strong><span>vier Säulen</span></div>${balkenListe(sc.saeulen.map(s => ({ label: s.titel, wert: s.punkte })))}<div class="text-klein" style="margin-top:10px;line-height:var(--lh-body)">${sc.saeulen.map(s => `<div><b>${es(s.titel)}:</b> ${es(s.quelle)}</div>`).join('')}</div>`) : ''}
    <div class="v-liste">${pc.teile.map(t => { const [k, i] = zustand[t.zustand] || ['', '']; const ziel = BR_ZIEL[t.id] || null; const extern = t.id === 'biolink' ? externZeile('biolink', 'Ich habe schon eine BioLink-Seite bei einem anderen Anbieter') : t.id === 'mediakit' ? externZeile('kit_vorhanden', 'Ich habe schon ein Media Kit bei einem anderen Anbieter') : ''; return listeZeile({ sym: i, symKlasse: k === 'gut' ? 'gut' : k === 'warn' ? 'warn' : (t.zustand === 'offen' ? 'rot' : ''), text: t.titel, small: es(t.sub), wert: `<b class="v-num ${t.zustand === 'erfuellt' ? 'gut' : ''}">${t.punkte}/${t.max}</b>`, pfeil: !!ziel && t.zustand !== 'erfuellt', attrs: ziel && t.zustand !== 'erfuellt' ? `data-geh="${ziel}"` : 'disabled style="cursor:default;opacity:1"' }) + extern }).join('')}</div>
    <button class="v-btn v-btn--rand v-btn--breit" data-br-teilen>${ICO.teilen} Stand teilen</button>
    <p class="text-klein zentriert">Stand ${dat(pc.stichtag)} · Grün ist erfüllt, Orange teilweise, Rot fehlt.</p>
  `
  ctx.on($('[data-br-teilen]', area), 'click', brandReadyTeilen)
  $$('.sym.rot', area).forEach(s => { s.style.background = 'var(--red-bg)'; s.style.color = 'var(--red)' })
  $$('[data-geh]', area).forEach(el => ctx.on(el, 'click', () => { Z.zurueckZu = location.hash; geh(el.dataset.geh) }))
  externBinden(area, ctx, () => { if (!ctx.stale()) renderBrandReady(area, ctx) })
}

/* Geteilter Brand-Ready-Stand: brand-ready-freigeben legt je Kanal einen Link
   an (90 Tage). Der Link zeigt Punktestand und zwei bis drei Saetze -- gerechnet
   in der Function nach public/app/brand-ready-regeln.js, nicht nach dem
   Profilcheck dieser Ansicht; die Zahl kann deshalb abweichen. */
async function brandReadyTeilen() {
  const { data: stats } = await sb.from('analyse_stats').select('platform').eq('user_id', uid()).order('created_at', { ascending: false })
  const plattformen = [...new Set((stats || []).map(s => s.platform))]
  if (!plattformen.length) return toast('Erst nach einer Analyse teilbar', 'fehler')
  const { data: frei } = await sb.from('brand_ready_freigaben').select('platform,token,expires_at,revoked_at,aufrufe').eq('user_id', uid())
  const aktiv = (frei || []).find(f => !f.revoked_at && new Date(f.expires_at) > new Date())
  const link = t => 'https://viuno.de/brandready/?b=' + t
  const el = sheet(`<p>Ein öffentlicher Link mit deinem Punktestand und zwei bis drei Sätzen, 90 Tage gültig. Kriterien und Zahlen bleiben privat.</p>${aktiv ? `<div class="v-status v-status--aktiv"><i></i><div class="text"><strong>Link ist aktiv</strong><span>${es(link(aktiv.token))} · ${fm(aktiv.aufrufe)} Aufrufe</span></div></div>` : ''}<div class="v-btn-stapel" style="margin-top:14px"><button class="v-btn v-btn--dunkel" data-br-link>${aktiv ? 'Link kopieren' : 'Link erzeugen und kopieren'}</button>${aktiv ? `<button class="v-btn v-btn--rand" data-br-weg>Freigabe zurücknehmen</button>` : ''}</div>`, { titel: 'Stand teilen' })
  $('[data-br-link]', el).addEventListener('click', async e => {
    laden(e.currentTarget, true)
    try { const r = await fn('brand-ready-freigeben', { platform: aktiv ? aktiv.platform : plattformen[0] }); sheetZu(); await kopieren(link(r.token), 'Link kopiert · gilt 90 Tage') } catch (er) { fehler(er); laden(e.currentTarget, false) }
  })
  $('[data-br-weg]', el)?.addEventListener('click', async e => {
    laden(e.currentTarget, true)
    try { await fn('brand-ready-freigeben', { platform: aktiv.platform, aktion: 'zuruecknehmen' }); sheetZu(); toast('Freigabe zurückgenommen') } catch (er) { fehler(er); laden(e.currentTarget, false) }
  })
}

/* ═══════════════════════════════════════════════════════════════════════
   Creator News
   ═══════════════════════════════════════════════════════════════════════ */
/* Plattform-Pillen in eigenen Farben; Rot, Orange und Blau bleiben der Dringlichkeit vorbehalten. */
const PLATTFORM_FARBE = { instagram: 'akzent', tiktok: 'dunkel', youtube: 'verlauf', meta: 'gruen' }
const plattformPille = k => badge(k.platform_label || 'Allgemein', PLATTFORM_FARBE[k.platform] || '')
const dringPille = k => { const d = k.relevance_score >= 8 ? ['rot', 'Wichtig'] : k.relevance_score >= 6 ? ['orange', 'Relevant'] : ['blau', 'Info']; return badge(d[1], d[0]) }
const ersteSaetze = (t, n = 2) => String(t || '').split(/(?<=[.!?])\s+/).slice(0, n).join(' ')
function newsKarte(k, klein) {
  return `<div class="v-karte news-karte" data-news="${es(k.slug)}" style="cursor:pointer">${!klein && k.image_url ? `<img class="news-bild" src="${es(k.image_url)}" alt="" loading="lazy">` : ''}<div class="news-kopf">${plattformPille(k)}${dringPille(k)}<span class="text-klein" style="margin-left:auto">${datKurz(k.published_date || k.date)}</span></div><h3>${es(k.headline)}</h3>${klein ? '' : `<p>${es(ersteSaetze(k.summary))}</p>`}</div>`
}
async function renderNews(area, ctx) {
  const [heuteQ, nlQ, altQ] = await Promise.all([
    sb.from('digest_cards_today').select('*'),
    sb.from('newsletter_subscribers').select('status').eq('user_id', uid()).maybeSingle(),
    sb.from('digest_cards_past').select('slug,headline,platform,platform_label,date,published_date,relevance_score,summary,impact,full_content,source,source_url,image_url').limit(40),
  ])
  if (ctx.stale()) return
  let heute = heuteQ.data || [], alt = altQ.data || []
  /* "Fuer mich": viuno_news_profil liefert Merkmale wie plattform_instagram;
     gefiltert wird nach der Plattform der Karte. Allgemeine Karten bleiben,
     Meta-Karten gehoeren zu Instagram und Threads. */
  let fuerMich = false
  try { fuerMich = localStorage.getItem('viuno-news-filter') === 'mich' } catch (_) {}
  if (fuerMich) {
    const tags = await rpc('viuno_news_profil').catch(() => [])
    if (ctx.stale()) return
    const meine = new Set((tags || []).filter(t => t.startsWith('plattform_')).map(t => t.slice(10)))
    const passt = k => { const p = (k.platform || 'allgemein').toLowerCase(); return p === 'allgemein' || !p || meine.has(p) || (p === 'meta' && (meine.has('instagram') || meine.has('threads'))) }
    heute = heute.filter(passt); alt = alt.filter(passt)
  }
  const abonniert = nlQ.data?.status === 'active', bestaetigungOffen = nlQ.data?.status === 'pending'
  Z.newsNeu = false
  if (heute.length) sb.from('page_views').insert({ user_id: uid(), page: 'news', source: 'app' }).then(() => {})
  area.innerHTML = `
    <div class="v-seg v-seg--dunkel v-seg--voll"><button class="${fuerMich ? '' : 'aktiv'}" data-filter="alle">Alle News</button><button class="${fuerMich ? 'aktiv' : ''}" data-filter="mich">Für mich</button></div>
    ${abonniert ? '' : bestaetigungOffen ? `<div class="v-banner"><span class="sym">${ICO.mail}</span><div class="text"><strong>Bitte bestätigen</strong><span>Wir haben dir eine Mail an ${es(Z.session.user.email)} geschickt. Erst nach dem Klick darin kommen die News.</span></div><button class="v-btn v-btn--rand v-btn--klein" data-abo>Erneut senden</button></div>` : `<div class="v-banner"><span class="sym">${ICO.mail}</span><div class="text"><strong>Creator News per Mail</strong><span>Jeden Montag, jederzeit abbestellbar. Du bestätigst per Mail.</span></div><button class="v-btn v-btn--dunkel v-btn--klein" data-abo>Abonnieren</button></div>`}
    ${heute.length ? `<div class="abschnitt"><div class="abschnitt-titel">Ausgabe vom ${datKurz(heute[0].date)}</div>${heute.map(k => newsKarte(k)).join('')}</div>` : fuerMich ? leer('Nichts für deine Kanäle diese Woche', 'Unter „Alle News“ steht die ganze Ausgabe.') : leer('Diese Woche noch keine Ausgabe', 'Die Creator News erscheinen jeden Montag.')}
    ${alt.length ? `<div class="abschnitt"><div class="abschnitt-titel">Frühere Ausgaben</div>${alt.map(k => newsKarte(k, true)).join('')}</div>` : ''}
  `
  $$('[data-filter]', area).forEach(b => ctx.on(b, 'click', () => { try { localStorage.setItem('viuno-news-filter', b.dataset.filter) } catch (_) {} renderNews(area, ctx) }))
  ctx.on($('[data-abo]', area), 'click', async e => {
    laden(e.currentTarget, true)
    try { const r = await fn('newsletter-subscribe', { source: 'app' }); toast(r.status === 'schon_aktiv' ? 'Schon abonniert' : 'Bestätigungsmail unterwegs', 'gut'); if (!ctx.stale()) renderNews(area, ctx) } catch (er) { fehler(er); laden(e.currentTarget, false) }
  })
  const alle = [...heute, ...alt]
  $$('[data-news]', area).forEach(el => ctx.on(el, 'click', () => {
    const k = alle.find(x => x.slug === el.dataset.news); if (!k) return
    sb.from('page_views').insert({ user_id: uid(), page: 'news', source: 'app', card_slug: k.slug }).then(() => {})
    sheet(`${k.image_url ? `<img class="news-bild" src="${es(k.image_url)}" alt="">` : ''}<div class="news-kopf">${plattformPille(k)}${dringPille(k)}<span class="text-klein">${datKurz(k.published_date || k.date)}${k.source ? ' · ' + es(k.source) : ''}</span></div><h2 style="margin:0 0 10px;font-size:var(--t-xl)">${es(k.headline)}</h2><p class="news-text" style="color:var(--text)">${es(k.full_content || k.summary)}</p>${k.impact ? `<div class="news-impact">${es(k.impact)}</div>` : ''}<div class="v-btn-reihe" style="margin-top:16px">${k.source_url ? `<a class="v-btn v-btn--rand" href="${es(k.source_url)}" target="_blank" rel="noopener">Quelle ${ICO.extern}</a>` : ''}<button class="v-btn v-btn--dunkel" data-news-teilen>${ICO.teilen} Teilen</button></div>`)
    $('[data-news-teilen]').addEventListener('click', () => kopieren('https://viuno.de/news/' + k.slug, 'Link kopiert'))
  }))
}

/* ═══════════════════════════════════════════════════════════════════════
   Profil: die eine Quelle. Aussen-Ansicht oben, dann zwei Listen.
   ═══════════════════════════════════════════════════════════════════════ */
function kanalAn(kanal, seite) { const k = (Z.p.kanal_anzeige || {})[kanal]; return !k || k[seite] !== false }
async function renderProfil(area, ctx) {
  const p = Z.p
  const kanaele = KANAELE.filter(k => p[k.spalte])
  const nl = await sb.from('newsletter_subscribers').select('status').eq('user_id', uid()).maybeSingle()
  if (ctx.stale()) return
  const newsletterAn = nl.data?.status === 'active', newsletterOffen = nl.data?.status === 'pending'
  const dunkel = document.documentElement.dataset.farbmodus === 'dunkel'
  const fehltWert = '<span class="fehlt">fehlt</span>'
  area.innerHTML = `
    ${karte(`<div class="profil-kopf"><div class="v-avatar" data-aktion="foto" style="cursor:pointer">${avatarInnen(p, 64)}</div><div style="flex:1;min-width:0"><h2>${es(p.display_name)}</h2><p>${es(nischeLabel(p.niche_category))}${kanaele.length ? ' · ' + kanaele.map(k => k.label).join(', ') : ''}</p></div></div>${p.bio ? `<p class="text-muted" style="margin:12px 0 0;font-size:var(--t-sm);line-height:var(--lh-body)">${es(p.bio)}</p>` : ''}<div class="profil-links"><a class="v-btn v-btn--rand v-btn--klein" href="https://viuno.de/${es(slug())}" target="_blank" rel="noopener">BioLink ${p.bio_active ? '' : '(aus)'} ${ICO.extern}</a><a class="v-btn v-btn--rand v-btn--klein" href="https://viuno.de/kit/${es(slug())}" target="_blank" rel="noopener">Media Kit ${p.mediakit_active ? '' : '(aus)'} ${ICO.extern}</a></div>`)}
    <div class="v-liste"><div class="v-liste-titel">Öffentliche Angaben</div>
      ${listeZeile({ sym: ICO.profil, text: 'Username', small: 'viuno.de/' + es(slug()), wert: '@' + es(p.display_name), attrs: 'data-aktion="username"' })}
      ${listeZeile({ sym: ICO.doc, text: 'Bio', small: 'Steht unter deinem Namen', wert: p.bio ? es(p.bio.slice(0, 18)) + (p.bio.length > 18 ? '…' : '') : fehltWert, attrs: 'data-aktion="bio"' })}
      ${listeZeile({ sym: ICO.foto, text: 'Foto', small: 'Wird auf 800 px verkleinert', wert: p.profile_image_url && !p.profile_image_url.includes('Profilbild_BioUno') ? 'gesetzt' : fehltWert, attrs: 'data-aktion="foto"' })}
      ${listeZeile({ sym: ICO.stern, text: 'Nische', wert: es(nischeLabel(p.niche_category)), attrs: 'data-aktion="nische"' })}
      ${listeZeile({ sym: ICO.mail, text: 'Kontakt-E-Mail', small: 'Für den Kontakt-Knopf', wert: p.contact_email ? es(p.contact_email) : fehltWert, attrs: 'data-aktion="kontakt"' })}
      ${listeZeile({ sym: ICO.instagram, text: 'Kanäle', small: 'Einmal eintragen, pro Seite schalten', wert: kanaele.length ? kanaele.length + ' aktiv' : fehltWert, attrs: 'data-geh="#/kanaele"' })}
      ${listeZeile({ sym: ICO.link, text: 'Links', small: 'Eigene Links mit Reihenfolge', wert: Z.links.length ? String(Z.links.length) : 'keine', attrs: 'data-geh="#/links"' })}
      ${listeZeile({ sym: ICO.herz, text: 'Zusammenarbeit', small: 'Marken als Referenz im Media Kit', wert: Z.marken.length ? String(Z.marken.length) : 'keine', attrs: 'data-geh="#/marken"' })}
      ${listeZeile({ sym: ICO.euro, text: 'Leistungen & Preise', wert: Z.offers.length ? Z.offers.length + Z.eigene.length + ' Leistungen' : fehltWert, attrs: 'data-geh="#/leistungen"' })}
      ${listeZeile({ sym: ICO.gruppe, text: 'Zielgruppe', small: 'Alter, Länder, Geschlecht', wert: Z.mk && (Z.mk.gender_female_pct != null || Z.mk.top_country_1) ? 'gesetzt' : fehltWert, attrs: 'data-geh="#/zielgruppe"' })}
      ${listeZeile({ sym: ICO.bild, text: 'Referenzen', small: 'Stärkste Beiträge mit Bild', wert: Z.beitraege.length ? Z.beitraege.length + ' Beiträge' : 'keine', attrs: 'data-geh="#/referenzen"' })}
      ${listeZeile({ sym: ICO.doc, text: 'Impressum', small: 'Pflicht bei geschäftlicher Nutzung', wert: p.impressum_text ? 'gesetzt' : fehltWert, attrs: 'data-aktion="impressum"' })}
      ${listeZeile({ sym: ICO.sprache, text: 'Sprache', wert: (Z.bl?.default_language || 'de').toUpperCase(), attrs: 'data-aktion="sprache"' })}
      ${listeZeile({ sym: ICO.palette, text: 'Design', wert: { clean: 'Weiß', dark: 'Schwarz', color: 'Color' }[Z.bl?.theme || 'color'], attrs: 'data-aktion="design"' })}
    </div>
    <div class="v-liste"><div class="v-liste-titel">Nur für dich</div>
      <div class="v-liste-zeile" style="cursor:default"><span class="sym">${dunkel ? ICO.mond : ICO.sonne}</span><span class="text">Dunkelmodus<small>Ohne Wahl folgt die App dem Gerät</small></span>${toggle(dunkel, 'data-dunkel', 'v-toggle--dunkel')}</div>
      <div class="v-liste-zeile" style="cursor:default"><span class="sym">${ICO.news}</span><span class="text">Creator News per Mail<small>${newsletterOffen ? 'Bestätigung steht aus – schau in dein Postfach' : 'Jeden Montag, jederzeit abbestellbar'}</small></span>${toggle(newsletterAn, 'data-newsletter', 'v-toggle--akzent')}</div>
      ${listeZeile({ sym: ICO.stern, text: 'Abo', small: aboAktiv() ? (Z.abo.kuendigung_zum ? 'Gekündigt zum ' + dat(Z.abo.kuendigung_zum) : 'Wochenanalyse, Media-Kit-Zahlen, Brand Ready') : 'Erste Analyse inklusive, dann 4,99 € im Monat', wert: aboAktiv() ? (Z.abo.kuendigung_zum ? 'endet' : 'aktiv') : 'kein Abo', wertKlasse: aboAktiv() && !Z.abo.kuendigung_zum ? 'gut' : '', attrs: 'data-aktion="abo"' })}
      ${listeZeile({ sym: ICO.mail, text: 'Login-E-Mail', wert: es(Z.session.user.email), attrs: 'data-aktion="email"' })}
      ${listeZeile({ sym: ICO.schloss, text: 'Passwort ändern', attrs: 'data-aktion="passwort"' })}
      ${listeZeile({ sym: ICO.doc, text: 'Datenauskunft', small: 'Alle Daten zu deinem Konto, innerhalb von 48 Stunden', attrs: 'data-aktion="auskunft"' })}
      ${listeZeile({ sym: ICO.raus, text: 'Abmelden', pfeil: false, attrs: 'data-aktion="logout"' })}
      ${listeZeile({ sym: ICO.muell, symKlasse: 'rot', text: 'Konto löschen', pfeil: false, klasse: 'gefahr', attrs: 'data-aktion="loeschen"' })}
    </div>
    <p class="text-klein zentriert"><a href="https://viuno.de/legal#agb" target="_blank" rel="noopener">AGB</a> · <a href="https://viuno.de/legal#datenschutz" target="_blank" rel="noopener">Datenschutz</a> · <a href="https://viuno.de/legal#impressum" target="_blank" rel="noopener">Impressum</a> · <a href="mailto:office@viuno.de">office@viuno.de</a></p>
  `
  $$('.sym.rot', area).forEach(s => { s.style.background = 'var(--red-bg)'; s.style.color = 'var(--red)' })
  $$('[data-geh]', area).forEach(el => ctx.on(el, 'click', () => { Z.zurueckZu = '#/profil'; geh(el.dataset.geh) }))
  const neu = () => renderProfil(area, ctx)
  const aktionen = {
    username: () => usernameSheet(neu), bio: () => bioSheet(neu), foto: () => fotoSheet(neu), nische: () => nischeSheet(neu),
    kontakt: () => kontaktSheet(neu), impressum: () => impressumSheet(neu), sprache: spracheSheet, design: designSheet,
    email: () => emailSheet(neu), passwort: passwortSheet, auskunft: datenauskunft, logout: abmelden, loeschen: kontoLoeschen, abo: () => aboSheet(neu),
  }
  $$('[data-aktion]', area).forEach(el => ctx.on(el, 'click', () => aktionen[el.dataset.aktion] && aktionen[el.dataset.aktion]()))
  ctx.on($('[data-dunkel]', area), 'click', e => {
    const an = !e.currentTarget.classList.contains('an')
    e.currentTarget.classList.toggle('an', an)
    if (an) document.documentElement.dataset.farbmodus = 'dunkel'; else delete document.documentElement.dataset.farbmodus
    try { localStorage.setItem('viuno-farbmodus', an ? 'dunkel' : 'hell') } catch (_) {}
  })
  ctx.on($('[data-newsletter]', area), 'click', async e => {
    const btn = e.currentTarget, an = !btn.classList.contains('an'); btn.disabled = true; btn.classList.toggle('an', an)
    try {
      const r = await fn('newsletter-subscribe', an ? { source: 'app' } : { abmelden: true })
      if (an && r.status === 'bestaetigung_unterwegs') { btn.classList.remove('an'); toast('Bestätigungsmail an ' + (r.email || Z.session.user.email) + ' unterwegs', 'gut'); if (!ctx.stale()) renderProfil(area, ctx); return }
      toast(an ? 'Creator News abonniert' : 'Abbestellt')
    }
    catch (er) { fehler(er); btn.classList.toggle('an', !an) }
    btn.disabled = false
  })
}
/* Kleine Sheets: ein Feld, ein Knopf. */
function einfachesSheet({ titel, text, felder, speichern }) {
  const el = sheet(`${text ? `<p>${text}</p>` : ''}${felder}<button class="v-btn v-btn--dunkel v-btn--breit" data-speichern>Speichern</button>`, { titel })
  $('[data-speichern]', el).addEventListener('click', async e => {
    laden(e.currentTarget, true)
    try { const ok = await speichern(el); if (ok !== false) { sheetZu(); toast('Gespeichert') } } catch (er) { fehler(er) } finally { if ($('[data-speichern]', el)) laden(e.currentTarget, false) }
  })
  setTimeout(() => $('input,textarea,select', el)?.focus(), 350)
  return el
}
function bioSheet(neu) {
  const el = einfachesSheet({ titel: 'Bio', text: 'Ein bis zwei Sätze, die unter deinem Namen stehen.',
    felder: feld('', `<textarea class="v-input" id="f-bio" rows="3" maxlength="160" placeholder="Was machst du, für wen?">${es(Z.p.bio || '')}</textarea>`, '<span class="v-hint-zeile"><span>Max. 160 Zeichen</span></span>') +
      `<div class="v-schalter-zeile"><div><span>Auf dem BioLink zeigen</span></div>${toggle(kanalAn('bio', 'biolink'), 'data-bio-schalter="biolink"')}</div><div class="v-schalter-zeile"><div><span>Im Media Kit zeigen</span></div>${toggle(kanalAn('bio', 'mediakit'), 'data-bio-schalter="mediakit"')}</div>`,
    speichern: async el2 => {
      const bio = $('#f-bio', el2).value.trim() || null
      const anzeige = JSON.parse(JSON.stringify(Z.p.kanal_anzeige || {}))
      anzeige.bio = { biolink: $('[data-bio-schalter="biolink"]', el2).classList.contains('an'), mediakit: $('[data-bio-schalter="mediakit"]', el2).classList.contains('an') }
      const unveraendert = bio === (Z.p.bio || null) && JSON.stringify(anzeige.bio) === JSON.stringify((Z.p.kanal_anzeige || {}).bio || { biolink: true, mediakit: true })
      if (unveraendert) return
      await userSpeichern({ bio, kanal_anzeige: anzeige }); bioNeuErzeugen({ leise: true }); neu()
    } })
  $$('[data-bio-schalter]', el).forEach(t => t.addEventListener('click', () => t.classList.toggle('an')))
}
function nischeSheet(neu) {
  einfachesSheet({ titel: 'Nische', felder: feld('', `<select class="v-input v-select" id="f-nische">${NISCHEN.map(([k, l]) => `<option value="${k}"${k === Z.p.niche_category ? ' selected' : ''}>${es(l)}</option>`).join('')}</select>`),
    speichern: async el => { await userSpeichern({ niche_category: $('#f-nische', el).value }); neu() } })
}
function kontaktSheet(neu) {
  einfachesSheet({ titel: 'Kontakt-E-Mail', text: 'Steht hinter dem Kontakt-Knopf auf BioLink und Media Kit. Leer heißt: kein Knopf.',
    felder: feld('', input('f-kontakt', Z.p.contact_email || '', 'type="email" inputmode="email" placeholder="du@beispiel.de"')),
    speichern: async el => { const v = $('#f-kontakt', el).value.trim(); if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) { toast('Das sieht nicht nach einer Adresse aus', 'fehler'); return false } await userSpeichern({ contact_email: v || null }); neu() } })
}
function impressumSheet(neu) {
  einfachesSheet({ titel: 'Impressum', text: 'Name, Anschrift, Kontakt. Wer geschäftlich postet, braucht es (§ 5 DDG). Steht im Fuß beider Seiten.',
    felder: feld('', `<textarea class="v-input" id="f-imp" rows="7" placeholder="Vorname Nachname\nStraße 1\n12345 Ort\nE-Mail">${es(Z.p.impressum_text || '')}</textarea>`),
    speichern: async el => { await userSpeichern({ impressum_text: $('#f-imp', el).value.trim() || null }); neu() } })
}
function usernameSheet(neu) {
  const el = einfachesSheet({ titel: 'Username', text: 'Dein Username ist deine Adresse. Nach einer Änderung werden BioLink und Media Kit <b>ausgeschaltet</b> und müssen neu veröffentlicht werden, der alte Link führt ins Leere.',
    felder: feld('', `<div class="v-input-huelle"><span class="praefix">@</span>${input('f-name', Z.p.display_name || '', 'autocapitalize="none" maxlength="30"')}</div>`, '3–30 Zeichen, Buchstaben, Zahlen, Unterstrich'),
    speichern: async el2 => {
      const v = $('#f-name', el2).value.trim()
      if (v === Z.p.display_name) return
      if (!/^[a-zA-Z0-9_]{3,30}$/.test(v)) { toast('Ungültiger Username', 'fehler'); return false }
      const ok = await bestaetigen({ titel: 'Username ändern?', text: 'viuno.de/' + Z.p.display_name.toLowerCase() + ' wird abgeschaltet. Du musst BioLink und Media Kit danach neu einschalten.', ja: 'Ändern', gefahr: true })
      if (!ok) return false
      const r = await fn('change-username', { new_username: v })
      Z.p.display_name = r.new_username; Z.p.bio_active = false; Z.p.mediakit_active = false
      neu()
    } })
  return el
}
function emailSheet(neu) {
  einfachesSheet({ titel: 'Login-E-Mail', text: 'Du bekommst an die neue Adresse eine Bestätigung. Erst nach dem Klick darin gilt sie.',
    felder: feld('', input('f-email', Z.session.user.email, 'type="email" inputmode="email"')),
    speichern: async el => {
      const v = $('#f-email', el).value.trim(); if (v === Z.session.user.email) return
      const { error } = await sb.auth.updateUser({ email: v }); if (error) throw error
      fn('konto-warnung', { art: 'email', neue_adresse: v }).catch(() => {})
      toast('Bestätigungsmail an ' + v + ' unterwegs', 'gut'); neu()
    } })
}
function passwortSheet() {
  einfachesSheet({ titel: 'Passwort ändern', felder: feld('Neues Passwort', input('f-pw', '', 'type="password" autocomplete="new-password" placeholder="mindestens 8 Zeichen"')) + feld('Noch einmal', input('f-pw2', '', 'type="password" autocomplete="new-password"')),
    speichern: async el => {
      const a = $('#f-pw', el).value, b = $('#f-pw2', el).value
      if (a.length < 8) { toast('Mindestens 8 Zeichen', 'fehler'); return false }
      if (a !== b) { toast('Die Passwörter stimmen nicht überein', 'fehler'); return false }
      const { error } = await sb.auth.updateUser({ password: a }); if (error) throw error
      fn('konto-warnung', { art: 'passwort' }).catch(() => {})
    } })
}
function fotoSheet(neu) {
  const el = sheet(`<p>Quadratisch wirkt am besten. Das Bild wird im Browser auf 800 px verkleinert, das alte gelöscht.</p><label class="v-upload">${ICO.foto}<b>Foto auswählen</b><span>JPG, PNG oder HEIC</span><input type="file" id="f-foto" accept="image/*" hidden></label><div id="f-foto-stand" class="text-klein zentriert" style="margin-top:10px"></div>`, { titel: 'Profilfoto' })
  $('#f-foto', el).addEventListener('change', async e => {
    const datei = e.target.files[0]; if (!datei) return
    const stand = $('#f-foto-stand', el); stand.textContent = 'Wird verkleinert …'
    try {
      const blob = await bildVerkleinern(datei, 800)
      stand.textContent = 'Wird hochgeladen …'
      const pfad = uid() + '/' + Date.now() + '.jpg'
      const { error } = await sb.storage.from('profile-images').upload(pfad, blob, { contentType: 'image/jpeg', upsert: false })
      if (error) throw error
      const url = BILD_BASIS + 'profile-images/' + pfad
      const alt = Z.p.profile_image_url
      await userSpeichern({ profile_image_url: url })
      if (alt && alt.includes('/profile-images/' + uid() + '/')) sb.storage.from('profile-images').remove([alt.split('/profile-images/')[1]]).then(() => {})
      sheetZu(); toast('Foto gespeichert'); bioNeuErzeugen({ leise: true }); neu(); render()
    } catch (er) { fehler(er, 'Das Foto konnte nicht gespeichert werden'); stand.textContent = '' }
  })
}
function bildVerkleinern(datei, max) {
  return new Promise((res, rej) => {
    const img = new Image(); const url = URL.createObjectURL(datei)
    img.onload = () => {
      const f = Math.min(1, max / Math.max(img.width, img.height))
      const c = document.createElement('canvas'); c.width = Math.round(img.width * f); c.height = Math.round(img.height * f)
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url)
      c.toBlob(b => b ? res(b) : rej(new Error('Bild konnte nicht gelesen werden')), 'image/jpeg', 0.86)
    }
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Dieses Format kann der Browser nicht öffnen')) }
    img.src = url
  })
}
async function datenauskunft() {
  const ok = await bestaetigen({ titel: 'Datenauskunft anfordern?', text: 'Du bekommst innerhalb von 48 Stunden alle Daten zu deinem Konto an ' + Z.session.user.email + '.', ja: 'Anfordern' })
  if (!ok) return
  try { await fn('datenauskunft'); toast('Angefordert. Kommt innerhalb von 48 Stunden.', 'gut') } catch (e) { fehler(e) }
}
async function abmelden() {
  await sb.auth.signOut(); Z.session = null; Z.p = null; Z.geladen = false; geh('#/login')
}
function kontoLoeschen() {
  const name = Z.p.display_name
  const el = modal(`<div class="v-modal--mitte"><div class="sym">${ICO.muell}</div><h2>Konto löschen</h2><p>BioLink, Media Kit und alle Zahlen sind danach weg. Tipp deinen Username zur Bestätigung.</p><div class="v-feld" style="text-align:left">${input('f-del', '', `placeholder="${es(name)}" autocapitalize="none"`)}</div><div class="v-btn-stapel"><button class="v-btn v-btn--gefahr" data-del disabled>Endgültig löschen</button><button class="v-btn v-btn--rand" data-modal-zu>Abbrechen</button></div></div>`)
  $('.v-modal', el).classList.add('v-modal--mitte')
  const inp = $('#f-del', el), btn = $('[data-del]', el)
  inp.addEventListener('input', () => { btn.disabled = inp.value.trim().toLowerCase() !== String(name).toLowerCase() })
  btn.addEventListener('click', async () => {
    laden(btn, true)
    try { await fn('delete-account'); await sb.auth.signOut(); Z.session = null; Z.p = null; Z.geladen = false; sheetZu(); toast('Konto gelöscht'); geh('#/login') } catch (e) { fehler(e); laden(btn, false) }
  })
}

/* ═══════════════════════════════════════════════════════════════════════
   Kanaele: vier Handles, je zwei Schalter
   ═══════════════════════════════════════════════════════════════════════ */
async function renderKanaele(area, ctx) {
  const { data: gemessen } = await sb.from('analyse_stats').select('platform,username').eq('user_id', uid()).order('created_at', { ascending: false })
  if (ctx.stale()) return
  const analysiert = {}; (gemessen || []).forEach(g => { if (!analysiert[g.platform]) analysiert[g.platform] = g.username })
  area.innerHTML = `
    <p class="text-muted" style="margin:0;font-size:var(--t-sm);line-height:var(--lh-body)">Jeder Kanal einmal. Die Schalter bestimmen, wo er erscheint. Instagram und TikTok sind zugleich die Quelle deiner Analyse.</p>
    <div class="v-liste">${KANAELE.map(k => `<div style="padding:12px 16px;border-bottom:1px solid var(--border)">${feld(k.label, `<div class="v-input-huelle"><span class="praefix">@</span>${input('k-' + k.key, handleRein(Z.p[k.spalte]), 'autocapitalize="none" autocomplete="off" placeholder="deinname"')}</div>`)}<div style="display:flex;gap:18px;margin-top:10px"><label style="display:flex;align-items:center;gap:8px;font-size:var(--t-sm)">${toggle(kanalAn(k.key, 'biolink'), `data-schalter="${k.key}:biolink"`)}BioLink</label><label style="display:flex;align-items:center;gap:8px;font-size:var(--t-sm)">${toggle(kanalAn(k.key, 'mediakit'), `data-schalter="${k.key}:mediakit"`)}Media Kit</label></div></div>`).join('')}</div>
    <button class="v-btn v-btn--dunkel v-btn--breit" data-speichern>Speichern</button>
  `
  $$('[data-schalter]', area).forEach(t => ctx.on(t, 'click', () => t.classList.toggle('an')))
  ctx.on($('[data-speichern]', area), 'click', async e => {
    const patch = {}, anzeige = JSON.parse(JSON.stringify(Z.p.kanal_anzeige || {}))
    let warnung = null
    for (const k of KANAELE) {
      const neu = handleRein($('#k-' + k.key, area).value), alt = handleRein(Z.p[k.spalte])
      patch[k.spalte] = neu ? '@' + neu : null
      if (analysiert[k.key] && neu.toLowerCase() !== alt.toLowerCase() && alt) warnung = k.label
      anzeige[k.key] = { biolink: $(`[data-schalter="${k.key}:biolink"]`, area).classList.contains('an'), mediakit: $(`[data-schalter="${k.key}:mediakit"]`, area).classList.contains('an') }
    }
    if (warnung) {
      const ok = await bestaetigen({ titel: warnung + '-Handle wurde schon analysiert', text: 'Wenn du ihn änderst, gehören die bisherigen Zahlen zum neuen Namen. Trotzdem ändern?', ja: 'Trotzdem ändern' })
      if (!ok) return
    }
    laden(e.currentTarget, true)
    try { await userSpeichern({ ...patch, kanal_anzeige: anzeige }); toast('Kanäle gespeichert'); zurueck() } catch (er) { fehler(er); laden(e.currentTarget, false) }
  })
}

/* ═══════════════════════════════════════════════════════════════════════
   Links: Kanaele plus eigene Links, sortierbar, je zwei Schalter
   ═══════════════════════════════════════════════════════════════════════ */
async function renderLinks(area, ctx) {
  const schalterHtml = (an, attr, label) => `<label style="display:flex;align-items:center;gap:6px;font-size:var(--t-xs)">${toggle(an, attr)}${label}</label>`
  const zeichne = () => {
    const eintraege = linkEintraege()
    const zeile = (e, i) => {
      const knoepfe = `<button class="v-ibtn" data-bewege="${i}:-1" ${i === 0 ? 'disabled' : ''} aria-label="Nach oben">${ICO.auf}</button><button class="v-ibtn" data-bewege="${i}:1" ${i === eintraege.length - 1 ? 'disabled' : ''} aria-label="Nach unten">${ICO.ab}</button>`
      if (e.art === 'kanal') {
        const k = e.kanal
        return `<div class="sort-zeile" data-key="${e.key}"><span class="sym" style="width:32px;height:32px;border-radius:var(--r-xs);display:grid;place-items:center;background:var(--surface2);color:var(--muted);flex-shrink:0">${ICO[k.key]}</span><div class="text"><strong>${k.label}</strong><small>@${es(handleRein(Z.p[k.spalte]))}</small><div class="schalter">${schalterHtml(kanalAn(k.key, 'biolink'), `data-kanal="${k.key}:biolink"`, 'BioLink')}${schalterHtml(kanalAn(k.key, 'mediakit'), `data-kanal="${k.key}:mediakit"`, 'Media Kit')}</div></div><div class="sort-knoepfe">${knoepfe}<button class="v-ibtn" data-kanal-edit="${k.key}" aria-label="Bearbeiten">${ICO.stift}</button></div><span class="griff" data-griff="${i}" aria-label="Ziehen zum Sortieren">${ICO.griff}</span></div>`
      }
      const l = e.link
      return `<div class="sort-zeile" data-key="${e.key}"><span class="sym" style="width:32px;height:32px;border-radius:var(--r-xs);display:grid;place-items:center;background:var(--surface2);color:var(--muted);flex-shrink:0">${ICO.link}</span><div class="text"><strong>${es(l.title)}${l.is_paid ? ' ' + badge('Werbung', 'orange') : ''}</strong><small>${es(l.url)}</small><div class="schalter">${schalterHtml(l.im_biolink !== false, `data-link-schalter="${l.id}:im_biolink"`, 'BioLink')}${schalterHtml(!!l.im_mediakit, `data-link-schalter="${l.id}:im_mediakit"`, 'Media Kit')}${schalterHtml(!!l.is_paid, `data-link-schalter="${l.id}:is_paid"`, 'Werbung')}</div></div><div class="sort-knoepfe">${knoepfe}<button class="v-ibtn" data-link-edit="${l.id}" aria-label="Bearbeiten">${ICO.stift}</button><button class="v-ibtn rot" data-loesche="${l.id}" aria-label="Entfernen">${ICO.x}</button></div><span class="griff" data-griff="${i}" aria-label="Ziehen zum Sortieren">${ICO.griff}</span></div>`
    }
    area.innerHTML = `
      ${feld('Link hinzufügen', `<select class="v-input v-select" id="l-art"><option value="">Auswählen …</option>${KANAELE.map(k => `<option value="${k.key}">${k.label}</option>`).join('')}<option value="eigen">Eigener Link</option></select>`)}
      <div class="v-karte" id="l-form" hidden></div>
      <div class="abschnitt"><div class="abschnitt-titel">Deine Links · Reihenfolge wie auf dem BioLink</div>${eintraege.length ? `<div class="v-liste">${eintraege.map(zeile).join('')}</div><p class="text-klein">Reihenfolge: Pfeile antippen oder am Griff ziehen. Werbung kennzeichnet Affiliate- und bezahlte Links auf der Seite.</p>` : `<p class="text-klein">Noch keine Links. Wähle oben einen Kanal oder einen eigenen Link. Bis zu 10 eigene Links sind möglich.</p>`}</div>
    `
    const art = $('#l-art', area), form = $('#l-form', area)
    ctx.on(art, 'change', () => linkForm(art.value, null))
    const linkForm = (wert, link) => {
      form.hidden = !wert
      if (!wert) return
      const kanal = KANAELE.find(k => k.key === wert)
      if (kanal) form.innerHTML = feld(kanal.label, `<div class="v-input-huelle"><span class="praefix">@</span>${input('l-handle', handleRein(Z.p[kanal.spalte]), 'autocapitalize="none" placeholder="deinname"')}</div>`) + `<button class="v-btn v-btn--dunkel v-btn--breit" style="margin-top:12px" data-l-speichern>${Z.p[kanal.spalte] ? 'Speichern' : 'Hinzufügen'}</button>`
      else form.innerHTML = feld('Titel', input('l-titel', link ? link.title : '', 'placeholder="z. B. Mein Shop" maxlength="60"')) + `<div style="height:10px"></div>` + feld('Link', input('l-url', link ? link.url : '', 'type="url" inputmode="url" autocapitalize="none" placeholder="https://…"')) + `<label class="v-checkbox" style="margin-top:12px"><input type="checkbox" id="l-werbung" ${link && link.is_paid ? 'checked' : ''}><span>Werbung<small>Kennzeichnung auf der Seite, z. B. bei Affiliate-Links</small></span></label><button class="v-btn v-btn--dunkel v-btn--breit" style="margin-top:12px" data-l-speichern>${link ? 'Speichern' : 'Hinzufügen'}</button>`
      $('input', form).focus()
      $('[data-l-speichern]', form).addEventListener('click', async e => {
        laden(e.currentTarget, true)
        try {
          if (kanal) {
            const h = handleRein($('#l-handle', form).value); if (!h) throw new Error('@Namen eingeben')
            const anzeige = JSON.parse(JSON.stringify(Z.p.kanal_anzeige || {})); anzeige[kanal.key] = { ...(anzeige[kanal.key] || {}), biolink: true }
            await userSpeichern({ [kanal.spalte]: '@' + h, kanal_anzeige: anzeige })
          } else {
            const title = $('#l-titel', form).value.trim(), url = urlRein($('#l-url', form).value), is_paid = $('#l-werbung', form).checked
            if (!title || !url) throw new Error('Titel und Link eingeben')
            if (link) { const { error } = await sb.from('biolink_custom_links').update({ title, url, is_paid }).eq('id', link.id); if (error) throw error; Object.assign(link, { title, url, is_paid }) }
            else {
              if (Z.links.length >= 10) throw new Error('Höchstens 10 eigene Links')
              const { data, error } = await sb.from('biolink_custom_links').insert({ user_id: uid(), title, url, is_paid, position: Z.links.length, im_biolink: true, im_mediakit: false }).select('*').single(); if (error) throw error; Z.links.push(data)
            }
          }
          toast(link ? 'Gespeichert' : 'Hinzugefügt'); zeichne()
        } catch (er) { fehler(er); laden(e.currentTarget, false) }
      })
    }
    $$('[data-kanal-edit]', area).forEach(b => ctx.on(b, 'click', () => { art.value = b.dataset.kanalEdit; linkForm(art.value); window.scrollTo(0, 0) }))
    $$('[data-link-edit]', area).forEach(b => ctx.on(b, 'click', () => { art.value = 'eigen'; linkForm('eigen', Z.links.find(l => l.id === b.dataset.linkEdit)); window.scrollTo(0, 0) }))
    $$('[data-kanal]', area).forEach(t => ctx.on(t, 'click', async () => {
      const [key, seite] = t.dataset.kanal.split(':'); const an = !t.classList.contains('an'); t.classList.toggle('an', an)
      const anzeige = JSON.parse(JSON.stringify(Z.p.kanal_anzeige || {})); anzeige[key] = { ...(anzeige[key] || {}), [seite]: an }
      try { await userSpeichern({ kanal_anzeige: anzeige }) } catch (er) { fehler(er); t.classList.toggle('an', !an) }
    }))
    $$('[data-link-schalter]', area).forEach(t => ctx.on(t, 'click', async () => {
      const [id, spalte] = t.dataset.linkSchalter.split(':'); const an = !t.classList.contains('an'); t.classList.toggle('an', an)
      const { error } = await sb.from('biolink_custom_links').update({ [spalte]: an }).eq('id', id)
      if (error) { fehler(error); t.classList.toggle('an', !an) } else { const l = Z.links.find(x => x.id === id); if (l) l[spalte] = an; if (spalte === 'is_paid') zeichne() }
    }))
    const verschieben = async (von, zu) => {
      if (zu < 0 || zu >= eintraege.length || zu === von) return
      const [e] = eintraege.splice(von, 1); eintraege.splice(zu, 0, e)
      try { await reihenfolgeSpeichern(eintraege); zeichne(); toast('Reihenfolge gespeichert') } catch (er) { fehler(er); zeichne() }
    }
    $$('[data-bewege]', area).forEach(b => ctx.on(b, 'click', () => { const [i, d] = b.dataset.bewege.split(':').map(Number); verschieben(i, i + d) }))
    /* Ziehen am Griff: die Zeile folgt dem Finger, beim Loslassen wird die
       Reihenfolge gespeichert. Pfeile bleiben fuer Tastatur und Vorleser. */
    $$('[data-griff]', area).forEach(g => ctx.on(g, 'pointerdown', e => {
      e.preventDefault()
      const zeile = g.closest('.sort-zeile'), liste = zeile.parentElement, zeilen = () => $$('.sort-zeile', liste)
      const von = Number(g.dataset.griff); let zu = von
      zeile.classList.add('zieht'); g.setPointerCapture(e.pointerId)
      const bewegen = ev => {
        const y = ev.clientY
        zeilen().forEach((z, idx) => { if (z === zeile) return; const r = z.getBoundingClientRect(); if (y > r.top && y < r.bottom) { if (idx < zu) liste.insertBefore(zeile, z); else liste.insertBefore(zeile, z.nextSibling); zu = zeilen().indexOf(zeile) } })
      }
      const ende = () => {
        g.removeEventListener('pointermove', bewegen); g.removeEventListener('pointerup', ende); g.removeEventListener('pointercancel', ende)
        zeile.classList.remove('zieht')
        if (zu !== von) verschieben(von, zu)
      }
      g.addEventListener('pointermove', bewegen); g.addEventListener('pointerup', ende); g.addEventListener('pointercancel', ende)
    }))
    $$('[data-loesche]', area).forEach(b => ctx.on(b, 'click', async () => {
      const l = Z.links.find(x => x.id === b.dataset.loesche)
      if (!await bestaetigen({ titel: 'Link entfernen?', text: l.title + ' verschwindet von BioLink und Media Kit.', ja: 'Entfernen', gefahr: true })) return
      const { error } = await sb.from('biolink_custom_links').delete().eq('id', l.id); if (error) return fehler(error)
      Z.links = Z.links.filter(x => x.id !== l.id); toast('Entfernt'); zeichne()
    }))
  }
  zeichne()
}
/* Kanaele und eigene Links in einer Reihenfolge. Sie steht als Liste von
   Schluesseln in users.kanal_anzeige.reihenfolge (instagram | link:<id> | ...);
   die BioLink-Seite liest sie ueber biopage_v2.reihenfolge. Unbekannte
   Eintraege haengen hinten an, damit ein neuer Link sofort erscheint. */
function linkEintraege() {
  const kanaele = KANAELE.filter(k => Z.p[k.spalte]).map(k => ({ key: k.key, art: 'kanal', kanal: k }))
  const links = Z.links.map(l => ({ key: 'link:' + l.id, art: 'link', link: l }))
  const alle = [...kanaele, ...links]
  const ord = (Z.p.kanal_anzeige || {}).reihenfolge
  if (Array.isArray(ord) && ord.length) alle.sort((a, b) => { const ia = ord.indexOf(a.key), ib = ord.indexOf(b.key); return (ia < 0 ? 1e9 : ia) - (ib < 0 ? 1e9 : ib) })
  return alle
}
async function reihenfolgeSpeichern(eintraege) {
  const anzeige = JSON.parse(JSON.stringify(Z.p.kanal_anzeige || {})); anzeige.reihenfolge = eintraege.map(e => e.key)
  await userSpeichern({ kanal_anzeige: anzeige })
  Z.links = eintraege.filter(e => e.art === 'link').map(e => e.link)
  await Promise.all(Z.links.map((l, p) => sb.from('biolink_custom_links').update({ position: p }).eq('id', l.id)))
}

/* ═══════════════════════════════════════════════════════════════════════
   Marken (Zusammenarbeit): Name + Link, sortierbar, Schalter Media Kit
   ═══════════════════════════════════════════════════════════════════════ */
async function renderMarken(area, ctx) {
  const zeichne = () => {
    area.innerHTML = `
      <p class="text-muted" style="margin:0;font-size:var(--t-sm);line-height:var(--lh-body)">Marken, mit denen du schon gearbeitet hast. Sie stehen im Media Kit unter „Bisherige Kooperationen“ und zählen bei Brand Ready als Referenz. Zwei reichen für die volle Punktzahl.</p>
      ${karte(feld('Markenname', input('m-name', '', 'placeholder="z. B. Hunkemöller" maxlength="60"')) + '<div style="height:10px"></div>' + feld('Link', input('m-url', '', 'type="url" inputmode="url" autocapitalize="none" placeholder="https://…"')) + `<button class="v-btn v-btn--dunkel v-btn--breit" style="margin-top:12px" data-m-hinzu>Hinzufügen</button>`)}
      <div class="abschnitt"><div class="abschnitt-titel">Marken · Reihenfolge wie im Media Kit</div>${Z.marken.length ? `<div class="v-liste">${Z.marken.map((m, i) => `<div class="sort-zeile"><div class="text"><strong>${es(m.name)}</strong><small>${es(m.url || 'ohne Link')}</small><div class="schalter"><label style="display:flex;align-items:center;gap:6px;font-size:var(--t-xs)">${toggle(m.im_mediakit !== false, `data-m-schalter="${m.id}"`)}im Media Kit zeigen</label></div></div><div class="sort-knoepfe"><button class="v-ibtn" data-bewege="${i}:-1" ${i === 0 ? 'disabled' : ''}>${ICO.auf}</button><button class="v-ibtn" data-bewege="${i}:1" ${i === Z.marken.length - 1 ? 'disabled' : ''}>${ICO.ab}</button><button class="v-ibtn rot" data-loesche="${m.id}">${ICO.x}</button></div></div>`).join('')}</div>` : '<p class="text-klein">Noch keine Marken. Zwei Referenzen bringen Punkte im Brand-Ready-Check.</p>'}</div>
    `
    ctx.on($('[data-m-hinzu]', area), 'click', async e => {
      const name = $('#m-name', area).value.trim(), url = urlRein($('#m-url', area).value)
      if (!name) return toast('Markenname eingeben', 'fehler')
      laden(e.currentTarget, true)
      const { data, error } = await sb.from('mediakit_brands').insert({ user_id: uid(), name, url: url || null, position: Z.marken.length, im_mediakit: true }).select('*').single()
      if (error) { fehler(error); laden(e.currentTarget, false); return }
      Z.marken.push(data); toast('Hinzugefügt'); zeichne()
    })
    $$('[data-m-schalter]', area).forEach(t => ctx.on(t, 'click', async () => {
      const an = !t.classList.contains('an'); t.classList.toggle('an', an)
      const { error } = await sb.from('mediakit_brands').update({ im_mediakit: an }).eq('id', t.dataset.mSchalter)
      if (error) { fehler(error); t.classList.toggle('an', !an) } else { const m = Z.marken.find(x => x.id === t.dataset.mSchalter); if (m) m.im_mediakit = an }
    }))
    $$('[data-bewege]', area).forEach(b => ctx.on(b, 'click', async () => {
      const [i, d] = b.dataset.bewege.split(':').map(Number); const j = i + d; if (j < 0 || j >= Z.marken.length) return
      const t = Z.marken[i]; Z.marken[i] = Z.marken[j]; Z.marken[j] = t; zeichne()
      await Promise.all(Z.marken.map((m, p) => sb.from('mediakit_brands').update({ position: p }).eq('id', m.id)))
    }))
    $$('[data-loesche]', area).forEach(b => ctx.on(b, 'click', async () => {
      const { error } = await sb.from('mediakit_brands').delete().eq('id', b.dataset.loesche); if (error) return fehler(error)
      Z.marken = Z.marken.filter(x => x.id !== b.dataset.loesche); toast('Entfernt'); zeichne()
    }))
  }
  zeichne()
}

/* ═══════════════════════════════════════════════════════════════════════
   Leistungen & Preise, Konditionen, Preisrechner
   ═══════════════════════════════════════════════════════════════════════ */
async function renderLeistungen(area, ctx) {
  const preisVon = t => { const p = Z.preise.find(x => x.offer_type === t); return p && p.preis_von != null ? String(p.preis_von) : '' }
  const mk = Z.mk || {}
  area.innerHTML = `
    <div class="abschnitt"><div class="abschnitt-titel">Leistungen</div><div class="v-liste">${LEISTUNGEN.map(([k, l]) => `<div class="leistung" data-leistung="${k}"><button type="button" class="haken${Z.offers.some(o => o.offer_type === k) ? ' aktiv' : ''}" aria-label="${l} anbieten">${ICO.haken}</button><span>${l}</span><div class="preis-huelle"><input class="v-input" inputmode="decimal" placeholder="Preis" value="${es(preisVon(k))}"><b>€</b></div></div>`).join('')}</div><p class="text-klein">Ohne Preis steht „auf Anfrage“. Marken suchen den Abschnitt mit Preisen zuerst.</p></div>
    <div class="abschnitt"><div class="abschnitt-titel">Eigene Leistungen · bis zu 4</div><div class="v-liste" id="eigene"></div><button class="v-btn v-btn--gestrichelt v-btn--breit" id="eigene-plus" style="border:1px dashed var(--border-strong);background:none;color:var(--muted)">${ICO.plus} Eigene Leistung</button></div>
    <div class="abschnitt"><div class="abschnitt-titel">Konditionen</div>${karte(`<div class="zwei-spalten">${feld('Vorlauf (Tage)', input('kd-vorlauf', mk.vorlauf_tage ?? '', 'inputmode="numeric" placeholder="14"'))}${feld('Korrekturschleifen', input('kd-schleifen', mk.freigabe_schleifen ?? '', 'inputmode="numeric" placeholder="1"'))}</div><div style="height:12px"></div>${feld('Nutzungsrechte', input('kd-rechte', mk.nutzungsrechte || '', 'placeholder="z. B. 6 Monate auf den Kanälen der Marke"'))}<div style="height:12px"></div>${feld('Exklusivität', input('kd-exkl', mk.exklusivitaet || '', 'placeholder="z. B. 4 Wochen keine ähnliche Marke"'))}<div style="height:12px"></div>${feld('Preishinweis', `<select class="v-input v-select" id="kd-hinweis"><option value="">keiner</option><option value="kleinunternehmer"${mk.preis_hinweis === 'kleinunternehmer' ? ' selected' : ''}>Kleinunternehmer, keine USt.</option><option value="zzgl_ust"${mk.preis_hinweis === 'zzgl_ust' ? ' selected' : ''}>netto, zzgl. USt.</option><option value="inkl_ust"${mk.preis_hinweis === 'inkl_ust' ? ' selected' : ''}>inkl. USt.</option></select>`)}<div style="height:12px"></div>${feld('Pitch an Marken', `<textarea class="v-input" id="kd-pitch" rows="3" maxlength="300" placeholder="Zwei Sätze: wofür du stehst, was Marken bei dir bekommen.">${es(mk.pitch || '')}</textarea>`)}`)}</div>
    <button class="v-btn v-btn--dunkel v-btn--breit" data-speichern>Speichern</button>
    <div class="abschnitt"><div class="abschnitt-titel">Was kann ich verlangen?</div>${karte(`<p class="text-muted" style="margin:0 0 12px;font-size:var(--t-sm);line-height:var(--lh-body)">Aus deinen gemessenen Aufrufen und dem Referenzband deiner Nische. Ein Gesprächsanfang, kein Maximum.</p><div class="zwei-spalten">${feld('Format', `<select class="v-input v-select" id="pr-format">${LEISTUNGEN.map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select>`)}${feld('Kanal', `<select class="v-input v-select" id="pr-pf"><option value="instagram">Instagram</option><option value="tiktok">TikTok</option></select>`)}</div><div style="height:10px"></div><div class="zwei-spalten">${feld('Rechte', `<select class="v-input v-select" id="pr-rechte"><option value="keine">keine</option><option value="6 Monate">6 Monate</option><option value="12 Monate">12 Monate</option><option value="unbegrenzt">unbegrenzt</option></select>`)}${feld('Exklusiv', `<select class="v-input v-select" id="pr-exkl"><option value="keine">keine</option><option value="30 Tage">30 Tage</option><option value="90 Tage">90 Tage</option></select>`)}</div><button class="v-btn v-btn--rand v-btn--breit" style="margin-top:12px" data-rechnen>Berechnen</button><div id="pr-ergebnis" style="margin-top:12px"></div>`)}</div>
  `
  const eigeneEl = $('#eigene', area), plus = $('#eigene-plus', area)
  let eigene = Z.eigene.map(e => ({ titel: e.titel, preis_von: e.preis_von }))
  const eigeneZeichnen = () => {
    eigeneEl.innerHTML = eigene.map((e, i) => `<div class="leistung leistung--eigen" data-i="${i}"><input class="v-input titel" placeholder="Titel" value="${es(e.titel || '')}" maxlength="40"><div class="preis-huelle"><input class="v-input" inputmode="decimal" placeholder="Preis" value="${es(e.preis_von ?? '')}"><b>€</b></div><button class="v-ibtn rot" style="width:30px;height:30px;border-radius:var(--r-xs);color:var(--red)" data-eigen-weg="${i}">${ICO.x}</button></div>`).join('')
    eigeneEl.hidden = !eigene.length
    plus.hidden = eigene.length >= 4
    $$('[data-eigen-weg]', eigeneEl).forEach(b => b.addEventListener('click', () => { eigeneLesen(); eigene.splice(Number(b.dataset.eigenWeg), 1); eigeneZeichnen() }))
  }
  const eigeneLesen = () => { $$('.leistung--eigen', eigeneEl).forEach(z => { const f = $$('input', z); eigene[Number(z.dataset.i)] = { titel: f[0].value.trim(), preis_von: f[1].value.trim() } }) }
  ctx.on(plus, 'click', () => { eigeneLesen(); eigene.push({ titel: '', preis_von: '' }); eigeneZeichnen(); const f = $$('.leistung--eigen input.titel', eigeneEl); f[f.length - 1]?.focus() })
  eigeneZeichnen()
  $$('.haken', area).forEach(h => ctx.on(h, 'click', () => h.classList.toggle('aktiv')))
  $$('.leistung input', area).forEach(i => ctx.on(i, 'input', () => { if (i.value.trim()) $('.haken', i.closest('.leistung'))?.classList.add('aktiv') }))
  const zahl = v => { v = String(v ?? '').replace(',', '.').trim(); return v === '' ? null : (isNaN(Number(v)) ? null : Number(v)) }
  ctx.on($('[data-speichern]', area), 'click', async e => {
    laden(e.currentTarget, true)
    try {
      eigeneLesen()
      const aktiv = $$('[data-leistung]', area).filter(z => $('.haken', z).classList.contains('aktiv')).map(z => z.dataset.leistung)
      const preise = $$('[data-leistung]', area).map(z => ({ typ: z.dataset.leistung, von: zahl($('input', z).value) }))
      // Angebote: Differenz schreiben
      const vorher = Z.offers.map(o => o.offer_type)
      const weg = vorher.filter(t => !aktiv.includes(t)), neu = aktiv.filter(t => !vorher.includes(t))
      if (weg.length) { const { error } = await sb.from('mediakit_content_offers').delete().eq('user_id', uid()).in('offer_type', weg); if (error) throw error }
      if (neu.length) { const { error } = await sb.from('mediakit_content_offers').insert(neu.map(t => ({ user_id: uid(), offer_type: t }))); if (error) throw error }
      // Preise: upsert je Typ, leere loeschen
      for (const p of preise) {
        if (p.von == null) { await sb.from('mediakit_preise').delete().eq('user_id', uid()).eq('offer_type', p.typ) }
        else { const { error } = await sb.from('mediakit_preise').upsert({ user_id: uid(), offer_type: p.typ, preis_von: p.von, updated_at: new Date().toISOString() }, { onConflict: 'user_id,offer_type' }); if (error) throw error }
      }
      // Eigene: komplett neu schreiben (hoechstens vier Zeilen)
      const eigeneGueltig = eigene.filter(x => x.titel).slice(0, 4).map((x, i) => ({ user_id: uid(), titel: x.titel, preis_von: zahl(x.preis_von), position: i }))
      await sb.from('mediakit_eigene_leistungen').delete().eq('user_id', uid())
      if (eigeneGueltig.length) { const { error } = await sb.from('mediakit_eigene_leistungen').insert(eigeneGueltig); if (error) throw error }
      await mkSpeichern({ vorlauf_tage: zahl($('#kd-vorlauf', area).value), freigabe_schleifen: zahl($('#kd-schleifen', area).value), nutzungsrechte: $('#kd-rechte', area).value.trim() || null, exklusivitaet: $('#kd-exkl', area).value.trim() || null, preis_hinweis: $('#kd-hinweis', area).value || null, pitch: $('#kd-pitch', area).value.trim() || null })
      const [o, pr, ei] = await Promise.all([sb.from('mediakit_content_offers').select('*').eq('user_id', uid()), sb.from('mediakit_preise').select('*').eq('user_id', uid()), sb.from('mediakit_eigene_leistungen').select('*').eq('user_id', uid()).order('position')])
      Z.offers = o.data || []; Z.preise = pr.data || []; Z.eigene = ei.data || []
      toast('Gespeichert'); zurueck()
    } catch (er) { fehler(er); laden(e.currentTarget, false) }
  })
  ctx.on($('[data-rechnen]', area), 'click', async e => {
    laden(e.currentTarget, true); const out = $('#pr-ergebnis', area)
    try {
      const r = await rpc('viuno_preis', { p_format: $('#pr-format', area).value, p_rechte: $('#pr-rechte', area).value, p_exklusiv: $('#pr-exkl', area).value, p_plattform: $('#pr-pf', area).value })
      if (!r.ok) out.innerHTML = `<div class="v-hinweis v-hinweis--info">${ICO.info}<div class="text"><p style="margin:0">${es(r.text || 'Dafür liegt noch kein Referenzwert vor.')}</p></div></div>`
      else out.innerHTML = `<div class="v-kpi-reihe">${kpi('Empfehlung', euro(r.empfehlung), 'nennst du zuerst')}${kpi('Spanne', euro(r.von) + ' – ' + euro(r.bis), r.nische ? 'Nische ' + es(r.nische) : '')}</div><div style="margin-top:10px">${(r.rechnung || []).map(z => `<div class="preis-rechnung"><span>${es(z.label)}</span><b class="v-num">${es(z.wert)}</b></div>`).join('')}</div>${r.hinweis ? `<p class="text-klein" style="margin-top:8px">${es(r.hinweis)}</p>` : ''}${r.quelle ? `<p class="text-klein">Quelle: ${es(r.quelle)}${r.stand ? ', Stand ' + dat(r.stand) : ''}</p>` : ''}`
    } catch (er) { fehler(er) } finally { laden(e.currentTarget, false) }
  })
}

/* ═══════════════════════════════════════════════════════════════════════
   Zielgruppe (Eigenangabe)
   ═══════════════════════════════════════════════════════════════════════ */
async function renderZielgruppe(area, ctx) {
  const mk = Z.mk || {}
  area.innerHTML = `
    <p class="text-muted" style="margin:0;font-size:var(--t-sm);line-height:var(--lh-body)">Alter, Länder und Geschlecht kann viuno nicht messen. Sie stehen im Media Kit als Eigenangabe, nimm sie aus den Insights deiner Plattform.</p>
    ${karte(karteKopf('Geschlecht', 'in Prozent') + `<div class="zwei-spalten">${feld('Frauen', `<div class="preis-huelle">${input('zg-f', mk.gender_female_pct ?? '', 'inputmode="numeric" placeholder="62"')}<b>%</b></div>`)}${feld('Männer', `<div class="preis-huelle">${input('zg-m', mk.gender_male_pct ?? '', 'inputmode="numeric" placeholder="38"')}<b>%</b></div>`)}</div>`)}
    ${karte(karteKopf('Top-Länder', 'die zwei wichtigsten') + `<div class="zwei-spalten">${feld('Land 1', input('zg-l1', mk.top_country_1 || '', 'placeholder="Deutschland"'))}${feld('Anteil', `<div class="preis-huelle">${input('zg-l1p', mk.top_country_1_pct ?? '', 'inputmode="numeric" placeholder="70"')}<b>%</b></div>`)}</div><div style="height:10px"></div><div class="zwei-spalten">${feld('Land 2', input('zg-l2', mk.top_country_2 || '', 'placeholder="Österreich"'))}${feld('Anteil', `<div class="preis-huelle">${input('zg-l2p', mk.top_country_2_pct ?? '', 'inputmode="numeric" placeholder="12"')}<b>%</b></div>`)}</div>`)}
    ${karte(karteKopf('Alter', 'in Prozent, muss nicht 100 ergeben') + `<div class="zwei-spalten">${feld('18–24', `<div class="preis-huelle">${input('zg-a1', mk.alter_18_24 ?? '', 'inputmode="numeric"')}<b>%</b></div>`)}${feld('25–34', `<div class="preis-huelle">${input('zg-a2', mk.alter_25_34 ?? '', 'inputmode="numeric"')}<b>%</b></div>`)}</div><div style="height:10px"></div><div class="zwei-spalten">${feld('35–44', `<div class="preis-huelle">${input('zg-a3', mk.alter_35_44 ?? '', 'inputmode="numeric"')}<b>%</b></div>`)}${feld('45+', `<div class="preis-huelle">${input('zg-a4', mk.alter_45plus ?? '', 'inputmode="numeric"')}<b>%</b></div>`)}</div>`)}
    <button class="v-btn v-btn--dunkel v-btn--breit" data-speichern>Speichern</button>
  `
  const f = $('#zg-f', area), m = $('#zg-m', area)
  ctx.on(f, 'input', () => { const v = Number(f.value); if (f.value !== '' && !isNaN(v) && v >= 0 && v <= 100) m.value = 100 - v })
  ctx.on(m, 'input', () => { const v = Number(m.value); if (m.value !== '' && !isNaN(v) && v >= 0 && v <= 100) f.value = 100 - v })
  const pz = id => { const v = $('#' + id, area).value.trim(); if (v === '') return null; const n = Number(v); return isNaN(n) ? null : Math.max(0, Math.min(100, Math.round(n))) }
  ctx.on($('[data-speichern]', area), 'click', async e => {
    laden(e.currentTarget, true)
    try {
      await mkSpeichern({ gender_female_pct: pz('zg-f'), gender_male_pct: pz('zg-m'), top_country_1: $('#zg-l1', area).value.trim() || null, top_country_1_pct: pz('zg-l1p'), top_country_2: $('#zg-l2', area).value.trim() || null, top_country_2_pct: pz('zg-l2p'), alter_18_24: pz('zg-a1'), alter_25_34: pz('zg-a2'), alter_35_44: pz('zg-a3'), alter_45plus: pz('zg-a4') })
      toast('Gespeichert'); zurueck()
    } catch (er) { fehler(er); laden(e.currentTarget, false) }
  })
}

/* ═══════════════════════════════════════════════════════════════════════
   Referenzen: die staerksten Beitraege mit Bild, aus der letzten Analyse
   ═══════════════════════════════════════════════════════════════════════ */
async function renderReferenzen(area, ctx) {
  const zeichne = () => {
    area.innerHTML = `
      <p class="text-muted" style="margin:0;font-size:var(--t-sm);line-height:var(--lh-body)">Die stärksten Beiträge deiner letzten Analyse, mit Bild. Im Media Kit stehen die ersten drei je Kanal. Ein Beitrag lässt sich hier entfernen.</p>
      ${['instagram', 'tiktok'].map(pf => { const b = Z.beitraege.filter(x => x.platform === pf && x.bild_pfad); return b.length ? `<div class="abschnitt"><div class="abschnitt-titel">${PLATTFORM_LABEL[pf]}</div><div class="beitraege">${b.map(x => `<div class="beitrag"><img src="${es(BILD_BASIS + 'mediakit-beitraege/' + x.bild_pfad)}" alt="" loading="lazy"><b class="v-num">${fm(x.views || x.likes)} ${x.views ? 'Aufrufe' : 'Likes'}</b><button data-weg="${x.id}" aria-label="Entfernen">${ICO.x}</button></div>`).join('')}</div></div>` : '' }).join('')}
      ${Z.beitraege.some(x => x.bild_pfad) ? '' : leer('Noch keine Beiträge gesichert', 'Nach einer Analyse holt viuno die Vorschaubilder deiner stärksten Beiträge. Die Links der Plattform laufen nach wenigen Tagen ab, deshalb sichert viuno Kopien.')}
      <button class="v-btn v-btn--rand v-btn--breit" data-holen>${ICO.neu} Aus letzter Analyse aktualisieren</button>
    `
    ctx.on($('[data-holen]', area), 'click', async e => {
      laden(e.currentTarget, true)
      try {
        const r = await fn('mediakit-bilder')
        const { data } = await sb.from('mediakit_beitraege').select('*').eq('user_id', uid()).order('position'); Z.beitraege = data || []
        toast(r.grund ? r.grund : (r.gesichert ? r.gesichert + ' Bilder gesichert' : 'Alles aktuell'), r.grund ? 'fehler' : 'gut'); zeichne()
      } catch (er) { fehler(er); laden(e.currentTarget, false) }
    })
    $$('[data-weg]', area).forEach(b => ctx.on(b, 'click', async () => {
      const x = Z.beitraege.find(y => y.id === b.dataset.weg)
      const { error } = await sb.from('mediakit_beitraege').delete().eq('id', x.id); if (error) return fehler(error)
      if (x.bild_pfad) sb.storage.from('mediakit-beitraege').remove([x.bild_pfad]).then(() => {})
      Z.beitraege = Z.beitraege.filter(y => y.id !== x.id); toast('Entfernt'); zeichne()
    }))
  }
  zeichne()
}

/* ═══════════════════════════════════════════════════════════════════════
   Start der App
   ═══════════════════════════════════════════════════════════════════════ */
;(async function start() {
  const { data } = await sb.auth.getSession()
  Z.session = data.session
  sb.auth.onAuthStateChange((ev, s) => {
    if (ev === 'PASSWORD_RECOVERY') { Z.session = s; geh('#/neues-passwort'); return }
    if (ev === 'SIGNED_OUT') { Z.session = null; Z.p = null; Z.geladen = false; if (!ROUTEN[(location.hash || '').replace(/^#\/?/, '').split('/')[0]]?.frei) geh('#/login'); return }
    if (s) Z.session = s
  })
  window.addEventListener('hashchange', render)
  if (!location.hash) location.hash = Z.session ? '#/start' : '#/login'
  else render()
})()
