# 0013 — M6 build notes: the ambient radio

Date: 2026-10-09 · Status: accepted

## Context
SPEC §11 puts every station's audio files in Supabase Storage, each one licensed. M6 is being built past the gates (decision 0011), and the builder hasn't chosen or uploaded any tracks.

## Decisions
- **Rain, Café and Brown noise are synthesised in the browser** (`src/core/noise.ts`) as 16-second seamless stereo loops, made once per device session.
  - No files, so nothing to license, download or cache, and they work offline.
  - Noise has no "position", so room sync for these stations is just "the same station". Everyone in the room still hears the station the owner picked.
- **Lofi stays a playlist station with no tracks.** It shows as "Coming soon" and can't be picked until the builder adds tracks to `stations.json`, each with a `docs/ASSETS.md` row; a unit test checks that row and the licence.
  - New rooms, and rooms still on the old `'lofi'` default, are set to Rain.
- **The playlist sync is written and unit-tested** (`radioPosition`, `serverNow()`, re-seek beyond 0.75 s) but untested with real files. The builder checks it once tracks exist.
- **Tracks play through WebAudio** (an `<audio>` element routed through a gain node with `crossOrigin='anonymous'`). Volume then works on iOS, where `audio.volume` is read-only. Storage's public bucket serves CORS headers.
- **The personal room's station is remembered per device** (localStorage), not in the database. It's a private preference with no need to sync; it avoids a new profile field.
  - **Volume and mute are per listener, per device** (SPEC §11).
- **The radio stops when you leave the room's screen.** The timer keeps running and the radio doesn't follow you around the app, so it's always clear which room you're hearing.
- **The station list is checked on both sides.** `private.valid_station` in SQL holds the same ids as `stations.json`, and a unit test fails when they differ. `set_room` raises `invalid_station` and broadcasts `station`, so members refetch.

## Consequences
- The M6 acceptance test ("two devices play the same track within 1 s") can only be run once lofi tracks are uploaded. Until then the builder can check that both devices switch station when the owner picks one.
- iOS mutes WebAudio when the ring/silent switch is on. That's expected platform behaviour; it's in the builder checks.
