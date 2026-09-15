# LEGAL-CHANGES — Änderungen an den Rechtstexten (Launch-Check, 15.09.2026)

Die Texte liegen in der Tabelle `legal_texts` (Zeile `id = 1`) und werden von `/legal` zur Laufzeit geladen. Vor der Änderung wurde gesichert: **`legal_texts_backup_20260915`**. Zurück auf den Vorstand: `ROLLBACK.sql`, Abschnitt 3.

**Ich bin kein Anwalt.** Jede inhaltliche Änderung unten ist zum Gegenlesen markiert. Reine Adress- und Namensänderungen sind mit „Adresse" gekennzeichnet.

## Impressum

| Nr. | Vorher | Nachher | Art |
|---|---|---|---|
| I-1 | `E-Mail: kontakt@stradauno.de` | `E-Mail: office@viuno.de` | Adresse |

Geprüft, unverändert: Name, Anschrift, Telefon, Kleinunternehmer-Hinweis, § 18 Abs. 2 MStV, Verbraucherschlichtung (kein OS-Link — richtig, die EU-Plattform ist seit 20.07.2025 abgeschaltet).

## AGB

| Nr. | Vorher | Nachher | Art |
|---|---|---|---|
| A-1 | `kontakt@stradauno.de` (Kopf, § 7.2, Kontakt) | `office@viuno.de` | Adresse |
| A-2 | § 6.1 „Die Registrierung und die Grundfunktionen der App (BioLink, Media Kit, Creator News) **sind kostenlos**." | „… (BioLink, Media Kit, Creator News, **Brand-Ready-Check nach einer Analyse**) sind **ohne zusätzliche Kosten in jedem Konto enthalten**." | Inhalt — Sprachregel „kostenlos" und der Brand-Ready-Check fehlte als Leistung |
| A-3 | § 3.1 „… als webbasierte Anwendung sowie ggf. als Mobile App über App Stores (iOS / Android) angeboten." | „… als webbasierte Anwendung angeboten." | Inhalt — es gibt keine App-Store-App |
| A-4 | § 11.4 „(Supabase, Cloudflare, GitHub, Apify, Anthropic, Resend, App Stores)" | „(…, Resend, **Stripe**)" | Inhalt — App Stores raus, Stripe als tatsächlich genutzter Dritter rein |
| A-5 | § 15 „Die EU-Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit, die unter https://ec.europa.eu/consumers/odr abrufbar ist. Der Anbieter ist …" | „Der Anbieter ist …" | Inhalt — die OS-Plattform wurde am 20.07.2025 eingestellt (VO (EU) 2024/3228); ein Link darauf ist irreführend |

Geprüft, unverändert: § 6.2 Preis 9,99 € mit § 19 UStG, § 6.3 Verbrauch erst nach erfolgreicher Auswertung, § 4.4 nur eigene Kanäle, § 9 KI-Hinweis, § 14 Recht/Gerichtsstand.

## Datenschutzerklärung

