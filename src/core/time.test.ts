import { describe, expect, it } from 'vitest'
import { formatClock } from './time'

describe('formatClock', () => {
  it('shows minutes and seconds under an hour', () => {
    expect(formatClock(0)).toBe('0:00')
    expect(formatClock(9)).toBe('0:09')
    expect(formatClock(25 * 60)).toBe('25:00')
    expect(formatClock(42 * 60 + 10)).toBe('42:10')
  })

  it('adds hours from one hour up', () => {
    expect(formatClock(3600)).toBe('1:00:00')
    expect(formatClock(3 * 3600 + 5 * 60 + 7)).toBe('3:05:07')
  })

  it('floors fractions and clamps negatives to zero', () => {
    expect(formatClock(59.9)).toBe('0:59')
    expect(formatClock(-5)).toBe('0:00')
  })
})
