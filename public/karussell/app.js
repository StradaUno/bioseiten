// =====================================================================
// Swipe-File - Bedienoberflaeche
// ---------------------------------------------------------------------
// Eine statische Seite gegen die Edge Function "admin-api". Der
// Admin-Token wird einmal abgefragt und liegt danach in localStorage;
// er geht bei jeder Anfrage als Header X-Admin-Token mit.
//
// Die Seite rendert nichts und postet nichts - sie zeigt Vorlagen,
// laedt Bilder herunter und merkt sich, was daraus geworden ist.
// =====================================================================

const API = "https://dodglijurmtrbwnjivlg.supabase.co/functions/v1/admin-api";
const SCHLUESSEL = "viuno-admin-token";

const stand = document.getElementById("stand");
const liste = document.getElementById("liste");
const detail = document.getElementById("detail");
const konten = document.getElementById("konten");

let aktuelleAnsicht = "analyzed";
let filterQuelle = "";
let filterKeyword = "";
let filterTyp = "";
let filterArt = "";
/** Keywords fuer das Auswahlfeld und den Quellen-Tab. */
let keywordsCache = [];

// --- Zugang -------------------------------------------------------------
//
// Zwei Wege, und der erste ist der Normalfall:
//
//   1. Die Sitzung von viuno.de/admin. Die Seite liegt auf derselben
//      Herkunft, also liegt die Sitzung schon im localStorage - einmal
//      dort eingeloggt, und hier ist nichts mehr einzugeben.
//   2. Das feste Admin-Token. Dafuer, wenn ich gar nicht angemeldet bin.

/** Das Supabase-Projekt von viuno.de - dieselben Werte wie in /admin/. */
const VIUNO_URL = "https://bzejndghppuipnedasuv.supabase.co";
const VIUNO_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6ZWpuZGdocHB1aXBuZWRhc3V2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2NTMxOTcsImV4cCI6MjA4OTIyOTE5N30.TShH1cIABQCtKgLkhCS9ymUJ36ZUYnlvCnGTok6EKTo";

/** /karussell/?token geht an der Sitzung vorbei - siehe ausweis(). */
const NUR_TOKEN = new URLSearchParams(location.search).has("token");

/** Der Supabase-Client wird nur einmal geholt, und nur wenn er gebraucht wird. */
let viunoClient = null;

function viunoHolen() {
  if (!viunoClient) {
    viunoClient = import("https://esm.sh/@supabase/supabase-js@2")
      .then((m) =>
        m.createClient(VIUNO_URL, VIUNO_ANON, {
          auth: { persistSession: true, autoRefreshToken: true },
        })
      )
      .catch(() => null);
  }
  return viunoClient;
}

/** Die laufende Anmeldung - oder null. */
async function viunoSitzung() {
  try {
    const sb = await viunoHolen();
    if (!sb) return null;
    const { data } = await sb.auth.getSession();
    return data?.session ?? null;
  } catch {
    return null;
  }
}

// --- Anmelden -----------------------------------------------------------
//
// Wie auf /admin/: Die Seite meldet sich selbst an, statt auf eine Sitzung
// zu hoffen, die anderswo angelegt wurde. Das ist der Unterschied, auf den
// es ankommt - viuno.de und www.viuno.de sind getrennte Herkuenfte mit
// getrenntem Speicher, und ein Handy war ohnehin nie angemeldet. Wer sich
// hier anmelden kann, braucht nichts davon zu wissen.

const anmeldeFeld = document.getElementById("anmeldung");

function anmeldungZeigen(hinweis = "") {
  document.querySelector(".huelle").style.display = "none";
  anmeldeFeld.classList.add("sichtbar");
  document.getElementById("anmelde-hinweis").textContent = hinweis;
  document.getElementById("anmelde-mail").focus();
}

function anmeldungVerstecken() {
  anmeldeFeld.classList.remove("sichtbar");
  document.querySelector(".huelle").style.display = "";
}

/**
 * Gehoert dieses Konto hierher? Geprueft wird dasselbe Kennzeichen wie
 * auf /admin/. Die Antwort ist nur fuer die Meldung da - ob wirklich
 * etwas geht, entscheidet ohnehin admin-api bei jeder Anfrage.
 */
async function istAdmin(sb, benutzerId) {
  try {
    const { data } = await sb.from("users").select("is_admin").eq("id", benutzerId).maybeSingle();
    return data?.is_admin === true;
  } catch {
    return false;
  }
}

async function anmelden(email, passwort) {
  const sb = await viunoHolen();
  if (!sb) throw new Error("Die Supabase-Bibliothek ließ sich nicht laden.");

  const { data, error } = await sb.auth.signInWithPassword({ email, password: passwort });
  if (error) throw new Error("Falsche E-Mail oder falsches Passwort.");

  if (!(await istAdmin(sb, data.session.user.id))) {
    // Angemeldet bleiben waere hier eine Falle: Die Seite fände beim
    // naechsten Laden eine Sitzung, mit der sie nichts anfangen kann.
    await sb.auth.signOut();
    throw new Error("Dieses Konto hat keinen Admin-Zugriff.");
  }
  return data.session;
}

/**
 * Laeuft einmal beim Start. Gibt es schon eine gueltige Anmeldung, geht
 * es ohne Zutun weiter; sonst wartet die Seite auf das Formular.
 */
async function anmeldungSicherstellen() {
  // Die Notluke geht am Login vorbei - siehe NUR_TOKEN.
  if (NUR_TOKEN) return;

  const sitzung = await viunoSitzung();
  if (sitzung?.access_token) return;

  anmeldungZeigen(
    "Danach bleibst du in diesem Browser angemeldet – das Admin-Token brauchst du nicht mehr.",
  );

  await new Promise((fertig) => {
    const form = document.getElementById("anmelde-form");
    const knopf = document.getElementById("anmelde-knopf");
    const fehlerFeld = document.getElementById("anmelde-fehler");

    form.onsubmit = async (e) => {
      e.preventDefault();
      fehlerFeld.textContent = "";
      knopf.disabled = true;
      knopf.textContent = "Melde an …";
      try {
        await anmelden(
          document.getElementById("anmelde-mail").value.trim(),
          document.getElementById("anmelde-pw").value,
        );
        document.getElementById("anmelde-pw").value = "";
        anmeldungVerstecken();
        fertig();
      } catch (fehler) {
        fehlerFeld.textContent = fehler.message;
      } finally {
        knopf.disabled = false;
        knopf.textContent = "Einloggen";
      }
    };
  });
}

function token() {
  let wert = localStorage.getItem(SCHLUESSEL);
  if (!wert) {
    wert = prompt("Admin-Token eingeben:");
    if (wert) localStorage.setItem(SCHLUESSEL, wert.trim());
  }
  return wert ? wert.trim() : "";
}

/**
 * Womit weist sich diese Anfrage aus? Die Sitzung hat Vorrang; nach dem
 * Token wird nur gefragt, wenn es keine gibt.
 */
async function ausweis() {
  // Notluke: /karussell/?token erzwingt den Token-Weg. Gebraucht, wenn
  // ich mit einem Konto angemeldet bin, das hier nichts darf - sonst
  // bliebe die Seite verschlossen, obwohl ich das Token habe.
  const sitzung = NUR_TOKEN ? null : await viunoSitzung();
  if (sitzung?.access_token) {
    return { weg: "sitzung", kopf: { "Authorization": `Bearer ${sitzung.access_token}` } };
  }

  return { weg: "token", kopf: { "X-Admin-Token": token() } };
}

async function api(pfad, optionen = {}) {
  const { weg, kopf } = await ausweis();

  const antwort = await fetch(API + pfad, {
    ...optionen,
    headers: {
      ...kopf,
      "Content-Type": "application/json",
      ...(optionen.headers ?? {}),
    },
  });

  if (antwort.status === 401) {
    const grund = await fehlertext(antwort);
    if (weg === "sitzung") {
      // Sitzung abgelaufen oder Konto nicht mehr berechtigt: zurueck zum
      // Formular, statt den Benutzer in einer Fehlermeldung stehenzulassen.
      anmeldungZeigen(`${grund} Melde dich neu an.`);
      throw new Error(grund);
    }
    // Ein abgelehntes Token ist wertlos; beim naechsten Mal neu fragen.
    localStorage.removeItem(SCHLUESSEL);
    throw new Error("Token abgelehnt. Bitte neu laden und erneut eingeben.");
  }
  if (!antwort.ok) {
    throw new Error(await fehlertext(antwort));
  }
  return antwort;
}

const apiJson = async (pfad, optionen) => (await api(pfad, optionen)).json();

