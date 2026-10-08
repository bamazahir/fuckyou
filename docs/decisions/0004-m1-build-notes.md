# 0004 — M1 build notes

Date: 2026-10-08 · Status: accepted

## Consent-age table
`src/content/consent-ages.json` is the source of truth (mirrored into `public.consent_ages`; a unit test keeps them identical).
- **EU:** taken from the euCONSENT table (EU-funded age-assurance project), which matched the SPEC values. It agrees with the FRA mapping, except where national laws changed since (e.g. Slovenia 15, since 2023).
- **Outside the EU:**
  - NO 13, IS 13 (EEA laws)
  - GB 13 (DPA 2018 s.9)
  - US 13 (COPPA)
  - CA 14 (Quebec Law 25, applied Canada-wide as the strictest province)
  - AU 15 (OAIC capacity guidance)
  - CN 14 (PIPL)
  - KR 14 (PIPA)
  - IN 18 (DPDP Act)
- **Everything else:** 16.
- Accepted as "good for now" by the builder. Re-verify before any rollout beyond the builder's school.

## Implementation choices
- **Sign-in:** Google OAuth + email magic link (PKCE). Supabase's built-in email only reaches project team members, so classmates need the Resend domain (open, SPEC §17) or Google.
- **Under-13s:** `reject_underage()` deletes the auth user before any profile exists. The client navigates to `/blocked` first, then signs out locally.
- **Profile edits:** column-level grants (`display_name, avatar, tz, settings`) instead of an RPC per field. Avatar shape is enforced by a CHECK on `private.valid_avatar()`.
- **Sessions:** `start_session` serialises per user with an advisory lock. `end_session` is idempotent, so the client can call it when a pomodoro hits 0 even if `tick()` got there first.
- **Coins:** none in M1. `submit_note` returns 0 coins; earning arrives in M5.
- **E2E tests:** run against an in-memory mock of the Supabase REST/Auth API (`e2e/mock-supabase.ts`), so CI needs no backend. Real rules are covered by pgTAP (`supabase/tests`). The new CI `db` job runs `supabase test db`. Locally, `pnpm test:db` uses psql directly.
- **Screenshots:** `SCREENSHOTS=1 pnpm test:e2e screens` captures the studyroom-look §4 review set.
