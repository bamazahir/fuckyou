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
