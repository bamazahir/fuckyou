import { describe, expect, it } from 'vitest'
import fixtures from './__fixtures__/layouts.json'
import { blockedCells, rotatedSize, slotsOf, validateLayout, type ItemDef, type LayoutItem } from './grid'

const defs: ItemDef[] = [
  { id: 'desk', footprint: [2, 1], layer: 'floor' },
  { id: 'chair', footprint: [1, 1], layer: 'floor', seat: { height: 0.45, nudge: 0.2 } },
  { id: 'rug', footprint: [3, 2], layer: 'rug' },
  { id: 'window', footprint: [2, 1], layer: 'wall' },
]
const catalog = new Map(defs.map((d) => [d.id, d]))
const desk = defs[0] as ItemDef

describe('footprints', () => {
  it('swap width and depth on odd quarter turns', () => {
    expect(rotatedSize(desk, 0)).toEqual([2, 1])
    expect(rotatedSize(desk, 1)).toEqual([1, 2])
    expect(rotatedSize(desk, 2)).toEqual([2, 1])
  })

  it('cover cells from the item corner', () => {
    expect(slotsOf({ item_id: 'desk', x: 3, z: 4, rot: 1 }, desk)).toEqual(['floor:3,4', 'floor:3,5'])
  })
})

describe('validateLayout', () => {
  it('accepts furniture standing on a rug and a window on the wall', () => {
    expect(
      validateLayout(
        [
          { item_id: 'rug', x: 0, z: 0, rot: 0 },
          { item_id: 'desk', x: 0, z: 0, rot: 0 },
          { item_id: 'chair', x: 0, z: 1, rot: 2 },
          { item_id: 'window', x: 2, z: 0, rot: 0 },
          { item_id: 'window', x: 0, z: 2, rot: 1 },
        ],
        8,
        catalog,
      ),
    ).toEqual({ ok: true })
  })

  it('rejects overlapping furniture', () => {
    expect(
      validateLayout(
        [
          { item_id: 'desk', x: 0, z: 0, rot: 0 },
          { item_id: 'chair', x: 1, z: 0, rot: 0 },
        ],
        8,
        catalog,
      ),
    ).toEqual({ ok: false, error: 'overlap', index: 1 })
  })

  it('rejects items hanging off the edge, including after rotation', () => {
    expect(validateLayout([{ item_id: 'desk', x: 7, z: 0, rot: 0 }], 8, catalog)).toMatchObject({
      error: 'out_of_bounds',
    })
    expect(validateLayout([{ item_id: 'desk', x: 7, z: 0, rot: 1 }], 8, catalog)).toEqual({ ok: true })
    expect(validateLayout([{ item_id: 'desk', x: 7, z: 7, rot: 1 }], 8, catalog)).toMatchObject({
      error: 'out_of_bounds',
    })
  })

  it('rejects unknown items, fractional cells and bad wall slots', () => {
    expect(validateLayout([{ item_id: 'sofa', x: 0, z: 0, rot: 0 }], 8, catalog)).toMatchObject({
      error: 'unknown_item',
    })
    expect(validateLayout([{ item_id: 'chair', x: 0.5, z: 0, rot: 0 }], 8, catalog)).toMatchObject({
      error: 'bad_position',
    })
    expect(validateLayout([{ item_id: 'window', x: 1, z: 3, rot: 0 }], 8, catalog)).toMatchObject({
      error: 'bad_wall_slot',
    })
    expect(validateLayout([{ item_id: 'window', x: 0, z: 0, rot: 2 }], 8, catalog)).toMatchObject({
      error: 'bad_wall_slot',
    })
  })

  it('keeps the two walls apart and catches two windows in one slot', () => {
    expect(
      validateLayout(
        [
          { item_id: 'window', x: 0, z: 0, rot: 0 },
          { item_id: 'window', x: 0, z: 0, rot: 1 },
          { item_id: 'window', x: 1, z: 0, rot: 0 },
        ],
        8,
        catalog,
      ),
    ).toEqual({ ok: false, error: 'overlap', index: 2 })
  })
})

describe('blockedCells', () => {
  it('lists furniture cells but not rugs', () => {
    const cells = blockedCells(
      [
        { item_id: 'rug', x: 0, z: 0, rot: 0 },
        { item_id: 'desk', x: 4, z: 4, rot: 0 },
      ],
      catalog,
    )
    expect([...cells].sort()).toEqual(['4,4', '5,4'])
  })
})

describe('shared layout fixtures (mirrored by SQL save_layout)', () => {
  it('give the same verdicts as the fixture file', async () => {
    const { CATALOG } = await import('../content/layouts')
    for (const c of fixtures.cases) {
      const res = validateLayout(c.layout as LayoutItem[], c.size, CATALOG)
      const expected = c.error === null ? { ok: true } : { ok: false, error: c.error, index: c.index }
      expect(res, c.name).toEqual(expected)
    }
  })
})
