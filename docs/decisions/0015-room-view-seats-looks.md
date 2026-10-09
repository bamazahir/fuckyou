# 0015 — Turning the room, picking a seat, and room looks

Date: 2026-10-09 · Status: accepted

## Context
The builder asked to interact with the 3D room ("changing chair, moving around"), for more room layouts and aesthetics, and reported that the top of the app looked blurred on an iPhone.

## Decisions
- **Blurred top on iPhone.**
  - The `theme-color` meta now matches the page background, not the dark nav bar.
  - An opaque strip in the page colour covers the status-bar area (`env(safe-area-inset-top)`), so nothing scrolls under the clock.
  - This is our best guess at the cause: Safari's frosted top edge tinted with the old nav colour, plus `black-translucent`. Only a real iPhone can confirm it (builder check).
- **Turning and zooming the room (view only, per device, not saved).**
  - **Turning:** quarter turns with the ⟲ ⟳ buttons or a sideways swipe. The two walls nearest the camera are cut away, so you always see in. Wall things only hang on the north and west walls, so they hide when their wall is cut away.
  - **Zooming:** pinch or the + − buttons, up to 3×. Dragging while zoomed moves around. The view can't leave the fitted room (`viewFrame`).
  - **Motion:** the camera eases while turning; people's labels hide until it settles. With reduced motion it jumps.
  - **Decorating** always uses the plain view, because its tap surfaces sit on the north and west walls.
- **Picking a seat.**
  - Tap an empty chair, or press ⇄ ("next free chair"); the ⇄ button is the keyboard and screen-reader way.
  - Cushions aren't offered: they only appear for overflow.
  - Your bean walks to the new seat.
  - **Shared rooms:** the seat is kept on your membership (`room_members.seat`, 0–63, an index into `seatList`), so it lasts between sessions and everyone sees it through `room_live`.
    - It's set only through `choose_seat`, which is rate-limited, takes a lock per room, and is refused (`seat_taken`) while someone else is studying in that chair.
    - You must be in the room (studying, or on a break) to pick a seat.
  - **Your own room:** the seat is kept on the device (localStorage), like its radio station (0013). Nobody else sees it.
  - **Layout changes:** if the room's layout changes, a saved index may point at a different chair, and two people can end up wanting the same one. The scene then seats people in join order and the later one gets a free chair. This is simpler than re-mapping indices, and nothing breaks.
  - **Personal data:** the seat is a chair number, shown only to people in the room. The privacy page now mentions it, in both the shared-room and on-device lines.
- **Room looks.**
  - Ten one-tap looks (a wall and floor pair) in the decorator, plus three new wall finishes (butter, forest, charcoal) and two new floors (ash, ebony).
  - `private.valid_room_style` is replaced with the longer lists; a unit test reads the newest migration that defines it.
- **More layouts.** "Centre desk" and "Lounge" for your room; "Classroom" and "Four corners" for shared rooms. Like the others, they use only the starter things, and every shared template still seats 4 at desks and a crowd of 12.

## Consequences
- Migration `20261014000000_m9_seats_looks` must be pushed. Until then, choosing a seat in a shared room shows "needs a database update", and the new finishes can't be saved.
- `room_live` was dropped and recreated with a new `seat` column. Old clients ignore it.
- Device checks are added to `docs/OPEN-ITEMS.md`.
