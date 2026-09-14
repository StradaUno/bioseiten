# viuno Profil — Bestandsaufnahme und Konzept

Stand: 14.09.2026. Betrachtet: `renderProfile` in `public/app/index.html`
(Zeile 5371–5790), die Standalone-Seite `public/profile/index.html`, die vier
Dialoge, das Pro-Banner in der Seitenleiste, die Edge Functions
`change-username`, `delete-account`, `newsletter-subscribe`, die Tabelle
`users` samt Triggern und RLS, und die Stellen, an denen dieselben Felder
außerhalb des Profils bearbeitet werden.

Am Code wurde nichts geändert.

---

## Kurzfassung

Die Profil-Seite ist die älteste Ansicht der App und die einzige, die beim
SPA-Umbau nicht nachgezogen wurde. Sie zeigt zwei Felder an, die nirgends
ankommen (`full_name`, `city`), schreibt ein Feld in einen Wertebereich, den
ein anderer Bereich anders befüllt (`niche_category`), und blendet einen
Plan ein, den es nicht gibt. Sechs Rundungen sind seit dem Token-Umbau
kaputt, weil die Inline-Styles auf `--radius-sm` zeigen und das Token
`--r-sm` heißt.

Schwerer wiegen sechs Funde außerhalb der Oberfläche:

1. `delete-account`, `change-username` und `admin-dashboard` laufen mit
   `verify_jwt: false` und **prüfen die JWT-Signatur nicht** — sie lesen nur
   `sub` aus dem base64-Mittelteil. Jeder, der eine User-UUID kennt, kann
   damit ein fremdes Konto löschen oder umbenennen; mit der UUID eines
   Admins liefert `admin-dashboard` alle Nutzer-, Newsletter- und
   Kontaktadressen aus. Betroffen sind genau diese drei von zwölf
   client-aufgerufenen Functions — geprüft, kein durchgehendes Muster.
2. Die RLS-Regel auf `users` ist `ALL USING (auth.uid() = id)` ohne
   Spalteneinschränkung. Jeder Angemeldete kann sich per REST-Aufruf
   `is_admin = true` setzen und damit an Rechtstexte, News-Redaktion und
   die komplette Newsletter-Liste.
3. Die Storage-UPDATE-Policy für `profile-images` prüft nur
   `auth.uid() IS NOT NULL`, nicht den Ordner. Ein Angemeldeter kann das
   Profilbild eines anderen Creators überschreiben — auf dessen
   öffentlichem BioLink und Media Kit.
4. `window.saveHandles` ist zweimal definiert (Zeile 2803 BioLink, Zeile 4556
   Analyse). Die zweite gewinnt. **Der Speichern-Knopf unter BioLink →
   Social Kanäle tut deshalb nichts** — still, ohne Fehlermeldung.
5. Nach einem E-Mail-Wechsel bleibt `public.users.email` auf der alten
   Adresse stehen. Der wöchentliche Newsletter geht danach an die alte
   Adresse, und das Profil zeigt sie an.
6. `cleanup-user-pages` sucht die zu löschende Seite über
   `biolink_settings.slug` — eine Spalte, die der heutige Generator nie
   füllt und die bei vier von fünf Konten `null` ist. **Die Kontolöschung
   entfernt die öffentliche BioLink-Datei deshalb nicht.** Im Repo liegen
   bereits drei verwaiste Seiten aus gelöschten Testkonten.

Die Plan-Anzeige lässt sich sauber entfernen: `subscription_type` steht bei
allen fünf Konten auf `free`, keine RLS-Regel und keine Funktion hängt daran.
Das Pro-Banner kann heute gar nicht erscheinen.

---

# Phase 1 — Bestandsaufnahme

## A. Inventar

### A.1 Die Query

```js
const [profileRes] = await Promise.all([
  sb.from('users').select('*').eq('id',uid).single()
])
```

Ein `select('*')` über alle 41 Spalten, von denen die Ansicht 10 benutzt.
Das ist die einzige Query der View. Es gibt kein Skeleton-Timeout und keinen
Fehlerpfad: schlägt die Query fehl, ist `profileRes.data` null und
`paintProfile()` wirft beim ersten Zugriff auf `p.display_name`. Der Nutzer
sieht dann dauerhaft das Skeleton.

### A.2 Felder der Bearbeiten-Karte

| Feld | Spalte | Pflicht | Validierung | Beim Speichern |
|---|---|---|---|---|
| Profilbild | `profile_image_url` | optional | nur `accept`-Attribut + 5 MB clientseitig | Upload nach `profile-images/<uid>/<ts>.<ext>` (`upsert`), dann `users.update`, Topbar-Avatar, **BioLink-Regenerierung** |
| Username | `display_name` | ja (implizit) | `^[a-zA-Z0-9_]{3,30}$` + Blacklist + CI-Unique, geprüft über RPC `check_username_available` | eigener Weg über Edge Function `change-username` |
| Name | `full_name` | optional | **keine** | Teil des Sammel-UPDATE |
| Bio | `bio` | optional | **keine Länge** | Sammel-UPDATE, löst BioLink-Regenerierung aus wenn geändert |
| Instagram | `instagram_handle` | optional | nur `@`-Strip, **keine Formatprüfung** | Sammel-UPDATE → Trigger `sync_analytics_username` |
| TikTok | `tiktok_handle` | optional | dito | dito |
| Stadt | `city` | optional | keine | Sammel-UPDATE |
| Nische | `niche_category` | Default `general` | 16er-Tastenraster | Sammel-UPDATE → Trigger `normalize_niche_category` |

Das Sammel-UPDATE schreibt sechs Felder plus `updated_at` in einem Rutsch.
Danach: `Object.assign(pv.profile, patch)`, grüner Haken für 3 Sekunden,
Toast — und **nur bei geänderter Bio** ein Neubau der BioLink-Seite.

Zwei Auffälligkeiten:

- Das Instagram-Feld im Profil prüft das Format nicht, das **gleiche** Feld
  in der Analyse-Ansicht schon (`/^[a-zA-Z0-9._]{1,50}$/`, Zeile 4562). Ein
  im Profil eingetragenes `https://instagram.com/name` landet ungeprüft in
  `users.instagram_handle`, auf dem BioLink als kaputter Link und über den
  Trigger in `creator_analytics`.
- Die Bio hat keine Längenbegrenzung, `og:description` schneidet aber bei
  157 Zeichen ab. Wer 400 Zeichen schreibt, sieht das erst am geteilten Link.

### A.3 Kopfbereich

```js
<div class="profile-name">${p.display_name||p.full_name||'–'}</div>
<div class="profile-handle">${p.email}</div>
<div class="profile-plan ...">Free Plan</div>
```

- Der Name fällt auf `full_name` zurück — ein Fall, der praktisch nie
  eintritt, weil `display_name` beim Registrieren gesetzt wird.
- Darunter steht `p.email` aus **`public.users`**, während der Account-Block
  `pv.user.email` aus **Supabase Auth** zeigt. Nach einem E-Mail-Wechsel
  stehen an zwei Stellen derselben Seite zwei verschiedene Adressen
  (siehe C.1).
- Das Plan-Abzeichen ist der einzige Ort in der App, an dem „Free Plan“
  steht.

### A.4 Die vier Dialoge

**Passwort ändern** (`#password-modal`, statisch in der View)

Ablauf: Öffnen → zwei Felder → `checkPwSheet()` prüft **nur das erste** Feld
auf ≥ 8 Zeichen und schaltet den Knopf frei → `saveNewPassword()` prüft dann
beide und die Gleichheit → `sb.auth.updateUser({password})`.

Fehlerfälle:
- Der Speichern-Knopf ist aktiv, obwohl das Bestätigungsfeld leer ist. Der
  Nutzer klickt, bekommt einen Toast „Passwörter stimmen nicht überein“.
- Nach einem Fehler bekommt der Knopf `textContent = 'Passwort speichern'`,
  vorher hieß er „Speichern“. Die Beschriftung wechselt im Fehlerfall.
- **Kein aktuelles Passwort verlangt.** Wer einen offenen Laptop erwischt,
  kann das Passwort ohne Rückfrage neu setzen.
