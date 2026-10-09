import { describe, expect, it } from 'vitest'
import { validateLayout } from '../core/grid'
import { seatList } from '../core/seats'
import { CATALOG, DEFAULT_PERSONAL, DEFAULT_SHARED, PERSONAL_SIZE, SHARED_SIZE } from './layouts'

describe('starter rooms', () => {
  it('are valid layouts', () => {
    expect(validateLayout(DEFAULT_PERSONAL, PERSONAL_SIZE, CATALOG)).toEqual({ ok: true })
    expect(validateLayout(DEFAULT_SHARED, SHARED_SIZE, CATALOG)).toEqual({ ok: true })
  })

  it('seat 4 at desks in a shared room and fit a crowd of 12 on cushions', () => {
    const seats = seatList(DEFAULT_SHARED, SHARED_SIZE, CATALOG)
    expect(seats.filter((s) => s.kind === 'chair')).toHaveLength(4)
    expect(seats.length).toBeGreaterThanOrEqual(12)
  })

  it('give every catalog item a price in the spec range', () => {
    for (const item of CATALOG.values()) {
      expect(item.price).toBeGreaterThanOrEqual(20)
      expect(item.price).toBeLessThanOrEqual(1500)
    }
  })
})
