# Astro Analytics — VS Code 扩展 [![Version](https://img.shields.io/visual-studio-marketplace/v/kieksme.astro-analytics)](https://marketplace.visualstudio.com/items?itemName=kieksme.astro-analytics)

**语言：** [English](README.md) | [Deutsch](README.de.md) | [Français](README.fr.md) | [Español](README.es.md) | [Italiano](README.it.md) | [Português](README.pt.md) | [Nederlands](README.nl.md) | [Polski](README.pl.md) | [Русский](README.ru.md) | [简体中文](README.zh-cn.md) | [日本語](README.ja.md) | [हिन्दी](README.hi.md) | [한국어](README.ko.md) | [Indonesia](README.id.md) | [Tiếng Việt](README.vi.md) | [ไทย](README.th.md) | [বাংলা](README.bn.md)

> 🧑‍🚀 不了解 Astro？请访问 [astro.build](https://astro.build)。

**发布者：** kieks.me GbR

在 VS Code 中打开 Astro Markdown 或 `.astro` 文件时，直接显示 Google Analytics GA4 指标。

## 功能

- **CodeLens**：在每个 `.md`/`.mdx`/`.astro` 文件顶部显示跳出率、浏览量、用户数和会话时长
- **资源管理器**：当存在分析数据时，在目录树中的文件名旁显示跳出率（徽章 + 悬停提示）
- **悬停提示**：完整指标表（将鼠标悬停在文件前几行）
- **状态栏**：右下角显示当前打开页面的跳出率
- 自动缓存（5 分钟 TTL），点击可手动刷新

## 跳出率颜色标识

扩展在 CodeLens、资源管理器、悬停、状态栏和面板中用颜色标识（绿 / 黄 / 橙 / 红）显示跳出率：

| 级别 | 跳出率 |
|------|--------|
| 🟢 | < 25% — 很好 |
| 🟡 | 25–44% — 良好 |
| 🟠 | 45–64% — 一般 |
| 🔴 | ≥ 65% — 需改进 |

## 设置

### 1. 准备凭据

扩展需要具有 `analytics.readonly` 范围的 Google 应用默认凭据。

若尚未创建，请创建 ADC。视频演示可参考 [Authenticate with GCP using gcloud auth application-default login](https://www.youtube.com/watch?v=5utoA5gnKQ4)。

```bash
gcloud auth application-default login \
  --scopes https://www.googleapis.com/auth/analytics.readonly,https://www.googleapis.com/auth/cloud-platform \
  --client-id-file=~/Certificates/gcp/internal-dev.json
```

控制台会输出所创建凭据文件的路径：

```text
Credentials saved to file: [~/.config/gcloud/application_default_credentials.json]
```

### 2. 配置扩展

在 VS Code 中：`Cmd+,` → 搜索 **Astro Analytics**

| 设置 | 说明 | 默认值 |
|------|------|--------|
| `astroAnalytics.propertyId` | GA4 媒体资源 ID（数字） | `364493652` |
| `astroAnalytics.credentialsPath` | 凭据 JSON 路径 | （ADC 默认） |
| `astroAnalytics.lookbackDays` | 回溯天数 | `30` |
| `astroAnalytics.contentRoot` | Astro 内容目录 | `src/content` |
| `astroAnalytics.pagesRoot` | Astro 页面目录 | `src/pages` |

示例 `settings.json`：

```json
{
  "astroAnalytics.propertyId": "364493652",
  "astroAnalytics.credentialsPath": "~/.config/gcloud/application_default_credentials.json",
  "astroAnalytics.lookbackDays": 90,
  "astroAnalytics.contentRoot": "src/content",
  "astroAnalytics.pagesRoot": "src/pages"
}
```

### 3. URL slug 映射

扩展根据文件路径推导 GA4 的 `pagePath`：

```text
src/content/blog/datenstrategie-ki.md  →  /blog/datenstrategie-ki/
src/content/karriere/index.md          →  /karriere/
src/pages/blog/my-post.astro           →  /blog/my-post/
src/pages/index.astro                  →  /
```

支持**动态路由**（`[slug].astro`、`[...slug].astro`、`[slug]/[id].astro`）：

- 在**面板**中，当不存在静态文件时，GA4 路径如 `/blog/` 可解析为动态路由文件（如 `src/pages/[slug].astro`）。
- **打开动态路由文件**时，扩展会显示与该路由匹配的所有 GA4 路径的**汇总**跳出率、浏览量、用户数和会话时长。

### 4. 检查数据是否加载

若看不到指标（CodeLens 显示“no data”或状态栏为空）：

1. **运行测试命令** — `Cmd+Shift+P` → **“Astro Analytics: Test API Connection”**。也可运行 **“Astro Analytics: Open Dashboard”**。
2. **检查配置** — 确保已设置 `astroAnalytics.propertyId`，必要时将 `astroAnalytics.credentialsPath` 指向凭据 JSON。
3. **检查 slug 匹配** — GA4 的 `pagePath` 与扩展的 slug 均使用尾部斜杠（如 `/blog/my-post/`）。若站点发送的路径无尾部斜杠，扩展会进行规范化；测试输出会显示原始与规范化路径。
4. **查看 Output 通道** — API 错误会出现在该通道及通知中。

**若找不到命令“Astro Analytics: Test API Connection”：** 请重新编译扩展并重新加载窗口。参见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 本地化

扩展已为以下语言提供本地化。当存在翻译时，界面会跟随 VS Code 的显示语言：

| 语言 | Locale |
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

翻译通过 `package.nls.*.json`（贡献的 UI）和 `l10n/bundle.l10n.*.json`（扩展消息与面板）提供。

## 安装

从 [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=kieksme.astro-analytics) 或从 `.vsix` 文件安装（`Cmd+Shift+P` → **“Install from VSIX...”**）。从源码构建请参见 [CONTRIBUTING.md](CONTRIBUTING.md)。