- Andere Sitzungen werden nicht abgemeldet.

**Username ändern** (`#username-modal` → `showModal`-Bestätigung → Edge Function)

Der Hinweistext ist ehrlich: BioLink und Media Kit werden deaktiviert und
müssen neu erstellt werden. Die Prüfung läuft über `check_username_available`
mit 500 ms Debounce. Danach ein zweiter Dialog mit der alten URL im
Warntext, dann `change-username`.

Was `change-username` tut: alten Slug ableiten, `public/<slug>/index.html`
und `public/kit/<slug>/index.html` bei GitHub löschen, Cloudflare-Cache
leeren, `display_name` setzen, `bio_active` und `mediakit_active` auf false,
`biolink_settings.slug` nullen. Danach `router()`.

Fehlerfälle: Blacklist, Vergeben, Format, Race auf den CI-Unique-Index. Alle
abgefangen. Aber: die Funktion prüft die Signatur des Tokens nicht (C.4),
und der Nutzer kann `display_name` auch komplett an ihr vorbei ändern —
`users` ist für den Client beschreibbar (C.5). Dann bleiben die alten
HTML-Dateien im Repo liegen und der BioLink ist unter keiner Adresse mehr
erreichbar.

**E-Mail ändern** (`showModal` mit Inline-Input)

`sb.auth.updateUser({email})` → Supabase verschickt eine Bestätigungsmail.
Der Toast sagt „Bestätigungsmail gesendet“. Kein Hinweis darauf, dass bis
zur Bestätigung die alte Adresse gilt, und kein Hinweis, dass die
Anfrage-E-Mail davon unberührt bleibt.

**Konto löschen** (zwei `showModal`-Stufen → Edge Function `delete-account`)

Stufe 1: „Alle deine Daten, BioLink-Seite und Media Kit werden dauerhaft
gelöscht.“ Stufe 2: „Wirklich unwiderruflich löschen?“ mit Warnblock.
Beide Stufen haben denselben schwarzen Bestätigungsknopf — die Klasse
`modal-btn-danger` (rot) existiert, wird von BioLink und Media Kit benutzt,
im Profil aber nicht. Es gibt keine Tipp-Bestätigung, keinen Backdrop-Klick
zum Schließen und keine Escape-Taste.

### A.5 Was in `users` liegt und im Profil nicht vorkommt

| Spalte | Zustand |
|---|---|
| `contact_email` | wird auf BioLink und Media Kit veröffentlicht, ist aber **nur** im BioLink-Sheet und im Media-Kit-Sheet zu bearbeiten |
| `youtube_handle`, `threads_handle` | nur im BioLink- und Media-Kit-Editor |
| `impressum_text` | nur dort — gesetzlich vorgeschrieben für beide Seiten |
| `country` | Default `'Deutschland'`, nirgends editierbar, nirgends angezeigt |
| `amazon_storefront_url` | tot, kein Leser |
| `niche_custom` | tot |
| `creator_style`, `style_onboarding_done` | tot (Edge Function `generate-style-mirror` existiert, wird von der App nicht aufgerufen) |
| `active_goal_id` | tot, `user_goals` wird nirgends gelesen |
| `is_verified` | steuert den Haken auf dem BioLink, nur per SQL setzbar |
| `is_managed_creator` | nur Antonietta, kein Leser im Client |
| `total_followers` | Trigger-Aggregat, Dashboard liest es |
| `analyse_moeglich` | Analyse-Bereich |
| `deleted_at` | wird nie gesetzt — `delete-account` löscht hart |
| `subscription_type` | siehe Phase 2.5 |

### A.6 Was doppelt bearbeitbar ist

| Feld | Orte | Bleibt es synchron? |
|---|---|---|
| `profile_image_url` | Profil, Media-Kit-Profil-Sheet | ja, beide schreiben dieselbe Spalte — aber nur das Profil baut danach den BioLink neu |
| `bio` | Profil, BioLink-Profil-Sheet, Media-Kit-Profil-Sheet | ja, alle drei regenerieren den BioLink |
| `city` | Profil, Media-Kit-Profil-Sheet | ja |
| `niche_category` | Profil (16 feste Schlüssel), Media-Kit-Sheet (**Freitext**) | **nein — siehe unten** |
| `instagram_handle`, `tiktok_handle` | Profil, BioLink-Kanäle-Sheet (defekt), Analyse-Kanal-Dialog | ja, soweit sie funktionieren |
| `contact_email` | BioLink-Sheet, Media-Kit-Sheet | ja, aber nur der BioLink-Weg regeneriert |

**Der Nischen-Konflikt.** Das Profil schreibt Schlüssel (`fashion`,
`mental_health`). Das Media-Kit-Sheet hat ein Freitextfeld mit dem
Platzhalter „z.B. Italian Lifestyle & Fashion“. Beides landet in derselben
Spalte, und der Trigger `normalize_niche_category` macht daraus
`italian_lifestyle_&_fashion`. Der öffentliche Media Kit zeigt den Wert
**roh** als Schlagwort unter dem Namen (`generate-mediakit`, `renderPage`:
`s.textContent = u.niche_category`). Wer im Profil „Mental Health“ wählt,
hat auf seinem öffentlichen Media Kit das Schlagwort `mental_health` stehen.
Umgekehrt: wer im Media Kit Freitext einträgt, hat im Profil kein aktives
Nischen-Feld mehr, und der erste Klick auf eine Nischen-Taste überschreibt
den Freitext.

---

## B. Abhängigkeiten

### B.1 Wohin fließt welches Profilfeld

| Feld | BioLink-HTML | Media-Kit-HTML | Analyse | News | Dashboard |
|---|---|---|---|---|---|
| `display_name` | Slug, `<title>`, `og:title`, `canonical`, **eingebacken**; Name im Kopf zur Laufzeit | Slug, Name zur Laufzeit | `creator_analytics.username` über Trigger | Anrede in der Wochenmail | Begrüßung, Avatar |
| `bio` | `description` + `og:description`, **eingebacken**; Text zur Laufzeit | Text zur Laufzeit | – | – | – |
| `profile_image_url` | `og:image`, **eingebacken**; Bild zur Laufzeit | Bild zur Laufzeit | – | – | Topbar-Avatar |
| `instagram_handle` / `tiktok_handle` | Button + Icon, **Laufzeit** aus `biopage_v2` | Kennzahlenblock, Laufzeit | Kanal der Analyse, über Trigger in `creator_analytics` | – | – |
| `youtube_handle` / `threads_handle` | Button, Laufzeit | „Weitere Plattformen“, Laufzeit | – | – | – |
| `contact_email` | mailto-Button, Laufzeit — ohne Adresse **kein Button** | Kontaktblock + CTA, Laufzeit | – | Empfänger der Wochenmail (`contact_email \|\| email`) | – |
| `niche_category` | im View, wird nicht gerendert | **Schlagwort, Laufzeit** | – | – | – |
| `city` | im View, **wird nirgends gerendert** | im View, **wird nirgends gerendert** | – | – | – |
| `full_name` | – | – | – | Fallback für die Anrede | Fallback |
| `newsletter_subscribed` | – | – | – | **Empfängerliste der Wochenmail** | – |
| `impressum_text` | Impressum-Sheet, Laufzeit | Impressum-Sheet, Laufzeit | – | – | – |

`city` und `full_name` sind damit reine Datenhaltung ohne Abnehmer.

### B.2 Was muss regeneriert werden — und was nicht

Wichtig für das Verständnis: die generierte BioLink-Seite ist **kein
statisches Abbild**. Sie lädt beim Aufruf `biopage_v2` über den Slug und
rendert Name, Bio, Bild, Kanäle und Kontakt zur Laufzeit. Statisch
eingebacken sind nur `<title>`, `description`, `canonical`, `og:*` und
`twitter:card` — genau die Tags, die WhatsApp, iMessage und Instagram lesen,
ohne JavaScript auszuführen. Der Media Kit hat **gar keine** Inhaltstags:
sein `<title>` ist wörtlich „Media Kit“, `description` ist leer, OG-Tags
fehlen ganz.

