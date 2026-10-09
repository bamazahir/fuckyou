# 0010 — Calls from the M4 ship audit

Date: 2026-10-10 · Status: accepted

Calls made while fixing `docs/audits/2026-10-10-M4.md`:

- **Per-room "room is active" toggles live in each room's ⋯ menu, not in Profile.** You decide in the room you're looking at. Profile holds the device switch and the per-type toggles (break time, check-ins). SPEC §5.5's "per room" requirement is met in the room.
- **Extra event props are allowed** when they are a boolean or a short enum and never free text: `session_started.sync`, `app_open.standalone`, `signup.consent`. They answer "how many use shared pomodoros / the installed app" without new events.
- **`reaction_sent` and `nudge_sent` are client-logged, so they can be forged.** This is accepted: the application metrics (WAU, hours, retention) come only from server-side sessions, never from these counts.
- **`start_session` is limited to 30 per 10 minutes per account.** Real use is far below that. Without the limit, each start could notify a whole room.
- **The push function forgets a device only on 404/410.** A 403 usually means our VAPID setup is wrong, and treating it as "gone" would silently unsubscribe everyone.
