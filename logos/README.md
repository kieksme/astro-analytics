# Astro Analytics Logo

Logo concepts for the Astro Analytics VSCode extension.

## Concepts

| File | Description |
|------|--------------|
| `astro-analytics-concept1-chart-star.svg` | Rising chart line + star (Astro) on indigo gradient — analytics + Astro |
| `astro-analytics-concept2-lettermark.svg` | Stylized "A" with chart line integrated — lettermark + analytics |
| `astro-analytics-concept3-bars.svg` | Bar chart with star accent — dark theme, growth/green |

## Primary Icon

The extension uses `icon.png` (128×128) in the project root, generated from Concept 1.

## Regenerating icon.png

From SVG (requires ImageMagick):

```bash
convert -background none -resize 128x128 logos/astro-analytics-concept1-chart-star.svg icon.png
```

Or with sharp (Node):

```bash
pnpm add -D sharp
node -e "
const sharp = require('sharp');
const fs = require('fs');
sharp('logos/astro-analytics-concept1-chart-star.svg')
  .resize(128, 128)
  .png()
  .toFile('icon.png')
  .then(() => console.log('Done'));
"
```
