# RUNBOOK — viuno im Betrieb

Für den Fall, dass etwas nicht geht. Ein Ort, fünf Fälle, jeweils: woran man es erkennt, was man zuerst prüft, was man tut. Alles ohne Monatsgebühr.

Adressen: Support `office@viuno.de` · Supabase-Projekt `bzejndghppuipnedasuv` (Frankfurt) · Cloudflare Pages Projekt `bioseiten` (Branch `main` = live) · Stripe-Konto StradaUno · Resend (Domain `viuno.de`, Versand über `send.viuno.de`).

Wo die Wahrheit steht: `admin_errors` (Tabelle, im Admin unter *System*), Supabase → Edge Functions → Logs, Stripe → Entwickler → Webhooks → Endpoint → Ereignisse, Cloudflare → Pages → Deployments.

---

## (a) Seite ist down

**Erkennen:** `https://viuno.de/` liefert keinen 200, oder die App zeigt nur den Boot-Spinner.

1. **Ist es Cloudflare oder Supabase?**
   - `curl -sI https://viuno.de/` → kein 200: Cloudflare Pages. Dashboard → Pages → *Deployments*: ist das letzte Deployment fehlgeschlagen? Dann *Retry* oder das vorherige Deployment über „Rollback" wieder aktiv setzen. Status: https://www.cloudflarestatus.com
   - Startseite lädt, aber App/News bleiben leer: Supabase. Dashboard → Project → *Health*; https://status.supabase.com. Ein pausiertes Projekt (Free-Plan nach Inaktivität) wird im Dashboard mit einem Klick wieder gestartet.
2. **Nur die App (`/app/`) hängt:** Browser-Konsole öffnen. Fehler `Failed to fetch` gegen `bzejndghppuipnedasuv.supabase.co` → Supabase; Fehler beim Laden von `/vendor/supabase-js.mjs` oder `/fonts/fonts.css` → ein Deployment hat die Dateien nicht mitgenommen (Cloudflare → Deployment → *Files*).
3. **Nach einem eigenen Push kaputt:** `git revert <commit>` auf `main` und pushen. Cloudflare baut in unter einer Minute.
4. **Eine einzelne BioLink-Seite fehlt (`/name/` → 404):** Im Repo prüfen, ob `public/<slug>/index.html` existiert. Fehlt sie: Creator loggt sich ein, BioLink → „Seite neu erzeugen" (ruft `generate-biolink`, committet die Datei nach `main`).

---

## (b) Zahlung kommt nicht an (Kunde hat bezahlt, keine Freischaltung)

**Erkennen:** Kunde meldet sich; oder im Admin steht ein Kauf ohne `analysis_purchases`-Zeile; oder Stripe zeigt beim Webhook-Endpoint einen Fehler.

1. **Stripe → Entwickler → Webhooks → Endpoint `…/stripe-webhook` → Ereignisse.** Steht das Ereignis `checkout.session.completed` (oder `async_payment_succeeded`) mit Antwort **200**? Dann ist der Webhook durch, weiter bei 3.
   - Antwort **400 „Ungueltige Signatur"**: das Secret `STRIPE_WEBHOOK_SIGNING_SECRET` in Supabase passt nicht zum Endpoint → in Stripe „Reveal" und in Supabase → Edge Functions → Secrets neu setzen. Danach in Stripe das Ereignis **„Erneut senden"**.
   - Antwort **500**: Supabase → Edge Functions → `stripe-webhook` → Logs lesen. Nach dem Fix ebenfalls „Erneut senden" — der Webhook ist idempotent (`stripe_webhook_events`), doppelte Zustellung ist ungefährlich.
   - Gar kein Ereignis: die Zahlung lief nicht über unseren Checkout (alter Payment Link, seit 15.09.2026 deaktiviert) — Kunde nach Beleg fragen.
