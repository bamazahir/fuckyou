import { describe, expect, it } from 'vitest'
import { calendar, lastDays, level, localDate, streaks } from './allTime'

const d = (iso: string, s = 1800) => ({ d: iso, s })

describe('lastDays', () => {
  it('fills gaps with zeros, oldest first', () => {
    expect(lastDays([d('2026-10-08', 60)], '2026-10-09', 3)).toEqual([
      { d: '2026-10-07', s: 0 },
      { d: '2026-10-08', s: 60 },
      { d: '2026-10-09', s: 0 },
    ])
  })
})

describe('streaks', () => {
  it('counts the run ending today, or yesterday when today is still empty', () => {
    const days = [d('2026-10-05'), d('2026-10-06'), d('2026-10-07'), d('2026-10-08')]
    expect(streaks(days, '2026-10-08')).toEqual({ current: 4, best: 4 })
    expect(streaks(days, '2026-10-09')).toEqual({ current: 4, best: 4 })
    expect(streaks(days, '2026-10-10')).toEqual({ current: 0, best: 4 })
  })
  it('keeps the best run even when broken', () => {
    const days = [d('2026-09-01'), d('2026-09-02'), d('2026-09-03'), d('2026-10-08')]
    expect(streaks(days, '2026-10-08')).toEqual({ current: 1, best: 3 })
  })
  it('ignores zero days and crosses month ends', () => {
    expect(streaks([d('2026-09-30'), d('2026-10-01'), d('2026-10-02', 0)], '2026-10-02')).toEqual({
      current: 2,
      best: 2,
    })
  })
})

describe('calendar', () => {
  it('starts weeks on Monday and leaves the future empty', () => {
    // 2026-10-08 is a Thursday.
    const grid = calendar([d('2026-10-05', 99)], '2026-10-08', 2)
    expect(grid).toHaveLength(2)
    expect(grid[1]?.[0]).toEqual({ d: '2026-10-05', s: 99 })
    expect(grid[1]?.[3]?.d).toBe('2026-10-08')
    expect(grid[1]?.[4]).toBeNull()
    expect(grid[0]?.[0]?.d).toBe('2026-09-28')
  })
})

describe('level', () => {
  it('bins study time', () => {
    expect([0, 60, 1800, 3600, 7200].map(level)).toEqual([0, 1, 2, 3, 4])
  })
})

describe('localDate', () => {
  it('uses the timezone', () => {
    const ms = Date.UTC(2026, 9, 8, 23, 30)
    expect(localDate(ms, 'UTC')).toBe('2026-10-08')
    expect(localDate(ms, 'Asia/Tokyo')).toBe('2026-10-09')
  })
})
