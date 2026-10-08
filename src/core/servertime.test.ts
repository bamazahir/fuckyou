import { describe, expect, it } from 'vitest'
import { clockOffset, serverNow } from './servertime'

describe('clockOffset', () => {
  it('is zero when clocks agree', () => {
    expect(clockOffset(1000, 1050, 1100)).toBe(0)
  })

  it('is positive when the device clock is behind the server', () => {
    // request sent at 1000, answered at 1200 local; server said 6100 at the midpoint (1100)
    expect(clockOffset(1000, 6100, 1200)).toBe(5000)
  })

  it('is negative when the device clock is ahead', () => {
    expect(clockOffset(10_000, 7_000, 10_000)).toBe(-3000)
  })
})

describe('serverNow', () => {
  it('applies the offset to the local clock', () => {
    expect(serverNow(5000, 1_000_000)).toBe(1_005_000)
  })
})