| Änderung | BioLink neu bauen? | Heute? | Media Kit neu bauen? |
|---|---|---|---|
| `bio` | **ja** (og:description) | ✔ ja, aus allen drei Bearbeitungsorten | nein, nichts eingebacken |
| `profile_image_url` | **ja** (og:image) | ✔ ja aus dem Profil, ✘ **nein** aus dem Media-Kit-Sheet | nein |
| `display_name` | ja — erledigt `change-username` | ✔ | nein |
| Theme | ja (theme-color, CSS) | ✔ über `generatePage` | – |
| `instagram_handle` u. a. | **nein**, Laufzeit | – | nein |
| `contact_email` | **nein**, Laufzeit | ✘ regeneriert trotzdem, mit falschem Kommentar | nein |
| `city`, `niche_category`, `full_name` | nein | – | nein |

Also: **eine fehlende Regenerierung** (Foto-Upload im Media-Kit-Sheet) und
**eine überflüssige** (Kontakt-E-Mail im BioLink-Sheet, inklusive
Cloudflare-Purge). Der Byte-Vergleich in `commitToGitHub` verhindert
immerhin einen leeren Commit.

Die Rückmeldung an den Nutzer ist heute asymmetrisch: `generatePage` zeigt
ein Vollbild-Overlay mit Schritten, `regenerateBioPageQuietly` läuft
unsichtbar und meldet sich nur im Fehlerfall („Öffentliche Seite nicht
aktualisiert: …“) — mit einem Toast, den man leicht verpasst. Danach steht
die Seite mit alten OG-Tags im Netz und niemand weiß es.

### B.3 Handle-Wechsel

Was passiert, wenn jemand sein Instagram-Handle im Profil ändert:

1. `users.instagram_handle` wird überschrieben.
2. Trigger `sync_analytics_username` schreibt den **neuen** Handle in die
   **bestehende** Zeile `creator_analytics(user_id, platform='instagram')`.
   Die alten Zahlen bleiben stehen, tragen aber jetzt den neuen Namen.
3. `analysis_runs`, `analyse_stats`, `analyse_ki` und `apify_daten` bleiben
   unverändert — die alte Analyse gehört weiter zum alten Kanal, ist aber
   nicht mehr als solche erkennbar.
4. BioLink und Media Kit zeigen sofort den neuen Kanal, ohne Neubau.
5. **Der Nutzer wird nicht gewarnt.** Kein Hinweis, keine Rückfrage.

Das ist der stillste Datenverlust der Anwendung: der Analyse-Verlauf zeigt
danach Zahlen eines Kanals unter dem Namen eines anderen.

---

## C. Konto-Funktionen

### C.1 E-Mail ändern — die Adresse läuft auseinander

`sb.auth.updateUser({email})` ändert `auth.users.email`. Es gibt **keinen
Trigger**, der `public.users.email` nachzieht — der einzige Trigger auf
`auth.users` ist `sync_email_verified`, und der schreibt nur
`email_verified`.

Folgen:
- Der Profilkopf zeigt die alte Adresse (`p.email`), der Account-Block die
  neue (`pv.user.email`).
- Die Wochenmail geht an `contact_email || users.email` → an die **alte**
  Adresse, solange keine Anfrage-E-Mail hinterlegt ist.
- `newsletter-subscribe` liest ebenfalls `contact_email || users.email` und
  trägt die alte Adresse in `newsletter_subscribers` ein.
- Der Unique-Index `users_email_key` blockiert später eine legitime
  Neuregistrierung mit der freigewordenen Adresse.

### C.2 Passwort ändern und Passwort vergessen

Ändern: siehe A.4 — funktioniert, aber ohne Abfrage des alten Passworts und
ohne Abmeldung anderer Geräte.

Vergessen: `public/reset-password/` mit `sb.auth.resetPasswordForEmail`,
verlinkt aus dem SPA-Login (Zeile 1372) und aus `public/login/`. Aus dem
Profil heraus gibt es keinen Weg dorthin — brauchte man auch nicht, weil man
dort angemeldet ist.

### C.3 Konto löschen — was wirklich passiert

`delete-account` ist gründlicher als die Oberfläche vermuten lässt:

1. `cleanup-user-pages` (GitHub-Dateien + Cloudflare-Cache), best effort.
2. Storage `profile-images/<uid>/*` — bis zu 1000 Dateien.
3. `subscriptions`: bezahlte (`payment_ref` gesetzt) auf `user_id = NULL`,
   freie gelöscht.
4. `analysis_purchases`, `withdrawal_consents`, `ai_usage_log` auf
   `user_id = NULL` (Pseudonymisierung, § 147 AO).
5. `auth.admin.deleteUser` — die Cascade räumt über `public.users` weitere
   19 Tabellen ab.

Was liegen bleibt:

| Tabelle | Warum | Bewertung |
|---|---|---|
| `newsletter_subscribers` | FK ist `ON DELETE SET NULL` | **Problem: die E-Mail-Adresse bleibt in Klartext stehen.** Die Datenschutzerklärung 9.1 sagt zu, der Personenbezug werde „durch Setzen des Nutzer-Verweises auf NULL entfernt – die Daten sind danach nicht mehr dir zuordenbar“. Bei dieser Tabelle stimmt das nicht: die Adresse *ist* der Personenbezug. |
| `user_consents` | kein FK, bewusst („Option A“) | vertretbar, sollte aber ebenfalls pseudonymisiert werden |
| `page_views`, `admin_errors` | SET NULL, keine Inhalte | unkritisch |
| `subscriptions` mit `user_id` toter Konten | **kein FK** auf `users` | heute eine Waise (User `fe603200…`), aus einer Löschung vor Einführung von Schritt 3 |

**Schritt 1 läuft ins Leere: die öffentlichen Seiten bleiben stehen.**

`cleanup-user-pages` sucht den Slug so:

```ts
const { data: bls } = await supabase
  .from('biolink_settings').select('slug').eq('user_id', userId).maybeSingle()
const slug = bls?.slug ?? null
…
} else { result.note = 'kein slug, nichts zu loeschen' }
```

`generate-biolink` schreibt `biolink_settings.slug` aber **nie** — es leitet
den Slug aus `slugify(display_name)` ab und legt bei Bedarf eine Zeile in
`biolink_viuno` an. `change-username` setzt den Wert sogar aktiv auf `null`.
Der Stand in der Datenbank:

| Konto | `bio_active` | `biolink_settings.slug` |
|---|---|---|
| Antonietta | true | `antonietta` (historisch gepflegt) |
| Heyno | false | **null** |
| liaminini | false | **null** |
| Glenn | false | **null** |
| Testi | **true** | **null** |

Testi hat also eine **live stehende** BioLink-Seite und keinen Slug in
`biolink_settings`. Löscht dieses Konto sich heute, meldet
`cleanup-user-pages` „kein slug, nichts zu loeschen“ und
`public/testi/index.html` bleibt im öffentlichen Repo und auf viuno.de.

Das ist keine Theorie — im Repo liegen bereits drei verwaiste Seiten aus
Testkonten, die es in `users` nicht mehr gibt:
`public/stradi/`, `public/antika/` und `public/kit/stradi/`. Alle drei sind
Generator-Ausgabe (sie fragen `biopage_v2` ab).

Entwarnung nur für den Moment: diese drei stammen aus einer älteren
Generator-Fassung und tragen leere Meta-Tags (`<title>viuno</title>`,
`og:description` und `og:image` leer). Die **heute** ausgelieferte Fassung
(v16) backt `display_name`, Bio und die Profilbild-Adresse in genau diese
Tags ein. Die nächste Löschung hinterlässt diese Angaben dauerhaft in einem
öffentlichen GitHub-Repository — auch dann, wenn die Datenbankzeile weg ist
und die Seite im Browser nur noch auf viuno.de weiterleitet.

Die Korrektur ist klein: `cleanup-user-pages` muss den Slug genauso ableiten
wie `generate-biolink` und `change-username` — aus `users.display_name`,
hilfsweise aus `biolink_settings.slug`. Der `users`-Datensatz existiert an
dieser Stelle noch, weil `delete-account` den Aufruf **vor**
`auth.admin.deleteUser` macht.

