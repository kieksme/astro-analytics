# Astro Analytics — VS Code Extension

[![Version](https://img.shields.io/visual-studio-marketplace/v/kieksme.astro-analytics)](https://marketplace.visualstudio.com/items?itemName=kieksme.astro-analytics)

**Publisher:** kieks.me GbR

Shows Google Analytics GA4 metrics directly in VS Code when you open Astro Markdown or `.astro` files.

## Features

- **CodeLens** at the top of each `.md`/`.mdx`/`.astro` file with Bounce Rate, Views, Users, and Session Duration
- **Hover tooltip** with full metrics table (hover over the first lines of the file)
- **Status Bar** in the bottom-right with the Bounce Rate of the currently open page
- Automatic caching (5-minute TTL), manual refresh on click

## Bounce Rate Color Coding

| Symbol | Bounce Rate               |
|--------|---------------------------|
| 🟢     | < 25% — Very good         |
| 🟡     | 25–44% — Good             |
| 🟠     | 45–64% — Average          |
| 🔴     | ≥ 65% — Needs improvement |

## Setup

### 1. Prepare credentials

The extension requires Google Application Default Credentials with the `analytics.readonly` scope.

If you don't have them yet, create ADC:

```bash
gcloud auth application-default login \
  --scopes https://www.googleapis.com/auth/analytics.readonly,https://www.googleapis.com/auth/cloud-platform \
  --client-id-file=~/Certificates/gcp/internal-dev.json
```

The path to the created credentials file is printed in the console:

```text
Credentials saved to file: [~/.config/gcloud/application_default_credentials.json]
```

### 2. Configure the extension

In VS Code: `Cmd+,` → search for **Astro Analytics**

| Setting                          | Description                            | Default       |
|----------------------------------|----------------------------------------|---------------|
| `astroAnalytics.propertyId`      | GA4 Property ID (numeric)              | `364493652`   |
| `astroAnalytics.measurementId`   | GA4 Measurement ID (e.g. G-XXXXXXXXXX) | (empty)       |
| `astroAnalytics.credentialsPath` | Path to credentials JSON               | (ADC default) |
| `astroAnalytics.lookbackDays`    | Time range in days                     | `30`          |
| `astroAnalytics.contentRoot`     | Astro content folder                   | `src/content` |
| `astroAnalytics.pagesRoot`       | Astro pages folder                     | `src/pages`   |

Example `settings.json`:

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

### 3. URL slug mapping

The extension derives the GA4 `pagePath` from the file path:

```text
src/content/blog/datenstrategie-ki.md  →  /blog/datenstrategie-ki/
src/content/karriere/index.md          →  /karriere/
src/pages/blog/my-post.astro           →  /blog/my-post/
src/pages/index.astro                  →  /
```

### 4. Test that data is loading

If you don’t see any metrics (CodeLens shows “no data” or status bar stays empty):

1. **Run the test command**  
   `Cmd+Shift+P` → **“Astro Analytics: Test API Connection”**.  
   The **Output** panel (channel “Astro Analytics”) will show:
   - Whether the GA4 API call succeeded and how many page paths were returned
   - The first 15 `pagePath` values from GA4 (so you can compare with your slug mapping)
   - If a `.md`/`.mdx`/`.astro` file is open: the **current file’s slug** and whether it matches any GA4 path

2. **Check configuration**  
   Ensure `astroAnalytics.propertyId` is set (numeric GA4 Property ID) and, if needed, `astroAnalytics.credentialsPath` points to your credentials JSON.

3. **Check slug matching**  
   GA4 `pagePath` and the extension’s slug both use a trailing slash (e.g. `/blog/my-post/`). If your site sends paths without a trailing slash, the extension normalizes them for lookup; the test output shows both raw and normalized paths.

4. **Check the Output channel**  
   After a normal refresh, the same channel logs e.g. `Loaded N pages from GA4` and sample `pagePath` values. Any API errors appear there and as an error notification.

**If the command "Astro Analytics: Test API Connection" is not found:**  
Rebuild the extension and reload the window where the extension runs.  
- **Extension Development Host (F5):** Run `pnpm run compile` (or `pnpm run bundle`), then in the *Extension Development Host* window: `Cmd+Shift+P` → **Developer: Reload Window**.  
- **Installed from VSIX:** Run `pnpm run compile` then repackage and reinstall the `.vsix`.

## Installation

```bash
pnpm install
pnpm run compile
pnpx vsce package --no-dependencies --allow-missing-repository
```

Then install the generated `.vsix` file in VS Code:

```text
Cmd+Shift+P → "Install from VSIX..."
```

## Development

```bash
pnpm install
pnpm run compile   # builds TypeScript + bundle (dist/extension.js)
# F5 in VS Code → opens Extension Development Host
```

For incremental TypeScript build: `pnpm run watch` (then optionally `pnpm run bundle` to refresh the extension).

## Tests

**Unit tests (Vitest)** in `tests/` — e.g. `tests/lib/slug.test.ts`:

```bash
pnpm test
```

Watch mode: `pnpm run test:watch`

**Integration tests** (launch extension in VS Code and verify commands):

```bash
pnpm run test:integration
```

(Note: No other VS Code window should be running when you start the tests from the command line.)
