// Starter rooms (SPEC §10 "Default content"). Saved layouts and editing arrive in M5.
import type { ItemDef, LayoutItem } from '../core/grid'
import catalogJson from './catalog.json'

export interface CatalogItem extends ItemDef {
  name: string
  model: 'desk' | 'chair' | 'rug' | 'lamp' | 'plant' | 'bookshelf' | 'window'
  light?: boolean
  price: number
}

export const CATALOG: ReadonlyMap<string, CatalogItem> = new Map(
  (catalogJson.items as unknown as CatalogItem[]).map((item) => [item.id, item]),
)

export const PERSONAL_SIZE = 8
export const SHARED_SIZE = 12

// Furniture sits in the back corner, so the camera can frame it closely; the open floor in front
// is where overflow cushions go now and where decorating will go in M5 (decision 0006).

/** Desk, chair, rug, lamp and plant, plus a window so the room shows the time of day. */
export const DEFAULT_PERSONAL: LayoutItem[] = [
  { item_id: 'rug_stripe', x: 1, z: 1, rot: 0 },
  { item_id: 'desk_oak', x: 2, z: 3, rot: 2 },
  { item_id: 'chair_wood', x: 2, z: 2, rot: 0 },
  { item_id: 'lamp_floor', x: 1, z: 3, rot: 0 },
  { item_id: 'plant_pot', x: 0, z: 0, rot: 0 },
  { item_id: 'window_double', x: 2, z: 0, rot: 0 },
]

/** 4 desks + 4 chairs in two rows (spaced so name labels don't overlap), a rug, a bookshelf, a window. */
export const DEFAULT_SHARED: LayoutItem[] = [
  { item_id: 'rug_long', x: 1, z: 1, rot: 0 },
  ...[
    [2, 2],
    [4, 2],
    [2, 5],
    [4, 5],
  ].flatMap(([x = 0, z = 0]): LayoutItem[] => [
    { item_id: 'chair_wood', x, z, rot: 0 },
    { item_id: 'desk_oak', x, z: z + 1, rot: 2 },
  ]),
  { item_id: 'bookshelf', x: 0, z: 2, rot: 1 },
  { item_id: 'window_double', x: 2, z: 0, rot: 0 },
]