Was fehlt:
- **Keine Bestätigungsfrist, keine Rücknahme.** Sofortlöschung ist zulässig,
  aber unbarmherzig.
- **Kein Datenexport.** AGB § 7.4 sagt wörtlich: „Vor Löschung kann der
  Nutzer einen Datenexport anfordern.“ Es gibt keinen Knopf, keine Adresse,
  keinen Hinweis im Dialog. Das ist eine zugesagte und nicht erbrachte
  Leistung.
- **Stripe: geprüft, nichts zu tun.** `create-checkout-session` übergibt
  `customer_email`, nicht `customer` — es wird kein wiederverwendeter
  Stripe-Customer angelegt, und `analysis_purchases` speichert nur
  `stripe_checkout_session_id` und `stripe_payment_intent_id`, keine
  Kundennummer. Was bei Stripe zur Rechnung liegt
  (`invoice_creation: enabled`), unterliegt ohnehin der Aufbewahrungspflicht
  und darf nicht gelöscht werden. Der Löschpfad braucht hier also keinen
  Schritt.

### C.4 Sicherheit der beiden Konto-Funktionen

`delete-account` und `change-username` stehen beide auf `verify_jwt: false`
und dekodieren das Token von Hand:

```ts
const payload = JSON.parse(atob(token.split('.')[1]))
userId = payload.sub
```

Es gibt keine Signaturprüfung. Ein selbstgebautes Token mit beliebigem `sub`
wird akzeptiert. Damit kann jeder, der eine User-UUID kennt — und die steht
auf **jeder** hand­gebauten Creator-Seite im Tracking-Pixel —

- ein fremdes Konto **löschen**,
- einen fremden Username ändern und damit BioLink und Media Kit offline
  nehmen, oder sich einen fremden Namen sichern.

Der Kommentar in `change-username` nennt den Grund: „JWT manuell decoden (da
supabase.auth.getUser unzuverlässig ist)“. `generate-biolink` und
`generate-mediakit` benutzen `supabase.auth.getUser(token)` und funktionieren
damit einwandfrei — die Begründung trägt nicht. Das ist derselbe Fehlertyp
wie bei `notify-new-request`, der im Anfragen-Umbau beschrieben wurde.

**Dieselbe Lücke in `admin-dashboard`.** Der Kopfkommentar schreibt es
ausdrücklich hin: „Auth: manueller JWT-Decode (gleiches Pattern wie andere
viuno-Functions), danach is_admin-Check via service-role-key.“ Die Funktion
steht ebenfalls auf `verify_jwt: false`, dekodiert `sub` mit `atob` und
schlägt damit `is_admin` nach. Ein selbstgebautes Token mit der UUID eines
Admins reicht also, um über `POST …/admin-dashboard?action=overview` zu
bekommen:

- alle Nutzer mit E-Mail-Adresse, Klarname, Nische, letzter Aktivität,
- die letzten 50 Newsletter-Abonnenten mit Adresse und Status,
- die letzten 50 Kontaktanfragen von der Landingpage mit Name, E-Mail und
  Nachricht,
- KI-Kosten, Analysefehler, Biolink- und Media-Kit-Übersicht.

Dafür braucht man nicht einmal ein eigenes Konto — anders als bei der
Selbstbeförderung in C.5. Die Funktion kann außerdem
`contact_submissions` und `admin_errors` schreiben.

**Reichweite der Lücke — vollständig geprüft.** Von den zwölf Edge Functions,
die der Client aufruft, sind genau **drei** betroffen:

| Function | Auth | Befund |
|---|---|---|
| `delete-account` | manuelles `atob` | **ungeprüft** |
| `change-username` | manuelles `atob` | **ungeprüft** |
| `admin-dashboard` | manuelles `atob` | **ungeprüft** |
| `start-analysis` | `auth.getUser` | ok |
| `create-checkout-session` | `auth.getUser` | ok |
| `analyse-freigeben` | `auth.getUser` + Eigentumsprüfung | ok |
| `generate-biolink` | `auth.getUser` | ok |
| `generate-mediakit` | `auth.getUser` | ok |
| `newsletter-subscribe` | `auth.getUser` | ok |
| `fetch-competitor-accounts` | `verify_jwt: true` | ok, Plattform prüft |
| `analyse-oeffentlich` | Token in der URL | öffentlich gewollt |
| `track-biolink-view` | keine | öffentlich gewollt |
| `cleanup-user-pages` | Service-Role-Key im Header | ok (nicht vom Client aufgerufen) |

Es ist also kein durchgehendes Muster, sondern genau drei Stellen. Die
Korrektur ist an allen dreien dieselbe.

### C.5 Rechte auf `users`

Die einzige RLS-Regel lautet:

```
users_own  |  ALL  |  USING (auth.uid() = id)  |  WITH CHECK: null
```

Ohne `WITH CHECK` gilt für UPDATE die `USING`-Bedingung — der Nutzer bleibt
also auf seiner eigenen Zeile. Nur: die Spalten-Grants geben
`authenticated` UPDATE auf **alle 41 Spalten**, `is_admin` eingeschlossen.
Ein Angemeldeter kann in der Browser-Konsole

```js
sb.from('users').update({ is_admin: true }).eq('id', meineId)
```

ausführen. `is_admin()` liest genau diese Spalte, und daran hängen die
Policies von `legal_texts` (Rechtstexte schreibbar), `daily_digest`
(News-Redaktion), `newsletter_subscribers` (alle E-Mail-Adressen lesbar),
`page_views`, `user_consents`, `managed_creators`, `ig_carousels`,
`apify_raw_runs`.

Ebenso frei schreibbar: `display_name` (am Username-Prozess vorbei),
`subscription_type`, `is_verified` (blauer Haken auf dem BioLink),
`bio_active` / `mediakit_active`, `email`, `total_followers`.

### C.6 Profilbilder im Storage

```
INSERT: bucket_id='profile-images' AND (storage.foldername(name))[1] = auth.uid()::text   ✔ richtig
UPDATE: bucket_id='profile-images' AND auth.uid() IS NOT NULL                              ✘ prüft den Ordner nicht
```

Die App lädt mit `upsert: true` hoch. Für einen existierenden Pfad ist das
ein UPDATE — und das darf jeder Angemeldete auf jedem fremden Pfad. Der
Bucket ist öffentlich lesbar, die Pfade sind aus den Bildadressen der
öffentlichen Seiten ablesbar. Ein fremdes Profilbild lässt sich also
austauschen.

Außerdem: es gibt keine DELETE-Policy. Alte Profilbilder bleiben für immer
liegen — jeder Upload legt eine neue Datei mit Zeitstempel an. Nach dem
Bilder-Desaster bei den News (61 Bilder, 131 MB) ist das erwähnenswert; und
es gibt keine Verkleinerung, 5 MB sind erlaubt und gehen so auf BioLink und
Media Kit.

### C.7 Rechtliches im Profil

Im Profil selbst: **nichts**. Die Links stehen in der Seitenleisten-Fußzeile
(Impressum, Datenschutz, AGB) und in der App-Fußzeile (zusätzlich Widerruf
und `/legal/`). Beides ist auf dem Handy weit weg vom Löschknopf.

Die Texte liegen in `legal_texts` (Stand 13.09.2026) und sind anwaltlich
freigegeben, aber inhaltlich an drei Stellen überholt:

- AGB 1.2 nennt „Anfragen-Verwaltung: Annahme und Verwaltung von Anfragen
  Dritter über deinen BioLink“ — seit dem 14.09.2026 entfernt.
- AGB 1.2 und Datenschutz 4.6 nennen „Daily Digest — tägliche
  KI-generierte News“. Die News erscheinen wöchentlich.
- Datenschutz 3.5, 4.3 und 9.2 beschreiben Anfrage-Daten und deren
  Speicherdauer; die BioLink-Nutzungsbedingungen erwähnen das
  „integrierte Formular“. Alles weg.

