# Thinkport Analytics — VSCode Extension

Zeigt Google Analytics GA4 Metriken direkt in VSCode an, wenn du Astro Markdown-Dateien öffnest.

## Features

- **CodeLens** oben in jeder `.md`/`.mdx` Datei mit Bounce Rate, Views, Nutzern und Session-Dauer
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

In VSCode: `Cmd+,` → Suche nach **Thinkport Analytics**

| Einstellung                          | Beschreibung              | Default       |
|--------------------------------------|---------------------------|---------------|
| `thinkportAnalytics.propertyId`      | GA4 Property ID           | `364493652`   |
| `thinkportAnalytics.credentialsPath` | Pfad zur Credentials JSON | (ADC default) |
| `thinkportAnalytics.lookbackDays`    | Zeitraum in Tagen         | `30`          |
| `thinkportAnalytics.contentRoot`     | Astro Content-Ordner      | `src/content` |

Beispiel `settings.json`:

```json
{
  "thinkportAnalytics.propertyId": "364493652",
  "thinkportAnalytics.credentialsPath": "~/.config/gcloud/application_default_credentials.json",
  "thinkportAnalytics.lookbackDays": 90,
  "thinkportAnalytics.contentRoot": "src/content"
}
```

### 3. URL-Slug Mapping

Die Extension leitet den GA4-`pagePath` automatisch aus dem Dateipfad ab:

```text
src/content/blog/datenstrategie-ki.md  →  /blog/datenstrategie-ki/
src/content/karriere/index.md          →  /karriere/
```

## Installation

```bash
pnpm install
pnpm run compile
vsce package
```

Dann die erzeugte `.vsix` Datei in VSCode installieren:

```text
Cmd+Shift+P → "Install from VSIX..."
```

## Entwicklung

```bash
pnpm install
pnpm run watch
# F5 in VSCode → öffnet Extension Development Host
```
