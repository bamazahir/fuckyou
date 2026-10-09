# Open items (builder)

Everything only the builder can do: accounts, keys, real phones, real people. The same list is kept in the
shared doc "Studyroom — open items" (https://claude.ai/code/artifact/37ce5a78-1e44-4e7c-b4ff-de26f219ae79).
Agents: keep both in step, add new items when a milestone needs a device or a person, and never tick one yourself.

## Setup to do once (from the repo folder)
- [ ] `pnpm dlx supabase db push` (enable pg_cron + pg_net first); migrations up to the latest in `supabase/migrations/`
- [ ] Make yourself admin: `update public.profiles set is_admin = true where handle = '<you>';`
- [ ] `node scripts/push/vapid.mjs` → VAPID keys; `openssl rand -hex 32` → PUSH_SECRET
- [ ] `supabase secrets set VAPID_PUBLIC_KEY VAPID_PRIVATE_KEY VAPID_SUBJECT=mailto:… PUSH_SECRET APP_URL`
- [ ] `supabase functions deploy push --no-verify-jwt`
- [ ] Vault: `push_function_url` (…/functions/v1/push) and `push_secret`
- [ ] Vercel: `VITE_VAPID_PUBLIC_KEY`, redeploy
- [ ] Sender domain → Resend → `RESEND_API_KEY`, `EMAIL_FROM`; also Supabase Auth custom SMTP (SPEC §17)
- [ ] Google OAuth: add classmates as test users or publish the consent screen

## Real-device checks
- [ ] Classmate's (possibly school-managed) phone: install + notifications work (M3 pre-check)
- [ ] Android Chrome: "Break time" within ~15 s of a backgrounded pomodoro's end
- [ ] Installed iOS PWA: same
- [ ] Room is active: arrives on a second device once, then not again for 2 h
- [ ] Shared pomodoro: two devices show the same phase within 1 s
- [ ] Realtime live: two browsers see each other within ~2 s
- [ ] 12 avatars ≥ 45 fps on a mid-range Android
- [ ] Visual look-around on phone + laptop, all themes

## People and gates
- [ ] M1: builder uses it on 3 separate days
- [ ] M2 friendly alpha: 2–3 friends, one room, one week; confusion notes → decision file
- [ ] Launch: invite ~8 classmates
- [ ] M4 gate: ≥ 5 of 8 complete ≥ 3 sessions in week 2 (see /admin). Fail → interview 5, fix top reason
- [ ] M5/M6: 2 weeks after release, WAU and D7 vs before

## Open questions / accepted risks
App name · sender domain · consent table re-check before wider rollout · free vs paid Supabase · monthly encrypted
`db dump` · coin prices/caps · former-member purge · client-only reaction limits (accepted) · forgeable
reaction/nudge counts (accepted, decision 0010) · 13–15 consent outside the school (decision 0002).

## Added by work built past the gates (decision 0011)
- [ ] M5: tune coin prices and the daily cap after real earn rates
- [ ] M6: lofi station needs CC0 / explicitly licensed tracks chosen and uploaded by the builder
- [ ] M7: Lighthouse run on the deployed URL
