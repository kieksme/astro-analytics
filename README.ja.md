# Astro Analytics — VS Code 拡張機能 [![Version](https://img.shields.io/visual-studio-marketplace/v/kieksme.astro-analytics)](https://marketplace.visualstudio.com/items?itemName=kieksme.astro-analytics)

**言語:** [English](README.md) | [Deutsch](README.de.md) | [Français](README.fr.md) | [Español](README.es.md) | [Italiano](README.it.md) | [Português](README.pt.md) | [Nederlands](README.nl.md) | [Polski](README.pl.md) | [Русский](README.ru.md) | [简体中文](README.zh-cn.md) | [日本語](README.ja.md) | [हिन्दी](README.hi.md) | [한국어](README.ko.md) | [Indonesia](README.id.md) | [Tiếng Việt](README.vi.md) | [ไทย](README.th.md) | [বাংলা](README.bn.md)

> 🧑‍🚀 Astro をご存じない方は [astro.build](https://astro.build) をご覧ください。

**発行元:** kieks.me GbR

Astro の Markdown または `.astro` ファイルを開いたときに、VS Code 内で Google Analytics GA4 の指標を直接表示します。

## 機能

- **CodeLens** — 各 `.md`/`.mdx`/`.astro` ファイルの先頭に直帰率、閲覧数、ユーザー数、セッション時間を表示
- **エクスプローラー** — 分析データがある場合、ツリーのファイル名横に直帰率を表示（バッジ + ツールチップ）
- **ホバー ツールチップ** — 指標の一覧表（ファイルの先頭数行にホバー）
- **ステータス バー** — 右下に現在開いているページの直帰率を表示
- 自動キャッシュ（TTL 5 分）、クリックで手動更新

## 直帰率の色分け

拡張機能は、CodeLens、エクスプローラー、ホバー、ステータス バー、ダッシュボードで直帰率を色（緑 / 黄 / オレンジ / 赤）で表示します：

| レベル | 直帰率 |
|--------|--------|
| 🟢 | < 25% — 非常に良い |
| 🟡 | 25–44% — 良い |
| 🟠 | 45–64% — 普通 |
| 🔴 | ≥ 65% — 要改善 |

## セットアップ

### 1. 認証情報の準備

拡張機能には、スコープ `analytics.readonly` の Google Application Default Credentials が必要です。

まだお持ちでない場合は ADC を作成してください。動画手順例: [Authenticate with GCP using gcloud auth application-default login](https://www.youtube.com/watch?v=5utoA5gnKQ4)。

```bash
gcloud auth application-default login \
  --scopes https://www.googleapis.com/auth/analytics.readonly,https://www.googleapis.com/auth/cloud-platform \
  --client-id-file=~/Certificates/gcp/internal-dev.json
```

作成された認証情報ファイルのパスがコンソールに表示されます：

```text
Credentials saved to file: [~/.config/gcloud/application_default_credentials.json]
```

### 2. 拡張機能の設定

VS Code で: `Cmd+,` → **Astro Analytics** で検索

| 設定 | 説明 | 既定値 |
|------|------|--------|
| `astroAnalytics.propertyId` | GA4 プロパティ ID（数値） | `364493652` |
| `astroAnalytics.credentialsPath` | 認証情報 JSON のパス | （ADC 既定） |
| `astroAnalytics.lookbackDays` | 取得日数 | `30` |
| `astroAnalytics.contentRoot` | Astro コンテンツ フォルダ | `src/content` |
| `astroAnalytics.pagesRoot` | Astro ページ フォルダ | `src/pages` |

`settings.json` の例：

```json
{
  "astroAnalytics.propertyId": "364493652",
  "astroAnalytics.credentialsPath": "~/.config/gcloud/application_default_credentials.json",
  "astroAnalytics.lookbackDays": 90,
  "astroAnalytics.contentRoot": "src/content",
  "astroAnalytics.pagesRoot": "src/pages"
}
```

### 3. URL スラッグのマッピング

拡張機能はファイル パスから GA4 の `pagePath` を導出します：

```text
src/content/blog/datenstrategie-ki.md  →  /blog/datenstrategie-ki/
src/content/karriere/index.md          →  /karriere/
src/pages/blog/my-post.astro           →  /blog/my-post/
src/pages/index.astro                  →  /
```

**動的ルート**（`[slug].astro`、`[...slug].astro`、`[slug]/[id].astro`）に対応しています：

- **ダッシュボード**では、静的ファイルが存在しない場合、`/blog/` のような GA4 パスが動的ルート ファイル（例: `src/pages/[slug].astro`）に解決されることがあります。
- **動的ルート ファイルを開いた**場合、そのルートに一致するすべての GA4 パスについて、直帰率・閲覧数・ユーザー数・セッション時間の**集計値**を表示します。

### 4. データ読み込みの確認

指標が表示されない場合（CodeLens が「no data」またはステータス バーが空の場合）：

1. **テスト コマンドを実行** — `Cmd+Shift+P` → **「Astro Analytics: Test API Connection」**。**「Astro Analytics: Open Dashboard」**も利用できます。
2. **設定を確認** — `astroAnalytics.propertyId` が設定されていること、必要に応じて `astroAnalytics.credentialsPath` が認証情報 JSON を指していることを確認してください。
3. **スラッグの一致を確認** — GA4 の `pagePath` と拡張機能のスラッグはどちらも末尾スラッシュ（例: `/blog/my-post/`）を使用します。サイトがスラッシュなしでパスを送る場合、拡張機能が検索用に正規化します。
4. **Output パネルを確認** — API エラーはそこと通知に表示されます。

**「Astro Analytics: Test API Connection」コマンドが見つからない場合:** 拡張機能をリビルドし、ウィンドウをリロードしてください。[CONTRIBUTING.md](CONTRIBUTING.md) を参照。

## ローカライズ

拡張機能は以下の言語に対応しています。翻訳が利用可能な場合、UI は VS Code の表示言語に従います：

| 言語 | Locale |
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

翻訳は `package.nls.*.json`（UI）と `l10n/bundle.l10n.*.json`（メッセージとダッシュボード）で提供されています。

## インストール

[VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=kieksme.astro-analytics) から、または `.vsix` ファイルからインストール（`Cmd+Shift+P` → **「Install from VSIX...」**）。ソースからビルドする場合は [CONTRIBUTING.md](CONTRIBUTING.md) を参照。
