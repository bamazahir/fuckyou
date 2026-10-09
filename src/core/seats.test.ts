import { describe, expect, it } from 'vitest'
import type { ItemDef } from './grid'
import { assignSeats, nearestChair, nextFreeChair, seatList, type Seat } from './seats'

const catalog = new Map<string, ItemDef>([
  ['chair', { id: 'chair', footprint: [1, 1], layer: 'floor', seat: { height: 0.45, nudge: 0.2 } }],
  ['desk', { id: 'desk', footprint: [1, 1], layer: 'floor' }],
  ['rug', { id: 'rug', footprint: [4, 4], layer: 'rug' }],
])

describe('seatList', () => {
  const layout = [
    { item_id: 'rug', x: 0, z: 0, rot: 0 as const },
    { item_id: 'desk', x: 2, z: 3, rot: 2 as const },
    { item_id: 'chair', x: 2, z: 2, rot: 0 as const },
    { item_id: 'desk', x: 2, z: 5, rot: 0 as const },
  ]

  it('puts chairs first, facing the way the chair faces', () => {
    expect(seatList(layout, 6, catalog)[0]).toEqual({
      x: 2,
      z: 2,
      facing: 0,
      kind: 'chair',
      height: 0.45,
      nudge: 0.2,
    })
  })

  it('adds cushions in front of the desks, middle first, in spaced rows', () => {
    const cushions = seatList(layout, 8, catalog).filter((s) => s.kind === 'cushion')
    // furniture reaches z = 5, so cushions start at z = 7 (6 is the gap row), around the chair at x = 2
    expect(cushions.slice(0, 3).map((s) => `${s.x},${s.z}`)).toEqual(['2,7', '0,7', '4,7'])
    expect(cushions.every((s) => (s.z - 7) % 2 === 0)).toBe(true)
    expect(cushions.every((s) => s.facing === 0)).toBe(true)
  })

  it('skips furniture cells', () => {
    const seats = seatList([{ item_id: 'desk', x: 2, z: 7, rot: 0 }, ...layout], 10, catalog)
    expect(seats.some((s) => s.kind === 'cushion' && s.x === 2 && s.z === 7)).toBe(false)
  })

  it('never puts two seats on one cell, and has room for a crowd', () => {
    const seats = seatList(layout, 12, catalog)
    const keys = seats.map((s) => `${s.x},${s.z}`)
    expect(new Set(keys).size).toBe(keys.length)
    expect(seats.length).toBeGreaterThanOrEqual(30)
  })
})

describe('assignSeats', () => {
  it('seats people in join order', () => {
    expect([...assignSeats(new Map(), ['a', 'b', 'c'], 5)]).toEqual([
      ['a', 0],
      ['b', 1],
      ['c', 2],
    ])
  })

  it('keeps people in their seat when someone else leaves, and reuses the gap', () => {
    const first = assignSeats(new Map(), ['a', 'b', 'c'], 5)
    const later = assignSeats(first, ['a', 'c', 'd'], 5)
    expect(later.get('a')).toBe(0)
    expect(later.get('c')).toBe(2)
    expect(later.get('d')).toBe(1)
  })

  it('leaves people without a seat when the room is full', () => {
    const seats = assignSeats(new Map(), ['a', 'b', 'c'], 2)
    expect(seats.has('c')).toBe(false)
  })
})

describe('assignSeats with picked seats', () => {
  it('gives people the seat they picked, and moves others out of it', () => {
    const prev = new Map([['a', 0]])
    const next = assignSeats(prev, ['a', 'b'], 3, new Map([['b', 0]]))
    expect(next.get('b')).toBe(0)
    expect(next.get('a')).toBe(1)
  })
  it('ignores picks that are out of range or already taken by an earlier pick', () => {
    const next = assignSeats(
      new Map(),
      ['a', 'b'],
      2,
      new Map([
        ['a', 1],
        ['b', 1],
      ]),
    )
    expect(next.get('a')).toBe(1)
    expect(next.get('b')).toBe(0)
    expect(assignSeats(new Map(), ['a'], 2, new Map([['a', 9]])).get('a')).toBe(0)
  })
})

describe('nearestChair', () => {
  const chair = (x: number, z: number): Seat => ({ x, z, facing: 0, kind: 'chair', height: 0.45, nudge: 0 })
  const seats: Seat[] = [chair(1, 1), chair(4, 4), { ...chair(2, 6), kind: 'cushion' }]
  it('finds the chair under the tap', () => {
    // cell (4,4) in an 8×8 room is centred on (0.5, 0.5)
    expect(nearestChair(seats, [0.6, 0.3], 8, new Set())).toBe(1)
  })
  it('skips taken chairs, cushions and taps far from any chair', () => {
    expect(nearestChair(seats, [0.6, 0.3], 8, new Set([1]))).toBeNull()
    expect(nearestChair(seats, [-1.5, 2.5], 8, new Set())).toBeNull()
    expect(nearestChair(seats, [3, -3], 8, new Set())).toBeNull()
  })
})

describe('nextFreeChair', () => {
  const chair = (x: number): Seat => ({ x, z: 1, facing: 0, kind: 'chair', height: 0.45, nudge: 0 })
  const seats: Seat[] = [chair(0), chair(2), chair(4), { ...chair(6), kind: 'cushion' }]
  it('moves along the chairs, wrapping round and skipping cushions', () => {
    expect(nextFreeChair(seats, 0, new Set())).toBe(1)
    expect(nextFreeChair(seats, 2, new Set())).toBe(0)
    expect(nextFreeChair(seats, 3, new Set())).toBe(0)
    expect(nextFreeChair(seats, undefined, new Set())).toBe(0)
  })
  it('skips taken chairs and gives up when none is free', () => {
    expect(nextFreeChair(seats, 0, new Set([1]))).toBe(2)
    expect(nextFreeChair(seats, 0, new Set([1, 2]))).toBeNull()
  })
})