/**
 * Holt die Fehlermeldung aus der Antwort. Die Functions antworten mit
 * { error: "..." }; kommt etwas anderes, wird der Rohtext gekuerzt.
 */
async function fehlertext(antwort) {
  const roh = await antwort.text();
  try {
    const daten = JSON.parse(roh);
    if (daten?.error) return String(daten.error).slice(0, 300);
  } catch { /* kein JSON - dann eben der Rohtext */ }
  const sauber = roh.trim().replace(/\s+/g, " ");
  return sauber.length > 300 ? `${sauber.slice(0, 300)} …` : (sauber || `HTTP ${antwort.status}`);
}

// --- Liste --------------------------------------------------------------

/**
 * Zaehler fuer den jeweils juengsten Ladevorgang. Ein Reiterwechsel
 * waehrend eines laufenden Abrufs wuerde sonst die alte Antwort ueber die
 * neue schreiben - je nachdem, welche zuerst zurueckkommt.
 */
let ladeZaehler = 0;

async function listeLaden() {
  const meiner = ++ladeZaehler;
  const veraltet = () => meiner !== ladeZaehler;

  liste.innerHTML = '<p class="leer">Lade …</p>';
  const ohneFilter = aktuelleAnsicht === "quellen" || aktuelleAnsicht === "runs";
  document.getElementById("filter").hidden = ohneFilter;
  // Im Reiter "Meine Funde" steht die Quelle fest - dort zaehlt der Typ.
  const eigene = aktuelleAnsicht === "funde";
  document.getElementById("filter-quelle").hidden = eigene;
  document.getElementById("filter-keyword").hidden = eigene;
  document.getElementById("filter-art").hidden = eigene;
  document.getElementById("filter-typ").hidden = !eigene;
  // Einen eigenen Link einreihen ergibt nur in einer Beitragsliste Sinn.
  document.querySelector(".einreihen").hidden = ohneFilter;

  try {
    if (aktuelleAnsicht === "quellen") return await quellenZeichnen();
    if (aktuelleAnsicht === "runs") return await runsZeichnen();

    // "Meine Funde" ist kein Zustand, sondern eine Herkunft: alles, was
    // ich selbst eingereiht habe, quer ueber alle Zustaende.
    const eigeneFunde = aktuelleAnsicht === "funde";
    const parameter = new URLSearchParams({
      status: eigeneFunde ? "alle" : aktuelleAnsicht,
    });
    if (eigeneFunde) {
      parameter.set("source", "manual");
      if (filterTyp) parameter.set("type", filterTyp);
    } else {
      if (filterQuelle) parameter.set("source", filterQuelle);
      if (filterKeyword) parameter.set("keyword_id", filterKeyword);
      if (filterArt) parameter.set("kind", filterArt);
    }

    const daten = await apiJson(`/posts?${parameter}`);
    if (veraltet()) return;

    await eigeneOffenLaden();
    if (veraltet()) return;

    meineNormalwerte = daten.meine ?? null;
    zeichneListe(daten.posts ?? []);
    await offeneMelden();
  } catch (fehler) {
    if (veraltet()) return;
    liste.innerHTML = "";
    melde(fehler.message, true);
  }
}

/** Was bei mir normal ist - nur im Reiter "Veroeffentlicht" gefuellt. */
let meineNormalwerte = null;

/**
 * Meine eigenen Beitraege ohne Zuordnung. Nur im Reiter "Geplant"
 * gebraucht, deshalb auch nur dort geholt.
 */
let eigeneOffen = [];

async function eigeneOffenLaden() {
  if (aktuelleAnsicht !== "planned") { eigeneOffen = []; return; }
  try {
    const { eigene } = await apiJson("/own/offen");
    eigeneOffen = eigene ?? [];
  } catch {
    eigeneOffen = [];
  }
}

/** Weist auf Beitraege hin, die noch nicht bewertet sind. */
async function offeneMelden() {
  if (aktuelleAnsicht !== "analyzed") return;
  try {
    const offen = await apiJson("/posts?status=new");
    if (offen.anzahl > 0) {
      melde(`${offen.anzahl} gefunden, aber ausserhalb der Top 30 – unbewertet.`);
    }
  } catch { /* nicht so wichtig */ }
}

/**
 * Die zuletzt geladene Liste. Ein Statuswechsel aendert nur die eine
 * betroffene Karte - erst das naechste ausdrueckliche Laden holt wieder
 * alles vom Server.
 */
let aktuellePosts = [];

function zeichneListe(posts) {
  aktuellePosts = posts;

  if (posts.length === 0) {
    liste.innerHTML = `<p class="leer">${text(LEER[aktuelleAnsicht] ?? "Hier ist noch nichts.")}</p>`;
    return;
  }

  liste.innerHTML = "";
  if (aktuelleAnsicht === "published" && meineNormalwerte) {
    liste.insertAdjacentHTML("beforeend", normalzeile(meineNormalwerte));
  }
  for (const post of posts) {
    const analyse = post.analyse ?? {};
    const karte = document.createElement("article");
    // Im Reiter "Meine Funde" ist ohnehin alles von mir - dort waere die
    // lilafarbene Hervorhebung nur Rauschen.
    karte.className = post.kind === "news"
      ? "karte news"
      : post.source === "manual" && aktuelleAnsicht !== "funde"
      ? "karte manual"
      : "karte";
    karte.dataset.post = post.id;
    const handle = post.owner_handle ?? post.accounts?.handle ?? "?";
    // Im Reiter "Meine Funde" ist jede Karte von mir - das dazuzuschreiben
    // waere zwoelfmal dasselbe.
    const quelle = post.source === "manual"
      ? (aktuelleAnsicht === "funde" ? "" : '<span class="quelle-badge manual">von dir</span>')
      : post.source === "keyword"
      ? `<span class="quelle-badge keyword">${text(post.keyword_term ?? "Keyword")}</span>`
      : `<span class="quelle-badge">Account</span>`;

    karte.innerHTML = `
      <div class="karte-oben">
        <div class="vorschau">
          ${post.vorschau ? `<img src="${text(post.vorschau)}" alt="" loading="lazy">` : '<img alt="">'}
          ${post.type === "reel" ? '<span class="play">▶</span>' : ""}
        </div>
        <div class="karte-text">
          <div class="zeile1">
            <span class="handle">@${text(handle)}</span>
            ${badge(analyse.relevance)}
          </div>
          <p class="meta">${
      post.kind === "news" ? '<span class="news-badge">News</span>' + alterBadge(post.posted_at) : ""
    }${quelle}${typBadge(post)}${datum(post.posted_at)} · ${zahl(post.likes)} Likes · ${
      zahl(post.comments)
    } Kommentare${post.type === "carousel" ? ` · ${post.slide_count} Slides` : ""}</p>
          <p class="meta">
            ${post.views ? `<span class="views-badge">${zahl(post.views)} Aufrufe</span>` : ""}
            Engagement <b class="kennzahl">${kommazahl(post.engagement)}</b>${
      post.outlier ? ` · Ausreisser <b class="kennzahl">${kommazahl(post.outlier)}×</b>` : ""
    }
          </p>
          ${zustandZeile(post)}
          <p class="zusammenfassung">${
      text(
        analyse.summary ??
          (post.type === "carousel"
            ? "Noch nicht bewertet – ausserhalb der Top 30."
            : "Reels und Bilder werden nicht bewertet – nur die Zahlen zählen."),
      )
    }</p>
        </div>
      </div>
      ${vergleichsBlock(post)}
      ${zuordnungsFeld(post)}`;

    // Der Klick auf die Karte oeffnet die Detailansicht - die Auswahl zur
    // Zuordnung ist davon ausgenommen, sonst geht bei jedem Tippen der
    // Dialog auf.
    karte.querySelector(".karte-oben").addEventListener("click", () => detailOeffnen(post.id));
    const zuordnung = karte.querySelector("[data-zuordnen]");
    if (zuordnung) {
      zuordnung.onclick = () => zuordnen(post.id, karte.querySelector("[data-eigene]").value, zuordnung);
    }
    liste.appendChild(karte);
  }
}

/**
 * Was ist bei mir normal? Ohne diese Zeile sagt "84 Likes" nichts - mit
 * ihr sieht man, ob die nachgebauten Karussells ueber dem eigenen Schnitt
 * liegen oder darunter.
 */
function normalzeile(meine) {
  if (!meine || meine.median_likes_alle === null) return "";
  const nachgebaut = meine.median_likes_nachgebaut;
  return `<p class="normalzeile">
    Median deiner Likes: <b>${zahl(meine.median_likes_alle)}</b>
    über ${zahl(meine.beitraege_gesamt)} Beiträge${
    nachgebaut === null || nachgebaut === undefined
      ? ""
      : ` · <b>${zahl(nachgebaut)}</b> bei den nachgebauten`
  }
  </p>`;
}

