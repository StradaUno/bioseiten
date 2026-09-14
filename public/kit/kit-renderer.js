/* ═══════════════════════════════════════════════════════════════════
   MEDIA-KIT-RENDERER — die Darstellung jeder erzeugten Kit-Seite.

   Warum das hier liegt und nicht im Generator: `generate-mediakit` hat CSS,
   HTML und JS als Zeichenketten eingebacken und pro Creator eine fertige
   Datei nach GitHub committet. Jede Layout-Aenderung hiess damit: Generator
   anfassen UND jede bestehende Kit-Seite neu erzeugen. Jetzt erzeugt der
   Generator eine duenne Huelle, die diese Datei laedt -- eine Layout-
   Aenderung ist ab sofort ein Push, keine Neuerzeugung.

   Das bricht "kein geteiltes JS" aus CLAUDE.md zum zweiten Mal, mit
   demselben Muster wie brand-ready-regeln.js: eine Datei, zwei Verbraucher,
   Begruendung im Kopf.

   ── Was ein Kit an Marken leisten muss ──────────────────────────────
   Eine Marke fragt in dieser Reihenfolge: Wer bist du, wie gross und wie
   lebendig ist deine Community, was hast du gemacht, wer ist dein Publikum,
   was kostet es, wie laeuft die Zusammenarbeit, mit wem hast du schon
   gearbeitet, wie erreiche ich dich. Genau so ist die Seite sortiert.

   ── Der Unterschied zu jedem Canva-Kit ──────────────────────────────
   Dort ist jede Zahl getippt. Hier traegt jeder Block, der aus einer
   Analyse stammt, den Stichtag: "gemessen am 13.09.2026". Alles, was viuno
   nicht messen kann -- Alter, Laender, Geschlecht -- steht ausdruecklich als
   Eigenangabe da. Das ist unbequem und genau deshalb glaubwuerdig.
   ═══════════════════════════════════════════════════════════════════ */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SB_URL  = 'https://bzejndghppuipnedasuv.supabase.co'
const SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6ZWpuZGdocHB1aXBuZWRhc3V2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2NTMxOTcsImV4cCI6MjA4OTIyOTE5N30.TShH1cIABQCtKgLkhCS9ymUJ36ZUYnlvCnGTok6EKTo'
const BILD_BASIS = SB_URL + '/storage/v1/object/public/mediakit-beitraege/'

const sb = createClient(SB_URL, SB_ANON, { auth: { persistSession: false } })

/* ── Sprachen. Die Kit-Seite gibt es auf Deutsch, Englisch und
      Italienisch -- eine Marke aus Mailand liest kein deutsches Kit. ── */