Die zugesagte Datenauskunft (AGB 7.4) fehlt in der App, siehe C.3.

### C.8 Sitzungen und Zwei-Faktor

Nichts davon existiert. Keine Geräteliste, kein „überall abmelden“, kein
TOTP. Supabase Auth bringt MFA mit (`auth.mfa_factors` ist da), es wird
nicht benutzt.

Für die Zielgruppe: Zwei-Faktor ist heute **nicht** nötig. Ein viuno-Konto
enthält keine Zahlungsdaten und keine Plattform-Zugänge; das Schlimmste,
was ein Fremder anrichten kann, ist die öffentliche Seite verändern. Eine
Geräteliste wäre ebenfalls Luxus. Was dagegen fehlt und billig ist: eine
**Mail bei Passwort- und E-Mail-Änderung** an die alte Adresse — das ist der
eigentliche Schutz gegen eine übernommene Sitzung.

---

## D. UI-Bewertung

### D.1 Struktur heute

```
Hero          Foto · Name · E-Mail · Plan-Abzeichen
Profil bearbeiten   Username | Name | Bio | Instagram | TikTok | Stadt | Nische | [Speichern]
Account       Login-E-Mail | Passwort | Creator News | Account löschen
```

Zwei Blöcke, sieben Felder, ein Sammel-Speichern. Probleme:

- **Der Account-Block heißt im CSS `danger-card` und enthält vier völlig
  verschiedene Dinge**: eine Kontoangabe, eine Sicherheitsaktion, eine
  Einwilligung und eine Löschung. Drei der vier Knöpfe tragen die Klasse
  `btn-danger` (rot) und werden inline wieder neutral überschrieben:
  `style="background:var(--surface2);color:var(--text);border-color:var(--border-strong)"`.
  Nur der vierte bleibt rot. Das ist Rot als Standard mit dreifacher
  Ausnahme statt Rot als Ausnahme.
- **Der Newsletter steht unter „Account“.** Eine Einwilligung ist keine
  Kontoeinstellung.
- **Keine Trennung zwischen öffentlich und privat.** Bio, Foto und Handles
  landen weltweit sichtbar auf zwei Seiten, Login-E-Mail nicht. Nichts in
  der Oberfläche sagt das. Der einzige Hinweis ist die Zeile „Dein
  öffentlicher Name auf viuno.de“ unter dem Username.
- **Ein Speichern-Knopf für sechs Felder.** Wer nur die Stadt ändert,
  schreibt alle sechs Spalten neu und stößt bei unveränderter Bio keine
  Regenerierung an — richtig, aber schwer nachvollziehbar.
- Der Nischen-Raster ist 3 Spalten × 16 Tasten = ein halber Bildschirm für
  ein Feld, das nur als Schlagwort im Media Kit erscheint.

### D.2 Inline-Styles nach dem Token-Umbau

Der Dashboard-Bericht hatte die Username-Zeile und die Passwort-Felder als
Inline-Sonderfälle genannt. Sie sind es noch — und schlimmer als gedacht:

**Sechs Deklarationen zeigen auf ein Token, das es nicht gibt.**

| Zeile | Stelle |
|---|---|
| 5390 | Passwort-Modal, Feld „Neues Passwort“ |
| 5397 | Passwort-Modal, Feld „Passwort bestätigen“ |
| 5414 | Username-Modal, Eingabefeld |
| 5460 | Username-Zeile im Formular |
| 5462 | „Ändern“-Knopf daneben |
| 5663 | E-Mail-Modal, Eingabefeld |

Alle schreiben `border-radius: var(--radius-sm)`. Das Token-Set in
`public/app/index.html` kennt `--r-sm: 10px`, aber kein `--radius-sm`. Eine
undefinierte Variable macht die Deklaration ungültig, der Radius fällt auf 0
zurück: **diese sechs Elemente haben eckige Ecken, alles drumherum 10 px.**

Die Ursache ist sauber nachvollziehbar: `public/profile/index.html`
definiert in Zeile 11 `--radius-sm:10px`. Beim Port in die SPA wurden die
Inline-Styles wörtlich übernommen, das Token aber nicht — die SPA hatte
inzwischen auf `--r-*` umgestellt. Auf der Standalone-Seite funktioniert es
weiterhin.

Weitere Inline-Reste in der View: `style="opacity:.5"` an zwei Knöpfen
(es gibt `.modal-btn-confirm:disabled`), Trennlinien als
`<div style="height:1px;background:var(--border);margin:14px 0">` (dreimal),
`padding-bottom:calc(8px + var(--safe-bottom))` an der Section.

### D.3 Emojis und Zeichen

Die View benutzt `✓` (Gespeichert, Passwort sieht gut aus, Verfügbar) und
`⭐` — letzteres nur auf der Standalone-Seite, in der SPA ist daraus
`icon('star',12)` geworden. Der Rest der App benutzt durchgehend
Lucide-Icons über `icon()`. Die `✓` sind vertretbar, weil sie in Fließtext
stehen, nicht als Bedienelement.

### D.4 Wie andere das bauen

| | Gruppierung | Bearbeitung | Was wir übernehmen sollten |
|---|---|---|---|
| **Linktree** | „Profile“ (Bild, Titel, Bio) getrennt von „My Account“ (E-Mail, Passwort, Löschen) | Profil direkt in der Editor-Vorschau, Konto als Liste | Die Trennung „was auf der Seite steht“ vs. „was mein Konto ist“ — exakt unser Problem |
| **Beacons** | „Appearance/Profile“ im Editor, „Settings → Account“ separat | live-Vorschau neben dem Formular | Das Profil gehört zum Produkt, nicht in die Einstellungen |
| **Later** | „Profile“, „Notifications“, „Billing“, „Connected accounts“, „Danger Zone“ | je Gruppe eine Seite | Benachrichtigungen als eigene Gruppe; „Danger Zone“ als eigener, optisch abgesetzter Block ganz unten |
| **Notion** | „My account“ / „My notifications“ / „My connections“, Löschen ganz unten mit Tipp-Bestätigung | Modal je Aktion | Tipp-Bestätigung beim Löschen; Löschen sichtbar, aber nicht neben harmlosen Aktionen |

Gemeinsamer Nenner aller vier: **öffentliches Profil und Konto sind
getrennt**, Benachrichtigungen sind eine eigene Gruppe, und die Löschung
steht isoliert am Ende. Keiner von ihnen mischt eine Newsletter-Einwilligung
in denselben Kasten wie den Löschknopf.

---

# Phase 2 — Konzept

## 2.1 Informationsarchitektur

**Regel: ein Feld hat einen Bearbeitungsort.** Wo eine Angabe an mehreren
Stellen gebraucht wird, wird sie an einer Stelle bearbeitet und an den
anderen nur angezeigt — mit einem Link dorthin.

Vorgeschlagene Gruppen, in dieser Reihenfolge:

**1 — Öffentliches Profil** *(erscheint auf BioLink und Media Kit)*
- Profilbild — **hierher**, aus dem Media-Kit-Sheet entfernen
- Username — bleibt, mit der URL als Wert (`viuno.de/annalena`)
- Bio — **hierher**, aus BioLink- und Media-Kit-Sheet entfernen
- Nische — bleibt, aber das Freitextfeld im Media Kit wird ersetzt
- Anfrage-E-Mail — **hierher**, aus beiden Sheets entfernen

*Begründung:* Das sind genau die Felder, die auf **beiden** öffentlichen
Seiten stehen. Solange sie in drei Editoren verteilt sind, weiß niemand, wo
er suchen muss, und der Nischen-Konflikt wiederholt sich.

**2 — Kanäle** *(öffentlich)*
- Instagram, TikTok, YouTube, Threads — **hierher**, das (defekte)
  BioLink-Kanäle-Sheet und das Media-Kit-Plattform-Sheet verweisen
  hierher. Die Follower-Zahlen für YouTube/Threads bleiben im Media Kit,
  weil sie nur dort gebraucht werden.
- Formatprüfung wie in der Analyse: `^[a-zA-Z0-9._]{1,50}$`.
- Bei Änderung eines bereits analysierten Handles: Warndialog (2.3).