/**
 * Im Reiter "Veroeffentlicht": das Original neben meinem Beitrag, dazu
 * das Verhaeltnis. Das ist die Zahl, um die es am Ende geht - alles
 * andere war Vorarbeit.
 */
function vergleichsBlock(post) {
  if (aktuelleAnsicht !== "published") return "";
  const eigener = ersterEintrag(post.own_posts);
  if (!eigener) return "";

  const reihe = (likes, comments, views) =>
    `${zahl(likes)} Likes · ${zahl(comments)} Komm.${views ? ` · ${zahl(views)} Aufrufe` : ""}`;

  // Verglichen werden die Likes, nicht das Engagement: Das Original hat
  // eine andere Followerzahl, aber die Likes sind das, was ich sehe.
  const anteil = Number(post.likes) > 0
    ? (Number(eigener.likes ?? 0) / Number(post.likes)) * 100
    : null;
  const stufe = anteil === null ? "" : anteil >= 25 ? "gut" : anteil >= 5 ? "mittel" : "";

  return `<div class="vergleich">
    <div class="seite">
      <div class="titel">Original</div>
      <div class="zahlenreihe">${reihe(post.likes, post.comments, post.views)}</div>
    </div>
    <div class="verhaeltnis ${stufe}">${anteil === null ? "–" : `${kommazahl(anteil)} %`}</div>
    <div class="seite">
      <div class="titel">Bei dir</div>
      <div class="zahlenreihe">${reihe(eigener.likes, eigener.comments, eigener.views)}</div>
    </div>
  </div>`;
}

/**
 * Im Reiter "Geplant": Welcher meiner eigenen Beitraege ist die Umsetzung
 * dieser Vorlage? Der Normalfall ist, dass die Zuordnung das von allein
 * erkennt; das hier ist fuer die Faelle, in denen sie es nicht tut.
 */
function zuordnungsFeld(post) {
  if (aktuelleAnsicht !== "planned" || eigeneOffen.length === 0) return "";

  const zeile = (e) => {
    const anfang = (e.caption ?? "").replace(/\s+/g, " ").trim().slice(0, 45);
    return `${datum(e.posted_at)} · ${e.type === "reel" ? "Reel" : e.type === "image" ? "Bild" : "Karussell"}${
      anfang ? ` · ${anfang}…` : ""
    }`;
  };

  return `<div class="zuordnen">
    <label>Ist dieser eigene Post</label>
    <select data-eigene>
      ${eigeneOffen.map((e) => `<option value="${text(e.shortcode)}">${text(zeile(e))}</option>`).join("")}
    </select>
    <button data-zuordnen>Zuordnen</button>
  </div>`;
}

/**
 * Eine Zeile zum Zustand - aber nur, wo sie etwas hinzufuegt. Im Reiter
 * "Neu" weiss man ohnehin, dass nichts entschieden ist.
 */
function zustandZeile(post) {
  if (post.status === "planned") {
    return `<p class="meta zustand geplant">Zum Nachbauen vorgemerkt${
      post.planned_at ? ` · ${datum(post.planned_at)}` : ""
    }</p>`;
  }
  if (post.status === "published") {
    return `<p class="meta zustand veroeffentlicht">Veröffentlicht${
      post.published_at ? ` · ${datum(post.published_at)}` : ""
    }</p>`;
  }
  return "";
}

/** Was steht da, wenn ein Reiter leer ist? */
const LEER = {
  analyzed: "Nichts Neues. Hol dir frische Karussells.",
  planned: "Nichts vorgemerkt. Auf einer Karte ‚Nachbauen‘ drücken.",
  published: "Noch nichts veröffentlicht. Was du nachgebaut und gepostet hast, landet sonntags von allein hier.",
  rejected: "Nichts verworfen.",
  funde: "Noch nichts selbst eingereiht. Instagram-Link oben einfügen – Karussell, Reel oder Bild.",
};

/**
 * Bei News ist das Alter die wichtigste Zahl auf der Karte - deshalb steht
 * es vorn und nicht im Kleingedruckten.
 */
function alterBadge(zeitpunkt) {
  if (!zeitpunkt) return "";
  const tage = Math.floor((Date.now() - new Date(zeitpunkt).getTime()) / 86_400_000);
  if (!Number.isFinite(tage) || tage < 0) return "";
  const text_ = tage === 0 ? "heute" : tage === 1 ? "gestern" : `vor ${tage} Tagen`;
  return `<span class="alter-badge${tage <= 3 ? " frisch" : ""}">${text_}</span>`;
}

/** Reel oder Bild werden benannt; ein Karussell ist der Normalfall. */
function typBadge(post) {
  if (post.type === "reel") return '<span class="typ-badge">Reel</span>';
  if (post.type === "image") return '<span class="typ-badge">Bild</span>';
  return "";
}

function badge(relevanz) {
  if (relevanz === null || relevanz === undefined) return "";
  const stufe = relevanz >= 8 ? "gut" : relevanz >= 5 ? "mittel" : "schwach";
  return `<span class="badge ${stufe}">${relevanz}/10</span>`;
}

// --- Detail -------------------------------------------------------------

async function detailOeffnen(id) {
  detail.innerHTML = '<p class="leer">Lade …</p>';
  detail.showModal();

  try {
    const { post, bilder, kennzahlen } = await apiJson(`/post/${id}`);
    zeichneDetail(post, bilder, kennzahlen ?? {});
  } catch (fehler) {
    detail.innerHTML = `<p class="leer">${text(fehler.message)}</p>`;
  }
}

function zeichneDetail(post, bilder, kennzahlen = {}) {
  const a = post.analyse ?? {};
  const eigener = ersterEintrag(post.own_posts);

  const kopfHandle = post.owner_handle ?? post.accounts?.handle ?? "?";

  detail.innerHTML = `
    <div class="detail-kopf">
      <strong>@${text(kopfHandle)}</strong>
      ${badge(a.relevance)}
      <button class="still" id="zu">Schließen</button>
    </div>
    <div class="detail-inhalt">
      <div class="streifen">
        <button class="pfeil links" id="vor" aria-label="Zurück">‹</button>
        <div class="bilder" id="bilder">
          ${
    bilder.map((b) => `<img src="${b.url}" alt="Slide ${b.position}" loading="lazy">`).join("")
  }
        </div>
        <button class="pfeil rechts" id="zurueck" aria-label="Weiter">›</button>
      </div>
      <p class="zaehler" id="zaehler">1 / ${bilder.length}</p>

      ${zahlenUebersicht(post, kennzahlen)}

      ${a.viuno_hook ? abschnitt("Hook-Vorschlag", `<p class="kopierbar">${text(a.viuno_hook)}</p>`) : ""}

      ${
    post.kind === "news" && a.summary
      ? abschnitt(
        "Was ist neu",
        `<p>${text(a.summary)}</p>${
          a.absender ? `<p class="meta">Absender: ${text(a.absender)}</p>` : ""
        }`,
      )
      : ""
  }

      ${
    a.relevance_reason
      ? abschnitt(
        post.kind === "news" ? "Warum das für dich zählt" : "Bewertung",
        `<p>${text(a.relevance_reason)}</p>${
          a.structure ? `<p class="meta">Aufbau: ${text(a.structure)}</p>` : ""
        }`,
      )
      : ""
  }

      ${
    liste_(a.why_it_works)
      ? abschnitt("Warum es funktioniert", punkte(a.why_it_works))
      : ""
  }

      ${
    liste_(a.viuno_fit)
      ? abschnitt(
        post.kind === "news" ? "Gliederung deines Karussells" : "So baust du es für viuno um",
        `<ul class="punkte">${
          a.viuno_fit.map((f) =>
            `<li><span class="fit-slide">Slide ${zahl(f.slide)}:</span> ${
              text(ohneSlideNummer(f.vorschlag))
            }</li>`
          ).join("")
        }</ul>`,
      )
      : ""
  }

      ${
    a.caption_de
      ? abschnittMitKopieren("Caption", a.caption_de, `<p class="kopierbar">${text(a.caption_de)}</p>`)
      : ""
  }

      ${
    liste_(a.hashtags)
      ? abschnittMitKopieren(
        "Hashtags",
        a.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" "),
        `<p class="kopierbar">${text(a.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" "))}</p>`,
      )
      : ""
  }

      ${eigener ? zahlenBlock(post, eigener) : ""}

      <div class="aktionen">
        ${
    post.type !== "carousel" && !a.caption_de
      ? '<button class="breit" id="caption">Caption schreiben (≈0,3 ct)</button>'
      : ""
  }
        <button class="primaer breit" id="zip">${
    post.type === "carousel" ? "Bilder laden (ZIP)" : "Bild laden (ZIP)"
  }</button>
        <div class="paar">
          <button id="geplant">${
    post.status === "planned"
      ? "Doch nicht"
      : post.status === "published"
      ? "Zuordnung lösen"
      : "Nachbauen"
  }</button>
          <button id="verworfen">${post.status === "rejected" ? "Zurückholen" : "Verwerfen"}</button>
        </div>
      </div>
      <a class="original" href="${post.url ?? "#"}" target="_blank" rel="noopener">Original auf Instagram ansehen</a>
    </div>`;

  karussellSteuern(bilder.length);

  // Schliessen heisst schliessen - die Liste steht schon, ein erneuter
  // Abruf wuerde nur Wartezeit erzeugen.
  detail.querySelector("#zu").onclick = () => detail.close();
  detail.querySelector("#zip").onclick = (e) => zipLaden(post.id, post.shortcode, e.target);
  const captionKnopf = detail.querySelector("#caption");
  if (captionKnopf) captionKnopf.onclick = (e) => captionSchreiben(post.id, e.target);
  // "Nachbauen" fragt nichts mehr ab. Den eigenen Beitrag findet spaeter
  // die Zuordnung von allein - siehe scrape-own. Bei einem bereits
  // zugeordneten Beitrag heisst derselbe Knopf "Zuordnung lösen": Er
  // stellt ihn zurueck auf vorgemerkt und gibt meinen Beitrag wieder frei.
  detail.querySelector("#geplant").onclick = () =>
    statusSetzen(post.id, post.status === "planned" ? "analyzed" : "planned");
  detail.querySelector("#verworfen").onclick = () =>
    statusSetzen(post.id, post.status === "rejected" ? "analyzed" : "rejected");
  for (const knopf of detail.querySelectorAll("[data-kopieren]")) {
    knopf.onclick = () => kopieren(knopf.dataset.kopieren, knopf);
  }
}

