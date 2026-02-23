# Astro Analytics — Estensione VS Code [![Version](https://img.shields.io/visual-studio-marketplace/v/kieksme.astro-analytics)](https://marketplace.visualstudio.com/items?itemName=kieksme.astro-analytics)

**Lingue:** [English](README.md) | [Deutsch](README.de.md) | [Français](README.fr.md) | [Español](README.es.md) | [Italiano](README.it.md) | [Português](README.pt.md) | [Nederlands](README.nl.md) | [Polski](README.pl.md) | [Русский](README.ru.md) | [简体中文](README.zh-cn.md) | [日本語](README.ja.md) | [हिन्दी](README.hi.md) | [한국어](README.ko.md) | [Indonesia](README.id.md) | [Tiếng Việt](README.vi.md) | [ไทย](README.th.md) | [বাংলা](README.bn.md)

> 🧑‍🚀 Non conosci Astro? Visita [astro.build](https://astro.build).

**Editore:** kieks.me GbR

Mostra le metriche Google Analytics GA4 direttamente in VS Code quando apri file Astro Markdown o `.astro`.

## Funzionalità

- **CodeLens** in cima a ogni file `.md`/`.mdx`/`.astro` con frequenza di rimbalzo, visualizzazioni, utenti e durata della sessione
- **Esplora risorse** — Frequenza di rimbalzo accanto ai nomi dei file nell’albero quando ci sono dati analytics (badge + tooltip)
- **Tooltip al passaggio del mouse** con tabella completa delle metriche (passa sulle prime righe del file)
- **Barra di stato** in basso a destra con la frequenza di rimbalzo della pagina aperta
- Cache automatica (TTL 5 min), aggiornamento manuale al clic

## Codifica a colori della frequenza di rimbalzo

L’estensione mostra la frequenza di rimbalzo con indicatori colorati (verde / giallo / arancione / rosso) in CodeLens, esplora risorse, tooltip, barra di stato e dashboard:

| Livello | Frequenza di rimbalzo |
|---------|------------------------|
| 🟢 | < 25 % — Molto buona |
| 🟡 | 25–44 % — Buona |
| 🟠 | 45–64 % — Media |
| 🔴 | ≥ 65 % — Da migliorare |

## Configurazione

### 1. Preparare le credenziali

L’estensione richiede le Google Application Default Credentials con scope `analytics.readonly`.

Se non le hai ancora, crea le ADC. Per una guida video, vedi ad es. [Authenticate with GCP using gcloud auth application-default login](https://www.youtube.com/watch?v=5utoA5gnKQ4).

```bash
gcloud auth application-default login \
  --scopes https://www.googleapis.com/auth/analytics.readonly,https://www.googleapis.com/auth/cloud-platform \
  --client-id-file=~/Certificates/gcp/internal-dev.json
```

Il percorso del file delle credenziali viene stampato in console:

```text
Credentials saved to file: [~/.config/gcloud/application_default_credentials.json]
```

### 2. Configurare l’estensione

In VS Code: `Cmd+,` → cerca **Astro Analytics**

| Impostazione | Descrizione | Predefinito |
|--------------|-------------|-------------|
| `astroAnalytics.propertyId` | ID proprietà GA4 (numerico) | `364493652` |
| `astroAnalytics.credentialsPath` | Percorso al JSON delle credenziali | (predefinito ADC) |
| `astroAnalytics.lookbackDays` | Intervallo in giorni | `30` |
| `astroAnalytics.contentRoot` | Cartella contenuti Astro | `src/content` |
| `astroAnalytics.pagesRoot` | Cartella pagine Astro | `src/pages` |

Esempio `settings.json`:

```json
{
  "astroAnalytics.propertyId": "364493652",
  "astroAnalytics.credentialsPath": "~/.config/gcloud/application_default_credentials.json",
  "astroAnalytics.lookbackDays": 90,
  "astroAnalytics.contentRoot": "src/content",
  "astroAnalytics.pagesRoot": "src/pages"
}
```

### 3. Mappatura slug URL

L’estensione ricava il `pagePath` GA4 dal percorso del file:

```text
src/content/blog/datenstrategie-ki.md  →  /blog/datenstrategie-ki/
src/content/karriere/index.md          →  /karriere/
src/pages/blog/my-post.astro           →  /blog/my-post/
src/pages/index.astro                  →  /
```

Sono supportate **rotte dinamiche** (`[slug].astro`, `[...slug].astro`, `[slug]/[id].astro`):

- Nella **dashboard**, un path GA4 come `/blog/` può risolversi in un file di rotta dinamica (es. `src/pages/[slug].astro`) quando non esiste un file statico.
- Aprendo un **file di rotta dinamica**, l’estensione mostra frequenza di rimbalzo, visualizzazioni, utenti e durata sessione **aggregati** per tutti i path GA4 che corrispondono a quella rotta.

### 4. Verificare il caricamento dei dati

Se non vedi metriche (CodeLens mostra "no data" o la barra di stato è vuota):

1. **Esegui il comando di test** — `Cmd+Shift+P` → **"Astro Analytics: Test API Connection"**. Puoi anche usare **"Astro Analytics: Open Dashboard"**.
2. **Controlla la configurazione** — Assicurati che `astroAnalytics.propertyId` sia impostato e, se serve, `astroAnalytics.credentialsPath` punti al JSON delle credenziali.
3. **Controlla la corrispondenza degli slug** — Il `pagePath` GA4 e lo slug dell’estensione usano lo slash finale (es. `/blog/my-post/`). L’estensione normalizza i path per la ricerca se necessario.
4. **Controlla il canale Output** — Gli errori API compaiono lì e come notifica.

**Se il comando "Astro Analytics: Test API Connection" non viene trovato:** Ricompila l’estensione e ricarica la finestra. Vedi [CONTRIBUTING.md](CONTRIBUTING.md).

## Localizzazione

L’estensione è localizzata per le seguenti lingue. L’interfaccia segue la lingua di visualizzazione di VS Code quando è disponibile una traduzione:

| Lingua | Locale |
|--------|--------|
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

Le traduzioni sono in `package.nls.*.json` (UI) e `l10n/bundle.l10n.*.json` (messaggi e dashboard).

## Installazione

Installa dal [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=kieksme.astro-analytics) o da un file `.vsix` (`Cmd+Shift+P` → **"Install from VSIX..."**). Per compilare dai sorgenti, vedi [CONTRIBUTING.md](CONTRIBUTING.md).
