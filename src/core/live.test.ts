import { describe, expect, it } from 'vitest'
import { joinOrder, liveClock } from './live'

const t0 = Date.parse('2026-10-09T10:00:00Z')
const base = {
  state: 'focus' as const,
  kind: 'pomodoro' as const,
  started_at: '2026-10-09T10:00:00Z',
  planned_seconds: 1500,
  break_until: null,
}

describe('liveClock', () => {
  it('counts a pomodoro down', () => {
    expect(liveClock(base, t0 + 60_000)).toEqual({ focusing: true, clock: '24:00' })
  })

  it('counts a stopwatch up', () => {
    expect(liveClock({ ...base, kind: 'stopwatch', planned_seconds: null }, t0 + 90_000).clock).toBe('1:30')
  })

  it('shows the break time left, never negative', () => {
    const onBreak = { ...base, state: 'break' as const, break_until: '2026-10-09T10:05:00Z' }
    expect(liveClock(onBreak, t0 + 60_000)).toEqual({ focusing: false, clock: '4:00' })
    expect(liveClock(onBreak, t0 + 600_000).clock).toBe('0:00')
  })
})

describe('joinOrder', () => {
  it('orders by when each sitting began', () => {
    const rows = [
      { user_id: 'late', started_at: '2026-10-09T10:20:00Z', sitting_seconds: 0 },
      { user_id: 'early', started_at: '2026-10-09T10:30:00Z', sitting_seconds: 3600 },
      { user_id: 'mid', started_at: '2026-10-09T10:10:00Z', sitting_seconds: 0 },
    ]
    expect(joinOrder(rows, Date.parse('2026-10-09T10:40:00Z'))).toEqual(['early', 'mid', 'late'])
  })
})
