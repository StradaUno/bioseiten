# Admin-Neubau — Bestandsaufnahme und Konzept

Stand: 15.09.2026. Nichts davon ist umgebaut, nichts ist live. Dieses Dokument
ist die Grundlage fuer die Entscheidung, was das neue Admin koennen soll.

---

## 1. Was heute existiert

### 1.1 Das Admin selbst

Drei Seiten, alle hinter `is_admin`:

| Seite | Zeilen | Was sie kann |
|---|---|---|
| `public/admin/` | 858 | Das Dashboard. Login, 6 Tabs, liest **eine** Edge Function (`admin-dashboard?action=overview`) |
| `public/admin/news/` | 301 | Redaktion: einzelne News-Karten korrigieren oder loeschen |
| `public/admin/karusell/` | 503 | Swipe-File fuer Instagram-Karussells |

Das Dashboard holt alles in **einem** Aufruf und rendert daraus:

- **Kopf**: Aufrufe gesamt, AI-Kosten Monat, neue Kontaktformular-Eintraege
- **Mini-Leiste**: User, BioLinks, Media Kits, Apify-Posts, Analysen, Newsletter, Errors
- **Tab Uebersicht**: Top 10 nach Aufrufen, 4 Wachstumsbalken
- **Tab User**: eine Zeile je User, nicht anklickbar
- **Tab AI & Apify**: Kosten nach Feature, nach Modell, letzte 15 Calls
- **Tab Inbox**: Kontaktformular (aktuell 0 Eintraege)
- **Tab Bio & MK**: BioLink- und Media-Kit-Liste
- **Tab Errors**: `admin_errors` + letzte Analyse-Laeufe

Aktionen insgesamt: **drei**. Kontakt-Eintrag loeschen, Collab-Anfrage loeschen
(toter Code — das Feature ist seit 14.09. weg), Fehler als erledigt markieren.

### 1.2 Die Seiten von viuno

**Oeffentlich, ohne Login:**

| Seite | Zaehlt sie? | Wohin |
|---|---|---|
| `/` und `/it/` Landing | **nein, gar nicht** | — |
| BioLink-Seiten (generiert + handgebaut) | ja | `biolink_aufrufe`, `biolink_klicks` |
| `/kit/` + `/kit/<slug>/` Media Kit | ja | `mediakit_aufrufe` |
| `/news/` Creator News | ja | `page_views` (page=news, news_card) |
| `/analyse/<token>` Analyse-Freigabe | nein | — |
| `/brandready/<token>` Brand-Ready-Freigabe | nein | — |
| `/legal`, `/agb`, `/datenschutz`, `/impressum`, `/widerruf` | nein | — |
| `/extras/`, `/karussell/` (gesperrt), `/pitch/1/` | nein | — |

**Die App** (`/app/`, Hash-Router, 7.752 Zeilen): `#/dashboard`, `#/analytics`,
`#/brandready`, `#/biolink`, `#/mediakit`, `#/digest`, `#/profile` — plus
`/login/`, `/register/`, `/onboarding/`, `/reset-password/` als eigene Seiten.

**Backend**: 47 Edge Functions, 7 pg_cron-Jobs, ~58 Tabellen.

### 1.3 Die Zahlen, wie sie heute wirklich stehen

| | |
|---|---|
| User | 5 (1 Admin, 0 geloescht) |
| BioLink-Aufrufe gesamt | 2.106, davon 2.043 auf einem Konto (Antonietta) |
| BioLink-Klicks | 11 |
| Media-Kit-Aufrufe | 52 |
| Kaeufe | 5 Stueck, 49,95 EUR |
| AI-Kosten seit April | 13,41 USD — davon **12,93 USD nur Creator News** (96 %) |
| Analyse-Laeufe | 5, alle `done` |
| Offene Fehler | 18 von 34 |
| Newsletter | 5 Abonnenten |
| Kontaktformular | 0 |

---

## 2. Die Luecken — was das Admin heute nicht zeigt

### 2.1 Geld kommt darin nicht vor

`analysis_purchases` hat 5 Zeilen und 4.995 Cent. Das Admin kennt die Tabelle
nicht. Es gibt keinen Umsatz, keine Kaufliste, keine Rechnung, keinen Kunden.
Dasselbe gilt fuer `stripe_webhook_events` (6 Ereignisse) und `stripe_prices`.

### 2.2 Und dieses Geld ist Testgeld

