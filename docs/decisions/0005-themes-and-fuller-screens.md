# 0005 — Consistent color system, themes, fuller screens

Date: 2026-10-09 · Status: accepted (builder feedback during M2)

## Feedback
"Make the color scheme more consistent and have multiple themes; the interface looks a bit empty."

## Decision
- **Semantic color roles** replace the raw palette in components: bg, surface, ink, muted, line, accent, nav, good/rest/danger, plus the scene roles. One generator (`scripts/design/themes.mjs`) produces `src/styles/themes.css` and the picker previews. It enforces text contrast for every theme and mode.
- **Four themes**, each light + dark, plus Auto (by local time, so the lamp-lit 2am room survives):
  - Lamplight (default)
  - Library
  - Blossom
  - Observatory (dark cards)
- Each theme has its own wallpaper pattern. The choice is stored in `profiles.settings`, plus localStorage before sign-in.
- **Fuller screens:**
  - An illustrated 2D `RoomScene` (window with the real sky, shelf, plant, lamp that glows when someone studies, beans at the desk) heads Home, solo/shared rooms and the invite preview, until the isometric scene (M4).
  - Home: a today / this week / streak strip, room cards with stacks of who's studying, actions beside the heading.
  - Shared room: drawn desks with live timers, free desks filling the row, a reactions row.
  - Profile: a 7-day focus chart (single series, today labeled), the theme picker, an account section.
- Desktop content width raised to `max-w-5xl` so rooms use two columns.

## Why
A mix of raw colors (brown tab bar on a blue wall) made screens feel stitched together. Roles make every surface agree, and themes become cheap to add.
