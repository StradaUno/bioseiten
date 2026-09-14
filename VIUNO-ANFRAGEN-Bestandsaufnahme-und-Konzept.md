# viuno Anfragen — Bestandsaufnahme und Konzept

**Stand:** 14. September 2026
**Umfang:** Anfrage-Overlay auf der öffentlichen BioLink-Seite (`#cf-overlay`), Edge Function `notify-new-request`, Tabellen `collab_requests` / `collab_request_activities`, vier Insert-/Update-Trigger, `handle_new_user`, SPA-View `renderRequests`, Standalone-Seite `/requests/`, Media-Kit-Kontaktweg, Dashboard-Kachel
**Zielvorgabe:** Über die eigene Seite sollen Kooperationsanfragen von Brands hereinkommen, im Anfragen-Center landen und beantwortet werden.
**Status:** reine Analyse — nichts geändert.

---

## Kurzfassung vorab

Das Anfragen-System ist der am weitesten durchgebaute Bereich der App: zweistufiges Overlay, Honeypot, Mail mit Reply-To, Status-Pills, Notizen, Timeline, Empty State, Soft-Delete. Es ist auch der Bereich mit dem klarsten Messergebnis — und das Ergebnis ist unangenehm.

Sechs Befunde bestimmen alles Weitere:

1. **`notify-new-request` ist ein offener Endpunkt.** Verifiziert: `POST` ohne `apikey`, ohne JWT, ohne jeden Header → HTTP 200. Die Function nimmt den `record` aus dem Request-Body **ungeprüft** entgegen und gleicht ihn nie gegen die Datenbank ab. Wer eine Creator-UUID kennt — sie steht im Quelltext jeder öffentlichen BioLink- und Media-Kit-Seite — kann von `noreply@viuno.de` beliebige Mails an diesen Creator schicken, mit frei gewähltem Absendernamen, freiem Text und **frei gewähltem Reply-To**. Es braucht dafür nicht einmal eine Zeile in `collab_requests`. Das ist der schwerste Befund des Berichts.

2. **In 2.059 BioLink-Aufrufen ist keine einzige echte Kooperationsanfrage entstanden.** `collab_requests` hat neun Zeilen: fünf Demo-Anfragen „von viuno", zwei Selbsttests von Mehmet, und zwei private Anmach-Nachrichten auf Italienisch („Ciao bambolina sei molto carina…", „Ciao scrivimi"). Echte Brand-Anfragen: null. Die Conversion ist nicht schlecht — sie existiert nicht.

3. **Der einzige Anfrage-Knopf, den es auf der Welt gibt, steht auf einer italienischsprachigen Fan-Seite und heißt „Scrivimi".** Genau ein Creator hat einen aktiven BioLink (`biolink_settings.is_active`): Antonietta, Sprache `it`. Der Button wird als **letztes** Element unter alle Links gehängt, ist der einzige gefüllte Button (`btn-primary`) der Seite — also das visuell stärkste Element — und trägt im Italienischen die Beschriftung „Scrivimi" („schreib mir"). Das Formular fragt danach „Wie kann ich helfen?" und „Damit ich dich erreichen kann." Ein Fan liest das als Nachrichtenfunktion. Genau das ist eingetroffen.

4. **Vier von fünf Creatorn sehen auf dem Dashboard „1 · Neue Anfrage", die es nicht gibt.** `handle_new_user` legt bei der Registrierung eine Demo-Anfrage mit `status='new'` an. Die zählt in `users.new_requests_count`, in der Dashboard-Kachel und im „x neu"-Badge der Anfragen-View. Sie löst über den Insert-Trigger zusätzlich eine **echte Mail „Neue Anfrage erhalten"** aus. Gleichzeitig existiert in der Anfragen-View ein fertig gebauter Empty State mit genau der Erklärung, die ein neuer Nutzer braucht („Noch keine Anfragen — Erstelle deine Präsenz, damit Brands dich finden können", plus CTAs auf BioLink und Media Kit). Er wird **nie angezeigt**, weil die Demo-Zeile ihn verdrängt.

5. **Das Media Kit hängt nicht am Anfragen-System.** Es hat einen rohen `mailto:` auf `users.contact_email`. Vier von fünf Nutzern haben keine `contact_email` gesetzt — dann entsteht `mailto:?subject=Kooperationsanfrage`, ein Knopf ins Leere. Media-Kit-Anfragen landen nie in `collab_requests`, haben keinen Status, lösen keine Benachrichtigung aus, und die private Mailadresse steht abgreifbar im Quelltext. Obendrein liest der generische Renderer `public/kit/index.html` eine View namens `media_kit_public` — die heißt in der Datenbank `mediakit_public` und existiert unter dem abgefragten Namen nicht.

6. **Kein Rate-Limit, keine Längenbegrenzung, kein Index.** Die RLS-Insert-Policy ist `WITH CHECK (true)`: jede beliebige `creator_id`, beliebig oft, beliebig lang. Pro Insert feuern vier Trigger, einer davon ein `net.http_post`. Und `collab_requests` hat **keinen Index auf `creator_id`** — jeder Listenaufruf und jeder der vier Trigger macht einen Seq Scan.

Dazu die Messlage: **Es gibt keinerlei Trichterdaten.** Wie oft das Overlay geöffnet und wieder verlassen wurde, ist nirgends erfasst. Bekannt sind nur die beiden Enden: 2.059 BioLink-Aufrufe, 4 echte Zeilen. Alles dazwischen ist blind.

---

# Phase 1: Bestandsaufnahme

## A. Eingang — aus Brand-Sicht

### A.1 Wo das Formular überhaupt lebt

| Ort | Weg zur Anfrage | landet in `collab_requests`? |
|---|---|---|
| BioLink-Seite (generiert von `generate-biolink` v15) | Button „Anfragen" / „Request" / „Scrivimi", **letztes** Element der Linkliste, `btn-primary` | ja |
| `public/antonietta/`, `public/stradauno/` (handgebaut) | dito | ja |
| `public/kit/stradauno/` (Media Kit, handgebaut) | Formular | ja |
| `public/kit/antonietta/`, `public/kit/stradi/` (Media Kit) | roher `mailto:` | **nein** |
| `public/kit/index.html` (generischer Media-Kit-Renderer) | `mailto:` auf `contact_email`, Fallback `mailto:?subject=…` | **nein** |
| SPA-Vorschau `#/mediakit` | kein Kontaktweg | — |
| `public/it/index.html` (Marketing-Startseite IT) | eigenes `cf-overlay` → Edge Function `contact-submit` | **nein** (andere Tabelle) |
| `public/bio-template.html` (Repo-Template) | Formular **ohne Honeypot** | ja |

Zwei Dinge fallen hier auf:

- **Das Repo-Template ist veraltet.** `public/bio-template.html` enthält das Formular ohne Honeypot-Feld. Die tatsächlich ausgelieferten Seiten entstehen aus `generate-biolink` (Edge Function, v15), und die hat `cf-hp` / `company_url` drin. Das Template im Repo dokumentiert also einen Stand, den es live nicht mehr gibt.
- **Der Anfrage-Button ist nicht abschaltbar.** `biolink_settings` hat keine Spalte dafür. Wer nur eine Linkliste will, bekommt den Kontaktkanal trotzdem — inklusive der Fan-Nachrichten.

### A.2 Das Formular, Feld für Feld

**Slide 1 — „Wie kann ich helfen?" / „Wähle, was zu deiner Anfrage passt."**

| Feld | Pflicht | Werte |
|---|---|---|
| `request_type` (4 Karten, Einfachauswahl) | ja | `brand` „Brand Deal — Kooperation mit Unternehmen" · `collab` „Collab — Gemeinsames Projekt mit anderen Creatorn" · `event` „Event / Einladung — Auftritt, Launch, Presse-Event" · `sonstiges` „Sonstiges — Etwas anderes, erzähl mir davon" |

**Slide 2 — „Deine Angaben" / „Damit ich dich erreichen kann."**

| Feld | Pflicht | Sichtbar bei | Validierung |
|---|---|---|---|
| `sender_name` „Name / Firma" | ja | immer | nur „nicht leer" |
| `sender_email` „E-Mail" | ja | immer | `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`, clientseitig |
| `sender_website` „Website (optional)" | nein | `brand`, `collab` | keine; `normalizeUrl()` setzt `https://` davor, wenn kein Schema da ist |
| `budget` „Budget-Rahmen (optional)", 5 Chips | nein | nur `brand` | keine |
| `message` „Nachricht" | ja | immer | nur „nicht leer", **kein `maxlength`** |
| `company_url` (Honeypot, off-screen) | — | immer | wenn gefüllt: kein POST, aber Erfolgsbildschirm |

**Der Budget-Chip ist irreführend.** Die Chips heißen „unter 250 €", „250 – 500 €", „500 – 1.000 €", „1.000 €+" und tragen die Werte `250`, `500`, `1000`, `1001`. Gespeichert wird `parseFloat(...)` in einer `numeric`-Spalte. Angezeigt wird daraus in App **und** Mail `€ 250` bzw. `€ 1.001` — aus einer Spanne wird eine exakte Zahl. Wer „unter 250 €" wählt, erscheint beim Creator mit „€ 250"; wer „1.000 €+" wählt, mit „€ 1.001". Die eine reale Testzeile (`budget = 500.00`) kam aus dem Chip „250 – 500 €".

Serverseitig geprüft wird davon **nichts** außer: `sender_name`/`sender_email` NOT NULL und `CHECK (request_type IN ('brand','collab','event','sonstiges'))`. Keine E-Mail-Syntax, keine Längen, keine Pflicht auf `message` (in der DB ist `message` nullable).

### A.3 Ausfüllen am Handy

Ohne Tippzeit: Button → Karte antippen → „Weiter" → drei Felder → „Anfrage senden" = 6 Interaktionen, zwei Bildschirme. Mit realistischer Nachricht landet man bei **etwa einer Minute**. Das ist für die Menge an abgefragter Information eher kurz — was auch der Punkt ist: es wird zu wenig gefragt, um eine Brand-Anfrage von einer Fan-Nachricht unterscheidbar zu machen (siehe D).

Das Overlay ist `position:fixed;inset:0` über die ganze Seite, mit Fortschrittsbalken „1 von 2". Escape schließt, ein Close-X oben links. `resetInquiry()` leert nach 300 ms alles — wer versehentlich schließt, verliert den Text ersatzlos. Kein Entwurfsspeicher, kein „Wirklich abbrechen?".

### A.4 Datenschutzhinweis: gibt es keinen