2. **`admin_errors` prüfen** (Admin → System). Eine Zeile „Betrag … passt nicht zu 999 eur — NICHT freigeschaltet" heißt: es wurde etwas anderes als 9,99 € gezahlt. Von Hand entscheiden: erstatten (Stripe → Zahlung → Erstatten) oder freischalten (Punkt 3).
3. **Von Hand freischalten** (SQL-Editor, Service-Role):
   ```sql
   insert into public.analysis_purchases (user_id, platform, stripe_checkout_session_id, amount_paid, currency)
   values ('<user uuid>', 'instagram', '<cs_… aus Stripe>', 999, 'eur');
   ```
   Die `user_id` steht in Stripe unter *Metadata → user_id* der Session. Danach dem Kunden schreiben; die Kaufbestätigung kann man mit `send-purchase-confirmation` nachholen (Body `{"stripe_checkout_session_id":"cs_…"}`, Authorization: Service-Role-Key).
4. **Kunde hat Freischaltung, aber die Analyse startet nicht:** siehe (c).

---

## (c) Analyse-API tot (Apify oder Anthropic)

**Erkennen:** Analysen bleiben auf „läuft" und kippen nach 15 Minuten auf „fehlgeschlagen" (`fail_stale_analysis_runs`), oder `admin_errors` füllt sich mit `analysis-webhook`/`start-analysis`-Zeilen. Die Freischaltung bleibt in allen diesen Fällen erhalten — der Kunde verliert kein Geld, nur Zeit.

1. **Apify:** https://console.apify.com → *Runs*. Läufe mit `FAILED`? Meist: Guthaben leer (Admin → Geld → Guthaben) oder ein Actor wurde geändert. Guthaben aufladen unter https://console.apify.com/billing; danach im Admin den Stand unter *Guthaben* eintragen.
   - Apify sperrt gelegentlich Profile („private profile", „not found"). Dann ist das Profil wirklich privat oder der Handle falsch → Kunde bitten, den Handle im Profil zu prüfen.
