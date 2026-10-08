# 0001 — Concept, scope and stack (council + grilling)

Date: 2026-10-08 · Status: accepted

## Context
Raw idea: a study app with a pomodoro/stopwatch, music sync with a now-playing screen, short-form-content hard lock with notification spam and an AI "explain yourself" judge, study lobbies with friends, character customization, and rooms that improve as you study. Goals: use it myself, iterate with friends, and have evidence of use by other people for university applications.

The idea was pressure-tested by a 5-advisor LLM council (Contrarian, First Principles, Expansionist, Outsider, Executor) with anonymous peer review and a chairman synthesis, then refined through a grilling interview.

## What the council concluded
- Live social presence ("I'm studying now, come join") is the only feature that pulls in other users. It is the core.
- A PWA cannot detect or block other apps. iOS blocking needs an Apple entitlement. → No hard lock in v1.
- Spotify dev-mode apps cap at ~25 users and Apple Music needs a paid account. → No music-app sync.
- "Study time = currency" invites Goodhart cheating. → Verify sessions, and require an end-of-session note to earn.
- Blind spots caught in peer review: users are minors (privacy and safety), and AI-written code means credibility comes from documented decisions. Hence this log.
- Rejected: an "IB operating system" for coordinators. It is scope creep during the IB.

## What I decided (grilling)
| Question | Decision |
|---|---|
| Core concept | Shared cozy room = lobby, **plus a personal room**, and **more competitive** |
| Feelings to design for | Proud when alone in the room; surprised when a classmate is there at 2am; pulled in when someone is studying now |
| Leaderboards | Comparisons **only inside rooms**. Tabs: live sitting, this week in room, all-time in room, lifetime |
| Moderation | Comes from the room owners, who want fair comparisons |
| Anti-scroll in v1 | Soft accountability: strict rooms detect leaving the tab; Screen Time guide; the Chrome extension is v1.5 |
| Verification | The room owner sets Strict or Honor mode; end note; owners can void sessions |
| Nagging | **Spam until return** (every 15s; 30-min safety cap) |
| Interaction | Reactions + nudges only, no chat |
| Economy | **Both** personal and shared rooms are bought with coins (donate to a room bank) |
| Art style | **Isometric** |
| Music | Built-in ambient radio, room-synced |
| Notion | Fully separate |
| Platform | Web/PWA first; must be able to become a real app |
| Timeline | DP1 now → applications next cycle (fall 2027) |
| Team | Me + AI agents; classmates test |

## Technical calls made while writing the spec
- **Vite + React + Capacitor instead of Expo.** The isometric 3D scene (three.js) runs unchanged inside Capacitor's WebView. Expo native would need a separate GL path, and Capacitor allows a native Android UsageStats plugin later.
- **Isometric = low-poly 3D with an orthographic camera**, not drawn sprites. Free rotation, recoloring and new items without drawing every angle.
- **Procedural "bean" avatars**, so v1 doesn't depend on finding a customizable CC0 character pack.
- **Server-authoritative sessions** (RPCs + a 10s cron tick), so leaderboards and coins can't be faked by editing the client.
- **First-party metrics only** (no PostHog etc.), for privacy with minors.

## Consequences
The Room screen is the product. Everything else (shop, avatar, radio) exists to make people come back to it. Each milestone has a dogfood gate (see SPEC §15). If I'm not using it daily, I stop and fix that before building more.