Auf der BioLink-Seite steht im Footer: „powered by viuno", ein **Impressum**-Knopf (öffnet den vom Creator selbst hinterlegten `impressum_text`), und der Sprachumschalter. **Kein Link auf die Datenschutzerklärung.** Im Formular selbst ebenfalls nicht — keine Zeile, keine Checkbox, kein Link.

Die Datenschutzerklärung (`legal_texts.datenschutz`, 18.511 Zeichen, zuletzt 13.09.) deckt den Vorgang durchaus ab:

> 3.5 Bei Erhalt von Anfragen über deinen BioLink • Name, E-Mail-Adresse, optional Website und Nachricht des Anfragenden • Zeitstempel und Bearbeitungsstatus der Anfrage

Aber sie ist durchgehend an den **Creator** adressiert („dein BioLink"). Die betroffene Person beim Anfrage-Formular ist der **Absender**, und der bekommt an keiner Stelle eine Information nach Art. 13 DSGVO und erreicht die Erklärung von der BioLink-Seite aus auch nicht. Das ist die klarste rechtliche Lücke in diesem Bereich.

### A.5 Bestätigung an den Absender

**Bildschirm:** ja. Slide 3 zeigt einen grünen Haken, „Anfrage gesendet!" und `„{Creator-Name} meldet sich bald bei dir."`, dazu „Schließen".

**Mail:** nein. `notify-new-request` schickt ausschließlich an den Creator. Der Absender bekommt nichts — keine Kopie, keinen Beleg, keine Adresse, unter der er nachfassen könnte. Für eine Agentur, die zehn Creator anschreibt, ist eine Anfrage ohne Bestätigung praktisch nicht nachverfolgbar.

Der Erfolgsbildschirm erscheint auch, wenn der Honeypot angeschlagen hat — absichtlich, damit der Bot nichts merkt. Nebenwirkung: ein Mensch, dessen Passwortmanager das versteckte Feld „Firma" befüllt, bekommt „Anfrage gesendet!" zu sehen, obwohl nichts gesendet wurde.

### A.6 Sicherheit

**Rate-Limit: keins.** Nirgends. Der POST geht direkt auf `https://…supabase.co/rest/v1/collab_requests` — also an Cloudflare vorbei, ohne WAF, ohne Turnstile. Es gibt nur die globalen Supabase-Limits.

**RLS:**

| Policy | Befehl | Bedingung |
|---|---|---|
| `collab_requests_insert_public` | INSERT | `WITH CHECK (true)` |
| `collab_requests_creator_read` | SELECT | `auth.uid() = creator_id` |
| `collab_requests_creator_update` | UPDATE | `auth.uid() = creator_id` |
| — | DELETE | **existiert nicht** |

**Kann jemand für einen fremden Creator Anfragen einspielen?** Ja, ohne jede Hürde. `WITH CHECK (true)` prüft die `creator_id` nicht, und die UUIDs stehen im Klartext im Quelltext jeder öffentlichen Seite (im `creator_id` des Formulars, im Tracking-Pixel und in jeder Bild-URL unter `profile-images/<UUID>/`). Es wird auch nicht geprüft, ob dieser Creator überhaupt einen aktiven BioLink hat.

**Kann man `collab_requests` von außen lesen?** Nein — verifiziert:

```
GET /rest/v1/collab_requests?select=sender_email&limit=3   (publishable key)
→ HTTP 200  []
```

Die Insert-Policy verhindert außerdem kein `Prefer: return=representation`, aber da die SELECT-Policy greift, kommt trotzdem nichts zurück. Der Lesepfad ist in Ordnung.

**Kein Hard-Delete möglich.** Ohne DELETE-Policy kann auch der Creator eine Zeile nicht wirklich löschen. `deleteRequest()` setzt `deleted_at` **und** `status='deleted'`. Die Daten des Absenders — Name, Mailadresse, Nachricht — bleiben unbefristet in der Tabelle stehen. Das widerspricht dem, was die App dem Creator mit „Gelöscht ✓" sagt, und macht ein Löschverlangen des Absenders (Art. 17) technisch unerfüllbar.

**Keine Aufbewahrungsfrist umgesetzt.** Die Datenschutzerklärung verspricht: „Anfragen über den BioLink: bis zu 24 Monate, dann Löschung". In `cron.job` stehen sieben Jobs — für Analysedaten (`purge-alte-analysedaten`) und Freigaben (`purge-abgelaufene-freigaben`) gibt es Purges, **für `collab_requests` nicht**. Die älteste Zeile ist vom 21.04.2026; das Versprechen wird erst im April 2028 fällig, aber heute gibt es nichts, was es einlösen würde.

**Bei Account-Löschung** greift dagegen alles: `collab_requests_creator_id_fkey … ON DELETE CASCADE` auf `users(id)`, und `collab_request_activities` hängt ebenfalls per CASCADE dran. Der Abschnitt 9.1 der Datenschutzerklärung stimmt.

**Spam-Schutz über den Honeypot hinaus: keiner.** Kein Captcha, keine IP-Drossel, keine Blocklist, keine Dublettenprüfung, keine Mindestlänge, kein Abgleich der Absenderdomain. Der Honeypot (`company_url`, `position:absolute;left:-9999px`, `tabindex="-1"`, `autocomplete="off"`) fängt nur naive Formularbots — und gegen die beiden realen Fälle hätte er nichts ausgerichtet, denn das waren Menschen.

**Der offene Mail-Endpunkt.** `notify-new-request` läuft mit `verify_jwt: false` und ist damit vollständig unauthentifiziert erreichbar. Verifiziert:

```
POST /functions/v1/notify-new-request   (ohne apikey, ohne Authorization)
Body: {"record":{}}
→ HTTP 200  {"success":false,"error":"id oder creator_id fehlt"}
```

Die Function prüft nur, ob `id` und `creator_id` im Body **vorhanden** sind. Danach liest sie aus der Datenbank **ausschließlich** die Mailadresse des Creators — `sender_name`, `sender_email`, `message`, `budget`, `request_type` nimmt sie unverändert aus dem Request-Body und baut daraus die Mail. Konsequenzen:

- Jeder kann mit einer bekannten Creator-UUID Mails von `noreply@viuno.de` an diesen Creator auslösen, beliebig oft, mit beliebigem Inhalt.
- `reply_to` wird auf den mitgeschickten `sender_email` gesetzt — der Angreifer bestimmt also, wohin die Antwort des Creators geht.
- Die Mail trägt Betreff `Neue Anfrage von <frei wählbar>` und das echte viuno-Layout. Sie ist von einer legitimen Benachrichtigung nicht zu unterscheiden.
- Es entsteht **keine Zeile** in `collab_requests`. Der Creator öffnet die App, findet nichts, und hat keinen Weg herauszufinden, was passiert ist.
- Das schadet zusätzlich der Zustellbarkeit von `viuno.de` insgesamt.

Ein zweiter, kleinerer Punkt aus demselben Muster: `esc()` escaped `& < >` für den HTML-Body, aber der **Betreff** übernimmt `record.sender_name` roh.

Der Supabase-Advisor meldet außerdem `public.trigger_notify_new_request()` als vom `anon`-Rollenkontext über `/rest/v1/rpc/` aufrufbar. Das ist nicht ausnutzbar — Postgres lehnt den direkten Aufruf einer Trigger-Funktion ab —, sollte aber beim Aufräumen mit erledigt werden.

### A.7 Was der Mail-Trigger bei 100 Anfragen in einer Minute macht

Pro Insert feuern **vier** Trigger:

| Trigger | Funktion | Was passiert |
|---|---|---|
| `on_collab_request_created` | `trigger_notify_new_request` | `net.http_post` auf `notify-new-request`, ohne Auth-Header |
| `on_collab_request_insert` | `handle_collab_request_activity` | INSERT in `collab_request_activities` |
| `trigger_new_requests_count` | `update_new_requests_count` | `UPDATE users SET new_requests_count = (SELECT COUNT(*) …)` |
| `on_collab_request_update` | `handle_collab_request_activity` | (nur bei UPDATE) |

Bei 100 Inserts in einer Minute:

- **100 `net.http_post`** in die pg_net-Queue → 100 Aufrufe von `notify-new-request` → 100 Aufrufe der Resend-API. Resend drosselt standardmäßig bei **2 Requests/Sekunde**. Ein über 60 s verteilter Strom (1,67/s) geht gerade noch durch; ein Burst von 100 in wenigen Sekunden erzeugt HTTP 429. Die Function wirft dann, schreibt nach `admin_errors` und antwortet trotzdem mit **HTTP 200**. Es gibt **keinen Retry**. Die betroffenen Mails sind endgültig verloren — die Zeile in `collab_requests` existiert, die Benachrichtigung nicht.
- **100 `SELECT COUNT(*)`** über `collab_requests`, gefiltert auf `creator_id` und `status` — ohne Index auf `creator_id` je ein **Seq Scan**. Heute bei 9 Zeilen irrelevant, bei 10.000 Zeilen ein quadratisches Problem.
- **100 zusätzliche INSERTs** in `collab_request_activities`, jeder mit der vollständigen Nachricht im `content` — die Nachricht liegt also doppelt in der Datenbank.
- **100 Mails** im Postfach des Creators, ohne Bündelung, ohne Digest, ohne Deckel.

Es gibt keinen Circuit-Breaker und keine Obergrenze pro Creator und Stunde.

### A.8 Zwei Cross-Site-Scripting-Wege über die Detailansicht

Beide setzen einen direkten POST auf die REST-API voraus — das Formular selbst ist nicht der Weg —, und beide treffen die **eingeloggte** Session des Creators auf `viuno.de`.

1. **`sender_email` im `mailto:`-Link.** In `renderDetail()` (`public/app/index.html:5504` und `public/requests/index.html:363`):

   ```js
   const mailtoHref=`mailto:${r.sender_email}?subject=…`
   …  <a … href="${mailtoHref}">
   ```

   `r.sender_email` wird **nicht** durch `escHtml()` geschickt und nicht URL-kodiert. Ein `sender_email`, das ein `"` enthält, bricht aus dem Attribut aus. Die DB erzwingt kein E-Mail-Format, die Prüfung ist rein clientseitig.

2. **`sender_website` als `href`.** Der Wert geht durch `escHtml()` (das auch `"` und `'` escaped), aber das Schema wird nicht geprüft. Über das Formular ist das unkritisch, weil `normalizeUrl()` `https://` voranstellt; über einen direkten POST kann dort `javascript:…` stehen, und die Detailansicht rendert es als klickbaren „Website ↗"-Pill.

## B. Verarbeitung — aus Creator-Sicht

### B.1 Wie der Creator erfährt, dass etwas da ist

| Kanal | Vorhanden | Anmerkung |
|---|---|---|
| E-Mail | ja | sofort, über den Insert-Trigger |
| Push | nein | keine Registrierung, kein Service Worker |
| Dashboard-Kachel „Anfragen" | ja | Zahl der `status='new'`, Untertitel „Neue Anfrage" / „Neue Anfragen" / „Keine neuen" |
| Badge in der Anfragen-View | ja | „x neu" |
| Punkt in der Seitenleiste | **nein** | Creator News hat einen, Anfragen nicht |
| In-App-Toast / Realtime | nein | die Liste lädt nur beim Betreten der View |

Wer die Mail übersieht und nicht aufs Dashboard geht, erfährt nichts. Der fehlende Seitenleisten-Punkt ist die auffälligste Inkonsistenz — ausgerechnet der Bereich, in dem Geld entsteht, ist der einzige ohne Anzeiger.

### B.2 Die Mail an den Creator

`notify-new-request` v7, Versand über Resend.

| | |
|---|---|
| Von | `viuno <noreply@viuno.de>` |
| An | `users.contact_email` → Fallback `users.email` |
| **Reply-To** | **`record.sender_email`** — ja, korrekt gesetzt |
| Betreff | `Neue Anfrage von <sender_name>` |
| Inhalt | Kopfzeile mit viuno-Logo · „Neue Anfrage erhalten" · „**Name** hat dir über deine viuno-Seite eine Anfrage geschickt." · graue Box mit Typ-Label, Budget, „Von: Name &lt;mail&gt;", Nachricht · schwarzer Button „Anfrage in viuno ansehen" · Footer mit Impressum/Datenschutz |
| Design | passt zum Token-Set (`#F0EFED`, `#FAFAF8`, `#1C1A18`, `#E8FF59`) |

Was fehlt oder nicht stimmt:

- **Der Button zeigt auf `https://viuno.de/requests`** — die alte Standalone-Seite mit eigener Login-Wand, nicht auf `#/requests` in der SPA. Beide existieren parallel und divergieren bereits (die SPA-Timeline zeigt für jeden Eintrag dasselbe Pin-Icon statt `a.icon`).
- **Es gibt keinen Deep-Link auf die konkrete Anfrage.** Die `id` liegt vor, wird aber nicht angehängt.
- **`sender_website` fehlt in der Mail**, obwohl es oft der einzige Hinweis ist, ob eine echte Firma dahintersteht.
- **Der Budget-Wert wird als exakte Zahl ausgegeben** (siehe A.2).
- **Kein Versandprotokoll.** Es gibt keine Entsprechung zu `digest_email_log`. Ob eine Benachrichtigung angekommen ist, lässt sich nachträglich nicht feststellen — nur Fehlschläge landen in `admin_errors` (dort steht derzeit kein einziger Eintrag für `notify-new-request`).
- **Keine Spam-Melde-Möglichkeit** in der Mail.

### B.3 Die Anfragen-View

**Liste.** `renderReqList()` zeigt pro Anfrage eine `req-card`: Initiale (`sender_initial` → sonst erster Buchstabe des Namens), Name, Typ-Badge, Budget, Relativdatum („vor 3 Std."), Status-Tag, bei `new` ein Punkt und ein linker Balken. Darunter die **vollständige** Nachricht ohne Kürzung — bei einer langen Nachricht wächst die Karte unbegrenzt.

**Filter.** Fünf Pills: Alle · Neu · Beantwortet · Verhandlung · Abgeschlossen. „Alle" bedeutet **nicht** alle: `filtered()` blendet `closed` aus. Erledigte Anfragen sind nur über die Pill „Abgeschlossen" erreichbar. Gelöschte (`deleted_at` gesetzt) sind aus der Abfrage heraus gar nicht mehr da.

**Detail-Panel.** Von unten einfahrendes Panel, per Swipe-down (> 80 px) oder Overlay-Klick schließbar. Inhalt: Kopf mit Initiale, Name, Mailadresse · Pills (Typ, Budget, Website, Datum) · Nachricht · **„Per E-Mail antworten"** · vier Status-Knöpfe · Notizfeld · Verlauf · „Anfrage löschen".

**Status-Modell.**

| Wert | Label | Wer setzt ihn |
|---|---|---|
| `new` | Neu | Default beim Insert |
| `replied` | Beantwortet | nur manuell |
| `negotiation` | Verhandlung | nur manuell |
| `closed` | Abgeschlossen | nur manuell |
| `deleted` | (roh angezeigt) | `deleteRequest()` |

Alles ist manuell. `openDetail()` hat sogar einen Kommentar dazu: *„Status wird NICHT automatisch geändert — nur manuell via changeStatus()"*. Es gibt kein „gelesen". Folge: `new_requests_count` sinkt nie von selbst, und die Zahl auf dem Dashboard bleibt stehen, bis der Creator aktiv eine Pille drückt. Bei der Demo-Anfrage heißt das: dauerhaft „1".

„Abgeschlossen" trägt außerdem zwei völlig verschiedene Ausgänge — Deal zustande gekommen und Absage — im selben Wert. Damit ist der Trichter nicht auswertbar.

`deleted` steht im `CHECK`-Constraint, aber nicht in `statusLabel()` und nicht in der `status_de`-Übersetzung des Triggers. In der Timeline erscheint deshalb wörtlich „Status geändert zu: deleted".

**Notizen.** Ein einzelnes Textfeld, das `collab_requests.notes` überschreibt. Kein Verlauf, kein Zeitstempel, kein Autosave — wer „Notiz speichern" nicht drückt, verliert den Text beim Schließen. Dabei gibt es in `collab_request_activities` den Typ `note` samt eigener UPDATE-/DELETE-Policy (`type = 'note'`) und eine Funktion `block_empty_collab_note`: Für Notizen mit Verlauf ist die Infrastruktur da und wird nicht benutzt.

**Timeline — drei Fehler auf einmal.**

1. **Jeder Eintrag erscheint doppelt.** `changeStatus()` schreibt clientseitig eine Aktivität („Status geändert: Neu → Verhandlung"), und der Datenbank-Trigger `handle_collab_request_activity` schreibt bei derselben Änderung eine zweite („Status geändert zu: In Austausch"). In den Daten steht das lückenlos so drin. Die Demo-Anfragen bekommen aus demselben Grund zwei `request_received`-Einträge: einen vom Trigger, einen explizit aus `handle_new_user`.
2. **Die Labels stimmen nicht überein.** Client sagt „Verhandlung"/„Beantwortet", der Trigger sagt „In Austausch"/„Geantwortet". Für denselben Vorgang.
3. **Zwischen den Einträgen steht ein Komma.** `activities.map(…).join()` — ohne Argument. `Array.join()` verbindet mit `","`. Die Einträge sind `<div>`-Blöcke, das Komma wird als Textknoten dazwischen gerendert. In beiden Implementierungen (`public/app/index.html:5515`, `public/requests/index.html:375`).

**Löschen.** `confirm()` → `UPDATE` auf `deleted_at` + `status='deleted'`. Löst den UPDATE-Trigger aus, der eine Aktivität mit rohem „deleted" schreibt — zu einer Anfrage, die danach nicht mehr sichtbar ist. Der Datensatz bleibt für immer (siehe A.6).

### B.4 Antworten

**Es gibt genau einen Weg: `mailto:`.** Kein In-App-Versand, kein Chat, kein Template-System.

Der Link ist vorbereitet:

- Betreff: `Re: Kooperationsanfrage von <sender_name>`
- Text: `Hallo <sender_name>,` / „Vielen Dank für deine Anfrage. Ich freue mich über dein Interesse an einer Zusammenarbeit." / vier Leerzeilen / `------- Deine ursprüngliche Anfrage -------` / die Originalnachricht

Der Creator muss die Adresse also **nicht** abtippen — das funktioniert. Was danach passiert, sieht viuno nie: kein `message_sent`, kein automatischer Statuswechsel, keine Antwortzeit. Der Vorlagentext duzt und ist inhaltlich leer; es fehlen Signatur, Media-Kit-Link, Preise, Rückfragen.

Bemerkenswert: In den Aktivitätsdaten steht vom 25.04.2026 ein Eintrag `message_sent` — „Nachricht an Brand gesendet: hiiiii". Der Typ ist im `CHECK`-Constraint enthalten. **Es gab einmal einen In-App-Versand**, und er wurde wieder entfernt. Was auch immer damals gescheitert ist, gehört vor einem neuen Anlauf geklärt.

### B.5 Verknüpfung zu Media Kit, Analyse und Deals

Es gibt **keine**. Kein Feld, keine Spalte, kein Button.

- **Media Kit aus der Anfrage heraus schicken:** nicht möglich. Der `mailto:`-Text enthält keinen Link auf `viuno.de/kit/<slug>`.
- **Abgeschlossene Deals festhalten:** Die Tabelle `deals` existiert und ist gut ausgestattet (`brand_name`, `brand_email`, `deal_value`, `final_value`, `usage_rights`, `exclusivity_days`, `source`, `status` …) — und hat **0 Zeilen**. Nichts in der App schreibt hinein, kein Weg führt von einer Anfrage dorthin.
- **„Bisherige Kooperationen" im Media Kit:** `mediakit_brands` hat **1 Zeile**, handgepflegt. Ein abgeschlossener Deal landet dort nicht automatisch.
- **Umsatz:** wird nirgends erfasst. Das `budget`-Feld der Anfrage ist die einzige Geldzahl im ganzen Bereich, und es ist die Wunschvorstellung des Absenders vor jeder Verhandlung.
- **Analyse:** kein Bezug. Die Reichweitendaten, die eine Anfrage bewertbar machen würden, stehen in einer anderen View.

## C. Die Demo-Anfrage nach der Anmeldung

### C.1 Wie sie entsteht

In `handle_new_user()` (`SECURITY DEFINER`, Trigger auf `auth.users`), nach `users`, `subscriptions`, `biolink_settings` und `analytics_settings`:

```sql
INSERT INTO public.collab_requests (
  creator_id, sender_name, sender_email, sender_website, message, status, created_at
) VALUES (
  new.id, 'viuno Team', 'hello@viuno.de', 'viuno.de',
  'Willkommen bei viuno! 👋 … Erstelle deinen BioLink, damit Brands dich finden können.',
  'new', now()
) RETURNING id INTO new_request_id;

INSERT INTO public.collab_request_activities (…, '👋', 'Willkommen bei viuno! Dies ist dein Anfragen-Center.', now());
```

Fester Text, hart in der Funktion, nur auf Deutsch. `request_type` bleibt auf dem Default `brand`, `sender_initial` wird auf `'V'` gesetzt (die Spalte wird sonst nirgends befüllt — bei echten Anfragen ist sie immer `NULL`).

Der Text verspricht: *„Per Klick auf »E-Mail antworten« geht es direkt los"*. Der Knopf heißt tatsächlich „Per E-Mail antworten" — und schreibt an `hello@viuno.de`.

Ein Detail aus den Daten: Die älteste Demo-Zeile (Antonietta, 21.04.) trägt `sender_email = 'noreply@`**`veuno`**`.de'` — ein Tippfehler aus einer früheren Fassung. Die vier jüngeren nutzen `hello@viuno.de`.

### C.2 Was sie auslöst

| Wirkung | |
|---|---|
| Dashboard-Kachel | zählt mit: „1 · Neue Anfrage" |
| „x neu"-Badge | zählt mit |
| `users.new_requests_count` | steht bei 4 von 5 Nutzern auf **1** |
| **Benachrichtigungs-Mail** | **ja** — der Insert-Trigger feuert, `notify-new-request` schickt „Neue Anfrage von viuno Team" an die frisch registrierte Adresse |
| Timeline | zwei `request_received`-Einträge (Trigger + expliziter Insert) |
| Empty State | wird verdrängt und nie gezeigt |
| Beantwortbar? | ja — der `mailto:` geht an `hello@viuno.de` |
| Löschbar? | ja, per Soft-Delete; die Zeile bleibt mit `status='deleted'` stehen |

**Der Bestand bestätigt, dass niemand sie wegräumt.** Von fünf Demo-Zeilen steht genau eine nicht mehr auf `new` (Antonietta, von Hand auf `closed` gesetzt). Die vier übrigen stehen seit dem Registrierungstag unverändert auf `new` — bei Heyno seit dem 28.04., also über vier Monate.

### C.3 Bewertung

**Sie verwirrt mehr, als sie erklärt — und zwar messbar.**

Dafür spricht:

- Sie ist von einer echten Anfrage **nicht unterscheidbar**: dieselbe Karte, derselbe Typ „Brand", derselbe Status „Neu", derselbe Punkt, dieselbe Mail im Postfach. Der einzige Hinweis ist der Absendername „viuno Team" — und eine Mail mit dem Betreff „Neue Anfrage von viuno Team", die zehn Sekunden nach der Registrierung eintrifft, liest sich für einen neuen Nutzer wie eine echte erste Anfrage.
- Sie erzeugt eine **falsche Kennzahl** an der prominentesten Stelle der App. Vier von fünf Nutzern sehen eine „1", die keiner Anfrage entspricht. Damit ist die Dashboard-Zahl als Signal wertlos: Wenn die „1" ohnehin immer dasteht, fällt die echte erste Anfrage nicht mehr auf.
- Sie **blockiert die bessere Erklärung**. Der Empty State ist bereits gebaut und sagt genau das Richtige, inklusive zweier CTAs.
- Sie **widerspricht sich selbst**: Sie fordert „Erstelle deinen BioLink, damit Brands dich finden können" — steht aber als Beleg dafür da, dass Anfragen schon ohne BioLink hereinkommen.
- Sie ist **nicht mehrsprachig** und wird bei einem italienischen Nutzer auf Deutsch angezeigt.

Dafür, sie zu behalten, spricht genau ein Argument: Sie zeigt, wie eine Karte aussieht, wenn eine da ist. Das lässt sich aber ohne Datenzeile lösen — als nicht anklickbare Beispielkarte im Empty State, sichtbar als Beispiel markiert.

**Empfehlung: raus, und der Empty State bekommt den Platz.** Skizze in Phase 2.5.

## D. Vergleich mit anderen Anbietern

### D.1 Übersicht

| | **Felder** | **Bestätigung an Absender** | **Benachrichtigung an Creator** | **Antwortweg** | **Status** | **Spam-Schutz** | **Preis dafür** |
|---|---|---|---|---|---|---|---|
| **viuno** | Typ, Name/Firma, Mail, Website, Budget-Chip, Nachricht | nur Bildschirm | Mail (Reply-To gesetzt) | `mailto:` mit Vorlage | Neu/Beantwortet/Verhandlung/Abgeschlossen, alles manuell | Honeypot | kostenlos |
| **Linktree** | frei konfigurierbare Formularfelder (Name, Mail, beliebige weitere) | — | Eintrag im **Audience-Dashboard**, CSV-/Sheets-Export | keiner in der App; Weiterverarbeitung im Mail-Tool (Mailchimp, Klaviyo, Kit — ab Pro) | keine; das Konstrukt ist ein CRM/Lead-Manager, kein Postfach | Plattform-Ebene | Formular in den unteren Tarifen, Integrationen ab Pro |
| **Beacons** | **kein Formular** — verbindet stattdessen das **bestehende Postfach** des Creators | entfällt | im „AI Brand-Deal Inbox" | **KI-entworfene Antworten**, inkl. Preisvorschlag; Pipeline „from pitch to payout" | eigene Deal-Pipeline mit Zahlungsanbindung | Postfach-Filter | in den Creator-Tarifen |
| **Komi** | „unlimited fan contacts" auf der Mini-Site; Brand-Deals laufen über den separaten **Brand Hub** | — | über den Brand Hub | Vermittlung über die Plattform | Kampagnen-Status im Hub | Plattform-Ebene | Starter kostenlos, Pro 16 $/Monat |
| **Collabstr** | Marktplatz: Brand **bucht** ein Paket zum ausgeschriebenen Preis; kein Freitext-Erstkontakt | Buchungsbestätigung | Auftragsbenachrichtigung | in der Plattform, Treuhand bis zur Lieferung | Auftragsstatus (angenommen/geliefert/bezahlt) | Vorabprüfung + Zahlung als Hürde | ~10 % Brand + ~15 % Creator |
| **Passionfroot** | **Buchungsformular am Rate Card**: gewünschtes Format, Termin, Budget; die Slots stehen in einem Kalender | ja, über den Mail-Workflow | im Requests-View, Echtzeit-Hinweis | **Annehmen / Ablehnen / Angebot senden** aus der App; der Partner antwortet per Mail, ohne Account | Requests → Angebot → Buchung → Rechnung → Zahlung | Zahlung/Vertrag als Hürde | für Creator kostenlos; 2 % Transaktion (zahlt die Brand), 15 % auf Netzwerk-Deals |

### D.2 Was daraus folgt

**Die Link-in-Bio-Anbieter behandeln das Formular auf der Seite gar nicht als Kooperationskanal.** Linktrees Formular ist ein **Lead-Capture** — es füttert den Audience Manager, damit der Creator eine Mailliste aufbaut. Es gibt dort bewusst kein Postfach, keine Status, keine Antwortfunktion. Komi macht dasselbe („capture unlimited fan contacts") und hängt Brand-Deals in ein völlig getrenntes Produkt, den Brand Hub.

**Beacons hat die Frage andersherum beantwortet — und das ist der wichtigste Punkt des ganzen Vergleichs.** Beacons baut kein Formular. Beacons verbindet das **bestehende E-Mail-Postfach** des Creators, weil Brand-Anfragen dort ankommen: als Mail an die Adresse aus der Instagram-Bio, als DM, über eine Agentur. Der Wert liegt nicht darin, einen neuen Eingang zu schaffen, sondern darin, den vorhandenen zu sortieren, zu bewerten und zu beantworten.

**Passionfroot und Collabstr sind keine Postfächer, sondern Marktplätze.** Ihre Anfragen entstehen, weil die Plattform Nachfrage bündelt — nicht, weil die Creator-Seite ein Formular hat. Und sie verdienen an der Transaktion, nicht am Formular. Das erklärt auch, warum sie es sich leisten können, viel mehr abzufragen: Wer im Passionfroot-Formular Format, Termin und Budget angibt, hat sich vorher für einen bezahlten Slot entschieden.

**Uns fehlt, gemessen an diesem Feld:**

1. Eine **Bestätigung an den Absender** — haben alle Marktplätze, weil ohne sie kein B2B-Vorgang nachvollziehbar ist.
2. Eine **Trennung zwischen Fan-Nachricht und Geschäftsanfrage.** Linktree trennt das über das Produkt (Lead-Formular ≠ Brand-Deal), Passionfroot über den Rate Card, Collabstr über die Zahlung. Wir haben keine Trennung — und unsere zwei realen Eingänge waren beide Fan-Nachrichten.
3. **Konkrete Felder, die eine Anfrage bewertbar machen:** Format, Zeitraum, Budget als echte Spanne. Bei Passionfroot ist das der Kern des Formulars.
4. Eine **entscheidbare Antwortgeste** — „Annehmen / Ablehnen / Angebot" statt „Status manuell umstellen".
5. **Ein Weg vom abgeschlossenen Deal zurück ins Media Kit.** Passionfroot zeigt Testimonials vergangener Kooperationen im Storefront; unsere `mediakit_brands` hat eine handgepflegte Zeile.

**Für Micro-Creator in DACH bei fünf aktiven Nutzern unnötig:**

- **In-App-Chat.** Dafür bräuchten Brands Accounts. Passionfroot löst das bewusst ohne Login („handled seamlessly via mail") — bei unserer Größe ist selbst das zu viel.
- **Treuhand, Rechnungen, Zahlungsabwicklung.** Das ist der Geschäftskern der Marktplätze, nicht ein Feature, das man nebenbei baut.
- **Kalender und Slot-Buchung.** Setzt eine Auftragslage voraus, die es nicht gibt.
- **Preisschilder öffentlich auf der Seite.** Im DACH-Micro-Segment werden Preise verhandelt, nicht ausgeschrieben; ein öffentlicher Rate Card ist eher abschreckend.
- **KI-Antworten wie bei Beacons.** Erst sinnvoll, wenn es ein Antwortvolumen gibt. Bei vier Anfragen in fünf Monaten kostet es mehr, als es spart.

## E. Daten und Messung

### E.1 Der komplette Bestand

Neun Zeilen. Alle davon.

| # | Creator | Absender | Typ | Budget | Status | Angelegt | Art |
|---|---|---|---|---|---|---|---|
| 1 | Antonietta | viuno Team `noreply@veuno.de` | brand | — | closed | 21.04. | Demo |
| 2 | Heyno | viuno Team | brand | — | **new** | 28.04. | Demo |
| 3 | liaminini | viuno Team | brand | — | **new** | 30.04. | Demo |
| 4 | Antonietta | „Antonio Giusti" | sonstiges | — | deleted | 09.07. | **Fan-DM (IT)** |
| 5 | Antonietta | „Davide" | sonstiges | — | deleted | 31.08. | **Fan-DM (IT)** |
| 6 | Antonietta | „Mehmet Ergürlek" | brand | 500 | deleted | 09.09. | Selbsttest |
| 7 | Antonietta | „Hallo" | brand | — | deleted | 09.09. | Selbsttest |
| 8 | Glenn | viuno Team | brand | — | **new** | 09.09. | Demo |
| 9 | Testi | viuno Team | brand | — | **new** | 11.09. | Demo |

**Für welche Creator:** ausschließlich Antonietta bekommt echten Eingang — sie ist auch die einzige mit aktivem BioLink.

**Status-Verteilung, ohne Demo:** 4 Zeilen, alle `deleted`. Keine einzige hat je `replied` oder `negotiation` als Endzustand.

**Antwortzeit:** nicht messbar. Nichts protokolliert eine Antwort. Aus den Aktivitäten lässt sich nur eines ablesen: Anfrage 4 kam am 09.07., der erste Statuswechsel dazu war am **09.09.** — zwei Monate später, und das war die Aufräumaktion, bei der alle vier auf `deleted` gesetzt wurden.

**Anteil Spam/Test: 100 %.** Vier echte Einsendungen, davon zwei Selbsttests und zwei unerwünschte Privatnachrichten auf Italienisch. Null Kooperationsanfragen.

**Trichter:** 2.059 BioLink-Aufrufe insgesamt (2.000 davon auf Antonietta), 853 seit Juli. Referrer sind überwiegend `l.instagram.com`, `l.threads.com`, TikTok und Facebook, mit `utm_content=link_in_bio`. Also echter Traffic von echten Followern.

```
2.000 BioLink-Aufrufe (Antonietta)
   ↓
    4 abgeschickte Formulare        = 0,20 %
   ↓
    2 von Fremden (nicht Selbsttest) = 0,10 %
   ↓
    0 Kooperationsanfragen           = 0,00 %
```

Zum Vergleich: 35 Media-Kit-Aufrufe insgesamt, seit dem 09.09. keiner mehr.

### E.2 Datenschutz

**Welche personenbezogenen Daten liegen in `collab_requests`:** `sender_name`, `sender_email`, `sender_website`, `message` (Freitext, beliebiger Inhalt — bei den zwei realen Fällen mit persönlichem Bezug), `budget`, `created_at`, plus in `collab_request_activities` noch einmal die **komplette Nachricht** im `content`.

Keine IP, kein User-Agent, kein Fingerprint. Das ist sauber.

| Frage | Antwort |
|---|---|
| Wie lange? | **Unbefristet.** Die Erklärung sagt 24 Monate, es gibt keinen Job dafür. |
| Was bei „Löschen" in der App? | Soft-Delete. Die Daten bleiben; es gibt keine DELETE-Policy. |
| Was bei Account-Löschung des Creators? | Vollständig weg, per `ON DELETE CASCADE` auf beiden Tabellen. Deckt sich mit Abschnitt 9.1. |
| Steht es in der Datenschutzerklärung? | Ja, Abschnitt 3.5, 4.1 und 9.2 — aber an den Creator adressiert. |
| Erfährt der Absender davon? | **Nein.** Kein Hinweis im Formular, kein Link auf der Seite, keine Bestätigungsmail. |
| Kann der Absender seine Rechte ausüben? | Praktisch nicht — er erfährt nicht, wer verantwortlich ist, und ein Löschverlangen wäre technisch nur per Service-Role erfüllbar. |

### E.3 Messung

**Es gibt keine.** Weder „Overlay geöffnet" noch „Slide 1 bestanden" noch „abgebrochen" noch „Honeypot ausgelöst" noch „Absendefehler" wird irgendwo festgehalten.

Verfügbar sind nur die beiden Enden — `biolink_aufrufe` (Aufruf der Seite) und `collab_requests` (fertig abgeschickt). Für die News wurde mit `page_views` genau diese Lücke schon geschlossen; für Anfragen fehlt das Gegenstück.

Konkret nicht beantwortbar: Wie viele öffnen das Formular und brechen bei „Deine Angaben" ab? Bleibt jemand bei der Typ-Auswahl hängen? Schlägt der Honeypot überhaupt je an? Wie oft scheitert der POST?

---

# Phase 2: Konzept

## 2.1 Das Formular

### Die eigentliche Entscheidung zuerst

Die Daten sagen: Der Kanal produziert Fan-Nachrichten, keine Kooperationsanfragen. Bevor man Felder sortiert, muss das Formular **sortieren, wer davorsteht**. Alles andere ist Kosmetik.

Vorschlag: Slide 1 bekommt eine fünfte Karte, und sie ist bewusst die unterste:

> **Persönliche Nachricht** — Kein Kooperationsanliegen

Wer sie wählt, bekommt statt Slide 2 einen kurzen Hinweis: „Dieser Bereich ist für Kooperationsanfragen von Unternehmen. Für alles andere schreib mir am besten direkt auf Instagram." — mit Link auf das Profil. **Kein** Datensatz, keine Mail. Das kostet eine Karte und einen Textblock und hätte beide realen Einsendungen abgefangen.

Zweite Maßnahme aus demselben Grund: **Die Beschriftung des Buttons und der Ton des Formulars ändern.** „Scrivimi" muss weg. Vorschlag: DE „Für Unternehmen", EN „For business", IT „Per aziende". Und die Überschriften weg vom Ich des Creators:

| heute | Vorschlag |
|---|---|
| „Wie kann ich helfen?" | „Worum geht es?" |
| „Wähle, was zu deiner Anfrage passt." | „Wähle die Art der Zusammenarbeit." |
| „Deine Angaben" / „Damit ich dich erreichen kann." | „Kontakt" / „Damit {Name} sich bei dir melden kann." |

### Felder und Reihenfolge

**Slide 1 — Art** (unverändert, plus die fünfte Karte)

**Slide 2 — Wer fragt** (kurz halten, das ist die Abbruchstelle)

| Feld | Pflicht | Hinweis |
|---|---|---|
| Unternehmen / Marke | ja | neues Feld; heute steckt es in „Name / Firma" |
| Ansprechperson | ja | |
| Geschäftliche E-Mail | ja | Prüfung auch serverseitig |
| Website | optional bei `brand`/`collab`, sonst aus | |

**Slide 3 — Worum es geht** (nur bei `brand`; für `collab`/`event` reicht Nachricht + Zeitraum)

| Feld | Pflicht | Warum |
|---|---|---|
| Format (Mehrfachauswahl: Reel · Story · TikTok · Beitrag · UGC ohne Veröffentlichung · Event) | ja | Was der Creator als Erstes wissen will |
| Zeitraum (Chips: diese Woche · diesen Monat · nächste 3 Monate · flexibel) | ja | Unterscheidet ernsthaft von unverbindlich |
| Budget (Chips wie heute, aber **als Text** gespeichert) | optional | siehe unten |
| Nachricht | ja | `maxlength` 2.000 |

**Budget richtig speichern.** Statt `budget numeric` mit einem Zahlenwert, der eine Spanne behauptet: `budget_min` und `budget_max` (`integer`, `NULL` erlaubt), oder eine Textspalte `budget_range` mit `'lt250' | '250_500' | '500_1000' | 'gt1000'`. Angezeigt wird dann wieder die Spanne — „250 – 500 €" —, nicht „€ 500". Die vorhandene `budget`-Spalte kann als abgeleitete Untergrenze bleiben, damit nichts bricht.

Das sind zwei Felder mehr als heute und ein Bildschirm mehr, aber nur für `brand`. Bei Passionfroot ist genau das der Kern; es ist auch der Punkt, an dem sich ein Unternehmen von jemandem unterscheidet, der „Ciao scrivimi" schreibt.

### Datenschutzhinweis

Rechtsgrundlage ist Art. 6 Abs. 1 lit. b/f DSGVO, nicht Einwilligung — es braucht also **keine Checkbox**, aber sehr wohl eine Information nach Art. 13. Vorschlag, direkt über dem Senden-Knopf, klein und einzeilig:

> Deine Angaben werden an {Creator-Name} übermittelt und dort gespeichert, um deine Anfrage zu bearbeiten. Mehr dazu in der [Datenschutzerklärung](https://viuno.de/legal#datenschutz).

Zusätzlich gehört in den Footer der BioLink-Seite neben „Impressum" ein **Datenschutz**-Link auf `viuno.de/legal#datenschutz`. Das fehlt heute auf jeder generierten Seite.

Und in die Datenschutzerklärung ein eigener Absatz, der den Absender direkt anspricht — heute ist 3.5 aus Creator-Sicht formuliert.

### Bestätigung an den Absender

Ja, einbauen. Eine schlichte Mail, sofort nach dem Insert, aus derselben Function:

- **Von:** `viuno <noreply@viuno.de>`
- **Betreff:** `Deine Anfrage an {Creator} ist angekommen`
- **Kein Reply-To** auf die private Adresse des Creators — stattdessen im Text: „{Creator} meldet sich direkt bei dir, in der Regel innerhalb weniger Tage."
- **Inhalt:** eine Zusammenfassung dessen, was gesendet wurde (Typ, Format, Zeitraum, Budget, Nachricht), damit der Absender einen Beleg hat, plus ein Satz „Du bekommst diese Mail, weil über viuno.de eine Anfrage mit dieser Adresse gesendet wurde. War das nicht du, ignoriere diese Nachricht."
- Der letzte Satz ist auch der Grund, warum diese Mail **nach** einem Rate-Limit kommen muss, nicht davor — sonst wird sie selbst zum Versandwerkzeug.

## 2.2 Die Benachrichtigung an den Creator

Die bestehende Mail ist im Kern richtig gebaut — das Token-Design stimmt, Reply-To ist gesetzt. Sie braucht fünf Korrekturen und keinen Neubau:

| # | Änderung |
|---|---|
| 1 | **Link auf `https://viuno.de/app/#/requests`** statt auf die alte Standalone-Seite. Besser noch: Deep-Link auf die Anfrage, `…#/requests/<id>` (setzt eine Route mit Parameter voraus). |
| 2 | **Website und Zeitraum/Format mit aufnehmen**, Budget als Spanne. |
| 3 | **Preheader setzen** (heute fehlt er): `{Typ} · {Budget-Spanne} · {Firma}` — das ist die Zeile, die im Postfach neben dem Betreff steht. |
| 4 | **Zweiter, unauffälliger Link im Footer: „Diese Anfrage als Spam melden"** — signierter Token wie beim Newsletter-Abmeldelink, setzt `status='spam'` und legt den Absender in eine Blockliste. |
| 5 | **Versandprotokoll** analog `digest_email_log`: eine Tabelle `request_email_log` (request_id, to, resend_id, status, created_at). Ohne sie ist nach jedem Zwischenfall wieder unklar, ob die Mail raus ist. |

Betreffzeile: `Neue Anfrage von {Firma}` — mit der Firma statt dem Personennamen, sobald es das Feld gibt.

**Push: später, und niedrig priorisiert.** Web-Push braucht Service Worker, VAPID-Schlüssel, Berechtigungsdialog und auf iOS eine zum Homescreen hinzugefügte PWA. Bei einem Anfragevolumen von vier in fünf Monaten ist der Nutzen null. Der **Punkt in der Seitenleiste** dagegen kostet fünf Zeilen und schließt die eigentliche Lücke.

## 2.3 Antworten — drei Optionen

### (a) Verbesserter `mailto:`-Link

**Aufwand: ~2 Stunden.** Nur Client, kein Backend.

Was sich ändert: Der vorbereitete Text bekommt Substanz statt Floskel.

```
Hallo {Ansprechperson},

danke für deine Anfrage zu {Format}.

[Hier schreibst du deine Antwort.]

Meine aktuellen Zahlen und Konditionen findest du in meinem Media Kit:
https://viuno.de/kit/{slug}

Viele Grüße
{Creator-Name}

------- Deine ursprüngliche Anfrage vom {Datum} -------
{Nachricht}
```

Dazu: Der Klick auf den Knopf setzt den Status automatisch auf **„beantwortet"** und schreibt eine `message_sent`-Aktivität („Antwortmail geöffnet"). Das ist nicht der Beweis, dass wirklich gesendet wurde — aber ehrlicher beschriftet ist es das beste verfügbare Signal, und es befreit den Creator vom manuellen Umschalten.

Grenze: Wir sehen die Antwort nie, messen keine Antwortzeit, und auf einem Gerät ohne eingerichteten Mail-Client passiert nichts.

### (b) Antwortvorlagen in der App, Versand über unseren Resend-Zugang

**Aufwand: ~1,5 Tage.** Eine neue Edge Function `send-request-reply` (mit `verify_jwt: true`, Prüfung `auth.uid() = creator_id`), ein Textfeld mit 3–4 Vorlagen im Detail-Panel, die `message_sent`-Aktivität, ein automatischer Statuswechsel.

Vorlagen: *Interesse, bitte Details* · *Mein Angebot* (mit Preisfeld) · *Passt nicht, danke* · *Frei schreiben*.

Versand von `noreply@viuno.de` mit `reply_to` auf `users.contact_email`, damit die Brand direkt beim Creator landet. Die Antwort wird im Verlauf gespeichert — damit sind erstmals Antwortquote und Antwortzeit messbar, und das ist die einzige Kennzahl, an der sich zeigen ließe, ob der Bereich überhaupt etwas bewirkt.

Zu beachten: Der Aktivitätseintrag vom 25.04. („Nachricht an Brand gesendet: hiiiii") belegt, dass es das schon einmal gab. Vor dem Neubau gehört geklärt, warum es verschwunden ist.

### (c) In-App-Chat

**Aufwand: 2–3 Wochen, plus dauerhafte Last.** Braucht Brand-Accounts oder magische Links, Realtime, Ungelesen-Zähler, Benachrichtigungen auf beiden Seiten, Moderation, und einen Ort, an dem Missbrauch gemeldet werden kann. Passionfroot vermeidet das bewusst und wickelt alles über Mail ab.

### Empfehlung

**Jetzt (a), und zwar diese Woche. (b) erst, wenn es die erste echte Anfrage gegeben hat.**

Begründung: Bei fünf aktiven Creatorn und null echten Anfragen bringt ein besserer Antwortweg nichts, weil nichts zu beantworten ist. (a) kostet einen Vormittag, macht den bestehenden Weg spürbar besser und hebt nebenbei die Statuspflege aus der Handarbeit. (b) ist die richtige Zielarchitektur — sie erzeugt die Messdaten, die heute fehlen —, aber sie lohnt erst bei Volumen. **(c) nicht bauen**, auch nicht später; der Managed Service deckt genau diesen Bedarf günstiger ab, indem Mehmet direkt verhandelt.

Für den **Managed Service** gilt ohnehin ein anderer Weg: dort soll die Anfrage möglichst gar nicht beim Creator landen, sondern bei Mehmet. Siehe 2.7.

## 2.4 Status-Modell

### Vorschlag

```
neu ──(Detail geöffnet, automatisch)──▶ gelesen
                                          │
                                          ├──(Antwort geschickt)──▶ beantwortet
                                          │                            │
                                          │                            ├──▶ Deal
                                          │                            └──▶ abgelehnt
                                          └──(Spam melden)──────────▶ Spam
```

| Status | Wer setzt ihn | Zählt in der Dashboard-Zahl |
|---|---|---|
| `new` | Insert | ja |
| `read` | automatisch beim Öffnen des Detail-Panels | **nein** |
| `replied` | automatisch beim Antworten (a) oder Senden (b) | nein |
| `deal` | manuell | nein |
| `declined` | manuell | nein |
| `spam` | manuell oder über den Mail-Link | nein |

Änderungen gegenüber heute:

- **`read` ist neu und automatisch.** Damit sinkt die Dashboard-Zahl von selbst, und sie bedeutet endlich „ungesehen" statt „nicht angefasst".
- **`closed` wird zu `deal` und `declined`.** Nur so lässt sich später sagen, wie viele Anfragen zu etwas geführt haben. Migration: die eine bestehende `closed`-Zeile ist die Demo, das ist also ein Einzeiler.
- **`negotiation` entfällt.** Es war nie nützlich (zweimal gesetzt, beide Male im Test) und liegt zwischen zwei Zuständen, die man ohnehin nicht sauber trennt. Wer es braucht, nutzt die Notiz.
- **`spam` ist neu** und ersetzt den heutigen Reflex, eine unerwünschte Nachricht zu löschen. Die beiden realen Fälle wären so korrekt eingeordnet statt verschwunden.
- **`deleted` bleibt ausschließlich als Soft-Delete-Marker** — aber `deleted_at` allein reicht dafür; den Statuswert kann man streichen, dann verschwindet auch „Status geändert zu: deleted" aus der Timeline.

Filter-Pills entsprechend: **Offen** (neu + gelesen) · **Beantwortet** · **Deals** · **Alle**. „Offen" ist die Standardansicht — das ist die einzige Liste, die täglich interessiert.

### Was erledigte Anfragen mit dem Media Kit machen

Das ist die Verbindung, die heute komplett fehlt, und sie ist der eigentliche Grund, warum sich der Bereich lohnt.

**Beim Wechsel auf `deal`** öffnet sich ein kurzer Dialog:

> **Deal festgehalten.** Möchtest du das ins Media Kit übernehmen?
> ☑ {Firma} unter „Bisherige Kooperationen" zeigen
> ☐ Honorar hinterlegen: [____] € (nur für dich sichtbar)

Bei „Ja":

- eine Zeile in `mediakit_brands` — das ist die Tabelle mit heute genau einem handgepflegten Eintrag,
- eine Zeile in `deals` (`brand_name`, `brand_email`, `final_value`, `source='collab_request'`, `status='closed'`) — die Tabelle existiert vollständig und ist leer,
- und die Anfrage bekommt die `deal_id` als Verweis.

Damit entsteht zum ersten Mal ein durchgehender Weg: **BioLink → Anfrage → Deal → Media Kit → nächste Anfrage.** Das Media Kit wird mit jedem Abschluss besser, ohne dass jemand etwas pflegt. Und der Umsatz steht an einer Stelle, an der man ihn später summieren kann.

## 2.5 Onboarding: Demo-Anfrage raus

**Empfehlung: entfernen.** Der `INSERT INTO collab_requests` und der zugehörige `collab_request_activities`-Insert fallen aus `handle_new_user()` heraus. Damit erledigt sich zugleich die falsche Dashboard-Zahl und die irreführende Registrierungs-Mail.

Die vier bestehenden Demo-Zeilen mit `status='new'` gehören einmalig mit aufgeräumt, sonst sehen die heutigen Nutzer weiter ihre „1".

### Der Ersatz: der Empty State, der schon da ist

Er existiert bereits (`public/app/index.html:5430`) und muss nur erweitert werden. Skizze:

```
┌──────────────────────────────────────────────────┐
│  Anfragen                                        │
│  ┌────┬────────────┬─────────┬──────┐            │
│  │Offen│Beantwortet│  Deals  │ Alle │            │
│  └────┴────────────┴─────────┴──────┘            │
│                                                  │
│                    ┌────┐                        │
│                    │ ⌸  │                        │
│                    └────┘                        │
│              Noch keine Anfragen                 │
│                                                  │
│   So kommen Anfragen herein:                     │
│                                                  │
│   ①  BioLink erstellen                           │
│      Deine Seite mit Links und Anfrage-Knopf     │
│                                                  │
│   ②  Link in die Bio setzen                      │
│      Instagram, TikTok, Threads                  │
│                                                  │
│   ③  Unternehmen schreiben dich an               │
│      Jede Anfrage landet hier                    │
│                                                  │
│   ⚠  Ohne aktiven BioLink kann dich niemand      │
│      erreichen — dein Link ist noch nicht aktiv. │
│                                                  │
│   ┌──────────────────────────────────────────┐   │
│   │ 🔗  BioLink erstellen                  → │   │
│   │     Deine Visitenkarte für Unternehmen   │   │
│   └──────────────────────────────────────────┘   │
│   ┌──────────────────────────────────────────┐   │
│   │ 📄  Media Kit erstellen                → │   │
│   │     Zeig deine Reichweite und Zahlen     │   │
│   └──────────────────────────────────────────┘   │
│                                                  │
│   ─────────────  So sieht eine Anfrage aus  ──── │
│   ┌──────────────────────────────────────────┐   │
│   │ B  Beispiel GmbH          Brand · Beispiel│  │
│   │    500 – 1.000 €  ·  vor 2 Std.           │  │
│   │    „Wir suchen ein Reel für unseren…"     │  │
│   └──────────────────────────────────────────┘   │
│        ausgegraut, nicht anklickbar               │
└──────────────────────────────────────────────────┘
```

Drei Dinge sind daran wichtig:

1. **Der Warnhinweis ist zustandsabhängig.** Er erscheint nur, solange `biolink_settings.is_active = false` — also genau bei den vier Nutzern, bei denen heute stattdessen eine Fantasie-Anfrage steht. Ist der BioLink aktiv, wird daraus: „Dein BioLink ist aktiv. Teile ihn, damit Unternehmen dich finden."
2. **Die Beispielkarte ist als Beispiel erkennbar** — ausgegraut, mit Trennlinie und Überschrift, nicht anklickbar. Sie leistet das Einzige, was die Demo-Anfrage wirklich konnte, ohne eine Zeile in der Datenbank anzulegen.
3. Der Text kommt aus dem i18n-Objekt, nicht aus einer SQL-Funktion. Damit ist er übersetzbar — was die heutige Demo-Anfrage nicht ist.

## 2.6 Sicherheit — konkreter Vorschlag

### Sofort (ohne Architekturänderung)

**S1 — `notify-new-request` schließen.** Zwei Schritte, beide klein:

1. In der Function den `record` **nicht mehr aus dem Body übernehmen**, sondern nur die `id` lesen und die Zeile per Service-Role aus `collab_requests` nachladen. Damit ist jeder Aufruf mit erfundenen Daten wirkungslos.
2. Zusätzlich ein gemeinsames Geheimnis: Der Trigger schickt einen Header `x-viuno-signature`, die Function vergleicht ihn gegen ein Secret aus den Environment-Variablen und antwortet sonst mit 401. `trigger_notify_new_request` muss dafür nur um den Header erweitert werden.

Punkt 1 allein beseitigt den Missbrauch bereits; Punkt 2 verhindert zusätzlich das Auslösen echter Mails durch Dritte.

**S2 — Die `mailto:`-XSS beseitigen.** In beiden Dateien:

```js
const mailtoHref = 'mailto:' + encodeURIComponent(r.sender_email) + '?subject=' + …
…  href="${escHtml(mailtoHref)}"
```

und für `sender_website` beim Rendern das Schema prüfen (`^https?://`), sonst als Text statt als Link ausgeben.

**S3 — Index.** `CREATE INDEX ON collab_requests (creator_id, status) WHERE deleted_at IS NULL;` Betrifft jeden Listenaufruf und jeden der vier Trigger.

**S4 — Längen und Format in der Datenbank.** `CHECK (char_length(message) <= 2000)`, `CHECK (char_length(sender_name) <= 120)`, `CHECK (sender_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')`, `CHECK (char_length(sender_website) <= 300)`. Das kostet nichts und macht die heutige rein clientseitige Prüfung endlich verbindlich.

**S5 — DELETE-Policy.** `CREATE POLICY collab_requests_creator_delete ON collab_requests FOR DELETE USING (auth.uid() = creator_id);` Damit kann „Löschen" tatsächlich löschen. Empfehlung: Soft-Delete für 30 Tage beibehalten (Rückholbarkeit), danach per Cron hart entfernen.

**S6 — Purge-Job.** `SELECT cron.schedule('purge-alte-anfragen', '41 3 1 * *', $$DELETE FROM collab_requests WHERE created_at < now() - interval '24 months' OR (deleted_at IS NOT NULL AND deleted_at < now() - interval '30 days')$$);` — das ist die Umsetzung des Versprechens aus Abschnitt 9.2 der Datenschutzerklärung.

### Rate-Limit

Zwei Ausbaustufen, beide sinnvoll — die erste heute, die zweite, sobald es Missbrauch gibt.

**Stufe 1 — in der Datenbank, ~1 Stunde.** Ein `BEFORE INSERT`-Trigger:

```
- mehr als  3 Anfragen von derselben sender_email an denselben Creator in 24 h  → Ablehnung
- mehr als 10 Anfragen an denselben Creator in 1 h                              → Ablehnung
- mehr als 30 Anfragen an denselben Creator in 24 h                             → Ablehnung
```

Das braucht S3 (den Index), sonst wird jeder Insert teuer. Es kennt keine IP — wer die Adresse variiert, kommt durch —, aber es deckelt den Schaden pro Creator, und genau das ist das Ziel: keine 100 Mails in einer Minute.

**Stufe 2 — die Insert-Policy schließen, ~1 Tag.** `collab_requests_insert_public` wird auf `WITH CHECK (false)` gesetzt; der Eingang läuft nur noch über eine Edge Function `submit-collab-request`, die

- ein **Cloudflare-Turnstile-Token** prüft (unsichtbar, kein Klick-Puzzle, DSGVO-freundlicher als reCAPTCHA),
- prüft, ob `creator_id` überhaupt zu einem Creator mit `biolink_settings.is_active = true` gehört,
- die IP hashen und für 24 h drosseln kann,
- die Felder serverseitig validiert,
- und erst dann mit der Service-Role schreibt.

Das ist die saubere Lösung. Sie hat eine Nebenwirkung, die man wissen muss: Der Honeypot bleibt trotzdem nützlich, weil er Bots vor dem Netzwerkaufruf abfängt.

### Trigger-Absicherung

- **`handle_collab_request_activity` bekommt `SET search_path TO 'public'`** — es ist `SECURITY DEFINER` ohne festen Suchpfad; der Supabase-Advisor meldet es zu Recht.
- **Die doppelten Timeline-Einträge auflösen**: entweder die clientseitigen `activities`-Inserts in `changeStatus()` entfernen (beide Dateien) und den Trigger als einzige Quelle behalten — das ist die richtige Richtung, weil der Trigger auch greift, wenn jemand die Daten anders ändert. Die Labels des Triggers (`'Neu'`, `'Geantwortet'`, `'In Austausch'`, `'Abgeschlossen'`) müssen dann an die neuen Status angepasst werden.
- **`update_new_requests_count`** sollte `deleted_at IS NULL` mitfiltern; heute verlässt es sich darauf, dass beim Löschen zusätzlich `status='deleted'` gesetzt wird. Nach dem Wegfall des `deleted`-Status wäre das sonst kaputt.
- **`.join()` → `.join('')`** in beiden Timelines.

## 2.7 Was fehlt, aber wichtig ist

### Impressumspflicht bei gewerblichen Anfragen

Zwei getrennte Fragen, die leicht durcheinandergehen:

- **Muss der Absender ein Impressum angeben?** Nein. § 5 DDG trifft den Diensteanbieter, nicht den Absender eines Formulars. Wer eine Anfrage schickt, hat keine Impressumspflicht.
- **Braucht die BioLink-Seite ein Impressum?** Ja, und das ist bereits gelöst: `biolink_settings.impressum_text`, ein Knopf im Footer. Was fehlt, ist der **Datenschutz-Link daneben** (siehe 2.1) — und eine Prüfung, ob der Impressumstext überhaupt gefüllt ist. Genau ein Creator hat heute einen.

Praktisch relevanter: Sobald der Creator auf eine Anfrage **antwortet**, ist das geschäftliche Kommunikation. Der Antwortvorlage in 2.3(a) fehlt eine Signatur — die sollte aus dem Profil gezogen werden, sobald es dort Name und Anschrift gibt.

### Spam-Meldung durch den Creator

Heute gibt es nur „Löschen". Vorschlag: Der Status `spam` (2.4) plus ein Knopf im Detail-Panel und ein signierter Link in der Mail. Beim Melden

- wird `sender_email` in eine kleine Tabelle `collab_blocklist` (E-Mail oder Domain, `creator_id` oder global) geschrieben,
- lehnt der Insert-Trigger künftige Anfragen dieser Adresse still ab,
- und die gemeldete Zeile wird nach 30 Tagen hart gelöscht (das ist auch die Lösung für den Löschanspruch des Absenders).

Bei zwei unerwünschten Nachrichten in fünf Monaten ist das kein dringendes Feature — aber es ist die Stelle, an der eine Creatorin merkt, ob die App sie ernst nimmt.

### Anfragen für Managed-Creator an Mehmet

**Das geht heute nicht, weil die Verbindung fehlt.** `managed_creators` ist eine eigenständige Tabelle mit `internal_name`, `real_name`, Handles, Zielen und Analysen — aber **ohne Fremdschlüssel auf `users`**. Es gibt kein Feld, an dem sich ablesen ließe, dass ein Account betreut wird.

Wenn das Weiterleiten gewünscht ist, braucht es genau drei Dinge:

1. Eine Spalte `users.managed_by uuid REFERENCES users(id)` (oder `managed_creators.user_id`), gesetzt für die betreuten Accounts.
2. In `notify-new-request`: Ist `managed_by` gesetzt, geht die Mail **zusätzlich** an die Adresse des Betreuers — mit einem sichtbaren Hinweis „Du erhältst diese Anfrage, weil du {Creator} betreust."
3. Ein Hinweis in der Anfragen-View des Creators („Diese Anfrage wurde auch an deine Betreuung geschickt"), damit das transparent ist.

Wichtig dabei: Das ist eine Weitergabe personenbezogener Daten des **Absenders** an eine dritte Stelle. Sie gehört in die Datenschutzerklärung und — falls Mehmet als eigenständig Verantwortlicher handelt — in eine Vereinbarung mit dem Creator. Vor der technischen Umsetzung ist das die zu klärende Frage.

### Weiteres, das beim Durchsehen auffiel

- **`public/kit/index.html` liest `media_kit_public`** — die View heißt `mediakit_public`. Der generische Media-Kit-Renderer kann so nie Daten bekommen. (Gehört streng genommen in den Media-Kit-Bericht, ist aber der Grund, warum der Media-Kit-Kontaktweg nirgends funktioniert.)
- **Der Media-Kit-`mailto:` fällt auf `mailto:?subject=…` zurück**, wenn `contact_email` leer ist — bei vier von fünf Nutzern. Ein Kontaktknopf ohne Empfänger ist schlechter als kein Knopf. Besser: das Anfrage-Overlay auch im Media Kit verwenden, dann landet alles im selben Postfach.
- **`bio_page_id` ist in allen neun Zeilen `NULL`** und wird nirgends geschrieben. Tote Spalte.
- **`sender_initial` wird nur von `handle_new_user` gesetzt**, echte Anfragen haben immer `NULL` und fallen auf den ersten Buchstaben des Namens zurück. Ebenfalls tot.
- **Die SPA-Timeline verwirft `a.icon`** und zeichnet für jeden Eintrag dasselbe Pin. Die Standalone-Seite zeigt die Emojis. Eine Regression aus der Portierung.
- **Zwei Oberflächen für denselben Bereich.** `/requests/` und `#/requests` divergieren bereits. Die Mail zeigt auf die ältere. Solange beide leben, ist jede Änderung doppelt zu machen — das ist die Stelle, an der als Erstes etwas auseinanderläuft.
- **`public/bio-template.html` ist veraltet** (kein Honeypot). Entweder nachziehen oder als „nicht die Deploy-Quelle" kennzeichnen.
- **Der Anfrage-Button lässt sich nicht abschalten.** Eine Spalte `biolink_settings.inquiry_enabled` wäre eine Zeile Arbeit und gibt dem Creator die Kontrolle darüber, ob er überhaupt kontaktiert werden will.
- **Der Button steht ganz unten.** Bei einer Seite mit acht Links sieht ein Unternehmen ihn erst nach dem Scrollen. Für die Zielgruppe „Brand" gehört er nach oben — direkt unter die Bio, vor die Links. Das ist eine Position, die man messen sollte, bevor man sie festlegt.

### Messung — die Lücke, die alle anderen Antworten blockiert

Ohne Trichterdaten lässt sich keine der Fragen dieses Berichts jemals beantworten. Vorschlag, ein Gegenstück zum `page_views`-Muster der News:

```sql
create table collab_form_events (
  id uuid primary key default uuid_generate_v4(),
  creator_id uuid not null references users(id) on delete cascade,
  step text not null,   -- 'opened' | 'type_chosen' | 'submitted' | 'honeypot' | 'error'
  request_type text,
  created_at timestamptz default now()
);
-- anonym insert erlaubt; lesen nur der Creator und Admins
```

Vier `fetch`-Aufrufe im Overlay, fire-and-forget, wie beim Tracking-Pixel. Damit werden beantwortbar: Öffnungsrate pro BioLink-Aufruf, Abbruchquote zwischen Slide 1 und 2, Anteil der Honeypot-Treffer, Fehlerquote beim Senden. Ohne das bleibt jede weitere Entscheidung in diesem Bereich geraten.

---

# Priorisierung

## Bug / heute

| # | Was | Warum jetzt | Aufwand |
|---|---|---|---|
| 1 | **`notify-new-request` absichern** — Datensatz aus der DB nachladen statt aus dem Body, Signatur-Header | Offener Endpunkt: beliebige Mails von `noreply@viuno.de` an jeden Creator, mit gewähltem Reply-To. Verifiziert. | 1–2 h |
| 2 | **`mailto:`-XSS beheben** (`sender_email` roh im `href`), Schema von `sender_website` prüfen | Stored XSS in der eingeloggten Session | 30 min |
| 3 | **Demo-Anfrage aus `handle_new_user` entfernen** + die vier bestehenden `new`-Zeilen aufräumen | Falsche Dashboard-Zahl bei 4 von 5 Nutzern, irreführende Mail, blockierter Empty State | 1 h |
| 4 | **Index `(creator_id, status) WHERE deleted_at IS NULL`** | Fehlt komplett; Voraussetzung für das Rate-Limit | 5 min |
| 5 | **Rate-Limit Stufe 1** (Insert-Trigger, 3/24h je Absender, 10/h und 30/24h je Creator) | Heute kann jeder beliebig viele Mails auslösen | 1 h |
| 6 | **`.join()` → `.join('')`** in beiden Timelines | Sichtbare Kommas zwischen den Einträgen | 2 min |
| 7 | **Doppelte Timeline-Einträge auflösen** (clientseitigen Insert entfernen) | Jeder Statuswechsel erscheint zweimal, mit widersprüchlichen Labels | 30 min |
| 8 | **Längen- und Format-Constraints** auf `message`, `sender_name`, `sender_email`, `sender_website` | Heute ist alles nur clientseitig geprüft | 15 min |
| 9 | **Mail-Button auf `/app/#/requests`** statt auf die alte Standalone-Seite | Die Mail führt am aktuellen Produkt vorbei | 5 min |
| 10 | **`search_path` für `handle_collab_request_activity`** | `SECURITY DEFINER` ohne festen Suchpfad | 5 min |

## Verbesserung

| # | Was | Wirkung | Aufwand |
|---|---|---|---|
| 11 | **Empty State ausbauen** (3 Schritte, BioLink-Warnhinweis, Beispielkarte) | Ersetzt die Demo-Anfrage durch eine Erklärung, die stimmt | 3 h |
| 12 | **Status `read` automatisch beim Öffnen** | Die Dashboard-Zahl bedeutet endlich „ungesehen" | 1 h |
| 13 | **`mailto:`-Vorlage aufwerten** (Media-Kit-Link, Signatur, Datum) + Status automatisch auf „beantwortet" | Der einzige Antwortweg wird brauchbar; Statuspflege entfällt | 2 h |
| 14 | **Datenschutzhinweis im Formular + Datenschutz-Link im Footer** der BioLink-Seite | Heute bekommt der Absender keine Information nach Art. 13 | 1 h |
| 15 | **Bestätigungsmail an den Absender** | Ohne sie ist eine Anfrage für ein Unternehmen nicht nachverfolgbar | 3 h |
| 16 | **`collab_form_events`** (Overlay geöffnet / Typ gewählt / gesendet / Honeypot / Fehler) | Ohne Trichterdaten ist keine weitere Entscheidung begründbar | 3 h |
| 17 | **Punkt in der Seitenleiste bei offenen Anfragen** | Der einzige Bereich mit Geldbezug ist der einzige ohne Anzeiger | 30 min |
| 18 | **Budget als Spanne speichern und anzeigen** (`budget_min`/`budget_max`) | „unter 250 €" wird heute als „€ 250" ausgegeben | 2 h |
| 19 | **Fünfte Karte „Persönliche Nachricht"** mit Umleitung auf Instagram | Hätte beide realen Einsendungen abgefangen | 2 h |
| 20 | **Statusmodell umstellen** (`closed` → `deal`/`declined`, `negotiation` raus, `spam` rein) | Erst damit ist der Trichter auswertbar | 4 h |
| 21 | **DELETE-Policy + Purge-Job (24 Monate / 30 Tage)** | „Gelöscht ✓" löscht heute nicht; das 24-Monats-Versprechen ist nicht umgesetzt | 1 h |
| 22 | **Deal → `deals` + `mediakit_brands`** beim Statuswechsel | Schließt den Kreis BioLink → Anfrage → Deal → Media Kit | 1 Tag |
| 23 | **Felder Format und Zeitraum** für `brand`-Anfragen | Macht eine Anfrage überhaupt erst bewertbar | 4 h |
| 24 | **Versandprotokoll `request_email_log`** | Heute ist nicht feststellbar, ob eine Benachrichtigung angekommen ist | 2 h |
| 25 | **Media Kit an das Formular hängen** statt an den `mailto:` | Bei 4 von 5 Nutzern zeigt der Knopf heute ins Leere | 3 h |

## Geschäftsentscheidung

| # | Frage | Worum es geht |
|---|---|---|
| A | **Bleibt das Formular der Kanal — oder wird es wie bei Beacons das vorhandene Postfach?** 2.000 Aufrufe, null Kooperationsanfragen. Beacons hat sich bewusst gegen ein Formular entschieden, weil Brand-Anfragen per Mail und DM ankommen. Eine Alternative wäre, das Formular klein zu halten und stattdessen eine viuno-Adresse (`anfragen@viuno.de`, weitergeleitet) anzubieten, die Anfragen automatisch einliest. |
| B | **Antwortweg: bei (a) bleiben oder (b) bauen?** (b) kostet 1,5 Tage und erzeugt als Einziges die Messdaten Antwortquote/Antwortzeit. Bei null Anfragen ist es verfrüht — aber es ist die Voraussetzung dafür, den Bereich je bewerten zu können. |
| C | **Werden Anfragen für Managed-Creator an Mehmet weitergeleitet?** Technisch fehlt jede Verbindung zwischen `managed_creators` und `users`. Rechtlich ist es eine Weitergabe der Daten des Absenders an einen Dritten und gehört in die Datenschutzerklärung. |
| D | **Wird der Anfrage-Knopf abschaltbar?** Heute bekommt jeder Creator den Kanal aufgezwungen, inklusive der Fan-Nachrichten. |
| E | **Wie lange leben `/requests/` und `#/requests` parallel?** Sie divergieren bereits. Jede Änderung in diesem Bericht ist zweimal zu machen, solange beide existieren. |
| F | **Gehört der Anfrage-Knopf nach oben?** Für Unternehmen ja, für Fans eher nicht. Sollte mit `collab_form_events` gemessen werden, nicht entschieden. |
| G | **Rate-Limit Stufe 2 (Turnstile + Edge Function) — jetzt oder später?** Stufe 1 deckelt den Schaden, aber die Insert-Policy bleibt offen. Bei mehr aktiven BioLinks wird Stufe 2 unumgänglich. |

---

# Offene Fragen

1. **Warum wurde der In-App-Versand entfernt?** In den Aktivitätsdaten steht vom 25.04.2026 „Nachricht an Brand gesendet: hiiiii", und `message_sent` ist im `CHECK`-Constraint. Es gab die Funktion also. Bevor 2.3(b) gebaut wird, gehört geklärt, woran sie gescheitert ist.

2. **Ist die Benachrichtigungsmail je angekommen?** Es gibt kein Versandprotokoll, `admin_errors` enthält keinen Eintrag für `notify-new-request`, und die `net._http_response`-Historie ist abgelaufen. Für Glenn (09.09.) und Testi (11.09.) müsste eine Registrierungsmail im Postfach liegen — das lässt sich nur dort nachsehen.

3. **Resend-Domain-Status.** Am 14.09. um 10:21 meldete `newsletter-subscribe` „Invalid `to` field. Please use our testing email address" — das ist der typische Fehler bei nicht verifizierter Absenderdomain. `notify-new-request` sendet von `noreply@viuno.de` und hat keinen solchen Fehler protokolliert, aber der Zusammenhang gehört einmal geprüft, bevor Bestätigungsmails an Fremdadressen (2.1) dazukommen.

4. **Soll die Bestätigungsmail an den Absender ein Reply-To auf den Creator tragen?** Dafür spricht die Erreichbarkeit, dagegen die Preisgabe der privaten Adresse an jeden, der das Formular absendet.

5. **Welche Budget-Spannen sind realistisch?** Die heutigen Stufen (unter 250 · 250–500 · 500–1.000 · 1.000+) stammen aus keiner belegten Quelle. Für DACH-Micro-Creator wäre zu klären, ob die Grenzen passen und ob „unter 250 €" nicht eher abschreckt.

6. **Wie soll `sonstiges` künftig behandelt werden?** Beide realen Einsendungen kamen darüber. Streichen, umbenennen („Presse / Medien"?) oder als Auffangbecken behalten und nur anders darstellen?

7. **Gibt es eine belastbare Vorstellung davon, wie viele Anfragen realistisch sind?** Bei 2.000 Aufrufen und einer angenommenen Conversion von 0,1 % wären das zwei pro Jahr. Wenn das die Erwartung ist, ändert es die Priorität des ganzen Bereichs — dann ist das Anfragen-Center ein Nebenschauplatz und die Arbeit gehört in BioLink-Reichweite statt in den Posteingang.

8. **Soll `deals` überhaupt weiterverfolgt werden?** Die Tabelle ist vollständig ausmodelliert (21 fachliche Spalten) und leer. Entweder wird sie über 2.4 angeschlossen — oder sie sollte weg, weil sie sonst nur suggeriert, dass es eine Deal-Verwaltung gäbe.
