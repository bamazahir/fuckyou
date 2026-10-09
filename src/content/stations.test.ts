import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { isPlayable } from '../core/radio'
import { STATION_EPOCH_MS, STATIONS } from './stations'

describe('stations.json', () => {
  it('has the v1 stations (SPEC §11)', () => {
    expect(STATIONS.map((s) => s.id).sort()).toEqual(['brown', 'cafe', 'lofi', 'rain', 'silence'])
    expect(Number.isFinite(STATION_EPOCH_MS)).toBe(true)
  })
  it('matches the SQL list of valid stations', () => {
    const sql = readFileSync('supabase/migrations/20261012000000_m6_radio.sql', 'utf8')
    const list = /p_id in \(([^)]*)\)/.exec(sql)?.[1] ?? ''
    expect(
      list
        .match(/'([a-z0-9_]+)'/g)
        ?.map((s) => s.slice(1, -1))
        .sort(),
    ).toEqual(STATIONS.map((s) => s.id).sort())
  })
  it('the SQL default is a playable station', () => {
    const rain = STATIONS.find((s) => s.id === 'rain')
    expect(rain && isPlayable(rain)).toBe(true)
  })
  it('every track has a license and a source (docs/ASSETS.md)', () => {
    const assets = readFileSync('docs/ASSETS.md', 'utf8')
    for (const s of STATIONS)
      if (s.kind === 'tracks')
        for (const t of s.tracks) {
          expect(t.license).toMatch(/^(CC0|explicit permission)/)
          expect(t.source_url).toMatch(/^https:\/\//)
          // The CSP's media-src only allows Supabase Storage.
          expect(new URL(t.src).hostname).toMatch(/\.supabase\.co$/)
          expect(assets).toContain(t.src.split('/').pop() ?? t.src)
        }
  })
})
