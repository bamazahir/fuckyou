---
name: studyroom-look
description: "Art direction and isometric asset pipeline for Studyroom. Use whenever building or changing anything visual: UI screens, colors, typography, the 3D isometric room, furniture/props, the bean avatar, lighting, shop thumbnails, icons, or when importing, making or optimizing a 3D model or audio asset. Also use when something 'looks generic', 'looks AI-made / vibe coded', or before any screenshot review. Pairs with frontend-design (UI craft), threejs-* skills (rendering), web-asset-generator (app icons) and web-design-guidelines (audit)."
---

# Studyroom look

Studyroom has to feel like a **place**, not a dashboard. The test for every screen: would a screenshot of it be mistaken for a generic Tailwind template? If yes, it's not done.

## 1. Direction: "lamp-lit study at night"

Mood: a small warm room at night. Desk lamps glowing, dusk-blue windows, paper and wood. Calm, cozy, a bit proud. References to study (for feel, never to copy): *Unpacking* (tidy isometric rooms), *A Short Hike* (soft low-poly), Monument Valley (clean lighting), Habbo (social rooms).

### Design tokens (`src/styles/tokens.css`; the only source of colors)
```
--ink:        #2B2622   text, 2px outlines
--paper:      #F6EFE4   cards / sheets
--paper-2:    #EDE3D3   pressed / secondary surface
--wood:       #BA8456   accents, tab bar (ink text on it: 4.65:1)
--lamp:       #FFC86B   primary action, focus, "studying" glow
--dusk:       #2F3A5C   app background at night, windows
--dusk-2:     #44527D
--leaf:       #6FA06B   focusing state
--sky:        #7FB2D9   break state
--ember:      #E0654A   destructive / errors
--muted:      #675D53   secondary text (5.6:1 on paper)
```
Day theme (06:00–18:00 local) swaps the background to `#E9DFCF` and windows to `#A9D3EE`. The room follows the **user's local time**: at night, lamps on, windows dark, a soft glow. That makes the 2am moment feel special.

### Type
- Display/timer: **Bricolage Grotesque** (700). The timer uses `font-variant-numeric: tabular-nums`.
- Body: **Atkinson Hyperlegible** (400/700).
- Self-host both (woff2 in `public/fonts`); no Google Fonts requests (privacy, SPEC §13). Record them in `docs/ASSETS.md` (both are OFL).

### UI language
- Cards look like **paper on a desk**: `--paper` fill, 2px `--ink` border, 14px radius, an offset hard shadow `4px 4px 0 var(--ink)` on primary cards only. Buttons press down 2px on active.
- A subtle grain overlay (tiny noise PNG at 4% opacity) on the background.
- Icons: one consistent set (Phosphor "bold" or Lucide at 2px stroke to match the borders). Never mix sets. Emoji only for reactions.
- Motion: springy but short (150–250ms). Avatar join = walk in. Coin gain = coins arc into the counter. Respect `prefers-reduced-motion`.

### Banned (the "vibe-coded" tells)
Purple-to-blue gradients · glassmorphism blur panels · gray-on-white default shadcn cards · centered single-column marketing layouts inside the app · Inter/system font as the brand · random emoji as UI icons · drop shadows with large blur on everything · stock 3D illustrations · inconsistent radii · placeholder lorem.

## 2. The isometric scene

Matches SPEC §10. Visual rules:
- **Flat-shaded low-poly.** `MeshStandardMaterial({ flatShading: true, roughness: 0.85, metalness: 0 })`. No textures beyond a single shared **palette texture** (32 swatches, 256×8 PNG; UVs map faces to swatches, Kenney-style). Everything then shares one material and one draw-call-friendly look.
- **Lighting:** warm key light from the lamp side (`#FFD9A0`), cool hemisphere fill (sky `#9DB4E0`, ground `#5A4636`). drei `<ContactShadows>` under furniture for grounding. At night, each lamp item adds a small point light (max 4 active, nearest to camera). Bloom (postprocessing) on lamps for desktop only.
- **Camera:** orthographic, true isometric (yaw 45°, pitch ≈35.264°), slight vignette. Room floor is a raised slab with a visible edge (dollhouse cutaway), walls on the back two sides only.
- **Bean avatar** (procedural, `src/scene/Bean.tsx`): capsule body (r 0.28, h 0.5), sphere head (r 0.26) overlapping the body, two small black eye spheres, a hair cap (scaled hemisphere). Colors from the four avatar slots, picked from curated swatches only (skin tones ×8, hair ×10, body/top ×16). An ink-colored outline via an inverted-hull mesh at 1.04 scale, so beans match the UI's 2px borders. States per SPEC §10 (writing bob, mug on break).

## 3. Asset pipeline

Order of preference for any new item:
1. **Procedural in code** (`threejs-geometry` skill): boxes, cylinders and extrusions for desks, shelves, rugs, books, mugs. Zero license risk, tiny.
2. **CC0 packs** (candidates: Kenney "Furniture Kit"; Quaternius packs). Open the pack's own page, confirm CC0, and record the URL + license in `docs/ASSETS.md` **before** committing the file.
3. **Made in Blender** by the builder (export glTF binary).

Never use: Sketchfab models without a verified CC0/CC-BY license, AI-generated meshes with unclear terms, or anything "free for personal use".

Normalize every model (script `scripts/assets/normalize.mjs` using `@gltf-transform/core` + `functions`):
- Y-up, facing +Z, 1 unit = 1 grid cell, origin at the **bottom-center of the footprint**.
- Strip cameras and lights, merge meshes, weld, dedup, apply the palette material (or keep the named materials `Primary`/`Secondary`/`Accent` so the app can tint them).
- `meshopt` compression, textures ≤ 512px webp. Budget: ≤ 60 KB per item, ≤ 2 MB per default room.
- Output `public/models/<category>/<id>.glb`, plus an entry in `src/content/catalog.json` (id, footprint, wall, seat anchor if seatable).

**Shop thumbnails:** a dev-only route `/dev/thumbs` renders each catalog item alone (same lighting, transparent background, 3/4 iso view). `scripts/assets/thumbs.mjs` (Playwright) screenshots each one at 256×256 → `public/thumbs/<id>.webp`. Re-run after any model change. Don't hand-make thumbnails.

**App icon / splash / OG image:** use `web-asset-generator` from one source image: a bean at a lamp-lit desk on a `--dusk` background.

## 4. Screenshot review (required before closing any visual task)

Use `webapp-testing` to capture Room, Home and My Room at **390×844** and **1440×900**, in **day and night**, with 1, 4 and 12 avatars present. Check against this list and fix before finishing:
- [ ] Nothing from the Banned list.
- [ ] Only token colors are used (`grep -rn "#[0-9a-fA-F]\{6\}" src --include=*.tsx` → no hits outside tokens/scene palette).
- [ ] The timer is the most prominent UI element; the scene is the most prominent overall.
- [ ] Labels are readable over the scene at all three crowd sizes.
- [ ] Night mode feels warm, not just dark.
- [ ] The screen would be recognizable as Studyroom with the logo covered.
