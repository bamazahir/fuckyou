# 0008 — Starter outfits and accessories (before the M5 shop)

Date: 2026-10-09 · Status: accepted

## Context
The builder asked for accessories and clothing styles now. The spec has accessories arrive as shop items bought with coins in M5.

## Decision
- **A free starter wardrobe, available to everyone now:**
  - Tops: tee, hoodie, stripes, collar.
  - Bottoms: trousers, shorts, skirt.
  - Six accessories: beanie, cap, bow, glasses, headphones, scarf. One per slot (head, face, ears, neck), so at most one hat.
- **A fifth color slot, `accent`,** colors the accessories and the stripes. It's optional; older avatars get a default.
- **Storage:** all of it lives in the existing `profiles.avatar` jsonb (`outfit`, `accessories`, `colors.accent`).
  - SQL `valid_avatar` checks every value, one hat at most, and no duplicates (migration `20261009110000`, pgTAP `04_m4_avatar`).
  - These are cosmetic choices, not personal data.
- **M5 shop:** sells *more* items on top of this set. The starter set stays free. When inventory arrives, `valid_avatar` (or `set_avatar`) has to allow catalog accessories only if they're owned.
- **Editor:** split into **Style** and **Colors** tabs, so it stays short on a phone.

## Consequences
- More meshes per avatar again: hats, glasses and the scarf add up to ~10. The mid-range Android fps check stays a builder check.
- Apply both new migrations to the hosted database (`supabase db push`).
