# Astro Analytics — Extensão VS Code [![Version](https://img.shields.io/visual-studio-marketplace/v/kieksme.astro-analytics)](https://marketplace.visualstudio.com/items?itemName=kieksme.astro-analytics)

**Idiomas:** [English](README.md) | [Deutsch](README.de.md) | [Français](README.fr.md) | [Español](README.es.md) | [Italiano](README.it.md) | [Português](README.pt.md) | [Nederlands](README.nl.md) | [Polski](README.pl.md) | [Русский](README.ru.md) | [简体中文](README.zh-cn.md) | [日本語](README.ja.md) | [हिन्दी](README.hi.md) | [한국어](README.ko.md) | [Indonesia](README.id.md) | [Tiếng Việt](README.vi.md) | [ไทย](README.th.md) | [বাংলা](README.bn.md)

> 🧑‍🚀 Não conheces Astro? Visita [astro.build](https://astro.build).

**Editor:** kieks.me GbR

Mostra métricas do Google Analytics GA4 diretamente no VS Code ao abrires ficheiros Astro Markdown ou `.astro`.

## Funcionalidades

- **CodeLens** no topo de cada ficheiro `.md`/`.mdx`/`.astro` com taxa de rejeição, visualizações, utilizadores e duração da sessão
- **Explorador** — Taxa de rejeição ao lado dos nomes dos ficheiros na árvore quando existem dados de analytics (badge + tooltip)
- **Tooltip ao passar o rato** com tabela completa de métricas (passa sobre as primeiras linhas do ficheiro)
- **Barra de estado** no canto inferior direito com a taxa de rejeição da página aberta
- Cache automática (TTL 5 min), atualização manual ao clicar

## Código de cores da taxa de rejeição

A extensão mostra a taxa de rejeição com indicadores coloridos (verde / amarelo / laranja / vermelho) no CodeLens, explorador, tooltip, barra de estado e painel:

| Nível | Taxa de rejeição |
|-------|------------------|
| 🟢 | < 25 % — Muito boa |
| 🟡 | 25–44 % — Boa |
| 🟠 | 45–64 % — Média |
| 🔴 | ≥ 65 % — A melhorar |

## Configuração

### 1. Preparar credenciais

A extensão requer Google Application Default Credentials com o âmbito `analytics.readonly`.

Se ainda não as tens, cria ADC. Para um tutorial em vídeo, ver por ex. [Authenticate with GCP using gcloud auth application-default login](https://www.youtube.com/watch?v=5utoA5gnKQ4).

```bash
gcloud auth application-default login \
  --scopes https://www.googleapis.com/auth/analytics.readonly,https://www.googleapis.com/auth/cloud-platform \
  --client-id-file=~/Certificates/gcp/internal-dev.json
```

O caminho do ficheiro de credenciais é mostrado na consola:

```text
Credentials saved to file: [~/.config/gcloud/application_default_credentials.json]
```

### 2. Configurar a extensão

No VS Code: `Cmd+,` → procurar **Astro Analytics**

| Definição | Descrição | Predefinido |
|-----------|-----------|-------------|
| `astroAnalytics.propertyId` | ID da propriedade GA4 (numérico) | `364493652` |
| `astroAnalytics.credentialsPath` | Caminho para o JSON de credenciais | (predefinido ADC) |
| `astroAnalytics.lookbackDays` | Período em dias | `30` |
| `astroAnalytics.contentRoot` | Pasta de conteúdo Astro | `src/content` |
| `astroAnalytics.pagesRoot` | Pasta de páginas Astro | `src/pages` |

Exemplo `settings.json`:

```json
{
  "astroAnalytics.propertyId": "364493652",
  "astroAnalytics.credentialsPath": "~/.config/gcloud/application_default_credentials.json",
  "astroAnalytics.lookbackDays": 90,
  "astroAnalytics.contentRoot": "src/content",
  "astroAnalytics.pagesRoot": "src/pages"
}
```

### 3. Mapeamento de slugs de URL

A extensão obtém o `pagePath` do GA4 a partir do caminho do ficheiro:

```text
src/content/blog/datenstrategie-ki.md  →  /blog/datenstrategie-ki/
src/content/karriere/index.md          →  /karriere/
src/pages/blog/my-post.astro           →  /blog/my-post/
src/pages/index.astro                  →  /
```

**Rotas dinâmicas** (`[slug].astro`, `[...slug].astro`, `[slug]/[id].astro`) são suportadas:

- No **painel**, um path GA4 como `/blog/` pode resolver para um ficheiro de rota dinâmica (ex. `src/pages/[slug].astro`) quando não existe ficheiro estático.
- Ao **abrires um ficheiro de rota dinâmica**, a extensão mostra taxa de rejeição, visualizações, utilizadores e duração da sessão **agregados** para todos os paths GA4 que correspondem a essa rota.

### 4. Verificar se os dados carregam

Se não vês métricas (CodeLens mostra "no data" ou a barra de estado está vazia):

1. **Executar o comando de teste** — `Cmd+Shift+P` → **"Astro Analytics: Test API Connection"**. Também podes usar **"Astro Analytics: Open Dashboard"**.
2. **Verificar a configuração** — Garante que `astroAnalytics.propertyId` está definido e, se necessário, `astroAnalytics.credentialsPath` aponta para o teu JSON de credenciais.
3. **Verificar a correspondência de slugs** — O `pagePath` do GA4 e o slug da extensão usam barra final (ex. `/blog/my-post/`). A extensão normaliza os paths para a pesquisa se necessário.
4. **Verificar o canal Output** — Os erros da API aparecem aí e como notificação.

**Se o comando "Astro Analytics: Test API Connection" não for encontrado:** Recompila a extensão e recarrega a janela. Ver [CONTRIBUTING.md](CONTRIBUTING.md).

## Localização

A extensão está localizada para os seguintes idiomas. A interface segue o idioma de visualização do VS Code quando há tradução disponível:

| Idioma | Locale |
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

As traduções estão em `package.nls.*.json` (UI) e `l10n/bundle.l10n.*.json` (mensagens e painel).

## Instalação

Instala a partir do [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=kieksme.astro-analytics) ou de um ficheiro `.vsix` (`Cmd+Shift+P` → **"Install from VSIX..."**). Para compilar a partir do código fonte, ver [CONTRIBUTING.md](CONTRIBUTING.md).
