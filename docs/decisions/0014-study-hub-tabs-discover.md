# 0014 — The study-hub update: five tabs, Discover, moving rooms, all-time stats, 3D only

Date: 2026-10-09 · Status: accepted (the builder asked for each of these)

## Context
After M7 the builder asked for more:
- different bean expressions;
- more room layouts, and custom ones;
- rooms that feel less empty;
- more tabs: all-time stats with graphs, customization, your room, Discover, and a place to hold several rooms ("you can only study in one, but you can move rooms");
- 3D everywhere ("the 2D things aren't good, keep it entirely 3D").

Several of these change SPEC principles:
- "4 primary screens";
- "no public room directory";
- the 2D illustrations.

CLAUDE.md asks for a decision record before adding a directory for minors.

The council run the same day (see chat) advised launching before adding features. The builder chose to build these first. This record holds the safety calls.

## Decisions
- **Navigation is five tabs:** Home · Rooms · My Room · Stats · You.
  - **Rooms** lists every room you're in, with Discover beside it.
  - **Stats** is all-time and private to you.
  - **You** is your 3D bean, customization, theme, notifications and account.
  - The spec's "4 screens" principle is replaced by "5 tabs, each with one job".
- **Discover is opt-in, age-banded and faceless:**
  - **Opt-in:** only a room's owner can list it (`set_room_listed`), and it's off by default.
  - **Age bands:** 13–15, 16–17 and 18+. A listed room is visible only to people in the same band as every one of its members. The owner can't list a mixed-age room (`mixed_ages`). A room that becomes mixed later simply drops out of Discover.
  - **What shows:** only the room's name, member count, studying count and the shared-pomodoro badge. No names, faces or status lines until you join.
  - **Blocks:** anyone who blocked you, or whom you blocked, hides the room from you.
  - **Joining** goes through `join_room`, so the existing checks apply: rate limit, 50-member cap, 20-room cap, bans, consent.
  - **Unchanged:** room names already pass the profanity filter, and there's still no chat. Reports and owner removal work as before.
- **Moving rooms:** `move_session` carries your running session to another room you can study in.
  - The whole session then counts in the new room, which keeps the accounting simple.
  - You can't move into a room running a shared pomodoro, because it has its own clock. You join its next focus instead.
- **All-time stats** come from one server function, `my_stats()`, computed in your timezone:
  - totals, streaks, the last 30 days, a year calendar, time of day, day of week, months and rooms.
  - Streaks and calendar maths live in `src/core/allTime.ts`, with tests.
- **Expressions:** 8 faces, all free, stored as `avatar.expression`. `private.valid_avatar` checks them against the same list as the app.
- **Fuller rooms:**
  - The starter sets grow: 14 things for your own room and 27 for a shared room. Existing accounts and rooms get the difference.
  - There are 3 ready-made layouts per room type, using only starter things.
  - Every room gets free wall and floor finishes (`rooms.style`, `set_room_style`), applied over the theme.
  - The catalog seed generator now writes into the M8 migration. Earlier migrations keep the seed they shipped with.
- **3D only:**
  - The 2D SVG bean and the 2D room illustration are gone.
  - Lists show 3D-rendered bean portraits, rendered on the device and cached like the shop thumbnails.
  - The editor and You page show a live, slowly turning 3D bean.
  - Without WebGL, a short note and the plain member list replace the scene.

## Consequences
- **Discover adds a stranger-contact surface** for minors. It's limited to the same age band, and there's still no chat. The builder should re-check it before any wider rollout; it's added to `docs/OPEN-ITEMS.md`.
- **Moving a session moves all its minutes**, so someone could study in their own room and then move into a shared room to put the time on its board. Moves are rate-limited, and only rooms you're already a member of are allowed. Accepted for v1.
- **Five tabs make a fuller bottom bar on small phones.** It was checked at 320 px.
