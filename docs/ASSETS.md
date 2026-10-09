# Assets & licenses

Every font, model, image and audio file shipped with the app. Add a row **before** committing a new asset (studyroom-look §3). Only CC0, OFL or other licenses that explicitly allow redistribution in an app.

| Asset | Path | Source | License |
|---|---|---|---|
| Bricolage Grotesque (variable) | npm `@fontsource-variable/bricolage-grotesque` (bundled into `dist/assets`) | Google Fonts via Fontsource | SIL OFL 1.1 |
| Atkinson Hyperlegible 400/700 | npm `@fontsource/atkinson-hyperlegible` (bundled) | Braille Institute via Fontsource | SIL OFL 1.1 |
| App icon (bean at a lamp-lit desk) | `public/icons/icon.svg` → PNGs via `scripts/assets/icons.mjs` | Original, made for this project | Project's own |
| Paper grain overlay | inline SVG noise in `src/styles/index.css` | Original | Project's own |
| Isometric furniture (desk, chair, rug, lamp, plant, bookshelf, window, cushion) | procedural, `src/scene/items.tsx` | Original, built in code (decision 0006) | Project's own |
| Bean avatar (3D) | procedural, `src/scene/Bean3D.tsx` | Original | Project's own |