const STR = {
  de: { contact:'Kontakt', contact_btn:'Kooperation anfragen', imprint:'Impressum',
    imprint_empty:'Kein Impressum hinterlegt.', other_platforms:'Weitere Plattformen',
    audience:'Zielgruppe', gender:'Geschlecht', countries:'Top-Länder', age:'Alter',
    offers:'Leistungen', brands:'Bisherige Kooperationen', female:'Frauen', male:'Männer',
    followers:'Follower', subscribers:'Abonnenten', er:'Engagement', avg_likes:'Ø Likes',
    avg_views:'Ø Views', avg_comments:'Ø Kommentare', frequency:'Beiträge/Woche',
    view_profile:'Profil ansehen', reach:'Reichweite', posts:'Stärkste Beiträge',
    terms:'Zusammenarbeit', lead:'Vorlauf', rights:'Nutzungsrechte', excl:'Exklusivität',
    rounds:'Freigabe', days:'Tage', round_one:'eine Korrekturschleife inklusive',
    rounds_n:'Korrekturschleifen inklusive', measured:'gemessen am', self:'Eigenangabe',
    self_note:'Eigenangabe des Creators — nicht von viuno gemessen.',
    measured_note:'Aus der viuno-Analyse übernommen.',
    price_from:'ab', on_request:'auf Anfrage', print:'Als PDF speichern',
    kleinunternehmer:'Kleinunternehmer nach § 19 UStG — es wird keine Umsatzsteuer ausgewiesen.',
    zzgl_ust:'Alle Preise netto, zzgl. gesetzlicher Umsatzsteuer.',
    inkl_ust:'Alle Preise inklusive gesetzlicher Umsatzsteuer.',
    offer_ugc_video:'UGC Video', offer_instagram_reel:'Instagram Reel',
    offer_tiktok_post:'TikTok Video', offer_story_package:'Story-Paket' },
  en: { contact:'Contact', contact_btn:'Request a collaboration', imprint:'Imprint',
    imprint_empty:'No imprint provided.', other_platforms:'Other platforms',
    audience:'Audience', gender:'Gender', countries:'Top countries', age:'Age',
    offers:'Services', brands:'Past collaborations', female:'Female', male:'Male',
    followers:'Followers', subscribers:'Subscribers', er:'Engagement', avg_likes:'Avg likes',
    avg_views:'Avg views', avg_comments:'Avg comments', frequency:'Posts/week',
    view_profile:'View profile', reach:'Reach', posts:'Top posts',
    terms:'Working together', lead:'Lead time', rights:'Usage rights', excl:'Exclusivity',
    rounds:'Approval', days:'days', round_one:'one round of revisions included',
    rounds_n:'rounds of revisions included', measured:'measured on', self:'self-reported',
    self_note:'Self-reported by the creator — not measured by viuno.',
    measured_note:'Taken from the viuno analysis.',
    price_from:'from', on_request:'on request', print:'Save as PDF',
    kleinunternehmer:'Small business under § 19 German VAT Act — no VAT is charged.',
    zzgl_ust:'All prices net, plus statutory VAT.',
    inkl_ust:'All prices including statutory VAT.',
    offer_ugc_video:'UGC video', offer_instagram_reel:'Instagram Reel',
    offer_tiktok_post:'TikTok video', offer_story_package:'Story package' },
  it: { contact:'Contatti', contact_btn:'Richiedi una collaborazione', imprint:'Impressum',
    imprint_empty:'Nessun impressum.', other_platforms:'Altre piattaforme',
    audience:'Pubblico', gender:'Genere', countries:'Paesi principali', age:'Età',
    offers:'Servizi', brands:'Collaborazioni precedenti', female:'Donne', male:'Uomini',
    followers:'Follower', subscribers:'Iscritti', er:'Engagement', avg_likes:'Media like',
    avg_views:'Media views', avg_comments:'Media commenti', frequency:'Post/settimana',
    view_profile:'Vedi profilo', reach:'Copertura', posts:'Post migliori',
    terms:'Collaborazione', lead:'Preavviso', rights:'Diritti di utilizzo', excl:'Esclusività',
    rounds:'Approvazione', days:'giorni', round_one:'una revisione inclusa',
    rounds_n:'revisioni incluse', measured:'misurato il', self:'dichiarato',
    self_note:'Dichiarato dal creator — non misurato da viuno.',
    measured_note:"Ripreso dall'analisi viuno.",
    price_from:'da', on_request:'su richiesta', print:'Salva come PDF',
    kleinunternehmer:'Regime forfettario § 19 UStG — IVA non esposta.',
    zzgl_ust:'Prezzi netti, IVA esclusa.',
    inkl_ust:'Prezzi IVA inclusa.',
    offer_ugc_video:'Video UGC', offer_instagram_reel:'Instagram Reel',
    offer_tiktok_post:'Video TikTok', offer_story_package:'Pacchetto Story' }
}

let lang = 'de', u = null, brands = [], offers = [], preise = [], beitraege = []
const t = k => (STR[lang] && STR[lang][k]) || (STR.de[k] ?? k)

const es = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))
const fm = n => n == null ? '–' : n >= 1e6 ? (n/1e6).toFixed(1).replace(/\.0$/,'')+'M'
  : n >= 1e3 ? (n/1e3).toFixed(1).replace(/\.0$/,'')+'k' : String(n)
const dez = (n, d = 1) => n == null ? '–'
  : Number(n).toLocaleString(lang === 'de' ? 'de-DE' : lang, { minimumFractionDigits: d, maximumFractionDigits: d })
/* Fest auf Berliner Zeit, nicht auf die Zeitzone des Betrachters -- dieselbe
   Entscheidung wie in der Analyse-Ansicht. Sonst sieht eine Marke in New York
   als Stichtag den Vortag, und zwei Leute streiten ueber dasselbe Datum. */
const datum = s => s ? new Date(s).toLocaleDateString(lang === 'de' ? 'de-DE' : lang,
  { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric' }) : ''
const euro = n => n == null ? null
  : Number(n).toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 })
