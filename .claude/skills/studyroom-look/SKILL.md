---
name: studyroom-look
description: "Art direction and isometric asset pipeline for Studyroom. Use whenever building or changing anything visual: UI screens, colors, typography, the 3D isometric room, furniture/props, the bean avatar, lighting, shop thumbnails, icons, or when importing, making or optimizing a 3D model or audio asset. Also use when something 'looks generic', 'looks AI-made / vibe coded', or before any screenshot review. Pairs with frontend-design (UI craft), threejs-* skills (rendering), web-asset-generator (app icons) and web-design-guidelines (audit)."
---

# Studyroom look

Studyroom has to feel like a **place**, not a dashboard. The test for every screen: would a screenshot of it be mistaken for a generic Tailwind template? If yes, it's not done.

## 1. Direction: "lamp-lit study at night"

Mood: a small warm room at night. Desk lamps glowing, dusk-blue windows, paper and wood. Calm, cozy, a bit proud. References to study (for feel, never to copy): *Unpacking* (tidy isometric rooms), *A Short Hike* (soft low-poly), Monument Valley (clean lighting), Habbo (social rooms).

### Color: semantic roles × themes (the only source of colors)
Components use **roles**, never raw palette values. Roles are CSS variables set per theme and mode in `src/styles/themes.css`, which is **generated** by `node scripts/design/themes.mjs --write`. That script also checks every text/background pair for contrast and fails on any miss.

| Role | Used for |
|---|---|
| `bg`, `on-bg`, `on-bg-muted`, `pattern` | the wall behind everything (+ its pattern), text on it |
| `surface`, `surface-2`, `field` | cards / pressed or secondary surfaces / inputs |
| `ink`, `muted`, `line` | text on cards, secondary text, 2px outlines and hard shadows |
| `accent`, `on-accent` | primary buttons, active tabs/chips, today's bar; text on them |
| `nav`, `on-nav` | the tab bar / side rail |
| `good`, `rest`, `danger` | focusing, on a break, destructive/errors (always with a label, never color alone) |
| `wall`, `window`, `wood`, `glow` | the 2D room scene (`RoomScene`) |

Tailwind utilities map 1:1 (`bg-surface`, `text-on-bg-muted`, `border-line`, `bg-accent text-on-accent`…). Anything on `bg-accent` uses `text-on-accent`.

**Themes** (each has light + dark; mode `auto` follows local time, light 06–18, dark otherwise):
- **Lamplight** (default): dusk walls, paper, lamp yellow. Dotted wallpaper.
- **Library**: bottle green, cream, brass. Wainscot stripes.
- **Blossom**: plum/petal, rose. Polka dots.
- **Observatory**: deep indigo with *dark* cards and lavender outlines, lilac accent. Sparse stars.

To add or adjust a theme: edit `scripts/design/themes.mjs`, run it with `--write`, and keep it at zero failures. Never hand-edit `themes.css` or hard-code a hex in a component (bean eyes and avatar swatches are the only exceptions: character art).

### Type
- Display/timer: **Bricolage Grotesque** (700). The timer uses `font-variant-numeric: tabular-nums`.
- Body: **Atkinson Hyperlegible** (400/700).
- Self-host both (woff2 in `public/fonts`); no Google Fonts requests (privacy, SPEC §13). Record them in `docs/ASSETS.md` (both are OFL).

### UI language
- Cards look like **paper on a desk**: `surface` fill, 2px `line` border, 14px radius, an offset hard shadow `4px 4px 0 var(--line)` on primary cards only. Buttons press down 2px on active.
- Screens are never bare: the illustrated `RoomScene` (window shows the real time of day, lamp glows when someone studies) heads Home, solo and shared rooms and invite previews; quiet rooms show free desks; numbers sit in strips rather than floating alone.
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
- **Avatar** (procedural chibi, decision 0007). `src/scene/Bean3D.tsx` (3D) and `src/components/Bean.tsx` (2D) must stay visually in sync.
  - Build: big round head (r 0.27), small body, stubby capsule limbs, shoes, eyes with a highlight, blush and a small smile. Hairstyles: short, long, curly, bun.
  - Colors come from the four avatar slots, using curated swatches only. Face colors are constants in `content/avatar.ts`.
  - Ink outline: an inverted hull grown by a fixed world thickness, so it matches the UI's 2px borders.
  - States per SPEC §10: writing arms while focusing, mug on break, looking around when idle, walking in.

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
- [ ] Only role colors are used (`grep -rn "#[0-9a-fA-F]\{6\}" src --include=*.tsx` → no hits outside `content/avatar.ts` and the bean's eye color).
- [ ] Captured in all four themes, light and dark (`SCREENSHOTS=1 pnpm test:e2e screens`).
- [ ] The timer is the most prominent UI element; the scene is the most prominent overall.
- [ ] Labels are readable over the scene at all three crowd sizes.
- [ ] Night mode feels warm, not just dark.
- [ ] The screen would be recognizable as Studyroom with the logo covered.
