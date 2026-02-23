# Astro Analytics — VS Code 확장 [![Version](https://img.shields.io/visual-studio-marketplace/v/kieksme.astro-analytics)](https://marketplace.visualstudio.com/items?itemName=kieksme.astro-analytics)

**언어:** [English](README.md) | [Deutsch](README.de.md) | [Français](README.fr.md) | [Español](README.es.md) | [Italiano](README.it.md) | [Português](README.pt.md) | [Nederlands](README.nl.md) | [Polski](README.pl.md) | [Русский](README.ru.md) | [简体中文](README.zh-cn.md) | [日本語](README.ja.md) | [हिन्दी](README.hi.md) | [한국어](README.ko.md) | [Indonesia](README.id.md) | [Tiếng Việt](README.vi.md) | [ไทย](README.th.md) | [বাংলা](README.bn.md)

> 🧑‍🚀 Astro가 뭔지 모르시나요? [astro.build](https://astro.build)를 확인하세요.

**게시자:** kieks.me GbR

Astro Markdown 또는 `.astro` 파일을 열면 VS Code에서 Google Analytics GA4 지표를 바로 표시합니다.

## 기능

- **CodeLens** — 각 `.md`/`.mdx`/`.astro` 파일 상단에 이탈률, 조회수, 사용자, 세션 시간 표시
- **탐색기** — 분석 데이터가 있을 때 트리에서 파일 이름 옆에 이탈률 표시(배지 + 툴팁)
- **호버 툴팁** — 전체 지표 테이블(파일 처음 몇 줄에 마우스 오버)
- **상태 표시줄** — 오른쪽 아래에 현재 열린 페이지의 이탈률 표시
- 자동 캐시(5분 TTL), 클릭으로 수동 새로고침

## 이탈률 색상 표시

확장은 CodeLens, 탐색기, 호버, 상태 표시줄, 대시보드에서 이탈률을 색상(녹색/노랑/주황/빨강)으로 표시합니다:

| 수준 | 이탈률 |
|------|--------|
| 🟢 | < 25% — 매우 좋음 |
| 🟡 | 25–44% — 좋음 |
| 🟠 | 45–64% — 보통 |
| 🔴 | ≥ 65% — 개선 필요 |

## 설정

### 1. 인증 정보 준비

확장에는 `analytics.readonly` 범위의 Google Application Default Credentials가 필요합니다.

아직 없다면 ADC를 만드세요. 동영상 예: [Authenticate with GCP using gcloud auth application-default login](https://www.youtube.com/watch?v=5utoA5gnKQ4).

```bash
gcloud auth application-default login \
  --scopes https://www.googleapis.com/auth/analytics.readonly,https://www.googleapis.com/auth/cloud-platform \
  --client-id-file=~/Certificates/gcp/internal-dev.json
```

생성된 인증 정보 파일 경로가 콘솔에 출력됩니다:

```text
Credentials saved to file: [~/.config/gcloud/application_default_credentials.json]
```

### 2. 확장 구성

VS Code에서: `Cmd+,` → **Astro Analytics** 검색

| 설정 | 설명 | 기본값 |
|------|------|--------|
| `astroAnalytics.propertyId` | GA4 속성 ID(숫자) | `364493652` |
| `astroAnalytics.credentialsPath` | 인증 정보 JSON 경로 | (ADC 기본) |
| `astroAnalytics.lookbackDays` | 조회 일수 | `30` |
| `astroAnalytics.contentRoot` | Astro 콘텐츠 폴더 | `src/content` |
| `astroAnalytics.pagesRoot` | Astro 페이지 폴더 | `src/pages` |

`settings.json` 예:

```json
{
  "astroAnalytics.propertyId": "364493652",
  "astroAnalytics.credentialsPath": "~/.config/gcloud/application_default_credentials.json",
  "astroAnalytics.lookbackDays": 90,
  "astroAnalytics.contentRoot": "src/content",
  "astroAnalytics.pagesRoot": "src/pages"
}
```

### 3. URL 슬러그 매핑

확장은 파일 경로에서 GA4 `pagePath`를 유도합니다:

```text
src/content/blog/datenstrategie-ki.md  →  /blog/datenstrategie-ki/
src/content/karriere/index.md          →  /karriere/
src/pages/blog/my-post.astro           →  /blog/my-post/
src/pages/index.astro                  →  /
```

**동적 라우트** (`[slug].astro`, `[...slug].astro`, `[slug]/[id].astro`) 지원:

- **대시보드**에서 정적 파일이 없을 때 `/blog/` 같은 GA4 경로가 동적 라우트 파일(예: `src/pages/[slug].astro`)로 해석될 수 있습니다.
- **동적 라우트 파일을 열면** 해당 라우트와 일치하는 모든 GA4 경로에 대해 **집계된** 이탈률, 조회수, 사용자, 세션 시간을 표시합니다.

### 4. 데이터 로드 확인

지표가 안 보이면(CodeLens에 "no data" 또는 상태 표시줄이 비어 있음):

1. **테스트 명령 실행** — `Cmd+Shift+P` → **"Astro Analytics: Test API Connection"**. **"Astro Analytics: Open Dashboard"**도 사용 가능합니다.
2. **구성 확인** — `astroAnalytics.propertyId`가 설정되어 있는지, 필요 시 `astroAnalytics.credentialsPath`가 인증 정보 JSON을 가리키는지 확인하세요.
3. **슬러그 매칭 확인** — GA4 `pagePath`와 확장 슬러그는 둘 다 끝 슬래시(예: `/blog/my-post/`)를 사용합니다. 사이트가 슬래시 없이 경로를 보내면 확장이 조회용으로 정규화합니다.
4. **Output 채널 확인** — API 오류는 거기와 알림에 표시됩니다.

**"Astro Analytics: Test API Connection" 명령을 찾을 수 없으면:** 확장을 다시 빌드하고 창을 다시 로드하세요. [CONTRIBUTING.md](CONTRIBUTING.md) 참조.

## 현지화

확장은 다음 언어로 현지화되어 있습니다. 번역이 있으면 UI는 VS Code 표시 언어를 따릅니다:

| 언어 | Locale |
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

번역은 `package.nls.*.json`(UI)과 `l10n/bundle.l10n.*.json`(메시지 및 대시보드)에 있습니다.

## 설치

[VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=kieksme.astro-analytics)에서 또는 `.vsix` 파일로 설치(`Cmd+Shift+P` → **"Install from VSIX..."**). 소스에서 빌드하려면 [CONTRIBUTING.md](CONTRIBUTING.md) 참조.