`stripe_prices` enthaelt **ausschliesslich Zeilen mit `mode = 'test'`**. Es gibt
keine Live-Preis-Zeile. `create-checkout-session` liest den Modus aus
`VIUNO_STRIPE_MODE` und wuerde ohne passende Preis-Zeile abbrechen — also
laeuft der Kauf heute im Testmodus. Die 49,95 EUR sind keine Einnahmen.

**Das muss im neuen Admin ganz oben stehen.** Eine Umsatzzahl ohne den
Hinweis "Testmodus" ist eine falsche Zahl, und sie faellt genau dann auf, wenn
man sich zum ersten Mal darauf verlaesst.

### 2.3 Die Marge ist unbekannt

Ein Verkauf kostet 9,99 EUR. Was er verursacht:

- **Instagram**: zwei Apify-Actors (`instagram-profile-scraper` +
  `instagram-post-scraper`, 36 Beitraege)
- **TikTok**: ein Actor (`clockworks~tiktok-scraper`, 36 Videos)
- dazu ein Haiku-Aufruf, im Schnitt 0,03 USD (Instagram) bzw. 0,01 USD (TikTok)

Der AI-Anteil ist erfasst. **Der Apify-Anteil nirgends.** Damit ist heute nicht
beantwortbar, ob 9,99 EUR Gewinn oder Verlust sind. Die Zahl liegt vor: die
Apify-Run-API gibt `usageTotalUsd` je Lauf zurueck, und `analysis-webhook` hat
die Run-ID bereits in der Hand.

### 2.4 Es gibt keinen Ort fuer ein Guthaben

Weder fuer Anthropic noch fuer Apify steht irgendwo, wie viel Guthaben noch da
ist. Verbrauch ohne Guthaben ist eine Zahl ohne Bezug: 13,41 USD sind
beruhigend bei 200 USD Guthaben und ein Problem bei 15 USD.

### 2.5 Die Landingpage ist blind

`/` und `/it/` senden nichts. Wie viele Menschen die Startseite sehen, woher
sie kommen, wie viele danach in die App gehen: unbekannt. Die Startseite hat
ausserdem **keinen Register-Link** — nur `/app/`.

### 2.6 Kein Funnel

Registriert → Onboarding fertig → BioLink an → Analyse gekauft. Jede Stufe
steht in der Datenbank, keine ist als Strecke sichtbar. Bei 5 Usern kann man
das im Kopf machen, bei 50 nicht mehr.

### 2.7 `last_active_at` ist bei allen fuenf Usern NULL

Die Spalte existiert, nichts schreibt sie. "Wer benutzt die App ueberhaupt
noch" ist heute nicht beantwortbar — und das ist die Frage, die bei 50 Usern
als erste gestellt wird.

### 2.8 Kein User-Detail

Die User-Liste ist eine Zeile pro Person, nicht anklickbar. Es gibt keinen
Ort, an dem alles zu einem Menschen steht: Kaeufe, Analysen, Seiten, Aufrufe,
Einwilligungen, Fehler.

### 2.9 Fast keine Aktionen

Das Admin ist ein Betrachter. Es kann keine Analyse nachschieben, keine Seite
neu erzeugen, keinen Kauf erstatten oder wieder freischalten, kein Admin-Recht
setzen, keinen Account sperren.

### 2.10 Reste

Pro/Free-Pills in der User-Liste, obwohl die Plan-Anzeige am 14.09. ueberall
sonst entfernt wurde. `del-collab` als Aktion, obwohl Anfragen geloescht sind.
18 Fehler, die seit Wochen offen stehen und die niemand sieht.

### 2.11 Nebenbei gefunden — ein Sicherheitsloch

`admin_errors` hat zwei Policies:

```
anon read admin_errors    SELECT  {anon}  USING (true)
anon update admin_errors  UPDATE  {anon}  USING (true) WITH CHECK (true)
```

Der anon-Key steht im Quelltext jeder oeffentlichen Seite. Damit kann **jeder**
alle Fehlermeldungen lesen — die enthalten User-IDs, E-Mail-Adressen und
Interna — und sie als erledigt markieren. Das gehoert auf `is_admin()`.
Ich habe nichts geaendert; das ist ein eigener, kleiner Commit.

---

## 3. Vorschlag: wie das neue Admin aussieht

Statt sechs gleichrangiger Tabs sechs Bereiche mit klarer Rangfolge. Der
Startbereich beantwortet eine Frage — "muss ich heute etwas tun?" — und der
Rest ist Nachschlagen.