| Nr. | Vorher | Nachher | Art |
|---|---|---|---|
| D-1 | `kontakt@stradauno.de` (§ 1, § 3.8, § 10, § 14) | `office@viuno.de` | Adresse |
| D-2 | § 3.4 „Bei Nutzung der Analytics-Funktion" | „Bei Nutzung der viuno Analyse" | Bezeichnung |
| D-3 | § 3.3 „Aggregierte Statistiken aus deinen verbundenen Social-Media-Profilen (…)" | „Aggregierte Statistiken zu deinen Social-Media-Profilen (…) – **aus deiner viuno Analyse oder von dir selbst eingetragen**" | Inhalt — die Media-Kit-Zahlen werden nicht laufend „verbunden" abgerufen |
| D-4 | § 3.8 „Die Anmeldung zum Newsletter ist freiwillig und kann jederzeit über die App-Einstellungen oder durch eine kurze Mitteilung … widerrufen werden." | „**Bei der Bestätigung deiner Anmeldung (Double-Opt-In) speichern wir außerdem Zeitpunkt, IP-Adresse und Browser-Kennung der Bestätigung als Nachweis deiner Einwilligung (Art. 7 Abs. 1 DSGVO).** Die Anmeldung ist freiwillig und kann jederzeit **über den Abmeldelink in jeder E-Mail**, über die App-Einstellungen oder … widerrufen werden." | Inhalt — `newsletter_subscribers.confirm_ip` / `confirm_user_agent` werden tatsächlich gespeichert und waren nicht genannt |
| D-5 | § 5.1 „Server-Standort der verarbeiteten Daten: Frankfurt, Deutschland (eu-central-1)" | „Server-Standort **von Datenbank und Dateispeicher**: Frankfurt … **Serverseitige Funktionen (Edge Functions) werden über das weltweite Netz von Supabase ausgeführt.**" | Inhalt — Edge Functions laufen nicht zwingend in Frankfurt; **bitte anwaltlich prüfen, ob dafür ein Drittland-Hinweis nötig ist** |
| D-6 | § 5.5 Resend: „Account-E-Mails (Registrierungsbestätigung, Passwort-Reset, Account-Benachrichtigungen) sowie ggf. der Creator-News-Newsletter" | „… (Registrierungsbestätigung, Passwort-Reset, **Hinweis bei Änderung von Passwort oder E-Mail-Adresse**), **die Kaufbestätigung und die Ergebnis-Mail zu einer Analyse** sowie ggf. der Creator-News-Newsletter" | Inhalt — diese Mails gehen tatsächlich über Resend. **Offen (braucht Mehmet): laufen Registrierungs- und Reset-Mails von Supabase Auth ebenfalls über Resend (Custom SMTP) oder über den Supabase-Standardversand? Wenn Standard: Satz anpassen.** |
| D-7 | § 5.8 App Stores (Apple App Store, Google Play – soweit zutreffend) … | § 5.8 **Schriften und Skripte**: „Schriften und Programmbibliotheken liefern wir von unseren eigenen Servern aus. Beim Aufruf unserer Seiten werden keine Schriften von Google und keine Skripte von fremden Verteilnetzen (CDNs) nachgeladen." | Inhalt — keine App-Store-App; Google Fonts und esm.sh wurden im selben Schritt durch lokale Dateien ersetzt (`public/fonts/`, `public/vendor/`) |
| D-8 | § 7.2 (Ende von Abschnitt 7) | neu **§ 7.3**: anonyme Zählung der eigenen Seiten (Startseite, Creator News, geteilte Ausschnitte): Seite, Herkunft ohne Klick-Kennungen, Zeitpunkt, bei eingeloggten Nutzern die Konto-ID; keine IP, keine Gerätekennung, kein Cookie; Art. 6 Abs. 1 lit. f | Inhalt — `page_views` wird seit 15.09. geschrieben und war nicht beschrieben |
| D-9 | § 8.1 „Auf der Website können technisch notwendige Cookies gesetzt werden, etwa zum Speichern deiner Login-Session." | „In der App speichern wir technisch notwendige Daten im **Local Storage** deines Browsers: deine Login-Sitzung und einen Zeitstempel (…einmal pro Stunde…). Ohne diese Speicherung funktioniert die Anmeldung nicht (§ 25 Abs. 2 Nr. 2 TDDDG). Beim Bezahlvorgang setzt Stripe auf seiner eigenen Seite technisch notwendige Cookies; Cloudflare kann zur Abwehr automatisierter Angriffe ein technisch notwendiges Cookie setzen." | Inhalt — die Sitzung liegt tatsächlich im Local Storage, nicht in einem Cookie |

Geprüft, unverändert: Verantwortlicher, Rechtsgrundlagen je Zweck, Apify (Prag), Anthropic (SCC, kein Training), Stripe (Irland), GitHub (DPF), Cloudflare (DPF), Speicherdauern, Betroffenenrechte, Aufsichtsbehörde BW, Löschkonzept (deckt sich mit `delete-account`).

## Widerrufsbelehrung

| Nr. | Vorher | Nachher | Art |
|---|---|---|---|
| W-1 | `E-Mail: kontakt@stradauno.de` (Belehrung + Muster-Widerrufsformular) | `E-Mail: office@viuno.de` | Adresse |

