# Rechtstexte — Änderungsprotokoll

**Stand:** 13. September 2026
**Status:** ✅ **Übernommen und live.** Nach anwaltlicher Freigabe am 13.09.2026 in `legal_texts` (Zeile `id = 1`) eingespielt und auf `/agb/`, `/widerruf/`, `/datenschutz/` und `/legal/` verifiziert.
**Snapshot vorher:** Tabelle `legal_texts_backup_20260913`.

Die Datei war ursprünglich ein Entwurf zur Prüfung. Sie bleibt als Protokoll erhalten: unten steht, was geändert wurde und warum.

**Ich bin kein Anwalt.** Die Formulierungen stammen aus diesem Entwurf und wurden anwaltlich freigegeben; die Verantwortung für den Inhalt liegt dort.

---

## Wie die Änderung eingespielt wurde

Die Texte stehen in der Tabelle `legal_texts` (eine Zeile, Spalten `agb`, `widerruf`, `datenschutz`, `impressum`, `biopage_terms`, `mediakit_terms`). Die Seiten laden sie zur Laufzeit — es war kein Deployment nötig. Vor dem Update wurde gesichert:

```sql
CREATE TABLE legal_texts_backup_20260913 AS TABLE legal_texts;
```

---

## 1 · AGB § 6.1 — der zentrale Widerspruch

**Heute:**
> 6.1 Die Nutzung der App ist derzeit kostenlos. Der Anbieter behält sich vor, künftig kostenpflichtige Funktionen einzuführen. In diesem Fall wird der Nutzer rechtzeitig vorab informiert. Eine Umstellung bestehender, kostenloser Accounts auf kostenpflichtige Nutzung erfolgt nur mit ausdrücklicher Zustimmung des Nutzers.

**Übernommen:**
> **6) PREISE**
>
> 6.1 Die Registrierung und die Grundfunktionen der App (BioLink, Media Kit, Creator News, Anfragen-Verwaltung) sind kostenlos.
>
> 6.2 Die Funktion „viuno Analyse" ist kostenpflichtig. Eine Freischaltung kostet 9,99 € (umsatzsteuerfrei nach § 19 UStG) und berechtigt zu **einer** Auswertung **eines** Kanals (Instagram oder TikTok). Der jeweils geltende Preis wird vor dem Kauf in der App und im Bestellprozess angezeigt.
>
> 6.3 Eine Freischaltung wird erst verbraucht, wenn die Auswertung erfolgreich abgeschlossen wurde. Scheitert die Auswertung vollständig, bleibt die Freischaltung bestehen und kann erneut eingesetzt werden. Eine Freischaltung verfällt nicht.
>
> 6.4 Die Zahlung wird über den Zahlungsdienstleister Stripe abgewickelt. Es gelten ergänzend die dort im Bestellprozess ausgewiesenen Konditionen.
>
> 6.5 Der Anbieter behält sich vor, Preise für künftige Käufe zu ändern. Bereits erworbene, noch nicht verbrauchte Freischaltungen bleiben davon unberührt.

Die Aussagen in 6.2 und 6.3 entsprechen exakt dem, was der Code tut (`analysis_purchases.platform`, `consumed_at` erst nach erfolgreichem Haiku-Lauf, kein Verfallsdatum).

---

## 2 · AGB § 1.2 — Leistungsbeschreibung

**Heute:**
> • Analytics: Auswertung deiner Instagram- und/oder TikTok-Profildaten

**Übernommen:**
> • viuno Analyse (kostenpflichtig, siehe § 6): Auswertung der öffentlich zugänglichen Profil- und Beitragsdaten **eines** von dir verknüpften Instagram- oder TikTok-Kanals, einschließlich einer KI-gestützten Einordnung

---

## 3 · AGB — neue Ziffer zur Eigentümerschaft der Kanäle

**Heute: fehlt.** Die Media-Kit-Bedingungen enthalten eine entsprechende Zusicherung, für die Analyse gibt es keine. Technisch kann derzeit jeder beliebige Handle eingetragen und analysiert werden.

