# Astro Analytics — Extensión de VS Code [![Version](https://img.shields.io/visual-studio-marketplace/v/kieksme.astro-analytics)](https://marketplace.visualstudio.com/items?itemName=kieksme.astro-analytics)

**Idiomas:** [English](README.md) | [Deutsch](README.de.md) | [Français](README.fr.md) | [Español](README.es.md) | [Italiano](README.it.md) | [Português](README.pt.md) | [Nederlands](README.nl.md) | [Polski](README.pl.md) | [Русский](README.ru.md) | [简体中文](README.zh-cn.md) | [日本語](README.ja.md) | [हिन्दी](README.hi.md) | [한국어](README.ko.md) | [Indonesia](README.id.md) | [Tiếng Việt](README.vi.md) | [ไทย](README.th.md) | [বাংলা](README.bn.md)

> 🧑‍🚀 ¿No conoces Astro? Visita [astro.build](https://astro.build).

**Editor:** kieks.me GbR

Muestra métricas de Google Analytics GA4 directamente en VS Code al abrir archivos Markdown de Astro o `.astro`.

## Características

- **CodeLens** en la parte superior de cada archivo `.md`/`.mdx`/`.astro` con tasa de rebote, vistas, usuarios y duración de sesión
- **Explorador** — Tasa de rebote junto a los nombres de archivo en el árbol cuando hay datos de analytics (badge + tooltip)
- **Tooltip al pasar el ratón** con tabla completa de métricas (sobre las primeras líneas del archivo)
- **Barra de estado** en la esquina inferior derecha con la tasa de rebote de la página abierta
- Caché automática (TTL 5 min), actualización manual al hacer clic

## Codificación por colores de la tasa de rebote

La extensión muestra la tasa de rebote con indicadores de color (verde / amarillo / naranja / rojo) en CodeLens, explorador, tooltip, barra de estado y panel:

| Nivel | Tasa de rebote     |
|-------|--------------------|
| 🟢    | < 25 % — Muy buena |
| 🟡    | 25–44 % — Buena    |
| 🟠    | 45–64 % — Media    |
| 🔴    | ≥ 65 % — Mejorable |

## Configuración

### 1. Preparar credenciales

La extensión requiere Google Application Default Credentials con el ámbito `analytics.readonly`.

Si aún no las tienes, crea ADC. Para un tutorial en vídeo, ver por ejemplo [Authenticate with GCP using gcloud auth application-default login](https://www.youtube.com/watch?v=5utoA5gnKQ4).

```bash
gcloud auth application-default login \
  --scopes https://www.googleapis.com/auth/analytics.readonly,https://www.googleapis.com/auth/cloud-platform \
  --client-id-file=~/Certificates/gcp/internal-dev.json
```

La ruta del archivo de credenciales se muestra en la consola:

```text
Credentials saved to file: [~/.config/gcloud/application_default_credentials.json]
```

### 2. Configurar la extensión

En VS Code: `Cmd+,` → buscar **Astro Analytics**

| Configuración                    | Descripción                    | Por defecto       |
|----------------------------------|--------------------------------|-------------------|
| `astroAnalytics.propertyId`      | ID de propiedad GA4 (numérico) | `364493652`       |
| `astroAnalytics.credentialsPath` | Ruta al JSON de credenciales   | (por defecto ADC) |
| `astroAnalytics.lookbackDays`    | Rango de días                  | `30`              |
| `astroAnalytics.contentRoot`     | Carpeta de contenido Astro     | `src/content`     |
| `astroAnalytics.pagesRoot`       | Carpeta de páginas Astro       | `src/pages`       |

Ejemplo `settings.json`:

```json
{
  "astroAnalytics.propertyId": "364493652",
  "astroAnalytics.credentialsPath": "~/.config/gcloud/application_default_credentials.json",
  "astroAnalytics.lookbackDays": 90,
  "astroAnalytics.contentRoot": "src/content",
  "astroAnalytics.pagesRoot": "src/pages"
}
```

### 3. Asignación de slugs de URL

La extensión obtiene el `pagePath` de GA4 a partir de la ruta del archivo:

```text
src/content/blog/datenstrategie-ki.md  →  /blog/datenstrategie-ki/
src/content/karriere/index.md          →  /karriere/
src/pages/blog/my-post.astro           →  /blog/my-post/
src/pages/index.astro                  →  /
```

Se admiten **rutas dinámicas** (`[slug].astro`, `[...slug].astro`, `[slug]/[id].astro`):

- En el **panel**, un path GA4 como `/blog/` puede resolverse a un archivo de ruta dinámica (p. ej. `src/pages/[slug].astro`) cuando no existe archivo estático.
- Al **abrir un archivo de ruta dinámica**, la extensión muestra tasa de rebote, vistas, usuarios y duración de sesión **agregados** para todos los paths GA4 que coinciden con esa ruta.

### 4. Comprobar que se cargan los datos

Si no ves métricas (CodeLens muestra "no data" o la barra de estado está vacía):

1. **Ejecutar el comando de prueba** — `Cmd+Shift+P` → **"Astro Analytics: Test API Connection"**. También puedes usar **"Astro Analytics: Open Dashboard"**.
2. **Revisar la configuración** — Asegúrate de que `astroAnalytics.propertyId` esté definido y, si aplica, `astroAnalytics.credentialsPath` apunte al JSON de credenciales.
3. **Revisar la coincidencia de slugs** — El `pagePath` de GA4 y el slug de la extensión usan barra final (p. ej. `/blog/my-post/`). La extensión normaliza los paths para la búsqueda si hace falta.
4. **Revisar el canal Output** — Los errores de API aparecen ahí y como notificación.

**Si no encuentras el comando "Astro Analytics: Test API Connection":** Recompila la extensión y recarga la ventana. Ver [CONTRIBUTING.md](CONTRIBUTING.md).

## Localización

La extensión está localizada para los siguientes idiomas. La interfaz sigue el idioma de visualización de VS Code cuando hay traducción disponible:

| Idioma     | Locale  |
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

Las traducciones están en `package.nls.*.json` (UI contribuida) y `l10n/bundle.l10n.*.json` (mensajes y panel).

## Instalación

Instala desde el [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=kieksme.astro-analytics) o desde un archivo `.vsix` (`Cmd+Shift+P` → **"Install from VSIX..."**). Para compilar desde fuentes, ver [CONTRIBUTING.md](CONTRIBUTING.md).
