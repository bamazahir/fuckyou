---
name: ship-audit
description: "Adversarial whole-app audit for Studyroom that hunts for what is MISSING or unsafe: security holes, RLS gaps, leaked secrets, client-trusted data, privacy failures for minors, abuse vectors, absent error/empty states, unlicensed assets, free-tier limits. Use before every milestone sign-off, before inviting new users, after any large AI-generated change, or whenever the user asks to check/audit/verify the app, asks 'what are we missing', 'is this safe', 'is this production-ready', a pre-mortem, or a security review. Do not skip it because tests pass — passing tests only prove what someone thought to test."
---

# Ship audit

Generated code fails by **omission** far more than by visible bugs: a table with no RLS policy, an RPC that forgets to check membership, a service key bundled into the client, a screen with no error state. Tests pass because nobody wrote the test for the thing that isn't there. Your posture is the opposite of a code reviewer's: assume something important is absent and go find it.

Output a report; don't fix anything in the same pass unless the user asks. A fix made mid-audit hides the finding from the record.

## 0. Ground truth first

Read `docs/SPEC.md` (especially §6 rules, §8 data model, §13 privacy) and `CLAUDE.md`. The spec is the contract. Anything the code does that the spec doesn't mention is a finding too.

## 1. Mechanical layer (run, don't eyeball)

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
supabase test db                 # pgTAP
pnpm audit --prod                # known CVEs
```
Then run these skills and fold their output into the report:
- `supply-chain-risk-auditor` on the lockfile.
- `spec-to-code-compliance` with `docs/SPEC.md` as the spec. This is the main "is anything huge missing" pass.
- `sharp-edges` on `supabase/migrations/` and `src/lib/`.
- The built-in `/security-review` on the current branch.

If a command can't run, say so in the report as **NOT CHECKED**. Never report it as passing.

## 2. Judgement layer: hunt each area

For every item: **evidence** (file:line, SQL output or command output) or it isn't a finding. Mark items ✅ verified, ❌ finding, or ⚠️ couldn't verify.

### A. Database & RLS (highest stakes)
- Every table has RLS enabled. Run:
  `select tablename from pg_tables where schemaname='public' and not rowsecurity;` → must return nothing.
- No `using (true)` / `with check (true)` on any table a client can write.
- Every `security definer` function sets `search_path = ''` (or pinned), checks `auth.uid()` is not null, and checks membership/role **inside** the function.
- The client cannot write durations, coins, inventory, membership or layout. Prove it with a pgTAP or script test that tries a direct `update sessions set focus_seconds=99999` as an authenticated user and expects failure.
- Length/format checks exist **in SQL**, not only in the UI (handle, names, status line, note).
- Limits are enforced in SQL: room capacity, rooms per user, daily coin cap, 4h session cap.
- Invite codes can't be brute-forced: `preview_room`/`join_room` are rate-limited per user/IP.
- Cron/Edge transitions are idempotent (`UPDATE ... WHERE status='active' RETURNING`).

### B. Secrets & config
- `grep -rlE "sb_secret_[A-Za-z0-9]{8,}|eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]*c2VydmljZV9yb2xl|sk-ant-|VAPID_PRIVATE" dist/ src/` → no hits (actual key shapes; the bare strings `service_role`/`sb_secret_` appear inside supabase-js itself and are not leaks).
- Only `VITE_`-prefixed public values reach the client. `.env*` is gitignored. Search git history for committed secrets.
- Edge Functions verify the caller: a user JWT, or the cron shared secret for `tick`.
- GitHub Actions use minimal `permissions:`, and no secrets are echoed to logs.

### C. Web client
- Security headers in `vercel.json`: a CSP (scripts self only; connect-src limited to the Supabase URL), `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`.
- No `dangerouslySetInnerHTML` with user text. Display names, room names, status lines and notes render as text everywhere, including drei `<Html>` labels and push notification bodies.
- Auth redirects (`/j/:code`, sign-in `next=`) accept same-origin paths only, so there is no open redirect. Supabase Auth redirect URLs are allowlisted.
- The service worker never caches authenticated API responses. Push payloads contain no private data.
- Sign-out clears Zustand stores, the Realtime channels and the push subscription for that device.

### D. Privacy & minors (SPEC §13 — every line is a requirement)
- The data inventory in `/privacy` matches the tables that actually exist. A new column with no privacy line is a finding.
- With Playwright, record every network request during a full session. Any request to a domain other than the app host or Supabase is a finding (fonts must be self-hosted).
- Delete account really deletes: test that, after `delete_my_account`, no row references the user, and their sessions and notes are gone.
- Export returns everything the user owns.
- Age gate present. The profanity filter runs on **every** text field other people can see. No free-text chat. No public room directory.

### E. Abuse & fairness
- Can a user inflate leaderboards? Check multiple tabs, a manipulated clock, replayed RPCs, or a stopwatch left running (check-ins). Record what's mitigated and what's accepted risk.
- Push can only ever target the session owner (phase end, check-in) or opted-in members (room active). Never arbitrary users.
- Consent: a `pending` user can reach no room data (pgTAP). Consent tokens are random, stored hashed, expire, and the parent page leaks nothing beyond the child's display name. Under-13 signups leave no data behind.
- Reactions/nudges are rate-limited, and a removed member is dropped from the Realtime channel.
- A voided session reverses its coins. A negative balance is handled.

### F. Reliability & limits
- Week boundaries and DST: tests for a room TZ crossing a DST change and for Monday 00:00 in non-UTC zones.
- Realtime reconnect after network loss restores presence. An expired push subscription (410) is deleted.
- Check current Supabase free-tier limits (concurrent Realtime connections, Edge Function invocations, database size, egress) against expected load. A 10s tick ≈ 260k invocations/month.
- Backups: the free plan has limited backups, so there's a documented export routine.

### G. UX completeness (the most commonly forgotten)
For every screen in SPEC §5: loading, empty, error and offline states exist. Run `web-design-guidelines` on the UI. Also check:
- Notification permission denied path. iOS-not-installed path.
- Wake Lock unsupported path. WebGL unavailable → 2D fallback list.
- `prefers-reduced-motion`. Keyboard focus. Contrast. Safe-area insets. 320px-wide layout.

### H. Licenses
Every file in `public/models`, `public/thumbs`, the audio bucket and the fonts has a row in `docs/ASSETS.md` with a license and source URL. Third-party skills keep their LICENSE files (`.claude/skills/THIRD_PARTY.md`).

## 3. Report

Write `docs/audits/YYYY-MM-DD-<milestone>.md`:

```
# Ship audit — <date> — <milestone>
Verdict: SHIP / SHIP AFTER BLOCKERS / DO NOT SHIP
Not checked: <list, with reason>

## Blockers   (data exposure, auth bypass, minors' privacy, secret leak, money/coins integrity)
## High       (abuse vector, missing required spec behaviour, missing error handling on a core path)
## Medium
## Low / polish

Each finding: **title** — evidence (file:line / command output) — why it matters — proposed fix (1–3 lines)
## Verified (✅ list, one line each, so the next audit knows what was covered)
```

Then tell the user the verdict, the blocker count, and the single most important fix.
