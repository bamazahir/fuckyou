import { describe, expect, it } from 'vitest'
import { daypartAt, msUntilNextDaypart } from './daypart'

describe('daypartAt', () => {
  it('is day from 06:00 up to 17:59', () => {
    expect(daypartAt(6)).toBe('day')
    expect(daypartAt(12)).toBe('day')
    expect(daypartAt(17)).toBe('day')
  })

  it('is night from 18:00 through 05:59, including 2am', () => {
    expect(daypartAt(18)).toBe('night')
    expect(daypartAt(23)).toBe('night')
    expect(daypartAt(0)).toBe('night')
    expect(daypartAt(2)).toBe('night')
    expect(daypartAt(5)).toBe('night')
  })
})

describe('msUntilNextDaypart', () => {
  const at = (h: number, m = 0) => new Date(2026, 9, 8, h, m, 0, 0)
  const HOUR = 3_600_000

  it('counts to 06:00 in the early morning', () => {
    expect(msUntilNextDaypart(at(2))).toBe(4 * HOUR)
  })

  it('counts to 18:00 during the day', () => {
    expect(msUntilNextDaypart(at(17, 30))).toBe(HOUR / 2)
  })

  it('counts to 06:00 the next day in the evening', () => {
    expect(msUntilNextDaypart(at(20))).toBe(10 * HOUR)
  })
})
