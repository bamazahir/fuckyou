// Room grid rules (SPEC §10): footprints, bounds and overlap. Pure; mirrored by SQL save_layout in M5.

export type Rot = 0 | 1 | 2 | 3
export type Layer = 'floor' | 'rug' | 'wall'

export interface ItemDef {
  id: string
  /** [width along x, depth along z] in cells, at rot 0. Wall items use only the width. */
  footprint: readonly [number, number]
  layer: Layer
  seat?: boolean
}

export interface LayoutItem {
  item_id: string
  x: number
  z: number
  rot: Rot
}

export type LayoutError = 'unknown_item' | 'bad_position' | 'out_of_bounds' | 'overlap' | 'bad_wall_slot'
export type LayoutCheck = { ok: true } | { ok: false; error: LayoutError; index: number }

/** Width/depth after rotation: odd quarter turns swap the footprint. */
export function rotatedSize(def: ItemDef, rot: Rot): [number, number] {
  const [w, d] = def.footprint
  return rot % 2 === 0 ? [w, d] : [d, w]
}

/**
 * The slots an item occupies. Floor and rug items cover cells (`x,z`, from the item's corner).
 * Wall items hang on one of the two back walls: rot 0 = the back wall along x (z = 0),
 * rot 1 = the side wall along z (x = 0). Slots are prefixed with the layer, so layers never collide.
 */
export function slotsOf(item: LayoutItem, def: ItemDef): string[] {
  const out: string[] = []
  if (def.layer === 'wall') {
    const along = item.rot === 0 ? item.x : item.z
    for (let i = 0; i < def.footprint[0]; i++) out.push(`wall${item.rot}:${along + i}`)
    return out
  }
  const [w, d] = rotatedSize(def, item.rot)
  for (let dx = 0; dx < w; dx++)
    for (let dz = 0; dz < d; dz++) out.push(`${def.layer}:${item.x + dx},${item.z + dz}`)
  return out
}

function inBounds(item: LayoutItem, def: ItemDef, size: number): boolean {
  if (def.layer === 'wall') {
    const along = item.rot === 0 ? item.x : item.z
    return along >= 0 && along + def.footprint[0] <= size
  }
  const [w, d] = rotatedSize(def, item.rot)
  return item.x >= 0 && item.z >= 0 && item.x + w <= size && item.z + d <= size
}

/** Checks a whole layout for a size×size room. Returns the first problem, by item index. */
export function validateLayout(
  items: readonly LayoutItem[],
  size: number,
  catalog: ReadonlyMap<string, ItemDef>,
): LayoutCheck {
  const used = new Set<string>()
  for (const [index, item] of items.entries()) {
    const def = catalog.get(item.item_id)
    if (!def) return { ok: false, error: 'unknown_item', index }
    if (![item.x, item.z].every(Number.isInteger) || ![0, 1, 2, 3].includes(item.rot))
      return { ok: false, error: 'bad_position', index }
    if (def.layer === 'wall' && (item.rot > 1 || (item.rot === 0 ? item.z : item.x) !== 0))
      return { ok: false, error: 'bad_wall_slot', index }
    if (!inBounds(item, def, size)) return { ok: false, error: 'out_of_bounds', index }
    for (const slot of slotsOf(item, def)) {
      if (used.has(slot)) return { ok: false, error: 'overlap', index }
      used.add(slot)
    }
  }
  return { ok: true }
}

/** Cells covered by floor-layer items (furniture), as "x,z" keys. Rugs don't block. */
export function blockedCells(
  items: readonly LayoutItem[],
  catalog: ReadonlyMap<string, ItemDef>,
): Set<string> {
  const out = new Set<string>()
  for (const item of items) {
    const def = catalog.get(item.item_id)
    if (def?.layer !== 'floor') continue
    for (const slot of slotsOf(item, def)) out.add(slot.slice('floor:'.length))
  }
  return out
}
