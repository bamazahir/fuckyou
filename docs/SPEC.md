# Studyroom — Product & Build Spec (v1)

> Working name. Rename freely; the code uses `APP_NAME` from `src/config.ts`.
> This document is the single source of truth for building v1. Build agents execute it; they do not redesign it.
> Decisions and the reasoning behind them live in `docs/decisions/`. If something here is ambiguous, pick the simplest option, record it in a new decision file, and keep going.

---

## 1. What it is

**One-line pitch (the text you send a friend):**
"Come study in my room — you can see who's studying right now, and the room gets nicer the more we study."

**Product:** A cozy isometric study room you share with friends. Inside each room there is a focus timer, live presence (who is sitting at a desk right now and for how long), room-only leaderboards, and an ambient radio. Study minutes earn coins that decorate your own personal room; the shared room is decorated from a room bank that fills from the room's study time and from donations.

**Core emotional moments (design every screen around these):**
1. **Alone at 2am → proud, not lonely.** If you are the only one in the room, the room says so warmly ("Night owl — you've had the room to yourself for 1h 12m").
2. **Someone sits down → surprise.** When a member joins the room you're in: soft chime + their avatar walks to a desk + toast "Aisha just sat down".
3. **Someone is in there right now → pull.** Room cards show live counts ("3 studying now"); opt-in push "3 people are studying in IB Chem".
4. **Leaving to scroll → caught.** In strict ("phone face-down") rooms, leaving the app on your phone makes your bean stand up, red, in front of your mates, and a short escalating push sequence calls you back (§6.5).

**Principles**
- Unbloated: 4 primary screens (Home, Room, My Room, Profile). No feature gets a 5th screen in v1.
- Comparisons only inside rooms. There is no global leaderboard. Lifetime hours are only visible to people who share a room with you.
- Rooms are self-moderated by the people running them (owner + mods).
- Users are mostly minors: minimum data, no free-text chat, no public room directory, no third-party trackers.

## 2. Users & goals

- **Primary user (v1):** the builder, an IB DP1 student, using it daily.
- **First external users:** IB classmates, invited via room links.
- **Application goal (next cycle, fall 2027):** demonstrable use by people other than the builder. Measured via first-party metrics (§12): weekly active users, D7/D30 retention, total hours studied by others. Plus a decision log (`docs/decisions/`) showing the build → measure → cut loop.

## 3. Scope

