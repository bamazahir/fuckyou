# 0007 — Chibi avatars with hairstyles (replacing the bean)

Date: 2026-10-09 · Status: accepted

## Context
The builder didn't like the bean in either 2D or 3D. It read as a featureless pill. I rendered three directions in the room style: chibi, mochi blob and blocky. The builder picked **chibi** and asked for hairstyles.

## Decision
- **Character:** a chibi kid. Big round head (r 0.27), small body (hips + top), stubby capsule arms and legs, shoes, eyes with a highlight, blush and a small smile. The four color slots stay the same (skin, hair, top, body = trousers).
  - **3D** (`src/scene/Bean3D.tsx`):
    - Sits on a chair or a floor cushion.
    - Writing arms and a bowed head while focusing; holds a mug and takes the odd sip on a break; looks around when idle.
    - Walks in standing up, swinging arms and legs, then sits.
    - Respects reduced motion.
  - **2D** (`src/components/Bean.tsx`): the same design as a flat SVG with 3.5px ink lines, for cards, leaderboards, the editor and the 2D fallback.
- **Hairstyles:** short, long, curly and bun, stored as `avatar.hair` in the existing `profiles.avatar` jsonb.
  - Missing means short, so existing avatars keep working.
  - SQL `valid_avatar` now rejects unknown values (migration `20261009100000`, pgTAP `04_m4_avatar`).
  - This is a cosmetic choice, not new personal data; the privacy page line says "colors and hairstyle".
- **Face colors:** eye, shine, blush and shoe are character-art constants in `src/content/avatar.ts` (the studyroom-look exception for character art).
- **Code names:** the component names (`Bean`, `Bean3D`) stay, to avoid churn. The spec's "bean" now means this character.

## Consequences
- More meshes per avatar: about 30 including outlines, up from about 8. With 12 people that's still under ~800 draw calls including furniture. The 45 fps check on a mid-range Android phone remains a builder check; if it misses, merge the static parts per avatar.
- **Apply the new migration to the hosted database** (`supabase db push`). Until then the editor still saves (the old check allows extra keys), but unknown values aren't rejected.
