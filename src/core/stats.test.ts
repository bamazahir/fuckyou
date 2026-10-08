import { describe, expect, it } from 'vitest'
import { localDate, profileStats, weekStart } from './stats'

const at = (iso: string) => Date.parse(iso)
const s = (iso: string, minutes: number) => ({ startedAtMs: at(iso), focusSeconds: minutes * 60 })

describe('localDate', () => {
  it('uses the profile time zone, not UTC', () => {
    // 23:30 UTC on Oct 8 is already Oct 9 in Berlin and still Oct 8 in New York
    expect(localDate(at('2026-10-08T23:30:00Z'), 'Europe/Berlin')).toBe('2026-10-09')
    expect(localDate(at('2026-10-08T23:30:00Z'), 'America/New_York')).toBe('2026-10-08')
  })
})

describe('weekStart', () => {
  it('returns the Monday of the week', () => {
    expect(weekStart('2026-10-08')).toBe('2026-10-05') // Thursday
    expect(weekStart('2026-10-05')).toBe('2026-10-05') // Monday
    expect(weekStart('2026-10-11')).toBe('2026-10-05') // Sunday
  })
})

describe('profileStats', () => {
  const now = at('2026-10-08T18:00:00Z') // Thursday
  const tz = 'UTC'

  it('sums lifetime and this week', () => {
    const st = profileStats([s('2026-10-08T09:00:00Z', 30), s('2026-10-04T09:00:00Z', 50)], now, tz)
    expect(st.lifetimeSeconds).toBe(80 * 60)
    expect(st.thisWeekSeconds).toBe(30 * 60) // Oct 4 was the Sunday before
  })

  it('counts consecutive days with at least 25 minutes', () => {
    const sessions = [
      s('2026-10-08T09:00:00Z', 25),
      s('2026-10-07T09:00:00Z', 10),
      s('2026-10-07T20:00:00Z', 20), // two sessions add up to 30 on Oct 7
      s('2026-10-06T09:00:00Z', 40),
      s('2026-10-04T09:00:00Z', 60), // gap on Oct 5 ends the streak
    ]
    expect(profileStats(sessions, now, tz).streakDays).toBe(3)
  })

  it('keeps yesterday’s streak alive until today ends', () => {
    expect(profileStats([s('2026-10-07T09:00:00Z', 30)], now, tz).streakDays).toBe(1)
  })

  it('is empty for no sessions', () => {
    expect(profileStats([], now, tz)).toEqual({ lifetimeSeconds: 0, thisWeekSeconds: 0, streakDays: 0 })
  })
})