/**
 * Die Zahlen des Beitrags, bevor irgendein Text kommt. Erst was messbar
 * ist, dann was das Modell dazu meint.
 *
 * Die beiden Balken sind der eigentliche Punkt: "Engagement 18,0" sagt
 * nichts, "doppelt so hoch wie der Median der Liste" sagt alles.
 */
function zahlenUebersicht(post, kennzahlen) {
  const herkunft = post.source === "manual"
    ? "Von dir eingereiht"
    : post.source === "keyword"
    ? `Über „${text(post.keyword_term ?? "?")}“ gefunden`
    : "Aus einem beobachteten Account";

  const zelle = (wert, was) => `<div><div class="wert">${wert}</div><div class="was">${was}</div></div>`;
  const zellen = [
    zelle(zahl(post.likes), "Likes"),
    zelle(zahl(post.comments), "Kommentare"),
    post.views ? zelle(zahl(post.views), "Aufrufe") : "",
    zelle(post.owner_followers ? zahl(post.owner_followers) : "–", "Follower"),
    zelle(kommazahl(post.engagement), "Engagement"),
    post.outlier ? zelle(`${kommazahl(post.outlier)}×`, "Ausreißer") : "",
    zelle(alterInTagen(post.posted_at), "Alter"),
    zelle(zahl(post.slide_count), post.type === "reel" ? "Video" : "Slides"),
  ].filter(Boolean);

  return `<h2>Zahlen</h2>
    <div class="block">
      <p class="meta">${herkunft} · @${text(post.owner_handle ?? post.accounts?.handle ?? "?")}</p>
      <div class="kennzahlen">${zellen.join("")}</div>
      ${balken(
        "Engagement gegen den Median der Liste",
        Number(post.engagement),
        Number(kennzahlen.median_engagement_liste),
        (w) => kommazahl(w),
      )}
      ${balken(
        "Likes gegen den Median des Kontos",
        Number(post.likes),
        Number(kennzahlen.median_likes_urheber),
        (w) => zahl(w),
      )}
    </div>`;
}

/**
 * Ein Balken mit Markierung: Die Fuellung ist der Wert des Beitrags, der
 * Strich der Vergleichswert. Die Skala reicht bis zum Doppelten des
 * Vergleichswerts - so sitzt "genau normal" immer in der Mitte und man
 * sieht auf einen Blick, auf welcher Seite man steht.
 */
function balken(titel, wert, vergleich, formatieren) {
  if (!Number.isFinite(wert) || !Number.isFinite(vergleich) || vergleich <= 0) {
    return `<div class="balken">
      <div class="kopf"><span>${text(titel)}</span></div>
      <p class="fuss">Kein Vergleichswert vorhanden.</p>
    </div>`;
  }

  const skala = vergleich * 2;
  const anteil = Math.min(100, (wert / skala) * 100);
  const faktor = wert / vergleich;
  const stufe = faktor >= 1.2 ? "gut" : faktor <= 0.8 ? "schwach" : "";

  return `<div class="balken">
    <div class="kopf">
      <span>${text(titel)}</span>
      <b>${kommazahl(faktor)}×</b>
    </div>
    <div class="spur">
      <div class="fuellung ${stufe}" style="width:${anteil.toFixed(1)}%"></div>
      <div class="marke" style="left:50%"></div>
    </div>
    <p class="fuss">${formatieren(wert)} gegenüber ${formatieren(vergleich)}${
    wert > skala ? " · Balken bei 2× abgeschnitten" : ""
  }</p>
  </div>`;
}

/** Alter in Tagen - die Zahl, die beim Nachbauen zaehlt. */
function alterInTagen(zeitpunkt) {
  if (!zeitpunkt) return "–";
  const tage = Math.floor((Date.now() - new Date(zeitpunkt).getTime()) / 86_400_000);
  if (!Number.isFinite(tage) || tage < 0) return "–";
  return tage === 0 ? "heute" : `${zahl(tage)} T`;
}

function abschnitt(titel, inhalt) {
  return `<h2>${titel}</h2><div class="block">${inhalt}</div>`;
}

function abschnittMitKopieren(titel, rohtext, inhalt) {
  return `<h2 class="kopf-mit-knopf">${titel}
    <button data-kopieren="${text(rohtext)}">Kopieren</button></h2>
    <div class="block">${inhalt}</div>`;
}

function punkte(eintraege) {
  return `<ul class="punkte">${eintraege.map((p) => `<li>${text(p)}</li>`).join("")}</ul>`;
}

function zahlenBlock(post, eigener) {
  const zelle = (wert, was) => `<div><div class="wert">${wert ?? "–"}</div><div class="was">${was}</div></div>`;
  return `<h2>Original gegen deinen Beitrag</h2>
    <div class="zahlen">
      ${zelle(zahl(post.likes), "Likes Original")}
      ${zelle(zahl(eigener.likes), "Likes bei dir")}
      ${zelle(zahl(post.comments), "Kommentare Original")}
      ${zelle(zahl(eigener.comments), "Kommentare bei dir")}
      ${eigener.views ? zelle(zahl(eigener.views), "Aufrufe bei dir") : ""}
    </div>
    <p class="meta" style="margin-top:8px">Dein Beitrag vom ${datum(eigener.posted_at)}${
    eigener.fetched_at ? ` · Zahlen vom ${datum(eigener.fetched_at)}` : ""
  }</p>`;
}

/** Wischen per Scroll, dazu die beiden Pfeile. */
function karussellSteuern(anzahl) {
  const bilder = detail.querySelector("#bilder");
  const zaehler = detail.querySelector("#zaehler");
  if (!bilder) return;

  const springe = (richtung) => {
    const breite = bilder.firstElementChild?.getBoundingClientRect().width ?? 0;
    bilder.scrollBy({ left: (breite + 10) * richtung, behavior: "smooth" });
  };
  detail.querySelector("#vor").onclick = () => springe(-1);
  detail.querySelector("#zurueck").onclick = () => springe(1);

  bilder.addEventListener("scroll", () => {
    const breite = bilder.firstElementChild?.getBoundingClientRect().width ?? 1;
    const index = Math.round(bilder.scrollLeft / (breite + 10)) + 1;
    zaehler.textContent = `${Math.min(Math.max(index, 1), anzahl)} / ${anzahl}`;
  }, { passive: true });
}

// --- Aktionen -----------------------------------------------------------

