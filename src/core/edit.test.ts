import { describe, expect, it } from 'vitest'
import { canPlace, nextRot, placement, pointToCell, remaining } from './edit'
import type { ItemDef } from './grid'

const desk: ItemDef = { id: 'desk', footprint: [2, 1], layer: 'floor' }
const poster: ItemDef = { id: 'poster', footprint: [1, 1], layer: 'wall' }
const catalog = new Map([
  ['desk', desk],
  ['poster', poster],
])

describe('pointToCell', () => {
  it('maps floor points to cells and ignores points off the floor', () => {
    expect(pointToCell(-3.9, -3.9, 8)).toEqual({ x: 0, z: 0 })
    expect(pointToCell(0.2, 3.9, 8)).toEqual({ x: 4, z: 7 })
    expect(pointToCell(4.1, 0, 8)).toBeNull()
  })
})

describe('placement', () => {
  it('keeps floor items inside the room', () => {
    expect(placement(desk, { x: 7, z: 3 }, 0, 8)).toEqual({ item_id: 'desk', x: 6, z: 3, rot: 0 })
    expect(placement(desk, { x: 7, z: 7 }, 1, 8)).toEqual({ item_id: 'desk', x: 7, z: 6, rot: 1 })
  })

  it('snaps wall items to the nearer back wall', () => {
    expect(placement(poster, { x: 5, z: 2 }, 0, 8)).toEqual({ item_id: 'poster', x: 5, z: 0, rot: 0 })
    expect(placement(poster, { x: 1, z: 6 }, 0, 8)).toEqual({ item_id: 'poster', x: 0, z: 6, rot: 1 })
  })
})

describe('canPlace', () => {
  const layout = [{ item_id: 'desk', x: 0, z: 0, rot: 0 as const }]
  it('refuses overlaps, but not with the item being moved', () => {
    expect(canPlace(layout, { item_id: 'desk', x: 1, z: 0, rot: 0 }, 8, catalog)).toBe(false)
    expect(canPlace(layout, { item_id: 'desk', x: 1, z: 0, rot: 0 }, 8, catalog, 0)).toBe(true)
    expect(canPlace(layout, { item_id: 'desk', x: 0, z: 1, rot: 0 }, 8, catalog)).toBe(true)
  })
})

describe('remaining', () => {
  it('is owned minus placed', () => {
    const left = remaining(new Map([['desk', 2]]), [{ item_id: 'desk', x: 0, z: 0, rot: 0 }])
    expect(left.get('desk')).toBe(1)
  })
})

describe('nextRot', () => {
  it('turns floor items and leaves wall items alone', () => {
    expect(nextRot(desk, 3)).toBe(0)
    expect(nextRot(poster, 1)).toBe(1)
  })
})