### Heute
Ampel oben: Testmodus-Hinweis, Guthaben-Warnung, offene Fehler, haengende
Analysen. Darunter drei Zahlen: Umsatz Monat, Kosten Monat, Deckungsbeitrag.
Dann eine Aufgabenliste, die leer sein darf.

### Geld
Umsatz je Monat, jeder Kauf einzeln mit Kunde, Plattform, Betrag,
Rechnungslink, ob die Analyse schon verbraucht wurde. Stripe-Ereignisse
daneben, damit man sieht, ob ein Webhook durchgelaufen ist.

### Kosten & Budget
Guthaben fuer Anthropic und Apify eintragen (Betrag + Stichtag). Die Tabelle
rechnet: Verbrauch seit dem Stichtag, verbleibendes Guthaben, Verbrauch pro
Tag, **Restlaufzeit in Tagen**, Datum, an dem es leer ist. Warnung bei unter
14 Tagen, Alarm bei unter 7. Darunter: Kosten nach Feature, nach Modell,
Kosten je Analyse und daraus die Marge je Verkauf.

### Menschen
Suchbare User-Liste mit Filtern (aktiv, zahlend, eingeschlafen). Klick oeffnet
die **User-Akte**: Stammdaten, Kanaele, Seiten mit Live-Link und Zustand,
Aufrufe, Kaeufe, Analysen, Einwilligungen, Fehler zu diesem User — und die
Aktionen (Seite neu erzeugen, Analyse freischalten, Admin setzen).
Newsletter und Kontaktformular gehoeren in denselben Bereich.

### Traffic
Aufrufe je Seitentyp, Herkunft (Instagram, Threads, direkt …), Sprache,
Tagesverlauf. Und der Funnel als eine Strecke: Landing → Registrierung →
Onboarding → BioLink an → Kauf.

### System
Fehler mit Verlauf statt nur Liste. Cron-Jobs mit letztem Lauf. Edge Functions
mit Version. Redaktion (News, Karussell) verlinkt.

---

## 4. Der Baukasten — jedes Modul einzeln

Drei Stufen:

- **Stufe A — sofort.** Die Daten liegen schon in der Datenbank. Nur Anzeige.
  Kein Schema, keine neue Erfassung, kein Risiko.
- **Stufe B — kleine Erweiterung.** Eine Tabelle oder zwei Spalten dazu.
- **Stufe C — neue Erfassung.** Es muss zusaetzlich etwas gemessen werden,
  also Code auf einer Seite oder in einer Function.

| # | Modul | Stufe | Aufwand | Empfehlung |
|---|---|---|---|---|
| 1 | Umsatz & Kaufliste | A | klein | **ja** |
| 2 | Testmodus-Warnung | A | sehr klein | **ja** |
| 3 | Stripe-Ereignisse | A | klein | ja |
| 4 | AI-Kosten (Feature/Modell/Verlauf) | A | vorhanden | **ja** |
| 5 | User-Akte (Detailseite) | A | mittel | **ja** |
| 6 | User-Suche & Filter | A | klein | **ja** |
| 7 | Fehler mit Verlauf + Zuordnung | A | klein | **ja** |
| 8 | Analysen: Laufzeit, haengende Laeufe | A | klein | **ja** |
| 9 | Traffic: Herkunft, Sprache, Stunde | A | klein | **ja** |
| 10 | Newsletter-Verwaltung | A | klein | ja |
| 11 | Cron- & Function-Status | A | mittel | ja |
| 12 | Einwilligungen je User | A | klein | ja |
| 13 | Aktionen (Seite neu erzeugen, freischalten …) | A | mittel | ja |
| 14 | **Guthaben-Rechner** (Anthropic + Apify) | **B** | **klein** | **ja** |
| 15 | **Apify-Kosten je Lauf → Marge** | **B** | **klein** | **ja** |
| 16 | Notizen zu einem User | B | sehr klein | optional |
| 17 | **Landingpage-Tracking + Funnel** | **C** | **mittel** | **ja** |
| 18 | `last_active_at` befuellen | C | sehr klein | **ja** |
| 19 | Aufrufe der Freigabe-Seiten (/analyse, /brandready) | C | klein | optional |
| 20 | Tages-E-Mail "das ist gestern passiert" | C | mittel | spaeter |
| 21 | Kohorten / Bindung ueber Wochen | A | gross | spaeter |

---

## 5. Was es kostet, bevor etwas gebaut wird

### B1 — Guthaben-Rechner: **eine Tabelle, vier Spalten**

