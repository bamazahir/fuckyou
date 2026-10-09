# 0012 — M5 build notes: coins, shop and decorating

Date: 2026-10-09 · Status: accepted

## Context
SPEC §6.5, §8.3 and §10 describe coins, the shop, room banks and edit mode. A few details were open; these are the simplest choices, picked while building M5 past the gates (decision 0011).

## Decisions
- **The catalog is one JSON file** (`src/content/catalog.json`), which feeds both sides. `scripts/catalog/generate.mjs` writes the SQL seed into the M5 migration and the layout-parity pgTAP file. A unit test fails when either is stale.
- **Thumbnails are rendered at runtime** from the same procedural models, in a hidden canvas, once per item, theme and light/dark. They are cached as data URLs in memory. This means no image files and no licence entries, and the pictures always match the room. Without WebGL a card shows the item's initial.
- **Starter things are owned, not assumed.** Every account gets the default personal room's six items, and every shared room gets the default shared set. A trigger grants these, with a backfill for existing rows. Edit mode can then treat everything the same way: the tray is what you own minus what is placed.
- **An empty layout means the default layout.** Rooms created before M5 keep `layout = '[]'`, and the client shows `DEFAULT_PERSONAL` / `DEFAULT_SHARED` until the first save. No data migration was needed.
- **Avatar ownership is checked by a trigger on `profiles.avatar`**, not by a new `save_avatar` RPC. The profile update path stays as it was (M4). Wearing a shop accessory you don't own raises `accessory_not_owned`. Starter accessories stay free (decision 0008).
- **Coin maths happens on the server** (`private.session_coins`), with `src/core/coins.ts` as the tested mirror for the estimate in the note sheet.
  - Coins are paid when the note is saved (SPEC §6.5: the note is the "receipt").
  - A void takes the coins back from both your wallet and the room bank. The wallet can go negative; the UI shows 0, and new coins fill the gap first.
- **Room banks fill themselves** with half the minutes studied there (max 360 per member, room and day), when a session completes. **Anyone in the room can donate; only owners and mods can spend.**
- **Who gave what stays private.** Members see the bank total only, not the ledger (migration `20261011100000_m5_bank_privacy`).
- **Placement is tap-first.** The first tap moves the ghost and a second tap on the same cell places it, so phones (no hover) work the same way as desktops. A Place button does the same.
- **Overflow seats** (cushions) are unchanged: when a room has more people than chairs, cushions fill the open floor at render time. They're not catalog items.
- **Visiting** someone's room needs a shared (non-personal) room with them, and no block in either direction.
- **Catalog shape differs from SPEC §8:** the categories are furniture/decor/wall (the spec's `desk` is just furniture), and `layer` (floor/rug/wall) replaces the `wall` boolean, because rugs need their own layer. `my_wallet()` replaces the spec's `my_balance` view, so the cap and today's earnings come back in one call.
- **A room bank can go negative** when a void takes back more than is left. The UI shows 0, and new study time fills the gap first, the same as a personal wallet.
- **Voided coins still count towards today's 720.** A void doesn't hand back earning room for that day. That's simpler, and it can't be gamed.
- **The timezone is fixed at signup** (ship audit, M7): coins are counted per local day, so changing it would reset the cap. A `set_timezone` RPC with a weekly limit can come if someone moves.
- **Saved layouts are normalised** to `{item_id, x, z, rot}` and capped at 16 KB, so a layout can't carry text between members.

## Consequences
- Prices are first guesses (1 coin per focus minute; room things cost 25 to 1500, shop accessories 150 to 400). They need tuning after real use, which is tracked in `docs/OPEN-ITEMS.md`.
- Thumbnails cost a few frames the first time the shop opens on a device. That's acceptable at this catalog size (37 things).