2. **Anthropic:** Supabase → Edge Functions → `analysis-webhook` → Logs. `KI error: 401`/`403` → API-Key ungültig (`ANTHROPIC_API_KEY` in Supabase Secrets), `429` → Rate-Limit oder Guthaben (https://console.anthropic.com/settings/billing), `529` → Überlast, einfach später „Analyse starten" wiederholen.
3. **Webhook antwortet 403 „nicht erlaubt":** der Vault-Schlüssel `apify_webhook_schluessel` fehlt oder wurde geändert, ohne dass `start-analysis` es weiß. Prüfen: `select name from vault.secrets;` — beide Einträge (`cron_schluessel`, `apify_webhook_schluessel`) müssen existieren. Läufe, die *vor* einer Schlüsseländerung gestartet wurden, kommen nicht mehr an; sie kippen nach 15 Minuten, Freischaltung bleibt.
4. **Kunde beruhigen:** „Deine Freischaltung ist noch da. Bitte in 10 Minuten noch einmal ‚Analyse starten' drücken." Wenn zweimal fehlgeschlagen: Fall in `admin_errors` mit Run-ID nachlesen.

---

## (d) Nutzer will Daten gelöscht haben

1. **Selbst machen lassen** (der Normalfall): App → Profil → „Konto löschen", Nutzername eintippen. `delete-account` löscht Konto, Seiten im Repo, Storage, Newsletter-Eintrag; Kaufdaten bleiben anonymisiert (§ 147 AO). Dauer: Sekunden.
2. **Per E-Mail ohne Login** (Konto vergessen, Passwort weg): Identität prüfen — Antwort muss von der beim Konto hinterlegten Adresse kommen (`select id, email from public.users where email = '…'`). Dann im SQL-Editor **nicht** direkt löschen, sondern `delete-account` mit dem Service-Role-Key aufrufen ist nicht vorgesehen (die Function prüft das JWT des Nutzers). Stattdessen: Supabase → Authentication → Users → Nutzer → „Delete user". Der Cascade räumt die Datenbank; die statischen Seiten unter `public/<slug>/` und `public/kit/<slug>/` danach **von Hand** aus dem Repo entfernen und pushen, Storage `profile-images/<uid>/` im Dashboard löschen.
3. **Frist:** Art. 12 Abs. 3 DSGVO — ein Monat. Bestätigung per Mail von `office@viuno.de`.
4. **Auskunft (Art. 15):** App → Profil → „Datenauskunft" mailt den Export nach `office@viuno.de` mit dem Nutzer als Reply-To; von Hand aufbereiten und innerhalb von 48 h antworten (so steht es in der App).

---

## (e) Schlüssel kompromittiert

Reihenfolge: **sperren, dann ersetzen, dann prüfen**. Kein Schlüssel steht im Repo; alle liegen in Supabase → Edge Functions → Secrets oder im Vault.

| Was | Sperren / neu | Wo eintragen | Danach prüfen |
|---|---|---|---|
| Supabase **Service-Role-Key** | Supabase → Settings → API → „Generate new JWT secret" (rotiert anon **und** service_role) | Anon-Key in **17 Dateien** unter `public/` ersetzen (`grep -rl "role\":\"anon" public`) und pushen; Service-Role wird automatisch an die Functions verteilt | App laden, News laden, ein BioLink |
| **Stripe Secret Key** | Stripe → Entwickler → API-Schlüssel → „Roll key" | `STRIPE_SECRET_KEY` in Supabase Secrets | Test-Kauf im Testmodus |
| **Stripe Webhook Secret** | Stripe → Webhooks → Endpoint → „Roll secret" | `STRIPE_WEBHOOK_SIGNING_SECRET` | Ereignis „Erneut senden" → 200 |
| **Resend** | https://resend.com/api-keys → Key löschen, neuen anlegen | `RESEND_API_KEY` | Admin → Tagesmail „Test senden" |
| **Apify** | https://console.apify.com/account/integrations → Token neu | `APIFY_TOKEN` (`APIFY_TOKEN_2` wird nicht mehr gebraucht) | Eine Analyse mit dem eigenen Konto |
| **Anthropic** | https://console.anthropic.com/settings/keys | `ANTHROPIC_API_KEY` | wie Apify |
| **GitHub-Token** (Seitengenerator) | GitHub → Settings → Developer settings → Token widerrufen, neuen mit `contents:write` nur für `bioseiten` | `GITHUB_TOKEN` | BioLink „neu erzeugen" |
| **Cloudflare-Token** (Cache-Purge) | Cloudflare → Profil → API-Tokens | `CF_TOKEN` | wie GitHub |
| **Cron-/Webhook-Schlüssel** (Vault) | `select vault.update_secret((select id from vault.secrets where name='cron_schluessel'), encode(gen_random_bytes(32),'hex'));` — gleiches für `apify_webhook_schluessel` | nirgends, die Functions lesen den Vault | `select net.http_post(...)` wie in ROLLBACK.sql 1c, dann `net._http_response` → 200 |
| **Ein Nutzerkonto** (Passwort geleakt) | Supabase → Authentication → Users → „Send password recovery" oder „Delete sessions" | – | Nutzer informieren; `konto-warnung` mailt bei Passwortänderung ohnehin |

Nach jeder Rotation: `admin_errors` eine Stunde beobachten und die Tagesmail am nächsten Morgen lesen.

---

## Regelmäßig (einmal im Monat, zehn Minuten)

- Admin → *Geld*: Guthaben Anthropic/Apify reichen noch > 30 Tage?
- Supabase → Reports: Datenbankgröße, Egress (Free-Plan: 500 MB / 5 GB).
- Stripe → Zahlungen: Erstattungen, Rückbuchungen (Dispute innerhalb von 7 Tagen beantworten).
- `select count(*) from admin_errors where resolved = false;` — offene Fehler abarbeiten oder als erledigt markieren.
- Cloudflare → Pages → *Deployments*: nur erwartete Commits.
