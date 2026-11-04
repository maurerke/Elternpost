# Elternpost

Kleine Web-App (PWA) für die Elternsprecher: Eltern-Verteiler pflegen (pro Kind beliebig viele
E-Mail-Adressen und Telefonnummern, optional mit Elternnamen) und Mitteilungen als Newsletter
verschicken – mit den letzten Nachrichten „Zur Erinnerung“ unten drunter.

**Alle Daten bleiben auf dem Gerät** (IndexedDB im Browser). Online liegt nur der Programmcode.
Gesichert wird per Knopfdruck als JSON-Datei, z. B. nach iCloud Drive.

## Entwickeln

```bash
npm install
npm run dev
```

`npm run dev` startet mit `--host`, die App ist dann auch im WLAN erreichbar. Über `http://`
im WLAN funktioniert sie auf dem iPhone aber nicht offline – dafür braucht es HTTPS (GitHub Pages).

## Veröffentlichen (GitHub Pages)

1. Neues Repository auf GitHub anlegen (darf öffentlich sein – es enthält keine Daten).
2. Code pushen (Branch `main`).
3. Im Repository: **Settings → Pages → Source: GitHub Actions**.
4. Nach dem Durchlauf ist die App unter `https://<benutzer>.github.io/<repo>/` erreichbar.

## Auf dem iPhone installieren

Adresse in **Safari** öffnen → **Teilen** → **Zum Home-Bildschirm**. Danach nur noch über das Icon
öffnen. Achtung: Wird das Icon gelöscht, sind auch die Daten weg – vorher sichern.

## Aufbau

- `src/lib/db.ts` – Datenmodell, Speicherung (Dexie/IndexedDB), Sicherung
- `src/lib/newsletter.ts` – HTML-/Text-Vorlage des Newsletters, mailto-Link
- `src/lib/importer.ts` – Import des alten Verteilers
- `src/views/` – die Bildschirme
