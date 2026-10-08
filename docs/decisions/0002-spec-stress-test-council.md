# 0002 — Spec stress-test (second council)

Date: 2026-10-08 · Status: accepted

## Context
Before handing SPEC v1 to build agents, it went through a second LLM council: 5 advisors, anonymous peer review and a chairman. All five reviewers rated the Executor's list of concrete spec bugs the strongest response. The Expansionist was rated the biggest blind spot, because it added scope while ignoring the harms the others found.

## Spec bugs fixed (objective)
1. The ping interval (20s) was longer than the away threshold (15s), so attentive users would be flagged. → Ping every 10s, stale threshold 25s, plus an explicit hidden ping.
2. Client-published presence vanishes when a phone tab is backgrounded, so "distracted" could never show. → `room_live` + server-side `state` broadcasts are the source of truth.
3. Privacy/safety ("non-negotiable") was scheduled after minors joined. → Moved into M2, plus block/report and an admin moderation queue (owners are minors too).
4. Lifetime leaderboards mixed honor and personal-room time into strict rankings. → Strict rooms count verified sessions only by default.
5. The coins UI was shown before coins existed, and rooms defaulted to Strict before strict existed. → Fixed per milestone.
6. A cron couldn't see "member started a session". → An AFTER INSERT trigger fills `notify_queue`.
7. `sitting_id` assignment was unspecified. → Defined in §6.
8. Radio and timers used client clocks. → `server_time()` offset (`serverNow()`).
9. Nags continued after a session had broken. → Nothing is sent after "broke".
10. Agents had no rule to stop at device tests and usage gates. → Added to SPEC §15/§16 and CLAUDE.md.
11. No ops plan for free-tier pausing or quotas. → SPEC §18. The tick is now pure SQL; the Edge Function runs only when pushes are due.

## Product calls (decided by me)
| Council recommendation | My decision |
|---|---|
| Replace spam-until-return with a capped "caught" sequence | **Accepted.** 4 pushes (15/30/50s + "broke"). The real sting is my bean standing up red in front of friends. Spamming would get notifications switched off and kill the "friends are studying" pull. |
| Honor as the default; strict = "phone face-down" | **Accepted.** Desktop sessions in strict rooms run as honor, labelled unverified, because IB work happens in other tabs. |
| Launch at M2 (2D rooms) by November | **Rejected → launch at M4 with the isometric room** (~late January). M2 gets a friendly alpha with 2–3 friends instead. Trade-off accepted: the social bet is tested ~2 months later. |
| Room study auto-fills the room bank | **Accepted** (½ coin per focus minute, capped). |
| Room-synced pomodoro | **Accepted** (optional per room, in M3). |
| Wellbeing guardrails (no night bonus, quiet hours, "wrap up?") | **Not now.** The 2am feeling stays as designed. Revisit if late-night usage dominates the data. |
| Parental-consent path for 13–15 | **Not now (accepted risk).** Users are classmates at my school. Revisit before inviting anyone outside it or any school rollout. |
| Gates on later milestones | **Accepted.** A launch gate at M4 with a fail plan (interview, don't build); 2-week WAU/D7 checks after M5/M6. |

## Also added from peer review
- Before M3, test on one classmate's real (possibly school-managed) phone.
- Application evidence uses aggregates only, never names or notes.
