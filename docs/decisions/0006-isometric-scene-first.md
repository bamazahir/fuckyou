# 0006 — Isometric scene before push (M4a), and how the scene is built

Date: 2026-10-09 · Status: accepted

## Context
After M2 the builder asked to "continue building" and to see the isometric graphics soon. M3 (push and synced pomodoro) is mostly blocked on real-device checks: the pre-check on a classmate's phone, iOS install, and VAPID push on Android/iOS. The M2 friendly-alpha gate (2–3 friends for a week) hasn't run yet, because multiplayer testing hasn't happened.

## Decision
1. **Split M4 and do the scene first.** **M4a** (this change) covers the scene, beans, labels, seats, My Room read-only, the colors-only avatar editor and the WebGL-unavailable fallback. **M3** comes next. **M4b** (the `/admin` metrics page, `ship-audit` with every blocker fixed, then launch) comes after M3. Launch stays gated on all three.
2. **The M2 friendly-alpha gate is deferred, not passed.** The builder runs the alpha alongside M4a and M3 and writes the confusion notes into a decision file before M4b. Agents can't pass it.
3. **All furniture is procedural** (studyroom-look §3, option 1), not Kenney GLBs. Boxes, cylinders and icosahedrons are built in code (`src/scene/items.tsx`), so there's no license risk and 0 KB of models, which is well under the 2 MB budget. Downloading asset packs is also blocked from the build container. GLBs can still come later for shop items (M5), recorded in `docs/ASSETS.md`.
4. **No `@react-three/drei`.**
   - Labels are plain DOM buttons positioned with the pure iso projection (`src/core/iso.ts`), since the camera is fixed.
   - Outlines are an inverted hull grown by a fixed world thickness (`src/scene/parts.tsx`).
   - Dropping drei avoids a large transitive dependency tree (supply-chain surface), for the same result as `<Html>`/`<Outlines>`.
5. **Seats:** only chairs (and floor cushions) are seats. Desks are surfaces, so a desk and its chair don't count as two seats.
6. **Overflow cushions** sit on free cells *in front of the desks*, in rows two cells apart with staggered columns, middle first. The spec put them "along the front edge". This keeps a crowd together, and the camera framing grows gradually instead of jumping to the far edge.
7. **Camera framing** fits the furniture, the people and the back wall behind them, not the whole 8×8 or 12×12 floor. A small group fills the view on a phone, and a crowd zooms out. Starter furniture therefore sits in the back corner, leaving the front floor free for cushions now and decorating in M5.
8. **Labels:** name + timer + state dot, as specified. Where two labels would overlap, the lower-priority one shrinks to a tappable dot (you and the last-tapped person always get a full label). Above 12 people, everyone but those two is a dot.
9. **Wall items:** `rot 0` hangs on the back wall along x (z = 0), `rot 1` on the side wall along z (x = 0). `src/core/grid.ts` validates this; M5's SQL `save_layout` must mirror it.
10. **The personal starter room also has a window**, so it shows the time of day. Layouts aren't saved yet: rooms render the starter layout until M5 adds `save_layout`.

## Consequences
- The scene chunk (three.js + R3F) is about 250 KB gzipped. It's lazy-loaded only on room screens and precached for offline use.
- Headless tests render WebGL with SwiftShader (`playwright.config.ts`). One e2e test forces the 2D fallback.
- The M4 acceptance numbers (≥45 fps with 12 avatars on a mid-range Android) need a real device; they're a builder check.