```sql
create table kosten_guthaben (
  id          uuid primary key default gen_random_uuid(),
  anbieter    text not null check (anbieter in ('anthropic','apify')),
  betrag_usd  numeric(10,2) not null,
  stand_am    timestamptz not null default now(),
  notiz       text,
  erfasst_von uuid references users(id)
);
alter table kosten_guthaben enable row level security;
create policy nur_admin on kosten_guthaben for all
  to authenticated using (is_admin()) with check (is_admin());
```

Eine Zeile je Auffuellung, nie ueberschreiben — dann ist der Verlauf gleich
mit da. Das Admin liest die neueste Zeile je Anbieter und rechnet den
Verbrauch seit `stand_am` dagegen.

Fuer Anthropic ist der Verbrauch exakt: `ai_usage_log.cost_usd`. Fuer Apify
erst, wenn B2 da ist — vorher nur schaetzbar ueber die Zahl der Laeufe.

**Aufwand: ~20 Zeilen SQL, kein Function-Deploy, keine Aenderung an
bestehenden Tabellen. Rueckbaubar mit einem `drop table`.**

### B2 — Apify-Kosten je Lauf: **zwei Spalten, ~15 Zeilen Code**

```sql
alter table analysis_runs
  add column apify_kosten_usd numeric(10,4),
  add column apify_kosten_stand timestamptz;
```

In `analysis-webhook`, wo die Apify-Run-ID ohnehin vorliegt:

```ts
const r = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`)
const usage = (await r.json()).data?.usageTotalUsd
// aufaddieren, weil Instagram zwei Laeufe hat
```

Erst danach ist die Marge je 9,99-EUR-Verkauf eine Zahl statt einer Vermutung.

**Aufwand: 2 Spalten (nullable, aendert nichts Bestehendes) + ein Deploy von
`analysis-webhook`. Alte Laeufe bleiben leer — das ist in Ordnung, es sind
fuenf.**

### C1 — Landingpage-Tracking: **keine neue Tabelle**

`page_views` gibt es schon, anon darf einfuegen (`page_views_insert_alle`),
Admin darf alles lesen (`page_views_select_admin`). Es braucht nur:

```js
// auf / und /it/, nach dem Laden:
fetch(REST + '/page_views', { method:'POST', headers:{...},
  body: JSON.stringify({ page:'landing', source: herkunft(document.referrer) }) })
```

**Wichtig, und das ist die Grenze aus CLAUDE.md:** kein Cookie, kein
localStorage, keine IP, kein User-Agent. Gespeichert wird nur *was* passiert
ist, nicht *wer*. Damit bleibt es beim jetzigen Zustand — kein Cookie-Banner
noetig. Wer hier eine Wiedererkennung ueber zwei Aufrufe hinweg einbaut, macht
den Banner noetig.

**Aufwand: ~10 Zeilen auf zwei Seiten. Null Schema. Der Funnel ist danach
eine `view` ueber `page_views` + `users` + `analysis_purchases`.**

### C2 — `last_active_at`: **keine neue Spalte**

Die Spalte existiert seit jeher und ist leer. Ein `update users set
last_active_at = now()` beim App-Start (hoechstens einmal pro Stunde, damit es
keine Schreiblast gibt) fuellt sie.

**Aufwand: ~5 Zeilen in `public/app/index.html`.**

### Alternative ohne jeden Code

Fuer 2.5 gaebe es **Cloudflare Web Analytics** — kostenlos, im Cloudflare-Konto
schon vorhanden, ein Script-Tag, keine Cookies. Das liefert Besucher, Herkunft
und Geraete fuer die Landing, aber **nicht** die Verbindung zur Registrierung.
Mein Vorschlag: beides. Cloudflare fuer die Rohreichweite, `page_views` fuer
den Funnel.

---

## 6. Was ich empfehle, in dieser Reihenfolge

1. **Testmodus-Hinweis + Umsatz + Kaufliste** (A) — die groesste Luecke, null Aufwand.
2. **Guthaben-Rechner** (B1) — deine ausdrueckliche Anforderung, eine Tabelle.
3. **Apify-Kosten** (B2) — ohne sie kennst du deine Marge nicht.
4. **User-Akte + Suche** (A) — der Ort, an dem alles zu einem Menschen steht.
5. **`last_active_at`** (C2) — fuenf Zeilen, beantwortet die wichtigste Frage bei Wachstum.
6. **Landing-Tracking + Funnel** (C1) — sobald Werbung oder Reichweite laeuft.
7. **Fehler aufraeumen** — 18 offene, und die RLS-Luecke aus 2.11.

Alles Weitere ist Komfort und kann warten.