**3 — Konto** *(privat)*
- Login-E-Mail, Passwort

**4 — Benachrichtigungen** *(privat)*
- Creator News per Mail, mit der tatsächlichen Empfängeradresse im Untertext

**5 — Rechtliches & Daten**
- Meine Daten herunterladen (neu, siehe 2.6)
- AGB, Datenschutz, Impressum, Widerruf

**6 — Konto beenden**
- Konto löschen, optisch abgesetzt, eigene Karte

**Was aus dem Profil verschwindet:**
- **Name (`full_name`)** — kommt nirgends an. Entweder streichen oder
  ehrlich als „Echter Name (nur für Rechnungen)“ deklarieren. Empfehlung:
  streichen, die Spalte behalten.
- **Stadt (`city`)** — wird auf keiner öffentlichen Seite gerendert.
  Streichen; wenn sie gewollt ist, muss sie erst im Media Kit ausgegeben
  werden.
- **Plan-Abzeichen** — siehe 2.5.

**Was ins Profil kommt, das dort fehlt:**
- Anfrage-E-Mail (siehe oben)
- Status der öffentlichen Seiten („BioLink live“ / „Media Kit live“ mit
  Link) — heute muss man in zwei Bereiche wechseln, um das zu sehen
- Impressum-Text bleibt bewusst in BioLink und Media Kit: er ist
  seitenbezogen und wird nur gebraucht, wenn eine Seite veröffentlicht wird.

## 2.2 Öffentlich und privat sichtbar trennen

Drei Mittel, gemeinsam:

1. **Zwei Überschriften statt Feldmarker.** „Was Brands sehen“ und „Nur für
   dich“. Das trägt weiter als ein Abzeichen je Zeile.
2. **Ein Marker je Feld** (`öffentlich` / `nur für dich`) für die Fälle, in
   denen die Gruppe nicht reicht — etwa die Anfrage-E-Mail, die neben der
   Login-E-Mail steht und leicht verwechselt wird.
3. **Die Außenansicht selbst** (Variante C): eine Karte, die zeigt, was
   tatsächlich draußen steht. Das ist das einzige Mittel, das auch die Frage
   beantwortet „wie sieht das eigentlich aus“.

## 2.3 Regenerierungs-Logik

**Auslöser.** Regeneriert wird nur, wenn sich ein Wert ändert, der in den
Kopfbereich der BioLink-Seite eingebacken ist: `bio`, `profile_image_url`,
`display_name`, Theme. Alles andere kommt zur Laufzeit aus `biopage_v2` und
braucht keinen Neubau.

**Konsequenzen für heute:**
- Das Media-Kit-Profil-Sheet muss nach einem Foto-Upload ebenfalls
  regenerieren (fehlt).
- `saveBioContactEmail` muss **nicht** mehr regenerieren (überflüssig, samt
  Cloudflare-Purge). Der Kommentar dort ist sachlich falsch und gehört
  korrigiert.
- Wenn die Felder wie in 2.1 zusammengelegt werden, gibt es genau **einen**
  Ort, der regenerieren muss — das Sheet „Öffentliches Profil“.

**Byte-Vergleich.** `commitToGitHub` vergleicht bereits und gibt
`commit: 'unchanged'` zurück. Das wird heute verworfen. Vorschlag: durchreichen
und die Rückmeldung daran hängen.

**Rückmeldung an den Nutzer.** Statt des unsichtbaren
`regenerateBioPageQuietly`:

- Beim Speichern eines relevanten Feldes im Sheet ein Hinweis **vorher**:
  „Deine BioLink-Seite wird danach neu gebaut, damit die Link-Vorschau
  stimmt.“
- Während des Laufs eine Statuszeile in der Profil-Karte: „BioLink wird
  aktualisiert …“, danach „BioLink aktualisiert ✓“ oder bei `unchanged`
  gar nichts.
- Im Fehlerfall **keinen** Toast, sondern eine bleibende Zeile mit
  „Erneut versuchen“. Ein verpasster Toast bedeutet heute: die Seite steht
  mit falscher Vorschau im Netz und niemand merkt es.

## 2.4 Konto löschen

**Dialog.** Ein Dialog statt zwei, dafür ehrlich und konkret:

- Aufzählung dessen, was verschwindet, mit echten Zahlen aus dem Konto
  („viuno.de/annalena wird offline genommen“, „2 Analysen werden gelöscht“).
- Ein Warnblock für das, was bleibt: Kaufbelege wegen § 147 AO, ohne
  Verweis auf die Person.
- **Tipp-Bestätigung** mit dem eigenen Username statt eines zweiten
  Ja-Klicks. Der zweite Klick ist Reflex, das Tippen nicht.
- Der Bestätigungsknopf bekommt `modal-btn-danger` — rot, wie bei BioLink
  und Media Kit.
- Ein Link auf den Datenexport direkt im Dialog: „Vorher Daten
  herunterladen“.

**Löschpfad.** Ergänzungen zu dem, was `delete-account` schon tut:

1. `newsletter_subscribers`: die Zeile **löschen** statt nur `user_id` zu
   nullen — oder mindestens die E-Mail durch einen Hash ersetzen, wenn die
   Wiederanmeldesperre bleiben soll. So wie es ist, widerspricht es der
   eigenen Datenschutzerklärung 9.1.
2. `user_consents`: ebenfalls pseudonymisieren.
3. `subscriptions`: Fremdschlüssel auf `users(id)` nachziehen (es gibt
   keinen), sonst sammeln sich weiter Waisen. Die eine bestehende Waise
   aufräumen.
4. Stripe: klären, ob ein Customer entsteht, und ihn ggf. löschen oder mit
   `deleted_account` markieren.
5. Vor dem Löschen eine Abschiedsmail an die Login-Adresse mit dem Hinweis
   auf die Aufbewahrungspflichten — das ist zugleich der Schutz gegen
   fremdveranlasste Löschung.

**Frist.** Empfehlung: **keine** Frist, aber Export davor. Eine 30-Tage-Frist
bedeutet Soft-Delete-Logik in jeder Query und jeder Public-View — für fünf
Konten unverhältnismäßig. Die Spalte `deleted_at` existiert und wird nicht
genutzt; sie kann bleiben, falls das später anders entschieden wird.

## 2.5 Plan-Anzeige entfernen

**Befund:** `subscription_type` steht bei allen fünf Konten auf `free`
(Default `'free'`). Keine RLS-Policy, keine Datenbankfunktion und kein
Edge-Function-Code liest sie. Das Pro-Banner kann heute also gar nicht
erscheinen. `handle_new_user` legt zusätzlich eine `subscriptions`-Zeile mit
`plan='free'` an — auch die wird nirgends gelesen.

**Was aus der Oberfläche verschwindet:**

| Datei | Zeile | Was |
|---|---|---|
| `public/app/index.html` | 5454 | `.profile-plan`-Abzeichen im Profilkopf |
| `public/app/index.html` | 297–298 | `.plan-free` / `.plan-pro` CSS |
| `public/app/index.html` | 296 | `.profile-plan` CSS |
| `public/app/index.html` | 978–981 | `#sidebar-pro-banner` Markup |
| `public/app/index.html` | 114–117 | `.sidebar-pro-banner*` CSS |
| `public/app/index.html` | 1338 | `classList.toggle('show', p?.subscription_type === 'pro')` |
| `public/app/index.html` | 567 | Dunkel-Theme-Regel für das Banner |
| `public/profile/index.html` | 72–73, 350, 662–668 | dasselbe auf der Standalone-Seite |
| `public/dashboard/index.html` | 589, 595 | Banner-Schalter |
| `public/biolink/index.html` | 637, 659 | Banner-Schalter |
| `public/mediakit/index.html` | 748, 774 | Banner-Schalter |
| `public/digest/index.html` | 417, 423 | Banner-Schalter |
| `sidebar.js` | 237–240 | nur von `public/extras/` benutzt |

**Was im Code bleibt, damit es später ohne Umbau zurückkann:**