async function zipLaden(id, shortcode, knopf) {
  const alt = knopf.textContent;
  knopf.textContent = "Packe …";
  knopf.disabled = true;
  try {
    const antwort = await api(`/zip/${id}`);
    const blob = await antwort.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${shortcode}.zip`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
    knopf.textContent = "Geladen";
  } catch (fehler) {
    knopf.textContent = alt;
    alert(`Download fehlgeschlagen: ${fehler.message}`);
  } finally {
    knopf.disabled = false;
    setTimeout(() => { knopf.textContent = alt; }, 2500);
  }
}

/**
 * Setzt den Status und nimmt das Ergebnis vorweg: Die Karte verschwindet
 * sofort aus der Liste, wenn sie nicht mehr in den offenen Tab gehoert.
 * Geht der Aufruf schief, kommt sie an ihre alte Stelle zurueck.
 */
async function statusSetzen(id, status) {
  const index = aktuellePosts.findIndex((p) => p.id === id);
  const vorher = index === -1 ? null : aktuellePosts[index];
  const karte = liste.querySelector(`[data-post="${id}"]`);
  const gehoertHierher = status === aktuelleAnsicht;

  // Vorwegnehmen: Karte raus oder Status anpassen.
  if (vorher) {
    if (gehoertHierher) {
      aktuellePosts[index] = { ...vorher, status };
    } else {
      aktuellePosts.splice(index, 1);
      if (karte) karte.remove();
      leerHinweisPruefen();
    }
  }
  detail.close();

  try {
    await apiJson(`/post/${id}/status`, {
      method: "POST",
      body: JSON.stringify({ status }),
    });
  } catch (fehler) {
    // Zuruecknehmen: Karte wieder an ihren Platz.
    if (vorher) {
      aktuellePosts.splice(index, 0, vorher);
      zeichneListe(aktuellePosts);
    }
    melde(`Status nicht gespeichert: ${fehler.message}`, true);
  }
}

/** Zuordnung von Hand: Vorlage und eigener Beitrag gehoeren zusammen. */
async function zuordnen(postId, ownShortcode, knopf) {
  if (!ownShortcode) return;
  const alt = knopf.textContent;
  knopf.textContent = "…";
  knopf.disabled = true;
  try {
    await apiJson(`/post/${postId}/zuordnen`, {
      method: "POST",
      body: JSON.stringify({ own_shortcode: ownShortcode }),
    });
    melde("Zugeordnet – der Beitrag steht jetzt unter ‚Veröffentlicht‘.");
    await listeLaden();
  } catch (fehler) {
    knopf.textContent = alt;
    knopf.disabled = false;
    melde(fehler.message, true);
  }
}

/** Zeigt den Leer-Hinweis, sobald die letzte Karte verschwunden ist. */
function leerHinweisPruefen() {
  if (aktuellePosts.length > 0) return;
  zeichneListe([]);
}

/**
 * Holt Hook, Caption und Hashtags fuer ein Reel oder Einzelbild nach.
 * Bewertet wird dabei nichts - dafuer gibt es bei diesen Typen nichts
 * zu bewerten.
 */
async function captionSchreiben(id, knopf) {
  const alt = knopf.textContent;
  knopf.textContent = "Schreibe …";
  knopf.disabled = true;
  try {
    await apiJson(`/post/${id}/caption`, { method: "POST" });
    await detailOeffnen(id);
  } catch (fehler) {
    knopf.textContent = alt;
    knopf.disabled = false;
    alert(fehler.message);
  }
}

async function kopieren(inhalt, knopf) {
  try {
    await navigator.clipboard.writeText(inhalt);
    const alt = knopf.textContent;
    knopf.textContent = "Kopiert";
    setTimeout(() => { knopf.textContent = alt; }, 1600);
  } catch {
    alert("Kopieren hat nicht geklappt – bitte von Hand markieren.");
  }
}

// --- Quellen-Tab --------------------------------------------------------

/** Quellen-Bewertungen, nach "art:id" aufgeschluesselt. */
let bewertungen = new Map();

async function bewertungenLaden() {
  try {
    const { scores } = await apiJson("/scores");
    bewertungen = new Map((scores ?? []).map((s) => [`${s.source_type}:${s.source_id}`, s]));
  } catch {
    bewertungen = new Map();
  }
}

/**
 * Zeigt Gewicht und Automatik-Entscheid einer Quelle. Das Gewicht steuert,
 * wie viele Ergebnisse sie im naechsten Lauf bekommt.
 */
function bewertungZeile(art, id) {
  const b = bewertungen.get(`${art}:${id}`);
  if (!b) return "";

  const gewicht = Number(b.weight ?? 1);
  const stufe = gewicht >= 1.5 ? "hoch" : gewicht <= 0.75 ? "niedrig" : "normal";
  const eigene = b.own_perf_ratio === null || b.own_perf_ratio === undefined
    ? ""
    : ` · deine Zahlen ${kommazahl(b.own_perf_ratio)}×`;

  return `<div class="quelle-lernen">
    <span class="gewicht ${stufe}">Gewicht ${kommazahl(gewicht)}×</span>
    ${b.manual_override ? '<span class="von-hand">von Hand</span>' : ""}
    <span class="grund">${text(b.last_reason ?? "")}${eigene}</span>
  </div>`;
}

async function quellenZeichnen() {
  await bewertungenLaden();
  const [keywords, accounts, einstellungen] = await Promise.all([
    apiJson("/keywords"),
    apiJson("/accounts"),
    apiJson("/settings").catch(() => ({ settings: [] })),
  ]);
  const ownHandle =
    (einstellungen.settings ?? []).find((e) => e.key === "own_handle")?.value ?? "";
  keywordsCache = keywords.keywords ?? [];
  keywordAuswahlFuellen();

  const konten = accounts.accounts ?? [];
  const nachZustand = (zustand) => konten.filter((k) => k.status === zustand);
  // News-Quellen haben einen eigenen Abschnitt; die Kandidatenliste bleibt
  // gemeinsam, dort taucht ohnehin nie eine News-Quelle auf.
  const news = konten.filter((k) => k.kind === "news");
  const tipps = konten.filter((k) => k.kind !== "news");

  liste.innerHTML = `
    <div class="bereich-titel">Mein Konto
      <span class="klein">von hier kommen die Zahlen, an denen alles gemessen wird</span></div>
    <div class="feld">
      <input id="eigenes-konto" placeholder="dein handle" autocapitalize="none"
             autocorrect="off" spellcheck="false" value="${text(ownHandle)}">
      <button class="primaer" id="eigenes-speichern">Merken</button>
    </div>

    <div class="bereich-titel">Suchbegriffe
      <span class="klein">stark, aber älter · max. 180 Tage, ab 300 Likes</span></div>
    <div class="feld">
      <input id="neues-keyword" placeholder="neuer Suchbegriff" autocapitalize="none">
      <select id="neue-sprache" style="flex:0 0 72px">
        <option value="de">de</option><option value="en">en</option>
      </select>
      <select id="neue-art" style="flex:0 0 96px">
        <option value="keyword">Suche</option><option value="hashtag">Hashtag</option>
      </select>
      <button class="primaer" id="keyword-hinzu">Hinzufügen</button>
    </div>
    ${keywordsCache.filter((k) => k.kind !== "hashtag").map(keywordKarte).join("")}

    <div class="bereich-titel">Hashtags
      <span class="klein">taufrisch, kleinere Konten · max. 14 Tage, ab 50 Likes</span></div>
    ${keywordsCache.filter((k) => k.kind === "hashtag").map(keywordKarte).join("")}

    <div class="bereich-titel">News-Quellen (fest)
      <span class="klein">Neuigkeiten statt Vorlagen · alle Beitragsarten, max. 14 Tage · fliegen nie automatisch raus</span></div>
    <div class="feld">
      <input id="neue-news" placeholder="handle" autocapitalize="none" autocorrect="off">
      <button class="primaer" id="news-hinzu">Hinzufügen</button>
    </div>
    ${news.map(kontoKarte).join("") || '<p class="leer" style="padding:18px 0">Noch keine News-Quelle.</p>'}

    <div class="bereich-titel">Accounts
      <span class="klein">${tipps.filter((k) => k.status === "active").length} aktiv · ${
    nachZustand("candidate").length
  } Kandidaten · ${tipps.filter((k) => k.status === "inactive").length} inaktiv</span>
    </div>
    <div class="feld">
      <input id="neues-konto" placeholder="handle" autocapitalize="none" autocorrect="off">
      <button class="primaer" id="konto-hinzu">Hinzufügen</button>
      <label class="haekchen">
        <input type="checkbox" id="neues-konto-fest">
        <span>Fest – fliegt nie automatisch raus, auch wenn es nichts findet</span>
      </label>
    </div>
    ${tipps.filter((k) => k.status === "active").map(kontoKarte).join("")}
    ${
    nachZustand("candidate").length > 0
      ? `<div class="bereich-titel">Kandidaten aus dem Schneeball
           <span class="klein">Klick aktiviert</span></div>` +
        nachZustand("candidate").map(kontoKarte).join("")
      : ""
  }
    ${
    tipps.filter((k) => k.status === "inactive").length > 0
      ? `<div class="bereich-titel">Stillgelegt <span class="klein">drei Läufe ohne Fund</span></div>` +
        tipps.filter((k) => k.status === "inactive").map(kontoKarte).join("")
      : ""
  }`;

  quellenAktionen();
}

function keywordKarte(k) {
  const art = k.kind === "hashtag" ? "#" : "Suche";
  return `<div class="quelle-karte">
    <div class="quelle-kopf">
      <strong>${k.kind === "hashtag" ? "#" : ""}${text(k.term)}
        <span class="sprache">${text(k.lang)}</span>
        <span class="sprache">${art}</span></strong>
      <button class="schalter" data-keyword="${k.id}" data-aktiv="${k.active}">
        <span class="${k.active ? "an" : "aus"}">${k.active ? "aktiv" : "pausiert"}</span>
      </button>
    </div>
    <div class="quelle-zahlen">
      <span>gefunden <b>${zahl(k.posts_found)}</b></span>
      <span>in Top 30 <b>${zahl(k.posts_in_top30)}</b></span>
      <span>gepostet <b>${zahl(k.posts_posted)}</b></span>
      <span>Ø Relevanz <b>${k.avg_relevance ?? "–"}</b></span>
      <span>Ø Engagement <b>${kommazahl(k.avg_engagement)}</b></span>
    </div>
    ${bewertungZeile(k.kind === "hashtag" ? "hashtag" : "keyword", k.id)}
  </div>`;
}

function kontoKarte(k) {
  const naechster = k.status === "active" ? "inactive" : "active";
  return `<div class="quelle-karte${k.pinned ? " fest" : ""}">
    <div class="quelle-kopf">
      <strong>${k.pinned ? '<span class="nadel">📌</span>' : ""}@${text(k.handle)}</strong>
      <span class="quelle-knoepfe">
        <button class="schalter" data-konto="${k.id}" data-ziel="${naechster}">
          <span class="${k.status === "active" ? "an" : "aus"}">${
    k.status === "active" ? "aktiv" : k.status === "candidate" ? "aktivieren" : "stillgelegt"
  }</span>
        </button>
        ${
    k.pinned
      ? `<button class="schalter loeschen" data-loeschen="${k.id}" data-handle="${
        text(k.handle)
      }">Löschen</button>`
      : ""
  }
      </span>
    </div>
    <div class="quelle-zahlen">
      ${k.followers ? `<span>${zahl(k.followers)} Follower</span>` : ""}
      <span>Treffer <b>${zahl(k.hits)}</b></span>
      <span>gefunden <b>${zahl(k.posts_found)}</b></span>
      <span>Ø Relevanz <b>${k.avg_relevance ?? "–"}</b></span>
      ${k.median_likes ? `<span>Median <b>${zahl(k.median_likes)}</b> Likes</span>` : ""}
      ${k.runs_without_hit > 0 ? `<span>${k.runs_without_hit} Läufe ohne Treffer</span>` : ""}
      ${k.discovered_via ? `<span>gefunden über @${text(k.discovered_via)}</span>` : ""}
    </div>
    ${
    k.pinned
      ? `<div class="quelle-lernen"><span class="fest-hinweis">📌 fest</span>
           <span class="grund">Bleibt aktiv, unabhängig von Funden. Nur hier wieder abschaltbar.</span></div>`
      : bewertungZeile("account", k.id)
  }
  </div>`;
}

function quellenAktionen() {
  liste.querySelector("#eigenes-speichern").onclick = async (e) => {
    const wert = liste.querySelector("#eigenes-konto").value.trim();
    if (!wert) return;
    const knopf = e.target;
    knopf.disabled = true;
    try {
      const { setting } = await apiJson("/settings", {
        method: "POST",
        body: JSON.stringify({ key: "own_handle", value: wert }),
      });
      melde(`Dein Konto: @${setting.value}`);
    } catch (fehler) {
      melde(fehler.message, true);
    } finally {
      knopf.disabled = false;
    }
  };

  liste.querySelector("#keyword-hinzu").onclick = async () => {
    const feld = liste.querySelector("#neues-keyword");
    const term = feld.value.trim();
    if (!term) return;
    await apiJson("/keywords", {
      method: "POST",
      body: JSON.stringify({
        term,
        lang: liste.querySelector("#neue-sprache").value,
        kind: liste.querySelector("#neue-art").value,
      }),
    });
    feld.value = "";
    await quellenZeichnen();
  };

  liste.querySelector("#konto-hinzu").onclick = async () => {
    const feld = liste.querySelector("#neues-konto");
    const handle = feld.value.trim();
    if (!handle) return;
    await apiJson("/accounts", {
      method: "POST",
      body: JSON.stringify({
        handle,
        active: true,
        kind: "tips",
        pinned: liste.querySelector("#neues-konto-fest").checked,
      }),
    });
    feld.value = "";
    liste.querySelector("#neues-konto-fest").checked = false;
    await quellenZeichnen();
  };

  // News-Quellen sind immer fest - dafuer sind sie da.
  liste.querySelector("#news-hinzu").onclick = async () => {
    const feld = liste.querySelector("#neue-news");
    const handle = feld.value.trim();
    if (!handle) return;
    await apiJson("/accounts", {
      method: "POST",
      body: JSON.stringify({ handle, active: true, kind: "news", pinned: true }),
    });
    feld.value = "";
    await quellenZeichnen();
  };

  for (const knopf of liste.querySelectorAll("[data-loeschen]")) {
    knopf.onclick = async () => {
      const handle = knopf.dataset.handle;
      if (!confirm(`@${handle} löschen? Die bisherigen Funde dieser Quelle gehen mit.`)) return;
      knopf.disabled = true;
      try {
        await apiJson(`/accounts/${knopf.dataset.loeschen}`, { method: "DELETE" });
        melde(`@${handle} gelöscht.`);
        await quellenZeichnen();
      } catch (fehler) {
        knopf.disabled = false;
        melde(fehler.message, true);
      }
    };
  }

  for (const knopf of liste.querySelectorAll("[data-keyword]")) {
    knopf.onclick = async () => {
      await apiJson(`/keywords/${knopf.dataset.keyword}`, {
        method: "PATCH",
        body: JSON.stringify({ active: knopf.dataset.aktiv !== "true" }),
      });
      await quellenZeichnen();
    };
  }

  for (const knopf of liste.querySelectorAll("[data-konto]")) {
    knopf.onclick = async () => {
      await apiJson(`/accounts/${knopf.dataset.konto}`, {
        method: "PATCH",
        body: JSON.stringify({ status: knopf.dataset.ziel }),
      });
      await quellenZeichnen();
    };
  }
}

function keywordAuswahlFuellen() {
  const feld = document.getElementById("filter-keyword");
  const vorher = feld.value;
  feld.innerHTML = '<option value="">Alle Keywords</option>' +
    keywordsCache.map((k) => `<option value="${k.id}">${text(k.term)}</option>`).join("");
  feld.value = vorher;
}

// --- Runs-Tab -----------------------------------------------------------

async function runsZeichnen() {
  const { runs } = await apiJson("/runs");
  if (!runs || runs.length === 0) {
    liste.innerHTML = '<p class="leer">Noch kein Lauf.</p>';
    return;
  }

  liste.innerHTML = `<table class="runs">
    <thead><tr>
      <th>Lauf</th><th>neu</th><th>davon&nbsp;KW</th><th>übersprungen</th><th>bewertet</th><th>Kosten</th>
    </tr></thead>
    <tbody>${
    runs.map((r) => `<tr>
        <td>${datum(r.started_at)}<br><span class="klein">${text(r.phase ?? r.status)}</span></td>
        <td>${zahl(r.gefunden)}</td>
        <td>${zahl(r.aus_keywords)}</td>
        <td>${zahl(r.posts_skipped)}</td>
        <td>${zahl(r.bewertet)}</td>
        <td class="kosten">${r.cost_estimate ? dollar(r.cost_estimate) : "–"}</td>
      </tr>`).join("")
  }</tbody>
  </table>
  <p class="leer" style="padding:18px 0 0;font-size:13px">
    Kosten geschätzt: Apify-Ergebnisse × 0,0023 $ plus Claude-Token.
  </p>`;
}

// --- Neue Karussells holen ----------------------------------------------

const PHASEN = [
  { name: "accounts", titel: "Accounts" },
  { name: "keywords", titel: "Keywords" },
  { name: "enrich", titel: "Enrichment" },
  { name: "analyze", titel: "Analyse" },
  { name: "own", titel: "Meine Zahlen" },
];

/**
 * Ein Lauf besteht aus vier Phasen. Die Seite ruft sie einzeln auf -
 * eine Edge Function darf nicht beliebig lange laufen, und so ist auch
 * zu sehen, wo es gerade steht.
 */
/**
 * Fragt beim Server nach, ob gerade ein Lauf starten darf, und stellt den
 * Knopf entsprechend ein. Die Entscheidung faellt der Server - hier wird
 * sie nur angezeigt.
 */
async function laufFensterPruefen() {
  const knopf = document.getElementById("knopf-holen");
  try {
    const f = await apiJson("/run/status");
    if (f.erlaubt) {
      knopf.disabled = false;
      knopf.textContent = "Neue holen";
      knopf.title = "";
      return;
    }
    knopf.disabled = true;
    knopf.textContent = f.heute_gelaufen
      ? `Erledigt – ${f.naechster_termin_kurz ?? ""}`.trim()
      : `Sonntag ${f.naechster_termin_kurz ?? ""}`.trim();
    knopf.title = f.heute_gelaufen
      ? `Der Lauf dieser Woche ist erledigt. Nächster Lauf ${f.naechster_termin_text}.`
      : `${f.grund} Nächster Lauf ${f.naechster_termin_text}.`;
    melde(
      f.heute_gelaufen
        ? `Erledigt – nächster Lauf ${f.naechster_termin_text}`
        : `Nächster Lauf ${f.naechster_termin_text}`,
    );
  } catch {
    // Ohne Antwort bleibt der Knopf bedienbar - der Server lehnt zur Not ab.
    knopf.disabled = false;
  }
}

async function holen(knopf) {
  knopf.disabled = true;
  const anzeige = document.getElementById("phasen");
  anzeige.hidden = false;
  anzeige.innerHTML = PHASEN
    .map((p) => `<div class="phase" id="phase-${p.name}"><span>${p.titel}</span><span class="wert">wartet</span></div>`)
    .join("");
  melde("");

  let runId = null;
  try {
    for (const phase of PHASEN) {
      const zeile = document.getElementById(`phase-${phase.name}`);
      zeile.classList.add("laeuft");
      zeile.querySelector(".wert").textContent = "läuft …";

      const parameter = runId ? `?run_id=${runId}` : "";
      const antwort = await apiJson(`/run/phase/${phase.name}${parameter}`, { method: "POST" });
      runId = antwort.run_id;

      zeile.classList.remove("laeuft");
      zeile.classList.add("fertig");
      zeile.querySelector(".wert").textContent = phasenText(phase.name, antwort.ergebnis);
    }

    await kostenZeigen(runId);
    aktuelleAnsicht = "analyzed";
    for (const tab of document.querySelectorAll('[role="tab"]')) {
      tab.setAttribute("aria-selected", String(tab.dataset.ansicht === "analyzed"));
    }
    await listeLaden();
    await laufFensterPruefen();
  } catch (fehler) {
    const laufend = anzeige.querySelector(".phase.laeuft");
    if (laufend) {
      laufend.classList.remove("laeuft");
      laufend.classList.add("fehler");
      laufend.querySelector(".wert").textContent = "Fehler";
    }
    melde(fehler.message, true);
  } finally {
    knopf.disabled = false;
  }
}

/** Kurzfassung je Phase fuer die Fortschrittsanzeige. */
function phasenText(phase, e) {
  if (!e) return "fertig";
  if (phase === "accounts") return `${zahl(e.neu)} neu, ${zahl(e.uebersprungen)} übersprungen`;
  if (phase === "keywords") {
    const summe = (e.ergebnisse ?? []).reduce((s, k) => s + Number(k.neu ?? 0), 0);
    return `${e.keywords ?? 0} Begriffe, ${zahl(summe)} neu`;
  }
  if (phase === "enrich") return `${zahl(e.engagement_gesetzt)} bewertbar`;
  if (phase === "analyze") {
    return `${zahl(e.analysiert)} von ${zahl(e.top30)}${e.offen ? `, ${e.offen} offen` : ""}`;
  }
  if (phase === "own") {
    const zugeordnet = (e.zugeordnet ?? []).length;
    return `${zahl(e.geholt)} Beiträge, ${zugeordnet} zugeordnet`;
  }
  return "fertig";
}

async function kostenZeigen(runId) {
  try {
    const { runs } = await apiJson("/runs");
    const lauf = (runs ?? []).find((r) => r.id === runId);
    if (lauf?.cost_estimate) melde(`Lauf fertig – Kosten ${dollar(lauf.cost_estimate)}`);
    else melde("Lauf fertig.");
  } catch {
    melde("Lauf fertig.");
  }
}

// --- Meine eigenen Beitraege --------------------------------------------

/**
 * Holt meine letzten Instagram-Beitraege und laesst zuordnen. Dasselbe
 * macht sonntags die letzte Phase des Laufs von allein - der Knopf ist
 * fuer alles dazwischen.
 */
async function eigeneHolen(knopf) {
  const alt = knopf.textContent;
  knopf.textContent = "Hole …";
  knopf.disabled = true;
  melde("Hole deine Beiträge …", false, true);
  try {
    const e = await apiJson("/own/fetch", { method: "POST" });
    const zugeordnet = (e.zugeordnet ?? []).length;
    melde(
      `${zahl(e.geholt)} eigene Beiträge · ${zugeordnet} neu zugeordnet${
        (e.knapp_daneben ?? []).length > 0
          ? ` · ${e.knapp_daneben.length} knapp daneben (im Tab Geplant von Hand zuordnen)`
          : ""
      }`,
    );
    await listeLaden();
  } catch (fehler) {
    melde(fehler.message, true);
  } finally {
    knopf.textContent = alt;
    knopf.disabled = false;
  }
}

// --- Konten -------------------------------------------------------------

async function kontenOeffnen() {
  konten.innerHTML = '<p class="leer">Lade …</p>';
  konten.showModal();
  await kontenZeichnen();
}

async function kontenZeichnen() {
  try {
    const { accounts } = await apiJson("/accounts");
    konten.innerHTML = `
      <div class="detail-kopf">
        <strong>Konten</strong>
        <button class="still" id="konten-zu">Schließen</button>
      </div>
      <div class="detail-inhalt">
        <div class="feld">
          <input id="neues-konto" placeholder="handle" autocapitalize="none" autocorrect="off">
          <button class="primaer" id="konto-hinzu">Hinzufügen</button>
        </div>
        <div style="margin-top:14px">
          ${
      accounts.map((k) => `
            <div class="konto">
              <div>
                <div><strong>@${text(k.handle)}</strong></div>
                <div class="meta">${k.followers ? `${zahl(k.followers)} Follower` : "Follower unbekannt"}</div>
              </div>
              <button data-handle="${text(k.handle)}" data-aktiv="${k.active}">
                <span class="${k.active ? "an" : "aus"}">${k.active ? "aktiv" : "pausiert"}</span>
              </button>
            </div>`).join("")
    }
        </div>
      </div>`;

    konten.querySelector("#konten-zu").onclick = () => konten.close();
    konten.querySelector("#konto-hinzu").onclick = async () => {
      const feld = konten.querySelector("#neues-konto");
      const handle = feld.value.trim();
      if (!handle) return;
      await apiJson("/accounts", { method: "POST", body: JSON.stringify({ handle, active: true }) });
      feld.value = "";
      await kontenZeichnen();
    };
    for (const knopf of konten.querySelectorAll("[data-handle]")) {
      knopf.onclick = async () => {
        await apiJson("/accounts", {
          method: "POST",
          body: JSON.stringify({
            handle: knopf.dataset.handle,
            active: knopf.dataset.aktiv !== "true",
          }),
        });
        await kontenZeichnen();
      };
    }
  } catch (fehler) {
    konten.innerHTML = `<p class="leer">${text(fehler.message)}</p>`;
  }
}

// --- Kleinkram ----------------------------------------------------------

function melde(nachricht, istFehler = false, arbeitet = false) {
  stand.textContent = nachricht;
  stand.classList.toggle("fehler", istFehler);
  stand.classList.toggle("arbeitet", arbeitet);
}

function text(wert) {
  return String(wert ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function zahl(wert) {
  const n = Number(wert);
  return Number.isFinite(n) ? n.toLocaleString("de-DE") : "–";
}

/** Eine Nachkommastelle, deutsches Komma - fuer Engagement und Ausreisser. */
/** Ein einzelner Beitrag kostet Bruchteile eines Cents - in Dollar waere das nur "0,0". */
function cent(dollar) {
  const wert = Number(dollar);
  if (!Number.isFinite(wert)) return "–";
  return `${(wert * 100).toLocaleString("de-DE", { maximumFractionDigits: 1 })} ct`;
}

function kommazahl(wert) {
  const n = Number(wert);
  if (!Number.isFinite(n)) return "–";
  return n.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function dollar(wert) {
  const n = Number(wert);
  if (!Number.isFinite(n)) return "–";
  return n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " $";
}

function datum(wert) {
  if (!wert) return "ohne Datum";
  return new Date(wert).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" });
}

/** Das Modell stellt die Slide-Nummer gern selbst voran - die steht schon davor. */
function ohneSlideNummer(vorschlag) {
  return String(vorschlag ?? "").replace(/^\s*Slide\s*\d+\s*[:.\-–]\s*/i, "");
}

function liste_(wert) {
  return Array.isArray(wert) && wert.length > 0;
}

function ersterEintrag(wert) {
  if (Array.isArray(wert)) return wert[0] ?? null;
  return wert ?? null;
}

// --- Eigenen Link einreihen ---------------------------------------------

const manualFeld = document.getElementById("manual-url");
const manualKnopf = document.getElementById("manual-los");
const manualStand = document.getElementById("manual-stand");

/**
 * Reiht einen eingefuegten Instagram-Link ein. Der Server holt, sichert
 * und bewertet in einem Rutsch; hier laeuft nur die Anzeige mit, weil
 * das je nach Anzahl der Slides eine halbe Minute dauern kann.
 */
async function einreihen() {
  const url = manualFeld.value.trim();
  if (!url) return;

  manualKnopf.disabled = true;
  manualFeld.disabled = true;

  // Der Server meldet sich erst am Ende - die Schritte laufen deshalb
  // nach der Zeit mit, damit sichtbar bleibt, dass etwas passiert.
  const schritte = ["Beitrag holen …", "Bilder sichern …", "Bewerten …"];
  let schritt = 0;
  manualMelde(schritte[0], "arbeitet");
  const takt = setInterval(() => {
    schritt = Math.min(schritt + 1, schritte.length - 1);
    manualMelde(schritte[schritt], "arbeitet");
  }, 7000);

  try {
    const ergebnis = await apiJson("/post/manual", {
      method: "POST",
      body: JSON.stringify({ url }),
    });

    if (ergebnis.status === "bereits_vorhanden") {
      manualMelde(ergebnis.hinweis ?? "Kennen wir schon.");
      if (ergebnis.post_id) {
        const vorhanden = liste.querySelector(`[data-post="${ergebnis.post_id}"]`);
        if (vorhanden) {
          vorhanden.scrollIntoView({ block: "center", behavior: "smooth" });
          hervorheben(vorhanden);
        } else {
          manualMelde(`${ergebnis.hinweis} Sie steht in einem anderen Tab.`);
        }
      }
      manualFeld.value = "";
      return;
    }

    manualFeld.value = "";
    manualMelde(
      `Eingereiht: Relevanz ${ergebnis.relevance ?? "–"}/10 · ${ergebnis.slides} Slides · ` +
        `${cent(ergebnis.kosten)}`,
    );
    await karteEinsortieren(ergebnis.post_id);
  } catch (fehler) {
    manualMelde(fehler.message, "fehler");
  } finally {
    clearInterval(takt);
    manualKnopf.disabled = false;
    manualFeld.disabled = false;
  }
}

/**
 * Holt den frisch eingereihten Beitrag und setzt ihn an die Stelle, an
 * die er nach Relevanz und Engagement gehoert - ohne die ganze Liste
 * neu zu laden.
 */
async function karteEinsortieren(postId) {
  if (aktuelleAnsicht !== "analyzed") return;

  const { post, bilder } = await apiJson(`/post/${postId}`);
  const eintrag = {
    ...post,
    analyse: post.analyse,
    vorschau: bilder?.[0]?.url ?? null,
  };

  const rang = (p) => [
    -(p.analyse?.relevance ?? -1),
    -(Number(p.engagement) || 0),
  ];
  const neuerRang = rang(eintrag);
  let stelle = aktuellePosts.findIndex((p) => {
    const r = rang(p);
    return neuerRang[0] < r[0] || (neuerRang[0] === r[0] && neuerRang[1] < r[1]);
  });
  if (stelle === -1) stelle = aktuellePosts.length;

  aktuellePosts.splice(stelle, 0, eintrag);
  zeichneListe(aktuellePosts);

  const karte = liste.querySelector(`[data-post="${postId}"]`);
  if (karte) {
    karte.scrollIntoView({ block: "center", behavior: "smooth" });
    hervorheben(karte);
  }
}

/** Laesst eine Karte kurz aufleuchten. */
function hervorheben(karte) {
  karte.classList.remove("neu");
  void karte.offsetWidth; // Neustart der Animation erzwingen
  karte.classList.add("neu");
  setTimeout(() => karte.classList.remove("neu"), 2600);
}

function manualMelde(nachricht, art) {
  manualStand.hidden = false;
  manualStand.className = `einreihen-stand${art === "fehler" ? " fehler" : ""}`;
  manualStand.innerHTML = art === "arbeitet"
    ? `<span class="punkt"></span>${text(nachricht)}`
    : text(nachricht);
}

// --- Ziehen zum Aktualisieren -------------------------------------------

/**
 * Am oberen Ende nach unten ziehen laedt die Liste neu. Das ist der
 * ausdrueckliche Weg dorthin - von allein holt die Seite nichts mehr,
 * seit der Statuswechsel die Karte direkt aendert.
 */
function ziehenEinrichten() {
  const anzeige = document.getElementById("ziehen");
  let start = null;
  let strecke = 0;
  const SCHWELLE = 70;

  addEventListener("touchstart", (e) => {
    start = scrollY <= 0 ? e.touches[0].clientY : null;
    strecke = 0;
  }, { passive: true });

  addEventListener("touchmove", (e) => {
    if (start === null) return;
    strecke = e.touches[0].clientY - start;
    if (strecke <= 0) { anzeige.style.height = "0px"; return; }
    // Gedaempft mitziehen, damit es sich nach Gummiband anfuehlt.
    anzeige.style.height = `${Math.min(strecke * 0.5, SCHWELLE)}px`;
    anzeige.textContent = strecke > SCHWELLE * 1.6 ? "Loslassen zum Aktualisieren" : "Zum Aktualisieren ziehen";
  }, { passive: true });

  addEventListener("touchend", async () => {
    const ausloesen = start !== null && strecke > SCHWELLE * 1.6;
    start = null;
    anzeige.style.height = "0px";
    if (ausloesen) await listeLaden();
  }, { passive: true });
}

// --- Start --------------------------------------------------------------

document.getElementById("knopf-holen").onclick = (e) => holen(e.target);
document.getElementById("knopf-eigene").onclick = (e) => eigeneHolen(e.target);

for (const tab of document.querySelectorAll('[role="tab"]')) {
  tab.onclick = () => {
    aktuelleAnsicht = tab.dataset.ansicht;
    for (const anderer of document.querySelectorAll('[role="tab"]')) {
      anderer.setAttribute("aria-selected", String(anderer === tab));
    }
    melde("");
    // Seit der Kopf mitscrollt, sind die Reiter nur oben erreichbar - dann
    // gehoert man nach dem Wechsel auch wieder nach oben, statt mitten in
    // einer frisch geladenen Liste zu stehen.
    scrollTo(0, 0);
    listeLaden();
  };
}

document.getElementById("filter-quelle").onchange = (e) => {
  filterQuelle = e.target.value;
  listeLaden();
};
document.getElementById("filter-keyword").onchange = (e) => {
  filterKeyword = e.target.value;
  listeLaden();
};
document.getElementById("filter-typ").onchange = (e) => {
  filterTyp = e.target.value;
  listeLaden();
};
document.getElementById("filter-art").onchange = (e) => {
  filterArt = e.target.value;
  listeLaden();
};

manualKnopf.onclick = einreihen;
manualFeld.addEventListener("keydown", (e) => {
  if (e.key === "Enter") einreihen();
});

ziehenEinrichten();

/**
 * Erst anmelden, dann laden. Ohne diese Reihenfolge liefen die ersten
 * Abrufe ins Leere, waehrend das Formular noch offen steht.
 */
(async () => {
  await anmeldungSicherstellen();

  // Keywords einmal vorab laden, damit das Auswahlfeld gefuellt ist.
  apiJson("/keywords").then((d) => {
    keywordsCache = d.keywords ?? [];
    keywordAuswahlFuellen();
  }).catch(() => {});

  laufFensterPruefen();
  listeLaden();
})();
