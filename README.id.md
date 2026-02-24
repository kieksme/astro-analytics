# Astro Analytics — Ekstensi VS Code [![Version](https://img.shields.io/visual-studio-marketplace/v/kieksme.astro-analytics)](https://marketplace.visualstudio.com/items?itemName=kieksme.astro-analytics)

**Bahasa:** [English](README.md) | [Deutsch](README.de.md) | [Français](README.fr.md) | [Español](README.es.md) | [Italiano](README.it.md) | [Português](README.pt.md) | [Nederlands](README.nl.md) | [Polski](README.pl.md) | [Русский](README.ru.md) | [简体中文](README.zh-cn.md) | [日本語](README.ja.md) | [हिन्दी](README.hi.md) | [한국어](README.ko.md) | [Indonesia](README.id.md) | [Tiếng Việt](README.vi.md) | [ไทย](README.th.md) | [বাংলা](README.bn.md)

> 🧑‍🚀 Belum tahu Astro? Lihat [astro.build](https://astro.build).

**Penerbit:** kieks.me GbR

Menampilkan metrik Google Analytics GA4 langsung di VS Code saat Anda membuka file Astro Markdown atau `.astro`.

## Fitur

- **CodeLens** di bagian atas setiap file `.md`/`.mdx`/`.astro` dengan Bounce Rate, Views, Users, dan Session Duration
- **Explorer** — Bounce rate ditampilkan di samping nama file di pohon direktori ketika data analytics ada (badge + tooltip)
- **Tooltip hover** dengan tabel metrik lengkap (hover di baris pertama file)
- **Status Bar** di kanan bawah dengan Bounce Rate halaman yang sedang dibuka
- Cache otomatis (TTL 5 menit), refresh manual saat diklik

## Pengodean Warna Bounce Rate

Ekstensi menampilkan bounce rate dengan indikator warna (hijau / kuning / oranye / merah) di CodeLens, explorer, hover, status bar, dan dashboard:

| Level | Bounce Rate             |
|-------|-------------------------|
| 🟢    | < 25% — Sangat baik     |
| 🟡    | 25–44% — Baik           |
| 🟠    | 45–64% — Rata-rata      |
| 🔴    | ≥ 65% — Perlu perbaikan |

## Pengaturan

### 1. Siapkan kredensial

Ekstensi memerlukan Google Application Default Credentials dengan scope `analytics.readonly`.

Jika belum punya, buat ADC. Untuk panduan video, lihat mis. [Authenticate with GCP using gcloud auth application-default login](https://www.youtube.com/watch?v=5utoA5gnKQ4).

```bash
gcloud auth application-default login \
  --scopes https://www.googleapis.com/auth/analytics.readonly,https://www.googleapis.com/auth/cloud-platform \
  --client-id-file=~/Certificates/gcp/internal-dev.json
```

Path ke file kredensial yang dibuat akan dicetak di konsol:

```text
Credentials saved to file: [~/.config/gcloud/application_default_credentials.json]
```

### 2. Konfigurasi ekstensi

Di VS Code: `Cmd+,` → cari **Astro Analytics**

| Pengaturan                       | Deskripsi                 | Default       |
|----------------------------------|---------------------------|---------------|
| `astroAnalytics.propertyId`      | GA4 Property ID (numerik) | `364493652`   |
| `astroAnalytics.credentialsPath` | Path ke JSON kredensial   | (default ADC) |
| `astroAnalytics.lookbackDays`    | Rentang hari              | `30`          |
| `astroAnalytics.contentRoot`     | Folder konten Astro       | `src/content` |
| `astroAnalytics.pagesRoot`       | Folder halaman Astro      | `src/pages`   |

Contoh `settings.json`:

```json
{
  "astroAnalytics.propertyId": "364493652",
  "astroAnalytics.credentialsPath": "~/.config/gcloud/application_default_credentials.json",
  "astroAnalytics.lookbackDays": 90,
  "astroAnalytics.contentRoot": "src/content",
  "astroAnalytics.pagesRoot": "src/pages"
}
```

### 3. Pemetaan slug URL

Ekstensi menurunkan `pagePath` GA4 dari path file:

```text
src/content/blog/datenstrategie-ki.md  →  /blog/datenstrategie-ki/
src/content/karriere/index.md          →  /karriere/
src/pages/blog/my-post.astro           →  /blog/my-post/
src/pages/index.astro                  →  /
```

**Rute dinamis** (`[slug].astro`, `[...slug].astro`, `[slug]/[id].astro`) didukung:

- Di **dashboard**, path GA4 seperti `/blog/` dapat di-resolve ke file rute dinamis (mis. `src/pages/[slug].astro`) ketika tidak ada file statis.
- Saat **membuka file rute dinamis**, ekstensi menampilkan bounce rate, views, users, dan session duration **agregat** untuk semua path GA4 yang cocok dengan rute tersebut.

### 4. Periksa apakah data ter-load

Jika metrik tidak muncul (CodeLens menampilkan "no data" atau status bar kosong):

1. **Jalankan perintah tes** — `Cmd+Shift+P` → **"Astro Analytics: Test API Connection"**. Bisa juga **"Astro Analytics: Open Dashboard"**.
2. **Periksa konfigurasi** — Pastikan `astroAnalytics.propertyId` diset dan jika perlu `astroAnalytics.credentialsPath` mengarah ke JSON kredensial Anda.
3. **Periksa pencocokan slug** — `pagePath` GA4 dan slug ekstensi sama-sama memakai trailing slash (mis. `/blog/my-post/`). Ekstensi menormalisasi path untuk lookup jika perlu.
4. **Periksa channel Output** — Error API muncul di sana dan sebagai notifikasi.

**Jika perintah "Astro Analytics: Test API Connection" tidak ditemukan:** Rebuild ekstensi dan reload jendela. Lihat [CONTRIBUTING.md](CONTRIBUTING.md).

## Lokalisasi

Ekstensi dilokalisasi untuk bahasa berikut. UI mengikuti bahasa tampilan VS Code ketika terjemahan tersedia:

| Bahasa     | Locale  |
|------------|---------|
| English    | `en`    |
| Deutsch    | `de`    |
| Français   | `fr`    |
| Español    | `es`    |
| Italiano   | `it`    |
| Português  | `pt`    |
| Nederlands | `nl`    |
| Polski     | `pl`    |
| Русский    | `ru`    |
| 简体中文   | `zh-cn` |
| 日本語     | `ja`    |
| हिन्दी     | `hi`    |
| 한국어        | `ko`    |
| Indonesia  | `id`    |
| Tiếng Việt | `vi`    |
| ไทย        | `th`    |
| বাংলা      | `bn`    |

Terjemahan disediakan via `package.nls.*.json` (UI) dan `l10n/bundle.l10n.*.json` (pesan dan dashboard).

## Instalasi

Instal dari [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=kieksme.astro-analytics) atau dari file `.vsix` (`Cmd+Shift+P` → **"Install from VSIX..."**). Untuk build dari sumber, lihat [CONTRIBUTING.md](CONTRIBUTING.md).