- Die Spalte `users.subscription_type` samt Default — unangetastet.
- Die Tabelle `subscriptions` und der Insert in `handle_new_user`.
- Die `subscription_type`-Spalte in den bestehenden `select`-Listen der
  Views (Zeilen 1322, 2465, 3347, 4123, 4521) — sie kostet nichts und ist
  der Wiedereinstiegspunkt.
- Eine Konstante an einer Stelle, etwa
  `const PLAENE_SICHTBAR = false`, und die Anzeigezweige dahinter statt sie
  zu löschen. Dann ist das Zurückholen ein Wortwechsel, kein Umbau.

**Nicht anfassen:** `is_managed_creator` — das ist kein Plan, sondern eine
Betreuungskennzeichnung, und `scan-managed-creator` hängt daran.

## 2.6 Was fehlt, aber wichtig ist

1. **Datenexport.** In den AGB zugesagt. Eine Edge Function, die die
   Zeilen des Nutzers aus `users`, `analysis_runs`, `analyse_stats`,
   `analyse_ki`, `biolink_custom_links`, `mediakit_*`, `user_consents`,
   `analysis_purchases` als JSON zusammenstellt und per Mail als Anhang
   verschickt. Kein Download-Link im Browser — dann muss niemand über
   Ablaufzeiten nachdenken.
2. **Benachrichtigung bei sicherheitsrelevanten Änderungen.** Mail an die
   **alte** Adresse bei E-Mail-Wechsel, Mail bei Passwortwechsel.
3. **`users.email` nachziehen.** Trigger auf
   `auth.users UPDATE OF email`, analog zu `sync_email_verified`. Sonst
   laufen Anzeige und Mailversand auseinander.
4. **Bilder verkleinern vor dem Upload.** Canvas, max. 800 px Kante,
   JPEG q≈0.85. Das ist zehn Zeilen im Client und verhindert 5-MB-Avatare
   auf öffentlichen Seiten.
5. **Alte Profilbilder aufräumen.** Beim Upload das vorherige Bild löschen
   (braucht eine DELETE-Policy auf dem eigenen Ordner).
6. **Fehlerpfad für die Profil-Query.** Heute bleibt bei einem Fehler das
   Skeleton stehen.
7. **Media-Kit-OG-Tags.** Ein geteilter Media-Kit-Link hat heute den Titel
   „Media Kit“ und keine Beschreibung — für ein Werkzeug, dessen einziger
   Zweck das Teilen mit Marken ist, ist das der teuerste einzelne Mangel.
   Gehört in den Media-Kit-Bereich, sei hier aber genannt, weil die
   Regenerierungslogik dieselbe wäre.
8. **Rechtstexte nachziehen.** Anfragen raus, „täglich“ → „wöchentlich“.

---

# Phase 3 — Drei Vorschläge

Dateien unter `/tmp/profil-preview/` — bewusst außerhalb von `public/`:

- `index.html` — Übersicht mit Gegenüberstellung
- `variante-bc.html` — **B im Design von C, die gewählte Richtung**
- `variante-a.html` — eine Seite, Feld für Feld
- `variante-b.html` — Karten und Sheets
- `variante-c.html` — Außenansicht und Einstellungen
- `_basis.css` — das Token-Set der App, 1:1 aus `:root`

Jede Datei hat oben eine schwarze Leiste mit drei Schaltern: Normalzustand,
ein Feld im Bearbeiten-Modus, Konto-löschen-Dialog. Mobil ab 390 px, ab
900 px mit Seitenleiste. Keine echten Aufrufe, nur Markup und CSS.

## Gegenüberstellung

| Kriterium | A — Eine Seite | B — Karten & Sheets | C — Außenansicht |
|---|---|---|---|
| Taps bis zur Änderung eines Feldes | **3** | 4 | **3** intern / 4 öffentlich |
| Taps bis „was ist öffentlich?“ | 0, über Marker je Zeile | 0, über die Gruppe | **0, man sieht es** |
| Scrolltiefe mobil | lang (≈ 4 Bildschirme) | **kurz (1,5)** | mittel (2,5) |
| Aufwand auf die bestehende Logik | **hoch** — je Feld ein eigener Schreib-, Lade- und Fehlerzustand; die Sammel-Speicherung muss aufgelöst werden | **niedrig** — `renderEditMenu`, die Sheet-Mechanik und die gruppenweise Speicherung gibt es schon in BioLink und Media Kit | mittel — Karte ist neu, Liste trivial, Sheets wiederverwendbar |
| Risiko | viele kleine Schreibpfade, jeder kann still scheitern; Regenerierung pro Feld schwer zu steuern | gering; bekanntes Muster, eine Speicherung je Gruppe, Regenerierung genau einmal je Sheet | gering bis mittel; die Karte muss der echten Ausgabe entsprechen, sonst verspricht sie Falsches |
| Passt zum Rest der App | eher nicht — sonst nirgends Inline-Bearbeitung | **ja** | teilweise |
| Stärke | schnellste Einzeländerung | geringster Aufwand, klare Struktur | beantwortet die wichtigste Frage ungefragt |
| Schwäche | lange Seite, viel neue Logik | ein Tap mehr | Doppelung: die Karte zeigt, was die Liste bearbeitet |

**Gewählt: B im Design von C** (`variante-bc.html`). Die Karten-Struktur ist
die einzige, die nichts Neues erfindet — sie ist dasselbe Muster wie das
Media-Kit-Edit-Menü, das schon steht und das die Nutzer aus zwei anderen
Bereichen kennen. Die Außenansicht aus C darüber gesetzt löst das
Öffentlich/Privat-Problem besser als jeder Feldmarker und kostet eine Karte
ohne eigene Logik. A ist die eleganteste Bedienung und der teuerste Umbau;
sie lohnt sich erst, wenn die Felder ohnehin einzeln gespeichert werden
müssten.

## Die gewählte Fassung im Einzelnen

```
So sehen dich Brands      [Bearbeiten]
  ┌────────────────────────────────┐
  │  Foto · Name · Nische · Bio    │   ← genau die Ausgabe von
  │  Kanäle als Chips              │     BioLink und Media Kit
  │  Anfragen an …                 │
  ├───────────────┬────────────────┤
  │ viuno.de/…  ↗ │ viuno.de/kit/…↗│
  └───────────────┴────────────────┘
  Genau das ist öffentlich abrufbar …

ÖFFENTLICHE ANGABEN
  Profil            Foto · Username · Bio · Nische   [Vollständig] ›
  Kanäle            Instagram · TikTok               [2 von 4]     ›
  Anfrage-E-Mail    anfragen@annalena.de                           ›

NUR FÜR DICH
  Konto             anna@example.de · Passwort 2.8.2026            ›
  Benachrichtigungen Creator News jeden Montag        [An]          ›
  Rechtliches & Daten AGB, Datenschutz, …, Datenexport             ›

  Konto löschen                                                    ›
```

Was die Kombination gegenüber den Einzelvarianten gewinnt:

- **Die Karte ersetzt die Feldmarker.** Kein `öffentlich`-Abzeichen an jeder
  Zeile mehr — die Trennung steckt in „So sehen dich Brands“ gegen „Nur für
  dich“, und darüber steht die Ausgabe selbst. Das ist ruhiger als B und
  eindeutiger als A.
- **Die Karte ist zugleich die Kontrolle.** Sie zeigt fehlende Kanäle als
  gestrichelte Chips (`YouTube +`) und fehlende Angaben als Lücke. Was
  heute zwei Bereichswechsel kostet („steht mein Media Kit? was steht
  drauf?“), ist eine Bildschirmhöhe.
- **Zwei Wege in dasselbe Sheet.** „Bearbeiten“ an der Karte und die
  Profil-Zeile darunter öffnen dasselbe — die Doppelung, die bei C als
  Schwäche stand, wird hier zum zweiten Einstieg statt zu einer zweiten
  Oberfläche.
- **Die Statusabzeichen bleiben** (`Vollständig`, `2 von 4`, `An`) — die
  einzige Anleihe aus B, die C nicht hat, und die einzige Stelle, an der ein
  Creator sieht, dass noch etwas fehlt, ohne das Sheet zu öffnen.
