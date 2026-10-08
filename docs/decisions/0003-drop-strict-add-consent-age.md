# 0003 — Drop strict mode; add age-of-digital-consent handling

Date: 2026-10-08 · Status: accepted · Supersedes the strict-mode and age-gate parts of 0002

## Decision
1. **No strict mode in v1.** Every session runs on server time whether or not the app is visible. The caught sequence, verified sessions, visibility pings, Wake Lock and the "distracted" state are removed. The "Leaving to scroll → caught" emotional moment is gone.
   - Why: a web app can only see "app visible", which punishes real IB work done in other tabs and phones being locked, and is easy to beat on desktop. Accountability now comes from the room itself (live presence, leaderboards, notes, owner voids).
   - Integrity that stays: server-authoritative time, 50-min stopwatch check-ins, the 4h cap, notes, voids.
   - The first real anti-distraction feature is the v1.5 Chrome extension.
2. **Consent age.** Signup asks country + age bracket (no birthday).
   - Under 13: blocked.
   - Between 13 and the country's digital-consent age (GDPR Art. 8 varies 13–16; unknown countries default to 16; India 18): a parent/guardian consents by email before the account can do anything. Decline, withdrawal or 7 days of silence deletes the account.
   - Age is self-declared.
   - Email goes through Resend, a new processor listed on the privacy page. Needs a verified sender domain (builder setup in M2).
   - The consent-age table must be verified against primary sources before M2.
