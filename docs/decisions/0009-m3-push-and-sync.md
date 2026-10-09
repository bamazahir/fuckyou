# 0009 — M3 build notes: web push and the shared pomodoro

Date: 2026-10-10 · Status: accepted

## Context
M3 adds push notifications (phase end, stopwatch check-in, "room is active") and the room-synced pomodoro (SPEC §6.2.1, §9). The builder asked for M3 right after the M4a scene work (decision 0006). The M2 friendly-alpha gate and the M3 pre-check on a classmate's phone are still builder checks.

## Decisions
1. **Web Push is written on WebCrypto in `supabase/functions/_shared/webpush.ts`:** RFC 8291 aes128gcm encryption plus RFC 8292 VAPID. No `web-push` dependency.
   - `web-push` relies on Node crypto internals that are shaky in Deno.
   - About 150 lines we can read and test are a smaller supply-chain surface.
   - Tests decrypt our output the way a browser does, and verify the VAPID JWT.
2. **Endpoint allowlist (SSRF):** subscriptions are accepted only for FCM, Mozilla, Apple and Windows push hosts. This is enforced in SQL (`private.valid_push_endpoint`), because the Edge Function POSTs to whatever endpoint is stored.
3. **Queue only what can be delivered:**
   - `tick()` and the room-active trigger write rows only for people who have a device subscribed and haven't switched that type off (`profiles.settings.notify`).
   - The Edge Function is woken only when rows are due, so quota is spent only on real pushes.
   - Rows older than 10 minutes (30 for "room is active") are dropped, not sent late.
   - 404/410 responses delete the subscription.
4. **Every push shows a notification**, even if the app is open. iOS revokes subscriptions that receive silent pushes. Notifications are tagged, so a new "Break time" replaces the old one.
5. **Asked at first need:**
   - The first pomodoro start asks once ("Not now" is remembered on the device).
   - Turning on a room's "room is active" toggle asks every time it isn't on yet.
   - On iPhone/iPad outside the Home Screen, an "Add to Home Screen" sheet shows instead.
   - Sign-out deletes this device's subscription.
6. **"Room is active"** follows SPEC §9.5 (opted in, not studying there, not blocked either way, max one per room per 2 hours). The push says "{room} is active / {name} just started studying". It contains nothing a room member couldn't already see.
7. **Shared pomodoro:**
   - The server sets `planned_seconds` to the time left in the focus phase and ignores the client's value.
   - With less than 5 minutes left the dock offers "Join the next focus" and starts automatically when it begins, while the screen is open. The server rejects joins during a break, and joins with under 60 seconds left.
   - Tapping within 5 seconds before a focus starts counts from the tap.
   - The sessions table's planned length range drops from 300 to 60 seconds to allow late joins. The 5–120 minute rule for normal pomodoros moved into `start_session`.
   - Turning sync on, or changing its lengths, restarts the cycle and broadcasts `sync` so open rooms refetch.
   - Lengths offered: 25/5 and 50/10.

## Consequences
- Real delivery (Android Chrome, installed iOS PWA, "room is active" on a second device, two devices showing the same phase within 1 second) can only be checked on devices. Those are builder checks.
- Setup steps for keys and secrets are in the README.