- **Eine Regenerierungsstelle.** Alles, was einen Neubau der BioLink-Seite
  auslöst (Foto, Bio, Username), liegt im Sheet „Profil“. Der Hinweis steht
  dort vorher, nicht als Toast hinterher.

Die Gefahr der Variante bleibt dieselbe wie bei C: **die Karte muss der
echten Ausgabe entsprechen.** Sie darf kein Idealbild zeigen. Konkret heißt
das: dieselbe Reihenfolge wie `renderHeader` im BioLink-Template, dieselbe
Nischen-Beschriftung wie der Media Kit, und wenn `contact_email` leer ist,
steht dort nicht „—“, sondern „Ohne Adresse erscheint kein Kontakt-Button“.

---

# Priorisierung

## Bug — heute

| # | Sache | Warum jetzt | Aufwand |
|---|---|---|---|
| 1 | `delete-account`, `change-username` **und `admin-dashboard`**: `verify_jwt: true` setzen und `supabase.auth.getUser(token)` statt der ungeprüften Dekodierung | Fremde Konten löschbar, fremde Seiten abschaltbar, und über `admin-dashboard` alle Nutzer-, Newsletter- und Kontaktadressen abrufbar — ohne eigenes Konto. Die UUIDs stehen öffentlich in den Tracking-Pixeln. | klein — dieselbe Korrektur dreimal, `generate-biolink` zeigt das Muster |
| 1b | `cleanup-user-pages`: Slug aus `users.display_name` ableiten statt aus `biolink_settings.slug` | Kontolöschung lässt die öffentliche BioLink- und Media-Kit-Datei im Repo stehen; ab Generator v16 samt Name, Bio und Bildadresse in den Meta-Tags | klein |
| 1c | `public/stradi/`, `public/antika/`, `public/kit/stradi/` löschen | verwaiste Generator-Seiten ohne zugehöriges Konto | winzig |
| 2 | Spalten-Grants auf `users` einschränken: `REVOKE UPDATE`, dann `GRANT UPDATE (bio, full_name, city, niche_category, instagram_handle, tiktok_handle, youtube_handle, threads_handle, contact_email, profile_image_url, impressum_text, updated_at, …)` | Selbstbeförderung zum Admin → Rechtstexte, News, alle Newsletter-Adressen | klein, ein Migrationsschritt; danach prüfen, ob Onboarding und Editoren noch schreiben können |
| 3 | Storage-UPDATE-Policy auf `(storage.foldername(name))[1] = auth.uid()::text` verschärfen | fremde Profilbilder überschreibbar | klein |
| 4 | `window.saveHandles` in der BioLink-View umbenennen (z. B. `saveBioHandles`) | der Speichern-Knopf im BioLink-Kanäle-Sheet tut nichts | winzig; CLAUDE.md-Liste der umbenannten Globals ergänzen |
| 5 | Trigger `auth.users UPDATE OF email` → `public.users.email` | Newsletter geht an die alte Adresse | klein |
| 6 | `--radius-sm` → `--r-sm` an sechs Stellen | sechs eckige Ecken mitten im Formular | winzig |
| 7 | Foto-Upload im Media-Kit-Sheet regeneriert nicht | geteilter Link behält das alte Vorschaubild | winzig |

## Verbesserung

| # | Sache | Wirkung | Aufwand |
|---|---|---|---|
| 8 | Nische vereinheitlichen: Freitext im Media-Kit-Sheet durch dieselbe Auswahl ersetzen, Anzeige über eine Label-Tabelle statt Rohwert | `mental_health` steht heute so auf öffentlichen Media Kits | klein |
| 9 | Handle-Wechsel-Warnung, wenn zu dem Kanal eine Analyse existiert | stiller Datenverlust im Analyse-Verlauf | klein |
| 10 | Profil auf `variante-bc` umbauen (B im Design von C) | löst Gruppierung, Öffentlich/Privat und Doppelung in einem Schritt | mittel |
| 11 | Foto, Bio, Anfrage-E-Mail aus BioLink- und Media-Kit-Sheets ins Profil ziehen, dort nur noch verlinken | ein Feld, ein Ort; eine Regenerierungsstelle statt drei | mittel |
| 12 | Löschdialog: eine Stufe, echte Zahlen, Tipp-Bestätigung, roter Knopf | die zweite Ja-Stufe ist Reflex | klein |
| 13 | Bilder vor dem Upload verkleinern, altes Bild löschen | 5-MB-Avatare auf öffentlichen Seiten, Storage wächst unbegrenzt | klein |
| 14 | Regenerierungs-Rückmeldung sichtbar machen, `commit: 'unchanged'` auswerten | ein verpasster Fehler-Toast = falsche Link-Vorschau im Netz | klein |
| 15 | `full_name` und `city` aus dem Formular nehmen | zwei Felder, die nirgends ankommen | winzig |
| 16 | Mail an die alte Adresse bei E-Mail- und Passwortwechsel | einziger sinnvoller Kontoschutz für diese Zielgruppe | klein |
| 17 | Instagram-/TikTok-Format prüfen wie in der Analyse | kaputte Links auf der öffentlichen Seite | winzig |
| 18 | Passwort-Modal: Bestätigungsfeld live prüfen, Knopfbeschriftung stabil | zwei kleine Ärgernisse | winzig |
| 19 | Fehlerpfad für die Profil-Query | Dauer-Skeleton bei Netzfehler | winzig |

## Geschäftsentscheidung

| # | Frage |
|---|---|
| 20 | **Plan-Anzeige raus** (2.5). Entschieden — hier nur noch das Wie: Konstante statt Löschung, damit es zurückkann. |
| 21 | **Datenexport.** In den AGB zugesagt, existiert nicht. Entweder bauen oder die AGB ändern. Bauen ist billiger als die Diskussion. |
| 22 | **`newsletter_subscribers` nach Kontolöschung.** Adresse löschen (sauber) oder hashen (verhindert stille Wiederanmeldung). Die Datenschutzerklärung beschreibt heute den ersten Fall, der Code macht keinen von beiden. |
| 23 | **Rechtstexte nachziehen** (Anfragen raus, täglich → wöchentlich). Braucht wieder anwaltlichen Blick. |
| 24 | **Zwei-Faktor und Geräteliste.** Empfehlung: nein, stattdessen #16. |
| 25 | **Löschfrist.** Empfehlung: keine, dafür Export davor. |
| 26 | **Öffentliche Newsletter-Anmeldungen.** Wer sich ohne Konto anmeldet und bestätigt, landet in `newsletter_subscribers`, bekommt aber nie eine Mail — `send-weekly-digest-email` liest `users`, nicht die Tabelle. Heute zwei Adressen im Zustand `pending`. Gehört in den News-Bereich, ist aber ein echter Ausfall. |

---

# Offene Fragen

1. `full_name` — streichen oder als Rechnungsname behalten? Stripe bekommt
   heute keinen Namen von uns.
2. `city` — ganz weg, oder auf dem Media Kit ausgeben (dann wäre das Feld
   sinnvoll)?
3. Soll die Anfrage-E-Mail ins Profil wandern, obwohl sie im BioLink-Editor
   an der Stelle steht, an der man sie erwartet? (Vorschlag: ja, ins Profil,
   im BioLink-Editor als schreibgeschützte Zeile mit Link.)
4. ~~Erzeugt `create-checkout-session` einen dauerhaften Stripe-Customer?~~
   **Geprüft: nein.** Es wird `customer_email` übergeben, kein `customer`,
   und keine Kundennummer gespeichert. Der Löschpfad braucht dort nichts.
5. Soll der Username überhaupt änderbar bleiben? Er kostet BioLink und Media
   Kit und ist die häufigste Quelle toter Links. Alternative: einmal nach
   dem Onboarding, danach nur auf Anfrage.
6. Wollen wir `is_verified` (den Haken auf dem BioLink) im Profil anzeigen —
   heute sieht der Creator nicht, ob er ihn hat.
7. Gibt es jemanden, der `deleted_at` oder `subscriptions` außerhalb der App
   auswertet? Sonst können beide beim Aufräumen mitgehen.
