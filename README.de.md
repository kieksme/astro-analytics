# Astro Analytics — VS Code Extension [![Version](https://img.shields.io/visual-studio-marketplace/v/kieksme.astro-analytics)](https://marketplace.visualstudio.com/items?itemName=kieksme.astro-analytics)

**Sprachen:** [English](README.md) | [Deutsch](README.de.md)

> 🧑‍🚀 Noch nie von Astro gehört? Schau auf [astro.build](https://astro.build)!

**Publisher:** kieks.me GbR

Zeigt Google-Analytics-GA4-Metriken direkt in VS Code an, wenn du Astro-Markdown- oder `.astro`-Dateien öffnest.

## Funktionen

- **CodeLens** oben in jeder `.md`-/`.mdx`-/`.astro`-Datei mit Absprungrate, Aufrufen, Nutzer:innen und Sitzungsdauer
- **Explorer** — Absprungrate neben Dateinamen im Verzeichnisbaum, sofern Analysedaten vorhanden sind (Badge + Tooltip)
- **Hover-Tooltip** mit vollständiger Metrik-Tabelle (Mauszeiger über die ersten Zeilen der Datei)
- **Statusleiste** unten rechts mit der Absprungrate der aktuell geöffneten Seite
- Automatisches Caching (5 Minuten TTL), manueller Refresh per Klick

## Farbcodierung der Absprungrate

Die Extension zeigt die Absprungrate mit farbigen Indikatoren (grün / gelb / orange / rot) in CodeLens, Explorer, Hover, Statusleiste und Dashboard:

| Stufe | Absprungrate              |
|-------|---------------------------|
| 🟢    | < 25 % — Sehr gut        |
| 🟡    | 25–44 % — Gut             |
| 🟠    | 45–64 % — Durchschnitt    |
| 🔴    | ≥ 65 % — Verbesserung nötig |

## Einrichtung

### 1. Zugangsdaten vorbereiten

Die Extension benötigt Google Application Default Credentials mit dem Scope `analytics.readonly`.

Falls du sie noch nicht hast, leg ADC an. Eine Anleitung findest du z. B. in [Authenticate with GCP using gcloud auth application-default login](https://www.youtube.com/watch?v=5utoA5gnKQ4).

```bash
gcloud auth application-default login \
  --scopes https://www.googleapis.com/auth/analytics.readonly,https://www.googleapis.com/auth/cloud-platform \
  --client-id-file=~/Certificates/gcp/internal-dev.json
```

Der Pfad zur erstellten Credentials-Datei wird in der Konsole ausgegeben:

```text
Credentials saved to file: [~/.config/gcloud/application_default_credentials.json]
```

### 2. Extension konfigurieren

In VS Code: `Cmd+,` → Suche nach **Astro Analytics**

| Einstellung                          | Beschreibung                    | Standard       |
|--------------------------------------|----------------------------------|----------------|
| `astroAnalytics.propertyId`          | GA4 Property ID (numerisch)      | `364493652`    |
| `astroAnalytics.credentialsPath`     | Pfad zur Credentials-JSON        | (ADC-Standard) |
| `astroAnalytics.lookbackDays`        | Zeitraum in Tagen                | `30`           |
| `astroAnalytics.contentRoot`         | Astro-Content-Ordner             | `src/content`  |
| `astroAnalytics.pagesRoot`           | Astro-Pages-Ordner               | `src/pages`    |

Beispiel `settings.json`:

```json
{
  "astroAnalytics.propertyId": "364493652",
  "astroAnalytics.credentialsPath": "~/.config/gcloud/application_default_credentials.json",
  "astroAnalytics.lookbackDays": 90,
  "astroAnalytics.contentRoot": "src/content",
  "astroAnalytics.pagesRoot": "src/pages"
}
```

### 3. URL-Slug-Zuordnung

Die Extension leitet den GA4-`pagePath` aus dem Dateipfad ab:

```text
src/content/blog/datenstrategie-ki.md  →  /blog/datenstrategie-ki/
src/content/karriere/index.md          →  /karriere/
src/pages/blog/my-post.astro           →  /blog/my-post/
src/pages/index.astro                  →  /
```

**Dynamische Routen** (`[slug].astro`, `[...slug].astro`, `[slug]/[id].astro`) werden unterstützt:

- Im **Dashboard** kann ein GA4-Pfad wie `/blog/` auf eine dynamische Route (z. B. `src/pages/[slug].astro`) aufgelöst werden, wenn keine statische Datei existiert; die Zeile bleibt klickbar und öffnet die Datei.
- Beim **Öffnen einer dynamischen Routen-Datei** zeigt die Extension die **aggregierten** Absprungrate, Aufrufe, Nutzer:innen und Sitzungsdauer für alle GA4-Pfade, die zu dieser Route passen (z. B. alle Ein-Segment-Pfade für `[slug].astro`).

### 4. Prüfen, ob Daten geladen werden

Wenn keine Metriken erscheinen (CodeLens zeigt „no data“ oder die Statusleiste bleibt leer):

1. **Testbefehl ausführen**  
   `Cmd+Shift+P` → **„Astro Analytics: Test API Connection“**.  
   Du kannst auch **„Astro Analytics: Open Dashboard“** ausführen, um eine Dashboard-Ansicht im Editor zu öffnen (sortierbare Tabelle, Absprungrate, klickbare Seitenlinks).  
   Im **Output**-Bereich (Kanal „Astro Analytics“) siehst du:
   - ob der GA4-API-Aufruf erfolgreich war und wie viele Seitenpfade zurückgegeben wurden
   - die ersten 15 `pagePath`-Werte von GA4 (zum Abgleich mit deiner Slug-Zuordnung)
   - bei geöffneter `.md`/`.mdx`/`.astro`-Datei: den **Slug der aktuellen Datei** und ob er zu einem GA4-Pfad passt

2. **Konfiguration prüfen**  
   Stelle sicher, dass `astroAnalytics.propertyId` gesetzt ist (numerische GA4 Property ID) und ggf. `astroAnalytics.credentialsPath` auf die Credentials-JSON zeigt.

3. **Slug-Abgleich prüfen**  
   GA4-`pagePath` und der Slug der Extension verwenden einen abschließenden Schrägstrich (z. B. `/blog/my-post/`). Wenn deine Seite Pfade ohne Schrägstrich sendet, normalisiert die Extension sie für den Abgleich; die Testausgabe zeigt rohe und normalisierte Pfade.

4. **Output-Kanal prüfen**  
   Nach einem normalen Refresh protokolliert derselbe Kanal z. B. `Loaded N pages from GA4` und Beispiel-`pagePath`-Werte. API-Fehler erscheinen dort und als Fehlerbenachrichtigung.

**Wenn der Befehl „Astro Analytics: Test API Connection“ nicht gefunden wird:**  
Extension neu bauen und Fenster neu laden. Siehe [CONTRIBUTING.md](CONTRIBUTING.md) für Build- und Reload-Schritte.

## Lokalisierung

Die Extension ist für die folgenden Sprachen lokalisiert. Die UI (Befehle, Einstellungen, Dashboard, Meldungen) folgt der in VS Code eingestellten Anzeigesprache, sofern eine Übersetzung vorhanden ist:

| Sprache   | Locale  |
|-----------|---------|
| Englisch  | `en`    |
| Deutsch   | `de`    |
| Französisch | `fr`  |
| Spanisch  | `es`    |
| Italienisch | `it`  |
| Portugiesisch | `pt` |
| Niederländisch | `nl` |
| Polnisch  | `pl`    |
| Russisch  | `ru`    |
| Chinesisch (vereinfacht) | `zh-cn` |
| Japanisch | `ja`    |
| Hindi     | `hi`    |
| Koreanisch | `ko`   |
| Indonesisch | `id`  |
| Vietnamesisch | `vi` |
| Thailändisch | `th`  |
| Bengalisch | `bn`   |

Übersetzungen liegen in `package.nls.*.json` (beigesteuerte UI) und `l10n/bundle.l10n.*.json` (Extension-Meldungen und Dashboard).

## Installation

Installation über den [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=kieksme.astro-analytics) oder über eine `.vsix`-Datei (`Cmd+Shift+P` → **„Install from VSIX…“**). Build aus den Quellen: [CONTRIBUTING.md](CONTRIBUTING.md).
