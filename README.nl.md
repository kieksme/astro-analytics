# Astro Analytics — VS Code-extensie [![Version](https://img.shields.io/visual-studio-marketplace/v/kieksme.astro-analytics)](https://marketplace.visualstudio.com/items?itemName=kieksme.astro-analytics)

**Talen:** [English](README.md) | [Deutsch](README.de.md) | [Français](README.fr.md) | [Español](README.es.md) | [Italiano](README.it.md) | [Português](README.pt.md) | [Nederlands](README.nl.md) | [Polski](README.pl.md) | [Русский](README.ru.md) | [简体中文](README.zh-cn.md) | [日本語](README.ja.md) | [हिन्दी](README.hi.md) | [한국어](README.ko.md) | [Indonesia](README.id.md) | [Tiếng Việt](README.vi.md) | [ไทย](README.th.md) | [বাংলা](README.bn.md)

> 🧑‍🚀 Weet je niet wat Astro is? Kijk op [astro.build](https://astro.build).

**Uitgever:** kieks.me GbR

Toont Google Analytics GA4-metrics direct in VS Code wanneer je Astro Markdown- of `.astro`-bestanden opent.

## Functies

- **CodeLens** bovenaan elk `.md`/`.mdx`/`.astro`-bestand met bouncerate, weergaven, gebruikers en sessieduur
- **Verkenner** — Bouncerate naast bestandsnamen in de boom wanneer er analytics-gegevens zijn (badge + tooltip)
- **Hover-tooltip** met volledige metricstabel (hover over de eerste regels van het bestand)
- **Statusbalk** rechtsonder met de bouncerate van de open pagina
- Automatische cache (TTL 5 min), handmatige vernieuwing bij klik

## Kleurcodering bouncerate

De extensie toont bouncerate met gekleurde indicatoren (groen / geel / oranje / rood) in CodeLens, verkenner, hover, statusbalk en dashboard:

| Niveau | Bouncerate |
|--------|------------|
| 🟢 | < 25 % — Zeer goed |
| 🟡 | 25–44 % — Goed |
| 🟠 | 45–64 % — Gemiddeld |
| 🔴 | ≥ 65 % — Verbetering nodig |

## Instelling

### 1. Credentials voorbereiden

De extensie heeft Google Application Default Credentials nodig met de scope `analytics.readonly`.

Als je die nog niet hebt, maak ADC aan. Voor een videouitleg, zie bijv. [Authenticate with GCP using gcloud auth application-default login](https://www.youtube.com/watch?v=5utoA5gnKQ4).

```bash
gcloud auth application-default login \
  --scopes https://www.googleapis.com/auth/analytics.readonly,https://www.googleapis.com/auth/cloud-platform \
  --client-id-file=~/Certificates/gcp/internal-dev.json
```

Het pad naar het aangemaakte credentialsbestand wordt in de console getoond:

```text
Credentials saved to file: [~/.config/gcloud/application_default_credentials.json]
```

### 2. Extensie configureren

In VS Code: `Cmd+,` → zoek op **Astro Analytics**

| Instelling | Beschrijving | Standaard |
|------------|--------------|-----------|
| `astroAnalytics.propertyId` | GA4 Property ID (numeriek) | `364493652` |
| `astroAnalytics.credentialsPath` | Pad naar credentials-JSON | (ADC-standaard) |
| `astroAnalytics.lookbackDays` | Periode in dagen | `30` |
| `astroAnalytics.contentRoot` | Astro-contentmap | `src/content` |
| `astroAnalytics.pagesRoot` | Astro-paginamap | `src/pages` |

Voorbeeld `settings.json`:

```json
{
  "astroAnalytics.propertyId": "364493652",
  "astroAnalytics.credentialsPath": "~/.config/gcloud/application_default_credentials.json",
  "astroAnalytics.lookbackDays": 90,
  "astroAnalytics.contentRoot": "src/content",
  "astroAnalytics.pagesRoot": "src/pages"
}
```

### 3. URL-slug-koppeling

De extensie leidt het GA4-`pagePath` af van het bestandspad:

```text
src/content/blog/datenstrategie-ki.md  →  /blog/datenstrategie-ki/
src/content/karriere/index.md          →  /karriere/
src/pages/blog/my-post.astro           →  /blog/my-post/
src/pages/index.astro                  →  /
```

**Dynamische routes** (`[slug].astro`, `[...slug].astro`, `[slug]/[id].astro`) worden ondersteund:

- In het **dashboard** kan een GA4-pad zoals `/blog/` oplossen naar een dynamisch routebestand (bijv. `src/pages/[slug].astro`) wanneer er geen statisch bestand is.
- Bij het **openen van een dynamisch routebestand** toont de extensie **geaggregeerde** bouncerate, weergaven, gebruikers en sessieduur voor alle GA4-paden die bij die route horen.

### 4. Controleren of data laadt

Als je geen metrics ziet (CodeLens toont "no data" of de statusbalk blijft leeg):

1. **Voer de testopdracht uit** — `Cmd+Shift+P` → **"Astro Analytics: Test API Connection"**. Je kunt ook **"Astro Analytics: Open Dashboard"** gebruiken.
2. **Controleer de configuratie** — Zorg dat `astroAnalytics.propertyId` is ingesteld en zo nodig `astroAnalytics.credentialsPath` naar je credentials-JSON wijst.
3. **Controleer slug-matching** — GA4-`pagePath` en de slug van de extensie gebruiken een afsluitende slash (bijv. `/blog/my-post/`). De extensie normaliseert paden voor opzoeken indien nodig.
4. **Controleer het Output-kanaal** — API-fouten verschijnen daar en als melding.

**Als de opdracht "Astro Analytics: Test API Connection" niet wordt gevonden:** Herbouw de extensie en herlaad het venster. Zie [CONTRIBUTING.md](CONTRIBUTING.md).

## Lokalisatie

De extensie is gelokaliseerd voor de volgende talen. De interface volgt de weergavetaal van VS Code wanneer een vertaling beschikbaar is:

| Taal | Locale |
|------|--------|
| English | `en` |
| Deutsch | `de` |
| Français | `fr` |
| Español | `es` |
| Italiano | `it` |
| Português | `pt` |
| Nederlands | `nl` |
| Polski | `pl` |
| Русский | `ru` |
| 简体中文 | `zh-cn` |
| 日本語 | `ja` |
| हिन्दी | `hi` |
| 한국어 | `ko` |
| Indonesia | `id` |
| Tiếng Việt | `vi` |
| ไทย | `th` |
| বাংলা | `bn` |

Vertalingen zitten in `package.nls.*.json` (UI) en `l10n/bundle.l10n.*.json` (berichten en dashboard).

## Installatie

Installeer via de [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=kieksme.astro-analytics) of via een `.vsix`-bestand (`Cmd+Shift+P` → **"Install from VSIX..."**). Om vanuit bron te bouwen, zie [CONTRIBUTING.md](CONTRIBUTING.md).
