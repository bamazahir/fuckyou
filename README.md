# Studyroom

A cozy isometric study room you share with friends: focus timer, live presence, room-only leaderboards, ambient radio, and coins that decorate your rooms.

- Spec: [docs/SPEC.md](docs/SPEC.md) · Decisions: [docs/decisions/](docs/decisions/) · Assets: [docs/ASSETS.md](docs/ASSETS.md)

## Develop

Requires Node 22 and pnpm 10 (`corepack enable`).

```bash
pnpm install
cp .env.example .env.local   # fill in once a Supabase project exists (public URL + anon key only)
pnpm dev                     # http://localhost:5173
```

| Command | What it does |
|---|---|
| `pnpm typecheck` / `pnpm lint` / `pnpm format:check` | static checks |
| `pnpm test` | unit tests (`src/core`) |
| `pnpm build` / `pnpm preview` | production build incl. service worker |
| `pnpm test:e2e` | Playwright tests (mobile + desktop) against the production build, with a mocked Supabase API |
| `pnpm test:db` | pgTAP database tests against the local Supabase (`pnpm dlx supabase start`) |
| `SCREENSHOTS=1 pnpm test:e2e screens` | capture the visual-review screenshot set into `test-results/screens` |
| `node scripts/assets/icons.mjs` | re-render app icons from `public/icons/icon.svg` |

Database: `supabase/` holds config and migrations. Local stack: `pnpm dlx supabase start` (needs Docker).

## Turning on notifications (builder, once per project)

Web push needs a VAPID key pair, the `push` Edge Function, and two Vault secrets so the database can wake the function.

```bash
node scripts/push/vapid.mjs                 # prints VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY (keep the private one secret)
openssl rand -hex 32                         # a PUSH_SECRET shared by the database and the function

pnpm dlx supabase db push                    # applies the migrations (enable pg_cron + pg_net in the dashboard first)
pnpm dlx supabase secrets set VAPID_PUBLIC_KEY=… VAPID_PRIVATE_KEY=… VAPID_SUBJECT=mailto:you@example.com \
  PUSH_SECRET=… APP_URL=https://<your-app>.vercel.app
pnpm dlx supabase functions deploy push --no-verify-jwt
```

In the Supabase SQL editor:

```sql
select vault.create_secret('https://<project-ref>.supabase.co/functions/v1/push', 'push_function_url');
select vault.create_secret('<the same PUSH_SECRET>', 'push_secret');
```

On Vercel, add `VITE_VAPID_PUBLIC_KEY` (the public key) and redeploy. Parental-consent emails also need `RESEND_API_KEY` and `EMAIL_FROM` as function secrets, once the sender domain is verified.
