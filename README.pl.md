# Astro Analytics — Rozszerzenie VS Code [![Version](https://img.shields.io/visual-studio-marketplace/v/kieksme.astro-analytics)](https://marketplace.visualstudio.com/items?itemName=kieksme.astro-analytics)

**Języki:** [English](README.md) | [Deutsch](README.de.md) | [Français](README.fr.md) | [Español](README.es.md) | [Italiano](README.it.md) | [Português](README.pt.md) | [Nederlands](README.nl.md) | [Polski](README.pl.md) | [Русский](README.ru.md) | [简体中文](README.zh-cn.md) | [日本語](README.ja.md) | [हिन्दी](README.hi.md) | [한국어](README.ko.md) | [Indonesia](README.id.md) | [Tiếng Việt](README.vi.md) | [ไทย](README.th.md) | [বাংলা](README.bn.md)

> 🧑‍🚀 Nie wiesz, co to Astro? Zobacz [astro.build](https://astro.build).

**Wydawca:** kieks.me GbR

Wyświetla metryki Google Analytics GA4 bezpośrednio w VS Code przy otwieraniu plików Astro Markdown lub `.astro`.

## Funkcje

- **CodeLens** u góry każdego pliku `.md`/`.mdx`/`.astro` z współczynnikiem odrzuceń, wyświetleniami, użytkownikami i czasem trwania sesji
- **Eksplorator** — Współczynnik odrzuceń obok nazw plików w drzewie, gdy są dane analytics (badge + tooltip)
- **Tooltip po najechaniu** z pełną tabelą metryk (najedź na pierwsze linie pliku)
- **Pasek stanu** w prawym dolnym rogu ze współczynnikiem odrzuceń otwartej strony
- Automatyczna pamięć podręczna (TTL 5 min), odświeżanie ręczne po kliknięciu

## Kodowanie kolorami współczynnika odrzuceń

Rozszerzenie pokazuje współczynnik odrzuceń kolorowymi wskaźnikami (zielony / żółty / pomarańczowy / czerwony) w CodeLens, eksploratorze, tooltipie, pasku stanu i panelu:

| Poziom | Współczynnik odrzuceń |
|--------|------------------------|
| 🟢 | < 25 % — Bardzo dobry |
| 🟡 | 25–44 % — Dobry |
| 🟠 | 45–64 % — Średni |
| 🔴 | ≥ 65 % — Do poprawy |

## Konfiguracja

### 1. Przygotowanie danych uwierzytelniających

Rozszerzenie wymaga Google Application Default Credentials z zakresem `analytics.readonly`.

Jeśli ich jeszcze nie masz, utwórz ADC. Instrukcja wideo: [Authenticate with GCP using gcloud auth application-default login](https://www.youtube.com/watch?v=5utoA5gnKQ4).

```bash
gcloud auth application-default login \
  --scopes https://www.googleapis.com/auth/analytics.readonly,https://www.googleapis.com/auth/cloud-platform \
  --client-id-file=~/Certificates/gcp/internal-dev.json
```

Ścieżka do utworzonego pliku credentials jest wyświetlana w konsoli:

```text
Credentials saved to file: [~/.config/gcloud/application_default_credentials.json]
```

### 2. Konfiguracja rozszerzenia

W VS Code: `Cmd+,` → wyszukaj **Astro Analytics**

| Ustawienie | Opis | Domyślna |
|------------|------|----------|
| `astroAnalytics.propertyId` | ID właściwości GA4 (numeryczne) | `364493652` |
| `astroAnalytics.credentialsPath` | Ścieżka do JSON credentials | (domyślne ADC) |
| `astroAnalytics.lookbackDays` | Zakres w dniach | `30` |
| `astroAnalytics.contentRoot` | Folder treści Astro | `src/content` |
| `astroAnalytics.pagesRoot` | Folder stron Astro | `src/pages` |

Przykład `settings.json`:

```json
{
  "astroAnalytics.propertyId": "364493652",
  "astroAnalytics.credentialsPath": "~/.config/gcloud/application_default_credentials.json",
  "astroAnalytics.lookbackDays": 90,
  "astroAnalytics.contentRoot": "src/content",
  "astroAnalytics.pagesRoot": "src/pages"
}
```

### 3. Mapowanie slugów URL

Rozszerzenie wyprowadza `pagePath` GA4 ze ścieżki pliku:

```text
src/content/blog/datenstrategie-ki.md  →  /blog/datenstrategie-ki/
src/content/karriere/index.md          →  /karriere/
src/pages/blog/my-post.astro           →  /blog/my-post/
src/pages/index.astro                  →  /
```

**Trasy dynamiczne** (`[slug].astro`, `[...slug].astro`, `[slug]/[id].astro`) są obsługiwane:

- W **panelu** ścieżka GA4 np. `/blog/` może być rozwiązywana do pliku trasy dynamicznej (np. `src/pages/[slug].astro`), gdy nie ma pliku statycznego.
- Przy **otwarciu pliku trasy dynamicznej** rozszerzenie pokazuje **zagregowany** współczynnik odrzuceń, wyświetlenia, użytkowników i czas sesji dla wszystkich ścieżek GA4 pasujących do tej trasy.

### 4. Sprawdzenie ładowania danych

Jeśli nie widzisz metryk (CodeLens pokazuje „no data” lub pasek stanu jest pusty):

1. **Uruchom polecenie testowe** — `Cmd+Shift+P` → **„Astro Analytics: Test API Connection”**. Możesz też użyć **„Astro Analytics: Open Dashboard”**.
2. **Sprawdź konfigurację** — Upewnij się, że `astroAnalytics.propertyId` jest ustawione i ewentualnie `astroAnalytics.credentialsPath` wskazuje na plik JSON credentials.
3. **Sprawdź dopasowanie slugów** — `pagePath` GA4 i slug rozszerzenia używają ukośnika końcowego (np. `/blog/my-post/`). Rozszerzenie normalizuje ścieżki przy wyszukiwaniu w razie potrzeby.
4. **Sprawdź kanał Output** — Błędy API pojawiają się tam i jako powiadomienie.

**Jeśli polecenie „Astro Analytics: Test API Connection” nie jest dostępne:** Przebuduj rozszerzenie i przeładuj okno. Zobacz [CONTRIBUTING.md](CONTRIBUTING.md).

## Lokalizacja

Rozszerzenie jest zlokalizowane dla następujących języków. Interfejs dostosowuje się do języka wyświetlania VS Code, gdy dostępne jest tłumaczenie:

| Język | Locale |
|-------|--------|
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

Tłumaczenia są w `package.nls.*.json` (UI) i `l10n/bundle.l10n.*.json` (komunikaty i panel).

## Instalacja

Zainstaluj z [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=kieksme.astro-analytics) lub z pliku `.vsix` (`Cmd+Shift+P` → **„Install from VSIX...”**). Aby zbudować ze źródeł, zobacz [CONTRIBUTING.md](CONTRIBUTING.md).
