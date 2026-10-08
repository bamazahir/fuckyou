import { describe, expect, it } from 'vitest'
import { focusSeconds, HARD_CAP_SECONDS } from './accounting'

const MIN = 60_000
const start = 1_700_000_000_000

describe('focusSeconds', () => {
  it('counts elapsed time for a stopwatch', () => {
    expect(
      focusSeconds({ kind: 'stopwatch', startedAtMs: start, plannedSeconds: null }, start + 42 * MIN),
    ).toBe(2520)
  })

  it('never counts past a pomodoro plan', () => {
    const p = { kind: 'pomodoro' as const, startedAtMs: start, plannedSeconds: 1500 }
    expect(focusSeconds(p, start + 10 * MIN)).toBe(600)
    expect(focusSeconds(p, start + 31 * MIN)).toBe(1500)
  })

  it('caps every session at 4 hours', () => {
    expect(
      focusSeconds({ kind: 'stopwatch', startedAtMs: start, plannedSeconds: null }, start + 300 * MIN),
    ).toBe(HARD_CAP_SECONDS)
  })

  it('is zero for an end before the start (clock skew)', () => {
    expect(focusSeconds({ kind: 'stopwatch', startedAtMs: start, plannedSeconds: null }, start - MIN)).toBe(0)
  })

  it('floors partial seconds like the database does', () => {
    expect(focusSeconds({ kind: 'stopwatch', startedAtMs: start, plannedSeconds: null }, start + 1999)).toBe(
      1,
    )
  })
})
