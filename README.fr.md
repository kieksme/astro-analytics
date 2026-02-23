# Astro Analytics — Extension VS Code [![Version](https://img.shields.io/visual-studio-marketplace/v/kieksme.astro-analytics)](https://marketplace.visualstudio.com/items?itemName=kieksme.astro-analytics)

**Langues :** [English](README.md) | [Deutsch](README.de.md) | [Français](README.fr.md) | [Español](README.es.md) | [Italiano](README.it.md) | [Português](README.pt.md) | [Nederlands](README.nl.md) | [Polski](README.pl.md) | [Русский](README.ru.md) | [简体中文](README.zh-cn.md) | [日本語](README.ja.md) | [हिन्दी](README.hi.md) | [한국어](README.ko.md) | [Indonesia](README.id.md) | [Tiếng Việt](README.vi.md) | [ไทย](README.th.md) | [বাংলা](README.bn.md)

> 🧑‍🚀 Vous ne connaissez pas Astro ? Rendez-vous sur [astro.build](https://astro.build) !

**Éditeur :** kieks.me GbR

Affiche les métriques Google Analytics GA4 directement dans VS Code lorsque vous ouvrez des fichiers Astro Markdown ou `.astro`.

## Fonctionnalités

- **CodeLens** en haut de chaque fichier `.md`/`.mdx`/`.astro` avec taux de rebond, vues, utilisateurs et durée de session
- **Explorateur** — Taux de rebond affiché à côté des noms de fichiers dans l’arborescence lorsque les données analytiques existent (badge + infobulle)
- **Infobulle au survol** avec tableau complet des métriques (survolez les premières lignes du fichier)
- **Barre d’état** en bas à droite avec le taux de rebond de la page actuellement ouverte
- Mise en cache automatique (TTL 5 minutes), actualisation manuelle au clic

## Codage couleur du taux de rebond

L’extension affiche le taux de rebond avec des indicateurs colorés (vert / jaune / orange / rouge) dans CodeLens, l’explorateur, le survol, la barre d’état et le tableau de bord :

| Niveau | Taux de rebond |
|--------|----------------|
| 🟢 | < 25 % — Très bon |
| 🟡 | 25–44 % — Bon |
| 🟠 | 45–64 % — Moyen |
| 🔴 | ≥ 65 % — À améliorer |

## Configuration

### 1. Préparer les identifiants

L’extension nécessite les Google Application Default Credentials avec le scope `analytics.readonly`.

Si vous ne les avez pas encore, créez des ADC. Pour une démonstration, voir par ex. [Authenticate with GCP using gcloud auth application-default login](https://www.youtube.com/watch?v=5utoA5gnKQ4).

```bash
gcloud auth application-default login \
  --scopes https://www.googleapis.com/auth/analytics.readonly,https://www.googleapis.com/auth/cloud-platform \
  --client-id-file=~/Certificates/gcp/internal-dev.json
```

Le chemin du fichier d’identifiants créé est affiché dans la console :

```text
Credentials saved to file: [~/.config/gcloud/application_default_credentials.json]
```

### 2. Configurer l’extension

Dans VS Code : `Cmd+,` → rechercher **Astro Analytics**

| Paramètre | Description | Par défaut |
|-----------|-------------|------------|
| `astroAnalytics.propertyId` | ID de propriété GA4 (numérique) | `364493652` |
| `astroAnalytics.credentialsPath` | Chemin du fichier JSON des identifiants | (défaut ADC) |
| `astroAnalytics.lookbackDays` | Période en jours | `30` |
| `astroAnalytics.contentRoot` | Dossier de contenu Astro | `src/content` |
| `astroAnalytics.pagesRoot` | Dossier des pages Astro | `src/pages` |

Exemple `settings.json` :

```json
{
  "astroAnalytics.propertyId": "364493652",
  "astroAnalytics.credentialsPath": "~/.config/gcloud/application_default_credentials.json",
  "astroAnalytics.lookbackDays": 90,
  "astroAnalytics.contentRoot": "src/content",
  "astroAnalytics.pagesRoot": "src/pages"
}
```

### 3. Correspondance des slugs d’URL

L’extension dérive le `pagePath` GA4 du chemin du fichier :

```text
src/content/blog/datenstrategie-ki.md  →  /blog/datenstrategie-ki/
src/content/karriere/index.md          →  /karriere/
src/pages/blog/my-post.astro           →  /blog/my-post/
src/pages/index.astro                  →  /
```

Les **routes dynamiques** (`[slug].astro`, `[...slug].astro`, `[slug]/[id].astro`) sont prises en charge :

- Dans le **tableau de bord**, un chemin GA4 comme `/blog/` peut être résolu vers un fichier de route dynamique (ex. `src/pages/[slug].astro`) lorsqu’aucun fichier statique n’existe, la ligne reste cliquable et ouvre ce fichier.
- Lorsque vous **ouvrez un fichier de route dynamique**, l’extension affiche le taux de rebond, les vues, les utilisateurs et la durée de session **agrégés** pour tous les chemins GA4 correspondant à cette route.

### 4. Vérifier que les données se chargent

Si vous ne voyez aucune métrique (CodeLens affiche « no data » ou la barre d’état reste vide) :

1. **Exécuter la commande de test** — `Cmd+Shift+P` → **« Astro Analytics: Test API Connection »**. Vous pouvez aussi exécuter **« Astro Analytics: Open Dashboard »** pour ouvrir un tableau de bord dans l’éditeur.
2. **Vérifier la configuration** — Vérifiez que `astroAnalytics.propertyId` est défini et, si besoin, `astroAnalytics.credentialsPath` pointe vers votre fichier JSON d’identifiants.
3. **Vérifier la correspondance des slugs** — Le `pagePath` GA4 et le slug de l’extension utilisent une barre oblique finale (ex. `/blog/my-post/`). L’extension normalise les chemins pour la recherche si nécessaire.
4. **Consulter le canal Output** — Les erreurs API y apparaissent ainsi qu’en notification.

**Si la commande « Astro Analytics: Test API Connection » est introuvable :** Recompilez l’extension et rechargez la fenêtre. Voir [CONTRIBUTING.md](CONTRIBUTING.md).

## Localisation

L’extension est localisée pour les langues suivantes. L’interface suit la langue d’affichage de VS Code lorsqu’une traduction est disponible :

| Langue | Locale |
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

Les traductions sont fournies via `package.nls.*.json` (UI) et `l10n/bundle.l10n.*.json` (messages et tableau de bord).

## Installation

Installez depuis le [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=kieksme.astro-analytics) ou depuis un fichier `.vsix` (`Cmd+Shift+P` → **« Install from VSIX... »**). Pour compiler depuis les sources, voir [CONTRIBUTING.md](CONTRIBUTING.md).
