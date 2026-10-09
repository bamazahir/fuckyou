// Edit mode rules for decorating (SPEC §10 "Edit mode"). Pure.
import { rotatedSize, validateLayout, type ItemDef, type LayoutItem, type Rot } from './grid'

/** The cell under a floor point, for a size×size room centred on the origin (null off the floor). */
export function pointToCell(x: number, z: number, size: number): { x: number; z: number } | null {
  const cx = Math.floor(x + size / 2)
  const cz = Math.floor(z + size / 2)
  return cx < 0 || cz < 0 || cx >= size || cz >= size ? null : { x: cx, z: cz }
}

/**
 * Where an item goes when the pointer is over cell (x, z): floor items put their corner there (kept
 * inside the room where possible); wall items snap to the nearer back wall at that column or row.
 */
export function placement(def: ItemDef, cell: { x: number; z: number }, rot: Rot, size: number): LayoutItem {
  if (def.layer === 'wall') {
    const w = def.footprint[0]
    const clamp = (v: number) => Math.max(0, Math.min(size - w, v))
    return cell.z <= cell.x
      ? { item_id: def.id, x: clamp(cell.x), z: 0, rot: 0 }
      : { item_id: def.id, x: 0, z: clamp(cell.z), rot: 1 }
  }
  const [w, d] = rotatedSize(def, rot)
  return {
    item_id: def.id,
    x: Math.max(0, Math.min(size - w, cell.x)),
    z: Math.max(0, Math.min(size - d, cell.z)),
    rot,
  }
}

/** Whether `candidate` can join `layout` (optionally replacing the item at `replacing`). */
export function canPlace(
  layout: readonly LayoutItem[],
  candidate: LayoutItem,
  size: number,
  catalog: ReadonlyMap<string, ItemDef>,
  replacing: number | null = null,
): boolean {
  const next = layout.filter((_, i) => i !== replacing)
  return validateLayout([...next, candidate], size, catalog).ok
}

/** Owned minus placed, per item (what the tray still offers). */
export function remaining(
  owned: ReadonlyMap<string, number>,
  layout: readonly LayoutItem[],
): Map<string, number> {
  const left = new Map(owned)
  for (const item of layout) left.set(item.item_id, (left.get(item.item_id) ?? 0) - 1)
  return left
}

/** Next quarter turn (wall items don't rotate: they follow the wall). */
export function nextRot(def: ItemDef, rot: Rot): Rot {
  return def.layer === 'wall' ? rot : (((rot + 1) % 4) as Rot)
}

/** A ready-made layout, keeping only as many of each thing as you own (the rest is left out). */
export function applyTemplate(
  template: readonly LayoutItem[],
  owned: ReadonlyMap<string, number>,
): LayoutItem[] {
  const left = new Map(owned)
  return template.filter((item) => {
    const n = left.get(item.item_id) ?? 0
    if (n <= 0) return false
    left.set(item.item_id, n - 1)
    return true
  })
}