const nu = x => x ? (x.startsWith('http') ? x : 'https://' + x) : '#'

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Serif+Display:ital@0;1&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:#EAEAEE;color:#1A1A2E;font-family:'DM Sans',system-ui,sans-serif;-webkit-font-smoothing:antialiased}
body{min-height:100dvh;padding:16px 16px 48px}
a{text-decoration:none;color:inherit}
.page-loader{position:fixed;inset:0;background:#EAEAEE;display:flex;align-items:center;justify-content:center;z-index:9999;transition:opacity .25s}
.page-loader.hide{opacity:0;pointer-events:none}
.spinner{width:24px;height:24px;border:2px solid rgba(26,26,46,.15);border-top-color:rgba(26,26,46,.6);border-radius:50%;animation:spin .8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
#main{visibility:hidden}
.mk-main{max-width:480px;margin:0 auto;background:#FAFAF9;border-radius:20px;border:1px solid #D4D4D8;overflow:hidden;box-shadow:0 2px 12px rgba(26,26,46,.07)}
.mk-hero{padding:32px 24px 24px;text-align:center;border-bottom:1px solid #D4D4D8}
.mk-avatar{width:88px;height:88px;border-radius:50%;background:#1A1A2E;color:#fff;font-family:'DM Serif Display',serif;font-size:32px;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;box-shadow:0 0 0 3px #FAFAF9,0 0 0 4.5px rgba(26,26,46,.25);overflow:hidden}
.mk-avatar img{width:100%;height:100%;object-fit:cover}
.mk-name{font-family:'DM Serif Display',serif;font-size:26px;letter-spacing:-.02em;margin-bottom:4px}
.mk-tags{display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin:10px 0}
.mk-tag{font-size:11px;color:#71717A;background:#FAFAF9;border:1px solid #D4D4D8;border-radius:20px;padding:3px 10px;font-weight:500}
.mk-pitch{font-size:14px;color:#1A1A2E;line-height:1.65;margin:12px auto 0;max-width:330px}
.mk-bio{font-size:13px;color:#71717A;line-height:1.6;margin:8px auto 0;max-width:300px}
.mk-section{padding:20px 24px;border-bottom:1px solid #D4D4D8}
.mk-section:last-child{border-bottom:none}
.mk-label{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.1em;color:#9292A0;margin-bottom:14px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.mk-herkunft{font-size:9px;font-weight:600;letter-spacing:.04em;padding:2px 7px;border-radius:999px;text-transform:none}
.mk-herkunft.gemessen{background:#E8F3EC;color:#1a7f4b}
.mk-herkunft.eigen{background:#EFEFF2;color:#71717A}
.mk-platform{background:#fff;border-radius:14px;border:1px solid rgba(26,26,46,.10);box-shadow:0 1px 4px rgba(26,26,46,.06),0 4px 12px rgba(26,26,46,.04);padding:16px;margin-bottom:10px}
.mk-platform:last-child{margin-bottom:0}
.mk-plat-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
.mk-plat-name{display:flex;align-items:center;gap:8px;font-weight:600;font-size:14px}
.mk-plat-icon{width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.mk-plat-icon.ig{background:#fce4ec}.mk-plat-icon.tt{background:#e8eaf6}
.mk-plat-icon.yt{background:#ffebee}.mk-plat-icon.th{background:#e8f5e9}
.mk-plat-handle{font-size:12px;color:#9292A0}
.mk-stats3{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px}
.mk-stat{background:#F5F5F7;border-radius:10px;padding:10px 8px;text-align:center}
.mk-stat-val{font-size:16px;font-weight:600;font-variant-numeric:tabular-nums}
.mk-stat-lbl{font-size:9px;text-transform:uppercase;letter-spacing:.06em;color:#9292A0;margin-top:3px}
.mk-rows{margin-bottom:10px}
.mk-row{display:flex;justify-content:space-between;gap:10px;font-size:12.5px;padding:7px 0;border-top:1px solid rgba(26,26,46,.07)}
.mk-row span:first-child{color:#9292A0}
.mk-row span:last-child{font-weight:600;text-align:right}
.mk-profile-btn{display:block;text-align:center;background:#FAFAF9;border:1px solid #D4D4D8;border-radius:8px;padding:9px;font-size:12px;font-weight:500}
.mk-stand{font-size:10px;color:#9292A0;margin-top:9px;text-align:center;line-height:1.5}
.mk-small-plat{background:#fff;border:1px solid rgba(26,26,46,.10);box-shadow:0 1px 4px rgba(26,26,46,.05);border-radius:12px;padding:13px 16px;display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
.mk-small-plat:last-child{margin-bottom:0}
.mk-small-left{display:flex;align-items:center;gap:10px}
.mk-small-followers{font-size:15px;font-weight:600}
.mk-small-lbl{font-size:11px;color:#9292A0}
.mk-posts{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.mk-post{border-radius:12px;overflow:hidden;background:#fff;border:1px solid rgba(26,26,46,.10);box-shadow:0 1px 4px rgba(26,26,46,.05);display:block}
.mk-post-bild{aspect-ratio:4/5;background:#EFEFF2;display:block;width:100%;object-fit:cover}
.mk-post-zahl{padding:7px 6px;font-size:9.5px;color:#9292A0;text-align:center;line-height:1.45}
.mk-post-zahl b{display:block;color:#1A1A2E;font-size:12px;font-variant-numeric:tabular-nums}
.mk-aud-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.mk-aud-box{background:#fff;border:1px solid rgba(26,26,46,.10);box-shadow:0 1px 4px rgba(26,26,46,.05);border-radius:12px;padding:14px}
.mk-aud-box.weit{grid-column:1 / -1}
.mk-aud-lbl{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#9292A0;font-weight:600;margin-bottom:10px}
.mk-gender{display:flex;flex-direction:column;gap:8px}
.mk-g-row{display:flex;align-items:center;gap:6px}
.mk-g-lbl{font-size:10px;color:#9292A0;width:52px;font-weight:500}
.mk-g-track{flex:1;height:5px;background:rgba(26,26,46,.10);border-radius:999px;overflow:hidden}
.mk-g-fill{height:100%;border-radius:999px}
.mk-g-pct{font-size:12px;font-weight:600;width:32px;text-align:right;font-variant-numeric:tabular-nums}
.mk-countries{display:flex;flex-direction:column;gap:6px}
.mk-country{display:flex;align-items:center;justify-content:space-between;font-size:13px;font-weight:500;padding:5px 0;border-bottom:1px solid rgba(26,26,46,.07);gap:8px}
.mk-country:last-child{border-bottom:none;padding-bottom:0}
.mk-country-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mk-country-pct{font-size:12px;color:#9292A0;font-weight:600;flex-shrink:0}
.mk-preise{background:#fff;border:1px solid rgba(26,26,46,.10);box-shadow:0 1px 4px rgba(26,26,46,.05);border-radius:12px;padding:6px 14px}
.mk-preis{display:flex;justify-content:space-between;align-items:baseline;gap:10px;font-size:13px;padding:10px 0;border-bottom:1px solid rgba(26,26,46,.07)}
.mk-preis:last-child{border-bottom:none}
.mk-preis-wert{font-weight:600;white-space:nowrap}
.mk-preis-wert.leer{color:#9292A0;font-weight:500}
.mk-hinweis{font-size:10.5px;color:#9292A0;margin-top:9px;line-height:1.55}
.mk-brands{display:flex;flex-wrap:wrap;gap:6px}
.mk-brand{display:inline-flex;align-items:center;font-size:12px;background:#fff;border:1px solid rgba(26,26,46,.14);box-shadow:0 1px 3px rgba(26,26,46,.05);padding:7px 14px;border-radius:999px;font-weight:500;line-height:1.2}
.mk-brand-arrow{margin-left:5px;font-size:10px;opacity:.5}
.mk-email{display:flex;align-items:center;gap:8px;padding:11px 14px;background:#F5F5F7;border-radius:10px;font-size:13px;color:#71717A;margin-bottom:10px;word-break:break-all}
.mk-cta{display:block;width:100%;padding:14px;background:#1A1A2E;color:#fff;border-radius:12px;font-size:14px;font-weight:600;text-align:center}
.mk-footer{text-align:center;padding:16px 24px;font-size:11px;color:#9292A0;border-top:1px solid #D4D4D8}
.mk-footer a,.mk-footer button{color:#71717A}
.mk-lang{display:inline-flex;gap:2px;background:#FAFAF9;border:1px solid #D4D4D8;border-radius:999px;padding:3px;margin-bottom:10px}
.mk-lang-btn{font-size:10px;font-weight:500;padding:4px 10px;border-radius:999px;border:none;background:none;color:#9292A0;cursor:pointer;font-family:inherit}
.mk-lang-btn.active{background:#1A1A2E;color:#fff}
.mk-drucken{background:none;border:none;cursor:pointer;font-size:11px;color:#71717A;font-family:inherit;text-decoration:underline}
.imp-backdrop{position:fixed;inset:0;background:rgba(26,26,46,.35);z-index:999;opacity:0;pointer-events:none;transition:opacity .25s}
.imp-backdrop.open{opacity:1;pointer-events:auto}
.imp-sheet{position:fixed;left:0;right:0;bottom:0;max-height:85dvh;background:#FAFAF9;border-top:1px solid #D4D4D8;border-radius:20px 20px 0 0;z-index:1000;transform:translateY(100%);transition:transform .3s cubic-bezier(.2,.8,.2,1),visibility 0s linear .3s;display:flex;flex-direction:column;visibility:hidden}
.imp-sheet.open{transform:translateY(0);visibility:visible;transition:transform .3s cubic-bezier(.2,.8,.2,1),visibility 0s linear 0s}
.imp-handle{width:36px;height:4px;background:#D4D4D8;border-radius:999px;margin:10px auto 6px;flex-shrink:0}
.imp-header{display:flex;align-items:center;justify-content:space-between;padding:8px 20px 14px;border-bottom:1px solid #D4D4D8;flex-shrink:0}
.imp-title{font-size:15px;font-weight:600}
.imp-close{background:transparent;border:1px solid #D4D4D8;color:#71717A;width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:16px;line-height:1;font-family:inherit}
.imp-content{flex:1;overflow-y:auto;padding:20px 20px 32px;font-size:13px;line-height:1.65;color:#71717A;white-space:pre-line}
.imp-empty{color:#C4C4CC;font-style:italic;text-align:center;padding:40px 20px}
body.imp-open{overflow:hidden}
@media (min-width:540px){.imp-sheet{left:50%;transform:translate(-50%,100%);max-width:480px;border-radius:20px;bottom:5dvh}.imp-sheet.open{transform:translate(-50%,0)}}
@media (max-width:480px){.mk-aud-grid{grid-template-columns:1fr}}
/* Marken legen Kits in Ordnern ab. "Drucken -> als PDF sichern" leistet
   das, ohne dass irgendwo ein PDF erzeugt werden muss. */
@media print{
  body{background:#fff;padding:0}
  .mk-main{max-width:none;border:none;box-shadow:none;border-radius:0}
  .mk-lang,.mk-drucken,.page-loader,.imp-sheet,.imp-backdrop,.mk-profile-btn{display:none!important}
  .mk-section{break-inside:avoid}
  #main{visibility:visible!important}
}`

const IKON = {
  ig: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c2185b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>',
  tt: '<svg width="14" height="14" viewBox="0 0 24 24" fill="#3949ab"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/></svg>',
  yt: '<svg width="14" height="14" viewBox="0 0 24 24" fill="#c62828"><path d="M23.5 6.5a3 3 0 0 0-2.1-2.1C19.5 4 12 4 12 4s-7.5 0-9.4.4A3 3 0 0 0 .5 6.5C0 8.4 0 12 0 12s0 3.6.5 5.5a3 3 0 0 0 2.1 2.1C4.5 20 12 20 12 20s7.5 0 9.4-.4a3 3 0 0 0 2.1-2.1c.5-1.9.5-5.5.5-5.5s0-3.6-.5-5.5zM9.6 15.6V8.4l6.2 3.6-6.2 3.6z"/></svg>',
  th: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#388e3c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/></svg>',
  mail: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>'
}

/* Herkunfts-Etikett. Das ist der Kern des Ganzen: eine Marke sieht sofort,
   welche Zahl aus einer Messung stammt und welche der Creator behauptet. */
const etikett = (gemessenAm) => gemessenAm
  ? `<span class="mk-herkunft gemessen">${t('measured')} ${datum(gemessenAm)}</span>`
  : `<span class="mk-herkunft eigen">${t('self')}</span>`

function abschnitt(titel, inhalt, herkunft) {
  if (!inhalt) return ''
  return `<div class="mk-section"><div class="mk-label">${es(titel)}${herkunft || ''}</div>${inhalt}</div>`
}

function plattformBlock(art) {
  const ig = art === 'ig'
  const handle = ig ? u.instagram_handle : u.tiktok_handle
  if (!handle) return ''
  const clean = String(handle).replace(/^@/, '')
  const foll = ig ? u.followers_instagram : u.followers_tiktok
  const er   = ig ? u.er_instagram : u.er_tiktok
  const drit = ig ? u.avg_likes_instagram : u.avg_views_tiktok
  const komm = ig ? u.avg_comments_instagram : u.avg_comments_tiktok
  const freq = ig ? u.posts_woche_instagram : u.posts_woche_tiktok
  const gem  = ig ? u.gemessen_am_instagram : u.gemessen_am_tiktok
  const link = ig ? 'https://instagram.com/' + encodeURIComponent(clean)
                  : 'https://tiktok.com/@' + encodeURIComponent(clean)

  let zeilen = ''
  if (komm != null) zeilen += `<div class="mk-row"><span>${t('avg_comments')}</span><span>${fm(komm)}</span></div>`
  if (freq != null) zeilen += `<div class="mk-row"><span>${t('frequency')}</span><span>${dez(freq, 1)}</span></div>`

  return `<div class="mk-platform">
    <div class="mk-plat-head">
      <div class="mk-plat-name"><div class="mk-plat-icon ${art}">${IKON[art]}</div>${ig ? 'Instagram' : 'TikTok'}</div>
      <span class="mk-plat-handle">@${es(clean)}</span>
    </div>
    <div class="mk-stats3">
      <div class="mk-stat"><div class="mk-stat-val">${fm(foll)}</div><div class="mk-stat-lbl">${t('followers')}</div></div>
      <div class="mk-stat"><div class="mk-stat-val">${er != null ? dez(er, 1) + ' %' : '–'}</div><div class="mk-stat-lbl">${t('er')}</div></div>
      <div class="mk-stat"><div class="mk-stat-val">${fm(drit)}</div><div class="mk-stat-lbl">${ig ? t('avg_likes') : t('avg_views')}</div></div>
    </div>
    ${zeilen ? `<div class="mk-rows">${zeilen}</div>` : ''}
    <a class="mk-profile-btn" href="${link}" target="_blank" rel="noopener">${t('view_profile')} ↗</a>
    ${gem ? `<div class="mk-stand">${t('measured')} ${datum(gem)} · ${t('measured_note')}</div>` : ''}
  </div>`
}

function beitraegeBlock() {
  /* Gezeigt werden drei -- mehr macht aus einem Kit eine Galerie.
     Genommen werden die staerksten des juengsten Laufs. */
  const mitBild = beitraege.filter(b => b.bild_pfad).slice(0, 3)
  if (!mitBild.length) return ''
  return `<div class="mk-posts">${mitBild.map(b => {
    const zahl = b.views ? fm(b.views) : fm(b.likes)
    const lbl  = b.views ? t('avg_views').replace('Ø ', '').replace('Avg ', '').replace('Media ', '') : 'Likes'
    return `<a class="mk-post" ${b.post_url ? `href="${es(b.post_url)}" target="_blank" rel="noopener"` : ''}>
      <img class="mk-post-bild" src="${es(BILD_BASIS + b.bild_pfad)}" alt="" loading="lazy">
      <div class="mk-post-zahl"><b>${zahl}</b>${es(lbl)}${b.likes && b.views ? ' · ' + fm(b.likes) + ' Likes' : ''}</div>
    </a>`
  }).join('')}</div>`
}

function zielgruppeBlock() {
  const hatG = u.gender_female_pct != null || u.gender_male_pct != null
  const hatL = u.top_country_1 || u.top_country_2
  const alter = [['18–24', u.alter_18_24], ['25–34', u.alter_25_34], ['35–44', u.alter_35_44], ['45+', u.alter_45plus]]
    .filter(([, v]) => v != null && v > 0)
  if (!hatG && !hatL && !alter.length) return ''

  let h = '<div class="mk-aud-grid">'
  if (hatG) {
    const f = u.gender_female_pct ?? 0, m = u.gender_male_pct ?? 0
    h += `<div class="mk-aud-box"><div class="mk-aud-lbl">${t('gender')}</div><div class="mk-gender">
      <div class="mk-g-row"><span class="mk-g-lbl">${t('female')}</span><div class="mk-g-track"><div class="mk-g-fill" style="width:${f}%;background:#e91e8c"></div></div><span class="mk-g-pct">${f}%</span></div>
      <div class="mk-g-row"><span class="mk-g-lbl">${t('male')}</span><div class="mk-g-track"><div class="mk-g-fill" style="width:${m}%;background:#1A1A2E"></div></div><span class="mk-g-pct">${m}%</span></div>
    </div></div>`
  }
  if (hatL) {
    h += `<div class="mk-aud-box"><div class="mk-aud-lbl">${t('countries')}</div><div class="mk-countries">`
    for (const [name, pct] of [[u.top_country_1, u.top_country_1_pct], [u.top_country_2, u.top_country_2_pct]]) {
      if (name) h += `<div class="mk-country"><span class="mk-country-name">${es(name)}</span>${pct != null ? `<span class="mk-country-pct">${pct}%</span>` : ''}</div>`
    }
    h += `</div></div>`
  }
  if (alter.length) {
    h += `<div class="mk-aud-box weit"><div class="mk-aud-lbl">${t('age')}</div><div class="mk-gender">`
    for (const [lbl, v] of alter) {
      h += `<div class="mk-g-row"><span class="mk-g-lbl">${lbl}</span><div class="mk-g-track"><div class="mk-g-fill" style="width:${v}%;background:#1A1A2E"></div></div><span class="mk-g-pct">${v}%</span></div>`
    }
    h += `</div></div>`
  }
  h += `</div><div class="mk-hinweis">${t('self_note')}</div>`
  return h
}

function leistungenBlock() {
  if (!offers.length) return ''
  const preisMap = new Map(preise.map(p => [p.offer_type, p]))
  let h = '<div class="mk-preise">'
  for (const o of offers) {
    const p = preisMap.get(o.offer_type)
    let wert = `<span class="mk-preis-wert leer">${t('on_request')}</span>`
    if (p && p.preis_von != null) {
      wert = p.preis_bis != null && Number(p.preis_bis) > Number(p.preis_von)
        ? `<span class="mk-preis-wert">${euro(p.preis_von)} – ${euro(p.preis_bis)}</span>`
        : `<span class="mk-preis-wert">${t('price_from')} ${euro(p.preis_von)}</span>`
    }
    h += `<div class="mk-preis"><span>${t('offer_' + o.offer_type)}</span>${wert}</div>`
  }
  h += '</div>'
  if (u.preis_hinweis && STR[lang][u.preis_hinweis]) h += `<div class="mk-hinweis">${t(u.preis_hinweis)}</div>`
  return h
}

function konditionenBlock() {
  const z = []
  if (u.vorlauf_tage != null) z.push([t('lead'), u.vorlauf_tage + ' ' + t('days')])
  if (u.nutzungsrechte) z.push([t('rights'), u.nutzungsrechte])
  if (u.exklusivitaet) z.push([t('excl'), u.exklusivitaet])
  if (u.freigabe_schleifen != null) {
    z.push([t('rounds'), u.freigabe_schleifen === 1 ? t('round_one') : u.freigabe_schleifen + ' ' + t('rounds_n')])
  }
  if (!z.length) return ''
  return `<div class="mk-preise">${z.map(([a, b]) =>
    `<div class="mk-preis"><span>${es(a)}</span><span class="mk-preis-wert" style="font-weight:500;white-space:normal;text-align:right">${es(b)}</span></div>`).join('')}</div>`
}

function weitereBlock() {
  const plats = [
    { key: 'youtube', cls: 'yt', label: 'YouTube', url: 'https://youtube.com/@', fk: 'followers_youtube', fl: 'subscribers' },
    { key: 'threads', cls: 'th', label: 'Threads', url: 'https://threads.net/@', fk: 'followers_threads', fl: 'followers' }
  ]
  const zeilen = plats.map(p => {
    const handle = u[p.key + '_handle']
    if (!handle) return ''
    const clean = String(handle).replace(/^@/, '')
    const f = u[p.fk]
    return `<a class="mk-small-plat" href="${p.url}${encodeURIComponent(clean)}" target="_blank" rel="noopener">
      <div class="mk-small-left"><div class="mk-plat-icon ${p.cls}">${IKON[p.cls]}</div>
        <div><div style="font-size:13px;font-weight:600">${p.label}</div><div class="mk-small-lbl">@${es(clean)}</div></div></div>
      ${f != null ? `<div style="text-align:right"><div class="mk-small-followers">${fm(f)}</div><div class="mk-small-lbl">${t(p.fl)}</div></div>` : ''}
    </a>`
  }).join('')
  return zeilen || ''
}

function markenBlock() {
  if (!brands.length) return ''
  return `<div class="mk-brands">${brands.map(b => b.url
    ? `<a class="mk-brand" href="${es(nu(b.url))}" target="_blank" rel="noopener">${es(b.name)}<span class="mk-brand-arrow">↗</span></a>`
    : `<div class="mk-brand">${es(b.name)}</div>`).join('')}</div>`
}

function zeichne() {
  document.title = (u.display_name || 'Media Kit') + ' · Media Kit'

  const avatar = u.profile_image_url
    ? `<img src="${es(u.profile_image_url)}" alt="" onerror="this.parentElement.textContent='${es((u.display_name || '?')[0].toUpperCase())}'">`
    : es((u.display_name || '?')[0].toUpperCase())

  /* Der Pitch ist an Marken gerichtet, die Bio an Follower. Steht ein
     Pitch da, fuehrt er -- die Bio rutscht darunter und wird kleiner. */
  const kopf = `<div class="mk-hero">
      <div class="mk-avatar">${avatar}</div>
      <div class="mk-name">${es(u.display_name || '')}</div>
      <div class="mk-tags">${u.niche_category ? `<span class="mk-tag">${es(u.niche_category)}</span>` : ''}${u.city ? `<span class="mk-tag">${es(u.city)}</span>` : ''}</div>
      ${u.pitch ? `<p class="mk-pitch">${es(u.pitch)}</p>` : ''}
      ${u.bio ? `<p class="mk-bio">${es(u.bio)}</p>` : ''}
    </div>`

  const reichweite = plattformBlock('ig') + plattformBlock('tt')
  const gemessenIrgendwo = u.gemessen_am_instagram || u.gemessen_am_tiktok

  const koerper = [
    abschnitt(t('reach'), reichweite || null),
    abschnitt(t('posts'), beitraegeBlock(), gemessenIrgendwo ? etikett(gemessenIrgendwo) : ''),
    abschnitt(t('other_platforms'), weitereBlock()),
    abschnitt(t('audience'), zielgruppeBlock(), etikett(null)),
    abschnitt(t('offers'), leistungenBlock()),
    abschnitt(t('terms'), konditionenBlock()),
    abschnitt(t('brands'), markenBlock()),
    `<div class="mk-section"><div class="mk-label">${t('contact')}</div>
      ${u.contact_email ? `<div class="mk-email">${IKON.mail}<span>${es(u.contact_email)}</span></div>` : ''}
      <a class="mk-cta" href="mailto:${es(u.contact_email || '')}">${t('contact_btn')}</a></div>`
  ].join('')

  const fuss = `<div class="mk-footer">
      <div class="mk-lang">${['de','en','it'].map(l =>
        `<button class="mk-lang-btn${l === lang ? ' active' : ''}" data-lang="${l}" type="button">${l.toUpperCase()}</button>`).join('')}</div>
      <div>powered by <a href="https://viuno.de" target="_blank" rel="noopener">viuno</a>
        · <button type="button" id="btn-imprint" class="mk-drucken">${t('imprint')}</button>
        · <button type="button" id="btn-print" class="mk-drucken">${t('print')}</button></div>
    </div>`

  document.getElementById('main').innerHTML = `<div class="mk-main">${kopf}${koerper}${fuss}</div>`
  binde()
}

function binde() {
  document.querySelectorAll('.mk-lang-btn').forEach(b =>
    b.addEventListener('click', () => { setzeSprache(b.dataset.lang); zeichne() }))
  document.getElementById('btn-print')?.addEventListener('click', () => window.print())
  document.getElementById('btn-imprint')?.addEventListener('click', () => {
    const txt = (u.impressum_text || '').trim()
    const c = document.getElementById('imp-content')
    c.textContent = txt || t('imprint_empty')
    c.classList.toggle('imp-empty', !txt)
    document.getElementById('imp-sheet').classList.add('open')
    document.getElementById('imp-backdrop').classList.add('open')
    document.body.classList.add('imp-open')
  })
}

function schliesseImp() {
  document.getElementById('imp-sheet')?.classList.remove('open')
  document.getElementById('imp-backdrop')?.classList.remove('open')
  document.body.classList.remove('imp-open')
}

function setzeSprache(l) {
  lang = STR[l] ? l : 'de'
  document.documentElement.lang = lang
}

function slugAusPfad() {
  const p = location.pathname.replace(/^\/+|\/+$/g, '').split('/')
  return p.length >= 2 ? p[1] : null
}

async function laden() {
  const slug = slugAusPfad()
  if (!slug) return location.replace('https://viuno.de')

  const { data, error } = await sb.from('mediakit_public').select('*').ilike('display_name', slug).maybeSingle()
  if (error || !data) return location.replace('https://viuno.de')
  u = data

  const [b, o, p, bt] = await Promise.all([
    sb.from('mediakit_brands').select('*').eq('user_id', u.user_id).order('position', { ascending: true }),
    sb.from('mediakit_content_offers').select('*').eq('user_id', u.user_id),
    sb.from('mediakit_preise').select('*').eq('user_id', u.user_id),
    sb.from('mediakit_beitraege').select('*').eq('user_id', u.user_id).order('position', { ascending: true })
  ])
  brands = b.data ?? []; offers = o.data ?? []; preise = p.data ?? []; beitraege = bt.data ?? []

  const urlLang = new URLSearchParams(location.search).get('lang')
  const browser = (navigator.language || 'de').slice(0, 2)
  setzeSprache(
    ['de','en','it'].includes(urlLang) ? urlLang
    : ['de','en','it'].includes(u.default_language) ? u.default_language
    : ['de','en','it'].includes(browser) ? browser : 'de')

  zeichne()
  zaehle(u.user_id)

  document.getElementById('main').style.visibility = 'visible'
  const ld = document.getElementById('page-loader')
  if (ld) { ld.classList.add('hide'); setTimeout(() => ld.remove(), 250) }
}

/* Zaehlt wie die BioLink-Seite: ohne Cookie, ohne Wiedererkennung --
   nur Herkunft, Stunde und Sprache. Deshalb braucht auch das Kit
   keinen Banner. */
function zaehle(uid) {
  try {
    fetch(SB_URL + '/rest/v1/mediakit_aufrufe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SB_ANON,
                 Authorization: 'Bearer ' + SB_ANON, Prefer: 'return=minimal' },
      body: JSON.stringify({ user_id: uid, referrer_source: document.referrer || 'direct',
                             hour_of_day: new Date().getHours(), language: lang })
    })
  } catch (_) {}
}

/* CSS und Grundgeruest kommen von hier, damit die erzeugte Datei duenn
   bleibt und eine Layout-Aenderung keine Neuerzeugung braucht. */
const stil = document.createElement('style')
stil.textContent = CSS
document.head.appendChild(stil)

document.body.insertAdjacentHTML('beforeend',
  `<div class="imp-backdrop" id="imp-backdrop"></div>
   <div class="imp-sheet" id="imp-sheet"><div class="imp-handle"></div>
     <div class="imp-header"><span class="imp-title">Impressum</span>
       <button type="button" class="imp-close" id="imp-close">×</button></div>
     <div class="imp-content" id="imp-content"></div></div>`)

document.getElementById('imp-close').addEventListener('click', schliesseImp)
document.getElementById('imp-backdrop').addEventListener('click', schliesseImp)
document.addEventListener('keydown', e => { if (e.key === 'Escape') schliesseImp() })

laden()
