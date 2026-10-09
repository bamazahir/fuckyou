// Where avatars sit (SPEC §10 "Seats"). Pure.
import { blockedCells, type ItemDef, type LayoutItem, type Rot } from './grid'

export interface Seat {
  /** Cell coordinates (the seat is at the cell's centre). */
  x: number
  z: number
  /** Which way the sitter faces, in quarter turns (0 = +z, 1 = +x). */
  facing: Rot
  kind: 'chair' | 'cushion'
  /** Seat height and forward nudge (from the catalog; cushions are low and centred). */
  height: number
  nudge: number
}

const CUSHION = { height: 0.1, nudge: 0 }

/** Above this many people, labels hide and show on tap instead (SPEC §10). */
export const MAX_LABELS = 12

/**
 * Every seat in the room, in a stable order: chairs (in layout order) first, then floor cushions for
 * overflow. Cushions go on free cells in front of the desks, two cells apart in staggered rows (so
 * neighbours' labels don't overlap), nearest to the middle of the chairs first, facing the camera
 * (decision 0006).
 */
export function seatList(
  layout: readonly LayoutItem[],
  size: number,
  catalog: ReadonlyMap<string, ItemDef>,
): Seat[] {
  const chairs = layout.filter((item) => catalog.get(item.item_id)?.seat)
  const seats: Seat[] = chairs.map((item) => {
    const spec = catalog.get(item.item_id)?.seat ?? CUSHION
    return { x: item.x, z: item.z, facing: item.rot, kind: 'chair', height: spec.height, nudge: spec.nudge }
  })
  const blocked = blockedCells(layout, catalog)
  const furniture = layout.filter((item) => catalog.get(item.item_id)?.layer === 'floor')
  const start = Math.min(size - 1, Math.max(0, ...furniture.map((i) => i.z + 1)) + 1)
  const xs = chairs.map((c) => c.x)
  const mid = xs.length > 0 ? (Math.min(...xs) + Math.max(...xs)) / 2 : (size - 1) / 2
  const cells: { x: number; z: number; score: number }[] = []
  for (let z = 0; z < size; z++) {
    for (let x = 0; x < size; x++) {
      // rows two apart, every other cell, staggered between rows
      const row = z - start
      if (row % 2 !== 0 || (x + row / 2) % 2 !== 0 || blocked.has(`${x},${z}`)) continue
      const rowsAway = row >= 0 ? row : size - row
      cells.push({ x, z, score: Math.abs(x - mid) + rowsAway * 0.9 })
    }
  }
  cells.sort((a, b) => a.score - b.score || a.z - b.z || a.x - b.x)
  for (const { x, z } of cells) seats.push({ x, z, facing: 0, kind: 'cushion', ...CUSHION })
  return seats
}

/**
 * Gives each present person a seat index, keeping everyone where they already were. Newcomers
 * (in `presentIds` order, i.e. join order) take the lowest free index. People beyond `seatCount`
 * get no seat.
 */
export function assignSeats(
  prev: ReadonlyMap<string, number>,
  presentIds: readonly string[],
  seatCount: number,
  /** Seats people picked themselves; they win over where anyone was sitting before. */
  chosen: ReadonlyMap<string, number> = new Map(),
): Map<string, number> {
  const next = new Map<string, number>()
  const used = new Set<number>()
  for (const id of presentIds) {
    const pick = chosen.get(id)
    if (pick !== undefined && pick >= 0 && pick < seatCount && !used.has(pick)) {
      next.set(id, pick)
      used.add(pick)
    }
  }
  for (const id of presentIds) {
    if (next.has(id)) continue
    const was = prev.get(id)
    if (was !== undefined && was < seatCount && !used.has(was)) {
      next.set(id, was)
      used.add(was)
    }
  }
  let free = 0
  for (const id of presentIds) {
    if (next.has(id)) continue
    while (used.has(free)) free++
    if (free >= seatCount) break
    next.set(id, free)
    used.add(free)
  }
  return next
}

/**
 * The chair nearest a tapped floor point (room coordinates, centred on the origin), if one is within
 * reach and nobody else is in it. Cushions aren't offered: they only appear when the chairs run out.
 */
export function nearestChair(
  seats: readonly Seat[],
  point: readonly [number, number],
  size: number,
  taken: ReadonlySet<number>,
  reach = 1.1,
): number | null {
  let best: number | null = null
  let bestDist = reach
  seats.forEach((seat, i) => {
    if (seat.kind !== 'chair' || taken.has(i)) return
    const dx = seat.x - size / 2 + 0.5 - point[0]
    const dz = seat.z - size / 2 + 0.5 - point[1]
    const dist = Math.hypot(dx, dz)
    if (dist < bestDist) {
      best = i
      bestDist = dist
    }
  })
  return best
}

/** The next free chair after `current` (wrapping round), for the "next chair" button. */
export function nextFreeChair(
  seats: readonly Seat[],
  current: number | undefined,
  taken: ReadonlySet<number>,
): number | null {
  const n = seats.length
  const from = current ?? -1
  for (let step = 1; step <= n; step++) {
    const i = (((from + step) % n) + n) % n
    if (i !== current && seats[i]?.kind === 'chair' && !taken.has(i)) return i
  }
  return null
}