Geprüft, unverändert: 14 Tage, Erlöschen nach § 356 Abs. 5 BGB mit allen drei Bedingungen (Checkbox in der App, Bestätigungstext, Vertragsbestätigung per Mail durch `send-purchase-confirmation`), Muster-Widerrufsformular vorhanden.

## BioLink-Nutzungsbedingungen

| Nr. | Vorher | Nachher | Art |
|---|---|---|---|
| B-1 | „Wir hosten deinen BioLink über Cloudflare (EU-Server)." | „… über Cloudflare (weltweites Netz; Anbieter mit Sitz in den USA, zertifiziert nach dem EU-US Data Privacy Framework)." | Inhalt — „EU-Server" war nicht belegbar; Cloudflare ist ein weltweites Netz |

## Media-Kit-Nutzungsbedingungen

| Nr. | Vorher | Nachher | Art |
|---|---|---|---|
| M-1 | „Wir hosten dein Media Kit über Cloudflare (EU-Server)." | wie B-1 | Inhalt |
| M-2 | „Deine Statistiken … werden automatisiert aus den öffentlich zugänglichen Profildaten … erhoben und in regelmäßigen Abständen aktualisiert." | „Deine Statistiken … stammen aus deiner letzten viuno Analyse (…) oder aus deinen eigenen Angaben in der App. Sie werden nicht laufend aktualisiert, sondern erst mit deiner nächsten Analyse oder deiner nächsten Eingabe." | Inhalt — es gibt keinen regelmäßigen Abruf; die Zahlen kommen aus der Analyse oder von Hand |
| M-3 | „(z. B. Brand-Anbahnung, Anfragen-Annahme)" | „(z. B. Anbahnung von Kooperationen mit Marken)" | Inhalt — das Anfragen-Feature existiert nicht mehr |

## Außerhalb der Datenbank (Seiten im Repo)

| Ort | Änderung |
|---|---|
| `public/it/index.html` | Fußzeile: Links auf `/legal#agb` (Termini), `/legal#widerruf` (Recesso), `/legal#datenschutz` (Privacy) ergänzt; das Privacy-Modal lud ein iframe von `itrk.legal`, das 404 liefert — ersetzt durch den Link auf `/legal`; E-Mail im Impressum-Modal auf `office@viuno.de` |
| alle Seiten | Google Fonts und `esm.sh` durch lokale Dateien ersetzt (siehe D-7) |
| `send-purchase-confirmation`, `send-analysis-email` | Reply-To von `kontakt@stradauno.de` auf `office@viuno.de` (Phase 3) |

## Was ich nicht entschieden habe (braucht Mehmet / Anwalt)

1. **D-5**: ob die Edge-Function-Ausführung außerhalb der EU einen eigenen Drittland-Hinweis (Art. 44 ff.) braucht. Supabase bietet regionale Bindung per `x-region`-Header an; wenn gewünscht, kann ich die Aufrufe auf `eu-central-1` festnageln.
2. **D-6**: Versandweg der Supabase-Auth-Mails (Dashboard → Authentication → SMTP Settings).
3. **Instagram/TikTok-Datenabruf über Apify**: Die Nutzungsbedingungen beider Plattformen untersagen automatisiertes Auslesen ohne Erlaubnis. Rechtlich ist das primär ein Vertrags-/Plattformrisiko (Sperrung des Abruf-Dienstes, keine DSGVO-Frage, da nur öffentliche Daten des Kunden selbst auf dessen Auftrag). Bitte bewusst entscheiden und ggf. in den AGB § 3.2 („Störungen von Dritten") belassen.
4. **AV-Verträge** (Art. 28): Supabase (DPA im Dashboard), Cloudflare (DPA in den Kontoeinstellungen), Stripe (Teil der Stripe Services Agreement), Resend (DPA anfordern/akzeptieren), Apify (DPA im Konto), Anthropic (Commercial Terms + DPA, „no training" bestätigen), GitHub (DPA in den Kontoeinstellungen).
