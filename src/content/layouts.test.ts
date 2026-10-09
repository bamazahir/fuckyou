import { describe, expect, it } from 'vitest'
import { validateLayout } from '../core/grid'
import { seatList } from '../core/seats'
import {
  CATALOG,
  DEFAULT_PERSONAL,
  DEFAULT_SHARED,
  PERSONAL_SIZE,
  PERSONAL_TEMPLATES,
  SHARED_SIZE,
  SHARED_TEMPLATES,
  STARTER,
} from './layouts'

describe('starter rooms', () => {
  it('are valid layouts', () => {
    expect(validateLayout(DEFAULT_PERSONAL, PERSONAL_SIZE, CATALOG)).toEqual({ ok: true })
    expect(validateLayout(DEFAULT_SHARED, SHARED_SIZE, CATALOG)).toEqual({ ok: true })
  })

  it('seat 4 at desks in a shared room and fit a crowd of 12 on cushions', () => {
    const seats = seatList(DEFAULT_SHARED, SHARED_SIZE, CATALOG)
    expect(seats.filter((s) => s.kind === 'chair').length).toBeGreaterThanOrEqual(4)
    expect(seats.length).toBeGreaterThanOrEqual(12)
  })

  it('give every catalog item a price in the spec range', () => {
    for (const item of CATALOG.values()) {
      expect(item.price).toBeGreaterThanOrEqual(20)
      expect(item.price).toBeLessThanOrEqual(1500)
    }
  })
})

describe('layout templates', () => {
  const count = (ids: readonly string[]) => {
    const m = new Map<string, number>()
    for (const id of ids) m.set(id, (m.get(id) ?? 0) + 1)
    return m
  }
  const cases = [
    { templates: PERSONAL_TEMPLATES, size: PERSONAL_SIZE, starter: STARTER.personal },
    { templates: SHARED_TEMPLATES, size: SHARED_SIZE, starter: STARTER.shared },
  ]
  it.each(cases)('are valid and use only the starter things', ({ templates, size, starter }) => {
    const have = count(starter)
    for (const tpl of templates) {
      expect(validateLayout(tpl.layout, size, CATALOG), tpl.id).toEqual({ ok: true })
      for (const [id, n] of count(tpl.layout.map((i) => i.item_id)))
        expect(n, `${tpl.id}: ${id}`).toBeLessThanOrEqual(have.get(id) ?? 0)
    }
  })
  it('every shared template seats 4 at desks and still fits a crowd', () => {
    for (const tpl of SHARED_TEMPLATES) {
      const seats = seatList(tpl.layout, SHARED_SIZE, CATALOG)
      expect(seats.filter((s) => s.kind === 'chair').length, tpl.id).toBeGreaterThanOrEqual(4)
      expect(seats.length, tpl.id).toBeGreaterThanOrEqual(12)
    }
  })
})
