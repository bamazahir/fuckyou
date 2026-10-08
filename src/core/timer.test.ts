import { describe, expect, it } from 'vitest'
import { breakMinutesAfter, clampFocusMinutes, timerView } from './timer'

const MIN = 60_000
const t0 = 1_700_000_000_000

describe('timerView: pomodoro', () => {
  const s = { kind: 'pomodoro' as const, startedAtMs: t0, plannedSeconds: 1500, nextCheckinAtMs: null }

  it('counts down the focus block', () => {
    const v = timerView(s, t0 + 10 * MIN)
    expect(v.elapsed).toBe(600)
    expect(v.remaining).toBe(900)
    expect(v.progress).toBeCloseTo(0.4)
    expect(v.finished).toBe(false)
  })

  it('finishes at the planned length and never overshoots', () => {
    const v = timerView(s, t0 + 40 * MIN)
    expect(v.elapsed).toBe(1500)
    expect(v.remaining).toBe(0)
    expect(v.finished).toBe(true)
  })
})

describe('timerView: stopwatch', () => {
  const s = {
    kind: 'stopwatch' as const,
    startedAtMs: t0,
    plannedSeconds: null,
    nextCheckinAtMs: t0 + 50 * MIN,
  }

  it('counts up with no check-in before 50 minutes', () => {
    const v = timerView(s, t0 + 49 * MIN)
    expect(v.elapsed).toBe(49 * 60)
    expect(v.remaining).toBeNull()
    expect(v.checkinDue).toBe(false)
  })

  it('asks for a check-in with a 10-minute window', () => {
    const v = timerView(s, t0 + 52 * MIN)
    expect(v.checkinDue).toBe(true)
    expect(v.checkinSecondsLeft).toBe(8 * 60)
  })

  it('stops at the 4-hour cap', () => {
    const v = timerView({ ...s, nextCheckinAtMs: null }, t0 + 300 * MIN)
    expect(v.elapsed).toBe(4 * 3600)
    expect(v.finished).toBe(true)
  })
})

describe('breakMinutesAfter', () => {
  it('takes a short break, then a long one every fourth block', () => {
    expect([1, 2, 3, 4, 5, 8].map((n) => breakMinutesAfter(n))).toEqual([5, 5, 5, 15, 5, 15])
  })
})

describe('clampFocusMinutes', () => {
  it('keeps focus lengths inside what the server accepts', () => {
    expect(clampFocusMinutes(1)).toBe(5)
    expect(clampFocusMinutes(25.4)).toBe(25)
    expect(clampFocusMinutes(500)).toBe(120)
    expect(clampFocusMinutes(Number.NaN)).toBe(25)
  })
})