**Übernommen (als § 4.4 in „Pflichten des Nutzers"):**
> 4.4 Der Nutzer darf über die Analyse-Funktion ausschließlich Kanäle auswerten lassen, deren Inhaber er selbst ist oder für die er zur Auswertung berechtigt ist. Die Auswertung fremder Profile ohne Berechtigung ist untersagt und kann zur Sperrung des Accounts führen.

> **Technisch umgesetzt:** Das Handle-Modal verlangt jetzt eine Bestätigung („Ich bestätige, dass dies meine eigenen Kanäle sind oder ich zur Auswertung berechtigt bin.“). Ohne Haken lässt sich kein Handle speichern.

---

## 4 · AGB § 9.1 — KI-Nutzung

**Heute:**
> 9.1 Der Dienst nutzt zur Bereitstellung bestimmter Funktionen (insbesondere Daily Digest) Künstliche Intelligenz (KI) der Anthropic, PBC, USA.

**Übernommen:**
> 9.1 Der Dienst nutzt zur Bereitstellung bestimmter Funktionen — insbesondere der Creator News und der viuno Analyse — Künstliche Intelligenz (KI) der Anthropic, PBC, USA.

Der Rest von § 9 (Fehlbarkeit KI-generierter Inhalte, Eigenverantwortung) passt bereits und muss nicht geändert werden. Er ist für ein **kostenpflichtiges** KI-Produkt aber besonders relevant — bitte anwaltlich prüfen lassen, ob der Haftungsausschluss in dieser Form auch dann trägt, wenn für die KI-Auswertung bezahlt wurde.

---

## 5 · Widerrufsbelehrung — der wichtigste Punkt

**Heute, Eingangshinweis:**
> Hinweis: Die Nutzung von viuno ist derzeit kostenlos. Sollten in Zukunft kostenpflichtige Funktionen angeboten werden, erhältst du vor jedem entgeltlichen Vertragsabschluss eine separate Widerrufsbelehrung. Die nachfolgende Belehrung ist daher ein Vorab-Hinweis für den Fall, dass künftig kostenpflichtige Leistungen vereinbart werden.

Dieser Absatz muss ersatzlos weg — es gibt ein Bezahlprodukt, und die angekündigte „separate Widerrufsbelehrung" existiert nicht.

**Übernommen als Eingangshinweis:**
> Diese Belehrung gilt für kostenpflichtige Leistungen von viuno, derzeit die Funktion „viuno Analyse".

**Der Rest der bestehenden Belehrung bleibt unverändert** — Widerrufsrecht, Fristen, Folgen des Widerrufs, Muster-Widerrufsformular sind bereits korrekt formuliert.

### Der Abschnitt „Vorzeitiges Erlöschen" — Ist-Abgleich

Die bestehende Belehrung nennt die drei Bedingungen aus § 356 Abs. 5 BGB korrekt. Stand jetzt:

| Bedingung | Umsetzung | Status |
|---|---|---|
| 1. Ausdrückliche Zustimmung zum Beginn vor Fristablauf | Checkbox je Kanal in der Analyse-View; `create-checkout-session` lehnt ohne `consent: true` mit 400 ab | ✅ |
| 2. Bestätigung der Kenntnis des Rechtsverlusts | Checkbox-Text: „…und verliere damit mein 14-tägiges Widerrufsrecht." Protokolliert in `withdrawal_consents` mit Session-ID und `effective_at` | ✅ |
| 3. Bestätigung des Vertrags **mit Hinweis auf das Erlöschen** in Textform | **Neu: `send-purchase-confirmation`**, ausgelöst vom `stripe-webhook` nach erfolgreichem Kauf | ✅ **seit heute** |

Bedingung 3 fehlte bis heute vollständig. Der Stripe-Beleg enthält den Hinweis nicht.

**Formulierung in der Bestätigungsmail (bereits live):**
> **Wichtig: Widerrufsrecht**
> Du hast vor dem Kauf ausdrücklich zugestimmt, dass wir sofort mit der Ausführung beginnen, und bestätigt, dass du dadurch dein Widerrufsrecht verlierst. Mit dem Beginn der Ausführung ist dein **Widerrufsrecht erloschen** (§ 356 Abs. 5 BGB).

Bitte diese Formulierung mitprüfen lassen — sie ist der rechtlich heikelste Satz im ganzen Ablauf.

**Anzupassen ist außerdem die Formulierung im Belehrungstext selbst**, die heute im Futur steht („Bei künftigen Verträgen über die Bereitstellung digitaler Inhalte…"). Übernommen: „Bei Verträgen über die Bereitstellung digitaler Inhalte oder digitaler Dienstleistungen, die nicht auf einem körperlichen Datenträger geliefert werden, erlischt das Widerrufsrecht vorzeitig, wenn…" (Rest unverändert).

---

## 6 · Datenschutz 9.1 — letzter Spiegelstrich

**Heute:**
> • Bezahlte Bestellungen werden aus steuerrechtlichen Aufbewahrungspflichten heraus pseudonymisiert aufbewahrt (siehe 9.3). Aktuell werden keine kostenpflichtigen Leistungen angeboten.

**Übernommen:**
> • Daten zu bezahlten Freischaltungen (Zeitpunkt, Betrag, Kanal, Stripe-Vorgangsnummer) werden aus steuerrechtlichen Aufbewahrungspflichten heraus aufbewahrt (siehe 9.3). Der Personenbezug wird dabei so weit entfernt, wie es die Aufbewahrungspflicht zulässt.

> **Technisch nachgezogen:** Der Satz beschrieb den Ist-Zustand nicht. `delete-account` setzt jetzt `user_id` in `analysis_purchases`, `withdrawal_consents` und `ai_usage_log` auf NULL, bevor der Auth-User gelöscht wird — dasselbe Muster, das dort schon für bezahlte `subscriptions` galt. Dafür mussten die beiden Spalten NULL-bar gemacht werden.

---

## 7 · Datenschutz — Stripe fehlt als Auftragsverarbeiter

**Heute:** Abschnitt 5 listet Supabase, Cloudflare, Apify, Anthropic, Resend, GitHub und App Stores. **Stripe fehlt vollständig**, obwohl dort Zahlungs- und Rechnungsdaten verarbeitet werden.

**Übernommen als neuer Abschnitt 5.7** (bestehende 5.7 „App Stores" rückt auf 5.8):
> **5.7 Stripe (Zahlungsabwicklung)**
> Anbieter: Stripe Payments Europe, Limited, 1 Grand Canal Street Lower, Grand Canal Dock, Dublin, Irland
> Verarbeitete Daten: Name, E-Mail-Adresse, Rechnungsanschrift, Zahlungsdaten (Kartendaten bzw. Daten des gewählten Zahlungsverfahrens), Betrag, Zeitpunkt, sowie eine interne Kennung deines viuno-Accounts zur Zuordnung des Kaufs.
> Zweck: Abwicklung der Zahlung und Erstellung des Zahlungsbelegs bzw. der Rechnung.
> Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung) sowie Art. 6 Abs. 1 lit. c DSGVO (steuerrechtliche Aufbewahrungspflichten).
> Hinweis: Deine Zahlungsdaten werden ausschließlich von Stripe verarbeitet. viuno erhält und speichert keine Kartendaten.

Zusätzlich in **Abschnitt 3** übernommen:
> **3.9 Bei Kauf einer Analyse**
> • Gekaufter Kanal, Betrag, Währung, Zeitpunkt des Kaufs
> • Stripe-Vorgangsnummern (Checkout-Session und Zahlungsvorgang)
> • Zeitpunkt und Wortlaut deiner Zustimmung zur sofortigen Ausführung
> • Zeitpunkt, zu dem die Freischaltung für eine Analyse eingesetzt wurde

---

## 8 · Impressum — keine Änderung nötig

„Umsatzsteuerbefreit (Kleinunternehmerregelung)" steht bereits drin. ✅

Der § 19 UStG-Hinweis erscheint zusätzlich an zwei Stellen:
- in der Stripe-Produktbeschreibung (sichtbar im Checkout)
- im Footer der per Stripe erzeugten Rechnung (`invoice_creation` ist seit Schritt 2 aktiviert) und in der Kaufbestätigungs-Mail

---

## Was der Anwalt zusätzlich anschauen sollte

1. **Trägt der KI-Haftungsausschluss (§ 9.2/9.3 AGB) auch bei einer bezahlten Leistung?** Das ist der Kern des Produkts — eine KI-generierte Auswertung, für die Geld fließt.
2. **Reicht die Checkbox-Formulierung für § 356 Abs. 5 Nr. 1 und 2?** Sie kombiniert Zustimmung und Kenntnisbestätigung in einem Satz.
3. **Muss im Checkout selbst auf AGB und Widerruf verwiesen werden?** Derzeit steht in der Stripe-Session `consent_collection.terms_of_service: "none"`, und `custom_text` ist leer. Der Verweis findet nur in der App vor der Weiterleitung statt.
4. **Braucht es eine Button-Lösung nach § 312j Abs. 3 BGB?** Der Button heißt aktuell „Freischalten – 9,99 €". Ob das als „zahlungspflichtig bestellen" oder entsprechend eindeutige Formulierung genügt, sollte geprüft werden — das ist eine der häufigsten Abmahnursachen im Onlinehandel und betrifft die Beschriftung direkt.
5. **Ist die Preisangabe vollständig i.S.d. PAngV?** Derzeit: „9,99 €" plus „Einmalig pro Analyse, kein Abo" in der App, „9,99 € je Kanal" auf der Landingpage, § 19 UStG im Checkout.

---

## Technische Punkte, die aus dieser Prüfung folgten

| Punkt | Zustand |
|---|---|
| Bestätigung der Kanal-Eigentümerschaft im Handle-Modal | gebaut (AGB 4.4) |
| Button-Beschriftung auf „Zahlungspflichtig freischalten – 9,99 €" | geändert, siehe Hinweis unten |
| AGB-/Widerruf-Verweis in der App direkt über dem Kaufbutton | gebaut |
| AGB-/Widerruf-Hinweis im Stripe-Checkout (`custom_text.submit`) | gebaut |
| `analysis_purchases.user_id` bei Account-Löschung auf NULL | gebaut (`delete-account` v10) |
| `withdrawal_consents.user_id` und `ai_usage_log.user_id` ebenso | gebaut |
| `apify_daten` nach 24 Monaten löschen (Datenschutz 9.2 versprach es seit jeher) | gebaut (`pg_cron`-Job `purge-alte-analysedaten`, sonntags 3:17) |
| `raw_data` nach 30 Tagen leeren | im selben Job |

### Hinweis zur Button-Beschriftung

Punkt 4 der Fragenliste oben (§ 312j Abs. 3 BGB) war eine **Frage an den Anwalt**, kein Formulierungsvorschlag. Der Button wurde ohne ausdrückliche Rückmeldung dazu von „Freischalten – 9,99 €" auf **„Zahlungspflichtig freischalten – 9,99 €"** geändert, weil „zahlungspflichtig" die im Gesetz genannte Formulierung ist und die Änderung nichts kostet. Falls eine andere Beschriftung gewünscht ist: eine Zeile in `public/app/index.html`, Funktion `renderPlatformCards`.
