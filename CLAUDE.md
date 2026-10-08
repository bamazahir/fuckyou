# CLAUDE.md

This repo builds **Studyroom** (working name), a cozy isometric shared study room PWA.

- **Read `docs/SPEC.md` first. It is the source of truth.** Execute it; don't redesign it. If something is ambiguous, choose the simplest option and record it in `docs/decisions/NNNN-*.md`.
- Work milestone by milestone (SPEC §15). Only do the task you were given; don't start the next milestone.
- Stack is fixed (SPEC §4): Vite + React + TS strict, Tailwind, Zustand, React Router, @react-three/fiber, Supabase, vite-plugin-pwa, Vitest, Playwright, pgTAP, pnpm.
- Pure logic goes in `src/core/` (no React or Supabase imports) and must have unit tests.
- The client never writes durations, coins, inventory, membership or layouts directly. Use the RPCs in SPEC §8.3.
- User-facing strings go in `src/content/copy.ts`.
- Every asset (model, audio) needs a license entry in `docs/ASSETS.md` (CC0 or explicit permission only).
- Before finishing: `pnpm typecheck && pnpm lint && pnpm test && pnpm build` (+ `supabase test db` if SQL changed).
- Users are minors: never add trackers, chat, a public directory or new personal data fields without a decision record.
