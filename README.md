# Astro Analytics — VSCode Extension

**Publisher:** kieks.me GbR

Zeigt Google Analytics GA4 Metriken direkt in VSCode an, wenn du Astro Markdown- oder .astro-Dateien öffnest.

## Features

- **CodeLens** oben in jeder `.md`/`.mdx`/`.astro` Datei mit Bounce Rate, Views, Nutzern und Session-Dauer
- **Hover-Tooltip** mit vollständiger Metriktabelle (Hover über die ersten Zeilen der Datei)
- **Status Bar** unten rechts mit der Bounce Rate der aktuell geöffneten Seite
- Automatisches Caching (5 Minuten TTL), manuelle Aktualisierung per Klick

## Farbcodierung Bounce Rate

| Symbol | Bounce Rate                |
|--------|----------------------------|
| 🟢     | < 25% — Sehr gut           |
| 🟡     | 25–44% — Gut               |
| 🟠     | 45–64% — Mittel            |
| 🔴     | ≥ 65% — Optimierungsbedarf |

## Setup

### 1. Credentials vorbereiten

Die Extension benötigt Google Application Default Credentials mit dem Scope `analytics.readonly`.

Falls noch nicht vorhanden, ADC erstellen:

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

In VSCode: `Cmd+,` → Suche nach **Astro Analytics**

| Einstellung                       | Beschreibung              | Default       |
|-----------------------------------|---------------------------|---------------|
| `astroAnalytics.propertyId`       | GA4 Property ID (numerisch) | `364493652` |
| `astroAnalytics.measurementId`    | GA4 Measurement ID (z. B. G-XXXXXXXXXX) | (leer) |
| `astroAnalytics.credentialsPath` | Pfad zur Credentials JSON | (ADC default) |
| `astroAnalytics.lookbackDays`     | Zeitraum in Tagen         | `30`          |
| `astroAnalytics.contentRoot`      | Astro Content-Ordner      | `src/content` |
| `astroAnalytics.pagesRoot`        | Astro Pages-Ordner        | `src/pages`   |

Beispiel `settings.json`:

```json
{
  "astroAnalytics.propertyId": "364493652",
  "astroAnalytics.measurementId": "G-XXXXXXXXXX",
  "astroAnalytics.credentialsPath": "~/.config/gcloud/application_default_credentials.json",
  "astroAnalytics.lookbackDays": 90,
  "astroAnalytics.contentRoot": "src/content",
  "astroAnalytics.pagesRoot": "src/pages"
}
```

### 3. URL-Slug Mapping

Die Extension leitet den GA4-`pagePath` automatisch aus dem Dateipfad ab:

```text
src/content/blog/datenstrategie-ki.md  →  /blog/datenstrategie-ki/
src/content/karriere/index.md          →  /karriere/
src/pages/blog/my-post.astro           →  /blog/my-post/
src/pages/index.astro                  →  /
```

## Installation

```bash
pnpm install
pnpm run compile
pnpx vsce package --no-dependencies --allow-missing-repository
```

Dann die erzeugte `.vsix` Datei in VSCode installieren:

```text
Cmd+Shift+P → "Install from VSIX..."
```

## Entwicklung

```bash
pnpm install
pnpm run compile   # baut TypeScript + Bundle (dist/extension.js)
# F5 in VSCode → öffnet Extension Development Host
```

Für inkrementellen TypeScript-Build: `pnpm run watch` (danach ggf. `pnpm run bundle` zum Aktualisieren der Extension).

## Tests

**Unit-Tests (Vitest)** in `tests/` – z. B. `tests/lib/slug.test.ts`:

```bash
pnpm test
```

Watch-Modus: `pnpm run test:watch`

**Integrationstests** (Extension in VS Code starten und Befehle prüfen):

```bash
pnpm run test:integration
```

(Hinweis: Kein anderes VS Code-Fenster sollte laufen, wenn du die Tests von der Kommandozeile startest.)