### In v1
| # | Feature | Notes |
|---|---|---|
| F1 | Auth + profile | Google or email magic link. Handle + display name. 13+ self-declared. |
| F2 | Focus timer | Pomodoro (default 25/5, long break 15 every 4, all configurable) and Stopwatch. |
| F3 | Rooms | Create, invite link/code, join, leave. Owner/mod/member roles. Honor (default) or Strict ("phone face-down") mode. Optional room-synced pomodoro. |
| F4 | Live presence | Who is in the room, what they're on (status line), live timer over their head. |
| F5 | Room leaderboards | Tabs: Live sitting · This week (in room) · All-time (in room) · Lifetime (members' totals). |
| F6 | Verification | Strict mode (phone sessions): the app must stay visible; desktop sessions in strict rooms run as honor and are labelled unverified. Honor mode: hidden time counts. End-of-session note. Owner can void sessions. |
| F7 | Caught sequence | Strict phone sessions: pushes at 15s, 30s and 50s away, then one "session broke" push. Max 4 per session. |
| F8 | Reactions & nudges | Emote reactions + targeted nudge. No free-text chat. |
| F9 | Isometric rooms | Shared room scene with avatars at desks; personal room. Edit mode to place furniture. |
| F10 | Character | Procedural "bean" avatar: body/skin/hair/top colors + purchasable accessories. |
| F11 | Coins & shop | Earn from completed focus. Spend on personal items, or donate to the room bank. The room bank also fills automatically from the room's study time. |
| F12 | Ambient radio | Built-in stations (lofi, rain, café, brown noise). Room-synced. Now-playing panel + Media Session. |
| F13 | Notifications | Phase-end, honor check-in, strict caught sequence, optional "room is active". Web push. |
| F14 | Privacy, safety & admin | Delete account, export data, privacy page, profanity filter, block + report, builder moderation queue, first-party metrics dashboard. |

### Deferred, and what unlocks each
| Feature | Version | Unlock trigger |
|---|---|---|
| Chrome extension: hard-block TikTok, YouTube Shorts and IG Reels during sessions | v1.5 | v1 launched, and ≥5 weekly users, or your own data shows drift |
| AI "explain yourself" pass for non-short-form sites (inside the extension; short-form is never unlockable) | v1.5 | Ships with the extension. Uses Claude `claude-haiku-5-5` via an Edge Function. |
| Android native (Capacitor) + UsageStats detection of short-form apps | v2 | ≥30 weekly users, or ≥3 users asking |
| iOS native (Capacitor). No app blocking; Screen Time APIs need an Apple entitlement. | v2 | After Android |
| Spotify / Apple Music integration | Not planned | Spotify dev-mode caps apps at ~25 users; Apple Music needs a paid developer account |
| Room chat, public room directory, global leaderboards | Not planned | Safety for minors and the "comparisons only in rooms" principle |

## 4. Platform & stack (fixed — do not revisit)

| Layer | Choice | Why |
|---|---|---|
| App | **Vite + React 18 + TypeScript (strict)** | Fast iteration; web-first |
| PWA | **vite-plugin-pwa** (`injectManifest` strategy, custom `src/sw.ts`) | Installable, offline shell, push handler |
| Native later | **Capacitor** (wraps the same build) | The 3D scene runs unchanged in a WebView; native plugins (UsageStats) can be added |
| 3D / isometric | **three.js via @react-three/fiber + @react-three/drei** | Orthographic camera gives a true isometric look; free rotation and recoloring |
| Styling | **Tailwind CSS** | |
| State | **Zustand** (client state) + Supabase queries in small hooks (no React Query in v1) | |
| Routing | **React Router** | |
| Backend | **Supabase**: Postgres, Auth, Realtime (Presence + Broadcast), Edge Functions (Deno), Cron (pg_cron, sub-minute schedules) + pg_net, Storage | One service, generous free tier |
| Push | **Web Push (VAPID)** via the `web-push` npm package inside an Edge Function | |
| Hosting | **Vercel** (static build) | |
| Tests | **Vitest** (core logic + SQL-free units), **Playwright** (smoke e2e), **pgTAP** via `supabase test db` (RLS + RPCs) | |
| Tooling | pnpm, ESLint, Prettier, GitHub Actions CI | |

Platform limits the product must respect (show them honestly in the UI):
- iOS web push only works when the PWA is **installed to the Home Screen** (iOS 16.4+). Onboarding prompts installation on iOS.
- A web app cannot see other apps. "Distracted" means "the app was not visible", nothing more.
- Strict mode keeps the screen awake with the **Screen Wake Lock API** while a session runs.
- **Strict applies to phone/tablet sessions only** (`matchMedia('(pointer: coarse)')` at session start; Capacitor builds later report the platform directly). On desktop, real study legitimately happens in other tabs (Docs, PDFs, Sheets), so a strict room's desktop sessions run under honor rules with an "unverified · desktop" label. The device class is stored on the session (`device`).

## 5. Screens & UX

Navigation: bottom tab bar on mobile, left rail on desktop. Tabs: **Home · My Room · Profile**. The Room screen is pushed from Home.

### 5.1 Onboarding (first run only, 3 steps)
0. **Invite links show the room first.** `/j/:code` renders a public preview before any sign-in: room name, live count, the beans of who's in right now, and a "Join" button. (Uses `preview_room`, which returns only display names and avatars of present members.)
1. Sign in (Google / email magic link). Checkbox "I'm 13 or older" (required).
2. Pick a handle (unique, 3–20 chars, `[a-z0-9_]`) and a display name.
3. Make your bean: 4 color pickers (preset swatches only) + randomize.

Then land in the invited room (or on **Home**). **There are no permission prompts in onboarding.** The notification permission, and on iOS the "Add to Home Screen to get notifications" sheet, are asked at first need: the first pomodoro start, the first strict session, or turning on "room is active".

### 5.2 Home
- List of room cards: name, mode badge (Strict/Honor), live count ("3 studying now", pulsing dot), your rank this week.
- Buttons: **Create room**, **Join with code**.
- "Solo" entry: study in your personal room (a room with only you; same timer, no leaderboard).

### 5.3 Room (the main screen)
Layout, mobile portrait:
- **Top bar:** room name, mode badge, members-present count, ⋯ menu (invite, settings for owner/mods, leave).
- **Scene (≈55% height):** isometric shared room. Present members' avatars sit at desks, with a floating label above each: name + timer `42:10` + state color (green focusing, blue break, red distracted). Tap an avatar to open a mini profile (status line, this-week minutes, "Visit room", "Nudge", ⋯ "Block" / "Report").
- **Timer dock:** big timer, mode toggle Pomodoro/Stopwatch, optional status line ("HL Chem IA — data analysis", ≤60 chars), Start / Break / End. In rooms with sync pomodoro on, the dock shows the shared cycle instead ("Focus · 12:04 left · 6 of you" / "Break together · 3:10"), and Start joins the current phase (§6.2.1).
- **Bottom sheet tabs (swipe up):** Leaderboard · Radio · Members.
- **Reaction bar:** 👋 🔥 ☕ 💪 🌙. Tapping one shows the emote over your avatar for everyone.

Desktop: the scene takes the left 2/3; the timer dock and tabs are on the right.

Empty and alone states:
- Nobody else present: banner "You've got the room to yourself 🌙 · 1h 12m", plus the night-owl variant between 00:00 and 05:00 local.
- Someone joins: chime (respects mute), toast "{name} just sat down", their avatar walks in.

### 5.4 My Room
Your personal isometric room. Visitors (roommates) see it read-only. Buttons: **Edit** (place, rotate, remove items from inventory), **Shop**, **Avatar**. Coin balance top-right.

### 5.5 Profile / Settings
Stats (lifetime hours, this week, current streak of days studied ≥25 min). Settings: timer defaults, sounds, notification toggles (per type; per room for "room is active"), caught-sequence opt-out, export data, delete account, privacy policy, sign out.

### 5.6 End-of-session sheet
Appears when a focus block ends (or on return after it ended in the background):
- "What did you get done?" Free text, 3–140 chars, private by default. Toggle "show to room".
- Shows minutes focused and, from M5 on, coins earned (hidden before coins exist). Coins are only credited when the note is submitted (within 24h, from History).

## 6. Timer & session rules (the heart — implement exactly)

Terminology:
- **Session** = one focus block (a single pomodoro focus phase, or one stopwatch run). Breaks are not sessions and are not stored.
- **Sitting** = a chain of sessions by the same user in the same room, where each gap is ≤ 20 min. The "Live sitting" leaderboard shows focus minutes in the current sitting. **Assignment (in `start_session`):** reuse the `sitting_id` of the user's most recent session in the same room if that session's status is `completed` and it ended ≤ 20 min ago; otherwise generate a new uuid. A `broken` session always ends the sitting.

### 6.1 Server-authoritative time
The client never sends durations. All timestamps are `now()` on the server, via RPCs (§8.3).

Clients **display** time using a server clock: `serverNow() = Date.now() + offset`, where `offset = server_time − (t0 + t1)/2` from a `server_time()` round trip at load and every 10 min (`src/core/servertime.ts`). Timers, the synced pomodoro and the radio all use `serverNow()`, never raw `Date.now()`.

### 6.2 Lifecycle
```
            start_session()
  (none) ─────────────────► active ──end_session(note)──────────► completed
                              │  ├──server: planned end reached ─► completed (note pending)
                              │  ├──server: strict away > 60s ───► broken
                              │  ├──server: honor check-in missed► completed at check-in due time
                              │  └──server: 4h hard cap ─────────► completed at cap
  owner/mod void_session() on completed|broken ─────────────────► voided
```
- One active session per user. `start_session` ends any previous active session as `completed`.
- **Pomodoro:** `planned_seconds` = focus length. Reaching it completes the session (cron), sends a "Break time" push if the app isn't visible, and the client starts a local break countdown. After the break the client shows "Start next focus" (no auto-start in v1).
- **Stopwatch:** `planned_seconds = null`. The user ends it manually.
- **Hard cap:** 4h per session.

#### 6.2.1 Room-synced pomodoro (room setting, off by default)
- Room fields: `sync_pomodoro`, `sync_focus_s` (default 1500), `sync_break_s` (default 300), `sync_epoch`. Changing the lengths resets `sync_epoch = now()`.
- The current phase is pure math (`src/core/sync.ts`, mirrored in SQL): `t = (now − sync_epoch) mod (focus + break)`. `t < focus` means a focus phase with `focus − t` left; otherwise a break.
- Start during a focus phase: the server sets `planned_seconds` to the time left in the phase. If less than 5 min is left, the client offers "join the next focus in m:ss" instead. Start during a break: the session begins at the next focus phase (the client waits and starts it automatically if the user tapped "join next").
- Breaks are shared: the reaction bar is emphasised during breaks, and nudges are muted during shared focus.
- Stopwatch is unavailable in sync rooms.

### 6.3 Strict mode (room setting; phone sessions only, see §4)
- A session is **verified** when it runs in a strict room on a phone/tablet (`sessions.verified = true`). Desktop sessions in strict rooms are honor sessions with `verified = false`.
- For verified sessions the client calls `session_ping(visible=true)` every **10s** while visible, and `session_ping(visible=false)` immediately on `visibilitychange → hidden` (sent with `fetch(..., {keepalive:true})`).
- The server marks the user **away** when either a hidden ping arrives, or `last_visible_at` is more than **25s** old (the hidden ping was lost, e.g. the OS killed the tab). Then `away_since = last_visible_at`. The ping interval (10s) is always shorter than the stale threshold (25s), so a user looking at the screen is never flagged.
- Away state is published **by the server** (§9), not by the client, because a backgrounded tab's realtime socket dies.
- If away > 60s, the session becomes `broken` with `ended_at = last_visible_at`. Focus seconds count up to that point (leaderboards), but **coins are forfeited** and the sitting ends.
- Returning within 60s (any visible ping): back to focusing. Away time is excluded from `focus_seconds`.
- Wake Lock is requested on start, and re-requested on visibility return.

### 6.4 Honor mode (room setting)
- Hidden time counts. The phone can be locked face-down.
- Pomodoro: completes at the planned end on server time, regardless of pings.
- Stopwatch: every 50 min a check-in is due ("Still studying?" push + in-app button). If no check-in within 10 min, the session completes at the time the check-in was due.
- No caught sequence in honor mode.

### 6.5 Caught sequence (verified strict sessions only)
At most **4 pushes per session**, timed from `away_since`, with escalating copy that uses real people where possible:
1. **+15s:** "Your bean just stood up 👀 Come back to {room}"
2. **+30s:** "{n} people are still studying. 30s until your session breaks"
3. **+50s:** "10 seconds. {name} is still going"
4. **+60s (broken):** "Session broke at {mm:ss}. {name} is still at their desk. Start again?"

- If away was detected late (stale-ping path), send only the most recent due push, never a backlog.
- Returning cancels the remaining pushes. **Nothing is sent after the "broke" push.**
- The user can turn the sequence off in settings (the in-room red bean still happens; that's the real sting).
- No push permission → in-app only (seen on return).

### 6.6 Accounting
- `focus_seconds` = (ended_at − started_at) − away_seconds, clamped to [0, 4h]. The server computes it in `end_session` and in the cron finalizer.
- Strict away intervals are recorded in `session_events` (`hidden` / `visible` with server timestamps). `away_seconds` = the sum of hidden intervals.
- Week boundary: Monday 00:00 in the **room's** timezone (`rooms.tz`, defaulting to the owner's browser TZ at creation). The personal "this week" uses the profile TZ.

### 6.7 Coins
- Earn: **1 coin per focus minute** (floor) for `completed` sessions with a note submitted, **+5** bonus for a completed pomodoro whose planned length was ≥ 20 min.
- Daily earn cap: 720 coins (profile TZ).
- `broken` and `voided` earn 0. Voiding a session that had already paid out writes a negative ledger entry. The balance can go negative and is shown as 0 with a debt note.
- Spending: buy catalog items (personal inventory), or donate any amount to a room bank. Owner/mods buy room items from the bank.
- **Room bank auto-fill:** every `completed` or `broken` session in a shared (non-personal) room adds `floor(focus_minutes / 2)` coins to that room's bank, on top of the member's own earnings (nothing is deducted from the member). Per member per room per day, at most 360 coins. Voiding a session reverses its bank contribution. Recorded in `room_bank_ledger`.

## 7. Rooms, roles, moderation

- Create: name (3–40 chars), mode (**Honor default**; Strict is selectable once M3 ships), tz, sync pomodoro on/off. The creator becomes owner.
- Invite: `https://<host>/j/<invite_code>` (8 chars, base32). Owner/mods can regenerate the code (the old link dies).
- Limits: 50 members per room; 20 rooms per user; 10 rooms created per user (personal rooms excluded). The personal room uses the same timer; its owner picks Strict or Honor.
- Roles: `owner` (1) · `mod` · `member`. The owner can promote or demote mods and transfer ownership.
- Owner/mod actions: remove (ban) a member, void a session (reason required, shown to that member), change mode (applies to new sessions only), rename, regenerate the invite, spend the room bank, edit the room layout.
- If the owner deletes their account, ownership passes to the longest-standing mod, then the longest-standing member. With no members left, the room is deleted.
- Members can leave any time. Their history in the room stays on leaderboards as "former member" (display name hidden, shown as "Former member").
- **Safety above the room owner** (owners are minors too):
  - Any user can **block** another user. Their reactions, nudges and room visits toward you are hidden, and they can't see your personal room.
  - Any user can **report** a member, a room name, a status line/public note, or a void ("unfair void"). Reasons come from a fixed list, plus an optional 140-char note.
  - Reports go to the room owner/mods (if the report isn't about them) **and** to the builder's admin queue (`/admin/reports`).
  - The builder (admin) can remove content, ban a user from the app, or delete a room.
  - Every void is logged with its reason and visible to the affected member; three voids by the same owner against the same member within 7 days auto-files a report.

## 8. Data model (Postgres, `supabase/migrations/`)

All tables have RLS enabled. `uid()` = `auth.uid()`.

### 8.1 Tables
```sql
profiles(
  id uuid pk references auth.users on delete cascade,
  handle citext unique not null check (handle ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null check (char_length(display_name) between 1 and 30),
  avatar jsonb not null default '{}',          -- {colors:{body,skin,hair,top}, accessories:[item_id]}
  tz text not null default 'UTC',
  settings jsonb not null default '{}',        -- timer defaults, notification toggles
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
)

rooms(
  id uuid pk default gen_random_uuid(),
  name text not null check (char_length(name) between 3 and 40),
  owner_id uuid not null references profiles,
  mode text not null default 'honor' check (mode in ('strict','honor')),
  tz text not null,
  sync_pomodoro boolean not null default false,
  sync_focus_s int not null default 1500 check (sync_focus_s between 600 and 5400),
  sync_break_s int not null default 300 check (sync_break_s between 60 and 1800),
  sync_epoch timestamptz not null default now(),
  invite_code text unique not null,
  is_personal boolean not null default false,  -- each profile has exactly one personal room
  station_id text not null default 'lofi',
  layout jsonb not null default '[]',          -- [{item_id, x, z, rot}] see §10
  bank_coins int not null default 0,
  created_at timestamptz not null default now()
)

room_members(
  room_id uuid references rooms on delete cascade,
  user_id uuid references profiles on delete cascade,
  role text not null default 'member' check (role in ('owner','mod','member')),
  banned boolean not null default false,
  notify_active boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
)

sessions(
  id uuid pk default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  room_id uuid not null references rooms on delete cascade,
  sitting_id uuid not null,
  kind text not null check (kind in ('pomodoro','stopwatch')),
  mode text not null check (mode in ('strict','honor')),   -- snapshot of the room mode at start
  device text not null check (device in ('phone','desktop')),
  verified boolean not null default false,                  -- strict room AND phone (§6.3)
  status text not null default 'active' check (status in ('active','completed','broken','voided')),
  status_line text check (char_length(status_line) <= 60),
  planned_seconds int,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  last_visible_at timestamptz not null default now(),
  away_since timestamptz,
  away_seconds int not null default 0,
  next_checkin_at timestamptz,                  -- honor stopwatch
  last_ping_hidden boolean not null default false,
  nags_sent int not null default 0 check (nags_sent between 0 and 4),
  focus_seconds int,
  note text check (char_length(note) between 3 and 140),
  note_public boolean not null default false,
  coins_paid boolean not null default false,
  void_reason text
)
-- indexes: (user_id) where status='active' unique; (room_id, started_at); (status) where status='active'

session_events(id bigserial pk, session_id uuid references sessions on delete cascade,
               type text check (type in ('hidden','visible','checkin')), at timestamptz default now())

catalog_items(id text pk, name text, category text check (category in ('furniture','decor','desk','accessory')),
              price int, footprint_w int, footprint_d int, wall boolean default false,
              model text, seat boolean default false)        -- seeded from src/content/catalog.json

inventory(user_id uuid references profiles on delete cascade, item_id text references catalog_items,
          qty int not null check (qty >= 0), primary key (user_id, item_id))
room_inventory(room_id uuid references rooms on delete cascade, item_id text references catalog_items,
               qty int not null check (qty >= 0), primary key (room_id, item_id))

coin_ledger(id bigserial pk, user_id uuid references profiles on delete cascade, delta int not null,
            reason text check (reason in ('session','bonus','purchase','donate','void','admin')),
            ref uuid, created_at timestamptz default now())
-- balance = sum(delta); exposed via view my_balance

room_bank_ledger(id bigserial pk, room_id uuid references rooms on delete cascade,
                 user_id uuid references profiles on delete set null, delta int not null,
                 reason text check (reason in ('study','donate','purchase','void')),
                 ref uuid, created_at timestamptz default now())
-- rooms.bank_coins is maintained from this ledger by trigger

push_subscriptions(id bigserial pk, user_id uuid references profiles on delete cascade,
                   endpoint text unique, p256dh text, auth text, created_at timestamptz default now())

notify_queue(id bigserial pk, user_id uuid references profiles on delete cascade,
             kind text check (kind in ('caught','phase_end','checkin','room_active')),
             payload jsonb not null, send_after timestamptz not null default now(),
             sent_at timestamptz, created_at timestamptz default now())
-- filled by tick() and by an AFTER INSERT trigger on sessions (room_active); drained by the `push` Edge Function

blocks(blocker_id uuid references profiles on delete cascade, blocked_id uuid references profiles on delete cascade,
       created_at timestamptz default now(), primary key (blocker_id, blocked_id))

reports(id bigserial pk, reporter_id uuid references profiles on delete set null,
        target_type text check (target_type in ('user','room','status_line','note','void')),
        target_id text not null, room_id uuid references rooms on delete set null,
        reason text check (reason in ('harassment','inappropriate_name','cheating','unfair_void','other')),
        note text check (char_length(note) <= 140),
        status text not null default 'open' check (status in ('open','actioned','dismissed')),
        created_at timestamptz default now())

events(id bigserial pk, user_id uuid references profiles on delete set null,
       name text not null, props jsonb default '{}', at timestamptz default now())
-- retention: delete rows older than 400 days (cron daily)
```

### 8.2 RLS summary
- `profiles`: select own row, plus rows of users who share a non-banned room with you (view `visible_profiles` exposes only id, handle, display_name, avatar). Update own row, except `is_admin`.
- `rooms`: select if you're a non-banned member, or by `invite_code` through the `preview_room(code)` RPC only. Personal rooms: selectable by anyone sharing a room with the owner (for visiting). Writes only through RPCs.
- `room_members`: select rows of rooms you're in. Writes via RPC.
- `sessions`: select own rows, plus rows in rooms you're a member of (note visible only if `note_public` or own). **No direct insert/update** — RPC only.
- `coin_ledger`, `inventory`: own only, read-only; writes via RPC.
- `events`: insert own; select only `is_admin`.
- `push_subscriptions`, `blocks`: own only.
- `reports`: insert own. Select: admin, plus owner/mods of `room_id` (except reports targeting themselves).
- `room_bank_ledger`: select by members of the room; writes via RPC/trigger only.
- `notify_queue`: no client access (service role only).

### 8.3 RPCs (`security definer`, each validates membership/role)
```
create_room(name, mode, tz) -> room
preview_room(code) -> {id, name, member_count, mode}
join_room(code) -> room              -- rejects banned, full, or over the user's room limit
leave_room(room_id)
regen_invite(room_id) -> code                        -- owner/mod
set_room(room_id, name?, mode?, station_id?, sync_pomodoro?, sync_focus_s?, sync_break_s?)   -- owner/mod
set_role(room_id, user_id, role)                     -- owner
remove_member(room_id, user_id)                      -- owner/mod; sets banned
transfer_ownership(room_id, user_id)                 -- owner

server_time() -> timestamptz
room_live(room_id) -> [{user_id, display_name, avatar, state:'focus'|'break'|'distracted', session_started_at, planned_seconds, away_since, verified, status_line}]
   -- the source of truth for who is studying (active sessions); see §9

start_session(room_id, kind, device, planned_seconds?, status_line?) -> session
   -- sets verified, sitting_id (§6), and in sync rooms planned_seconds (§6.2.1)
session_ping(session_id, visible bool) -> {status, away_seconds}
checkin(session_id)
end_session(session_id) -> session
submit_note(session_id, note, public bool) -> {coins_awarded}   -- within 24h of ended_at
void_session(session_id, reason)                                 -- owner/mod of session.room

leaderboard(room_id, tab text) -> [{user_id, display_name, avatar, seconds, rank, is_present}]
   -- tab: 'live' | 'week' | 'alltime' | 'lifetime'
   -- live: members with an active or <20-min-gap sitting, sum focus in the current sitting (active sessions count elapsed minus away)
   -- week/alltime: sum focus_seconds of completed+broken sessions in this room
   -- lifetime: sum over all rooms for current members
   -- fairness: in a STRICT room every tab (incl. lifetime) counts only verified sessions by default;
   --   optional param include_unverified=true shows all, with unverified minutes marked.
   --   In an HONOR room all non-voided sessions count. Personal rooms never contribute to a strict room's lifetime.

buy_item(item_id, qty) ; donate(room_id, amount) ; room_buy_item(room_id, item_id, qty)
save_layout(room_id, layout jsonb)    -- validates each item is owned and placements are within the grid with no overlap (shared helper mirrored in SQL)
save_avatar(avatar jsonb)             -- validates accessories are owned
log_event(name, props)
block_user(user_id) ; unblock_user(user_id)
report(target_type, target_id, room_id?, reason, note?)
admin_resolve_report(id, action) ; admin_ban_user(user_id) ; admin_delete_room(room_id)   -- is_admin only
delete_my_account() ; export_my_data() -> jsonb
```

## 9. Realtime & background jobs

**Realtime channels** (Supabase Realtime):
- **Who is studying comes from the server, not from presence.** The room view renders the result of `room_live(room_id)`: fetched on open, every 15s, and immediately on any `state` broadcast. A user whose phone is backgrounded therefore still appears at their desk, as **distracted**, even though their socket is gone.
- `room:{id}` **Presence**: only adds "online now" (members who have the room open but no active session), plus the join chime/toast. Payload `{user_id}`.
- **Server broadcasts:** `tick()` and the session RPCs publish `state {user_id, state}` to `room:{id}` on every transition (focus, break, distracted, back, broken, ended) using Supabase Realtime's database broadcast (`realtime.send`).
- `room:{id}` **Broadcast**: `reaction {from, emoji}`, `nudge {from, to}`, `joined {user_id}`. Client-side rate limit: 1 per 3s per sender.
- Postgres changes are not used (they cost too much and RLS makes them complex). Leaderboards refetch on session end events and every 60s while open.

**Cron: pg_cron runs the SQL function `tick()` every 10 seconds.** All transitions happen in SQL. Pushes are written to `notify_queue`, and `tick()` calls the Edge Function `push` via pg_net **only when the queue has unsent rows** (so there are no Edge invocations when nothing is due).
1. **Away detection** (verified sessions): `away_since is null and (last_ping_hidden or last_visible_at < now() - 25s)` → `away_since = last_visible_at`; broadcast `distracted`.
2. **Caught sequence:** for away sessions, enqueue the push whose time (`away_since + 15s / 30s / 50s`) has passed and whose index is greater than `nags_sent`. Only the latest due one; set `nags_sent` (§6.5).
3. **Break:** away > 60s → `broken`, `ended_at = last_visible_at`, compute focus, enqueue push #4, broadcast `broken`.
4. **Pomodoro end:** planned end reached → `completed`, compute focus, enqueue "Break time ☕" (skipped if a visible ping arrived in the last 15s; the open client handles it), broadcast `break`.
5. **Honor check-in:** `next_checkin_at <= now()` → enqueue "Still studying?" once, then a 10-min window; if missed → complete at `next_checkin_at`.
6. **4h cap.**
7. **Room is active:** not done by the tick. An `AFTER INSERT` trigger on `sessions` enqueues `room_active` rows for members with `notify_active = true` who aren't currently studying in that room and haven't had one for that room in the last 2h (and who haven't blocked the starter). The tick only drains the queue.

`push` Edge Function: authenticated by a shared secret header (set in Vault, sent by pg_net), sends Web Push with VAPID, marks rows `sent_at`, deletes subscriptions that answer 404/410.

Daily cron: purge `events` older than 400 days; purge `notify_queue` rows older than 7 days.

Every transition is idempotent: `UPDATE ... WHERE status = 'active' AND <condition> RETURNING`.

## 10. Isometric scene

- Renderer: `<Canvas orthographic frameloop="demand" dpr={[1, 1.5]}>`. Camera: isometric (position `(10,10,10)` looking at the origin, zoom fitted to the room). Lighting: one hemisphere + one directional light with soft shadows (shadows off on low-end devices: `navigator.hardwareConcurrency <= 4`).
- Grid: personal room 8×8; shared room 12×12. Cell = 1 world unit. Walls on the back two edges (wall items snap to wall slots).
- Layout item: `{item_id, x, z, rot}` (`rot ∈ {0,1,2,3}` quarter turns). The footprint rotates with `rot`. Overlap and bounds validation lives in `src/core/grid.ts` (pure, tested) and is mirrored in SQL by `save_layout`.
- Edit mode: tap inventory item → ghost follows pointer, snapped to the grid (red if invalid) → tap to place; selected item: rotate / move / return to inventory. Save is explicit.
- **Seats:** catalog items with `seat=true` (desks, chairs, cushions) expose a seat anchor. Present members are assigned seats in join order. Overflow members sit on auto-placed floor cushions along the front edge.
- Avatar labels: drei `<Html>` with name + timer + state dot; hidden when more than 12 are present (show on tap instead).
- **Avatar ("bean"):** procedural capsule body + sphere head + hair cap mesh, four color slots, eyes as small spheres. Built in code (`src/scene/Bean.tsx`) with zero asset dependency. Accessories (hat, glasses, headphones, scarf) are small GLBs or procedural meshes attached to a head anchor. Idle animation: gentle bob; focusing: "writing" bob; distracted: turns away + red "!" bubble; break: holds a mug.
- **Assets:** low-poly CC0 furniture GLBs (candidate: Kenney "Furniture Kit", CC0 — verify the license in M4 and record it in `docs/ASSETS.md`). Compress with `gltf-transform` (Draco/meshopt). Budget: ≤ 2 MB of models for the default room. Lazy-load the shop catalog models.
- Default content: the starter personal room has a desk, chair, rug, lamp and plant. The starter shared room has 4 desks + 4 chairs, a rug, a bookshelf and a window. Catalog v1: ~40 items (≈30 furniture/decor, ≈10 accessories) in `src/content/catalog.json` with prices 20–1500 coins.

## 11. Ambient radio

- Stations are defined in `src/content/stations.json`: `{id, name, emoji, tracks:[{title, artist, src, duration_s, license, source_url}]}`. v1 stations: Lofi, Rain, Café, Brown noise, Silence.
- Audio files are in Supabase Storage (public bucket), Opus/AAC at ~96 kbps. **Every track must be CC0 or explicitly licensed for in-app streaming.** Record each in `docs/ASSETS.md`; reject anything with a non-commercial or no-redistribution clause.
- **Room sync = radio model:** position = `(serverNow() - STATION_EPOCH) mod total_duration` (§6.1 server clock; never raw `Date.now()`). Everyone in the room hears the same track at the same point without a server. Owner/mods pick the room station. Each listener controls their own volume/mute. In your personal room you pick the station.
- Now-playing panel: cover (station art), title, artist, progress, volume, mute; also a compact pill in the timer dock.
- `navigator.mediaSession` metadata + play/pause handlers, so the lock screen shows now-playing.
- Playback starts only from a user gesture (autoplay rules).

## 12. Metrics (first-party only)

`log_event` names (no other events; props must contain no free text):
`signup`, `onboarding_done`, `room_created`, `room_joined`, `session_started{kind,mode}`, `session_completed{kind,mode,focus_min}`, `session_broken`, `caught_push_sent{n}`, `note_submitted`, `reaction_sent`, `nudge_sent`, `item_bought`, `donated`, `push_enabled`, `pwa_installed`, `app_open`, `report_filed`, `user_blocked`.

Admin page `/admin` (`is_admin` only): WAU/DAU (users with ≥1 completed session), D1/D7/D30 retention by signup week, hours studied per week (excluding the admin), sessions per user per week, strict vs. honor mix, broken-session rate. A CSV export button. These charts are the application evidence.

## 13. Privacy & safety (non-negotiable)

- Collected: email (auth only, never shown), handle, display name, avatar, timezone, sessions, optional notes, coins, push endpoints, the events above. **No** real name, birthday, location, contacts or analytics SDKs.
- Age gate: self-declared 13+. Under-13 → blocked with a friendly message. **Accepted risk** (decision 0002): some countries set the digital-consent age at 16. Revisit before any school-wide rollout or before inviting users outside the builder's own school.
- No free-text visible to others except display name, handle, room names, status line and public notes. All of these pass a small profanity filter (`src/core/filter.ts`, word list) and length limits. Owners/mods remove offenders.
- No public room directory. Rooms are reachable only via invite.
- Self-serve **Delete account** (hard delete, cascades) and **Export my data** (JSON).
- A privacy page in plain language (`/privacy`) covering what is collected, why, retention and deletion. No ads, no selling data.
- Block + report for every user, plus the builder's moderation queue (§7).
- **Application evidence uses aggregates only** (counts, hours, retention curves), never names or notes. The privacy page says so in plain words.
- If ever rolled out through a school: talk to the school first (their data policy applies). That's out of scope for v1.

## 14. Repo layout

```
/
├─ CLAUDE.md                     # agent rules (short)
├─ docs/SPEC.md                  # this file
├─ docs/decisions/NNNN-*.md      # decision log (ADR-lite)
├─ docs/ASSETS.md                # every 3D model / audio file + license + source
├─ index.html, vite.config.ts, tailwind.config.ts, tsconfig.json
├─ public/ (icons, manifest assets, models/)
├─ src/
│  ├─ main.tsx, App.tsx, config.ts, sw.ts
│  ├─ core/         # PURE TS, no React/Supabase imports, 100% unit tested
│  │   timer.ts (pomodoro/stopwatch state machine), accounting.ts, coins.ts,
│  │   grid.ts, radio.ts, sync.ts (shared pomodoro cycle), servertime.ts, week.ts,
│  │   filter.ts, leaderboard.ts (formatting/ranking), caught.ts (nag schedule)
│  ├─ lib/          # supabase.ts, push.ts, wakelock.ts, visibility.ts, events.ts
│  ├─ stores/       # zustand: session.ts, room.ts, ui.ts
│  ├─ features/     # auth/ onboarding/ home/ room/ timer/ leaderboard/ radio/
│  │                # myroom/ shop/ avatar/ profile/ admin/ privacy/
│  ├─ scene/        # Canvas setup, IsoCamera, Room, Item, Bean, Seats, EditMode
│  └─ content/      # catalog.json, stations.json, copy.ts (all user-facing strings incl. nag copy)
├─ supabase/
│  ├─ migrations/   # 0001_init.sql ... (tables, RLS, RPCs, tick(), cron)
│  ├─ functions/push/index.ts (drains notify_queue)
│  ├─ tests/        # pgTAP: rls.sql, sessions.sql, coins.sql, rooms.sql
│  └─ seed.sql      # catalog seed + demo users for local dev
├─ e2e/             # Playwright smoke tests
└─ .github/workflows/ci.yml, keepalive.yml (§18)
```

## 15. Milestones (each = one or more agent tasks; each ends with green CI + deploy)

Gates are real: don't start the next milestone until the gate is met. **Agents cannot pass a gate or a device test.** When a milestone reaches its gate or needs real-device verification, the agent stops and hands back to the builder with a checklist (see CLAUDE.md).

**M0 — Skeleton (½ day)**
Vite+React+TS+Tailwind+Router, vite-plugin-pwa with manifest + icons, ESLint/Prettier, Vitest, Playwright, CI (typecheck, lint, unit, build), local Supabase via CLI, Vercel deploy, `config.ts`, empty tab shell, `keepalive.yml` (§18).
*Accept:* the deployed URL is installable as a PWA; CI is green.

**M1 — Auth + solo timer + history**
Migrations for profiles, rooms (personal), sessions, session_events, events. Auth + onboarding steps 1–3. Personal room auto-created on signup (trigger). `core/timer.ts`, `core/accounting.ts`, `core/servertime.ts` with tests. RPCs `server_time`, start/ping/end/submit_note (sitting assignment per §6). Timer dock UI (pomodoro + stopwatch), end-of-session sheet (minutes only; no coins UI yet), history list in Profile. `tick()` steps 4, 5, 6 (queue rows are written but not sent until M3). `log_event` from day one, so evidence accumulates.
*Accept:* pgTAP proves the client can't write durations; refreshing mid-session resumes correctly; a pomodoro completes server-side with the tab closed.
*Gate:* the builder uses it on 3 separate days.

**M2 — Rooms, live state, leaderboards, reactions, privacy & safety basics**
Room tables/RPCs + RLS tests. Home room cards with live counts. Invite flow with the **public room preview before sign-in** (§5.1). Room screen as a **2D members view** (desks as cards; the isometric scene comes in M4) driven by `room_live` + server `state` broadcasts + presence for "online now". Join chime + toast, alone/night-owl banner, the 4 leaderboard tabs with the fairness rules (§8.3), reactions + nudges, owner/mod tools (remove, void, regen invite, roles). Rooms are honor-only at this point. **Privacy & safety basics:** `/privacy`, delete account, export data, the profanity filter on every public text field, block + report, and `/admin/reports`.
*Accept:* two browsers see each other's state change within 2s; leaderboard numbers match the SQL tests; the deletion test leaves no rows referencing the user.
*Gate (friendly alpha):* 2–3 trusted friends use a room for one week, and the builder writes down what confused them (a decision file).

**M3 — Push, strict phone mode, caught sequence, synced pomodoro**
Push subscription flow (permission at first need; iOS install sheet), VAPID keys, `push` Edge Function, queue draining. Phase-end, honor check-in and "room is active" pushes. Strict mode for phone sessions: `device` detection, 10s pings, hidden pings, away/broken transitions, server `distracted` broadcast, the 4-push caught sequence (`core/caught.ts`), the "unverified · desktop" label, Wake Lock. The strict option in room settings. Room-synced pomodoro (§6.2.1, `core/sync.ts`).
*Accept (builder on real devices):* on Android Chrome and an installed iOS PWA, leaving the app during a strict session shows you red to a second device within ~25s and delivers pushes at about 15/30/50s, then "broke" at 60s; returning at 40s keeps the session with 40s away; nothing arrives after "broke". A desktop session in a strict room shows as unverified. Two devices in a sync room show the same phase within 1s.
*Pre-check:* before building M3, test on one classmate's actual phone (school-managed?) that PWA install and notifications work.

**M4 — Isometric scene + bean avatars → LAUNCH**
Asset spike (licenses → `docs/ASSETS.md`), `scene/` with camera, grid, items, seats, bean + state animations (incl. stand-up-red when distracted) + labels. The Room screen swaps the 2D view for the scene (the list stays in the Members tab). My Room read-only. Avatar editor (colors only). WebGL-unavailable fallback to the 2D view. The `/admin` metrics page (§12), so launch data is visible from day one. Run `ship-audit` and fix all blockers.
*Accept:* 12 avatars render at ≥45 fps on a mid-range Android; the default room is under 2 MB of models; ship-audit verdict is SHIP.
*Launch:* invite ~8 classmates.
*Gate:* ≥5 of the 8 invitees each complete ≥3 sessions in their second week. **If the gate fails:** stop building. Interview 5 people, write the findings into a decision file, and fix the top reason before M5.

**M5 — Coins, shop, decorating**
Coin earning from notes (incl. daily cap and void reversal), room bank auto-fill + donations (`room_bank_ledger`), `catalog.json` + seed, shop, inventory, edit mode for the personal room, owner/mod room purchases + shared room edit mode, accessories on avatars, visiting roommates' personal rooms (respecting blocks). Coins appear in the end-of-session sheet.
*Accept:* `core/grid.ts` and the SQL `save_layout` reject the same invalid layouts (shared test vectors in `src/core/__fixtures__/layouts.json`); coin and bank pgTAP tests pass.
*Gate:* 2 weeks after release, WAU and D7 are recorded against the pre-M5 numbers in a decision file.

**M6 — Ambient radio**
stations.json, licensed tracks uploaded, radio sync on `serverNow()`, now-playing panel + pill, Media Session, owner station picker.
*Accept:* two devices in the same room play the same track within 1s of each other.
*Gate:* same 2-week WAU/D7 check as M5.

**M7 — Polish**
Empty/error/offline states everywhere, performance pass, app icon + splash (`web-asset-generator`), accessibility pass (`web-design-guidelines`), a full `ship-audit`.
*Accept:* Lighthouse PWA installable; ship-audit has no blockers or highs.

**v1.5 — Extension + AI pass** (gets its own spec when unlocked): MV3 Chrome extension using `declarativeNetRequest` that pairs to the account (one-time code). It blocks short-form URL patterns during any active session. Other entertainment sites show an interstitial where you explain yourself; an Edge Function calls `claude-haiku-5-5` and returns allow (10-min pass) or deny with a one-line reason. Decisions are logged to the room as "used a pass" (no content shared). With the extension installed, desktop sessions in strict rooms can count as verified.

**v2 — Native** (gets its own spec when unlocked): Capacitor Android + iOS builds, native push, an Android UsageStats plugin for short-form detection.

Rough timeline (DP1, part-time; expect slips, especially iOS push in M3): M0–M2 by late November 2026 · M3 by mid-December · M4 + launch by late January 2027 · M5–M6 February–March · M7 April · v1.5 after that · metrics accumulate through the fall 2027 applications.

## 16. Definition of done (every task)

- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` pass; `supabase test db` passes when SQL changed.
- New pure logic lives in `src/core/` with unit tests.
- No direct table writes from the client for sessions, coins, inventory, membership, bank or layout.
- User-facing strings live in `src/content/copy.ts`.
- Anything needing a real device or real users is listed under "Builder checks" in the hand-back, not claimed as done.
- If a decision deviated from this spec, add `docs/decisions/NNNN-title.md` (context, decision, why, date).

## 17. Open questions (decide later; defaults apply until then)

1. App name (default "Studyroom").
2. Caught-sequence timings (15/30/50/60s). Tune after M3 dogfooding.
3. Coin prices, the 720/day cap and the bank auto-fill rate (½ coin per focus minute). Tune after M5 with real earn rates.
4. Whether "Former member" history should be purgeable by the room owner.
5. Free vs. paid Supabase at launch (§18).

## 18. Operations

- **Free-tier pausing:** Supabase pauses inactive free projects (check the current policy when setting up). The 10s cron may not count as activity. `keepalive.yml` (GitHub Actions, daily) calls a `health()` RPC through the public API. Exams and summer will still have low traffic, so decide before launch whether to move to the paid plan, which also adds daily backups.
- **Quota math** (re-check against current limits at M0 and M4): `tick()` is pure SQL (8,640 runs a day, no Edge cost). The `push` Edge Function only runs when pushes are due. Realtime: one channel per open room, with concurrent connections ≈ users with the app open. Database: sessions ≈ 10 rows per user per day, so 50 users ≈ 180k rows a year (small).
- **Backups:** on the free plan, a monthly manual `supabase db dump`, stored encrypted on the builder's machine (it contains minors' data; never commit it or upload it to CI artifacts).
- **Secrets:** VAPID private key and the push shared secret in Supabase Vault / Edge secrets; only the anon key and URL reach the client.
