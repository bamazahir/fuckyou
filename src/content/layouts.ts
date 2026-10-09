// Starter rooms (SPEC §10 "Default content"). Saved layouts and editing arrive in M5.
import type { ItemDef, LayoutItem, Rot } from '../core/grid'
import catalogJson from './catalog.json'

export const MODELS = [
  'desk',
  'chair',
  'stool',
  'armchair',
  'beanbag',
  'sofa',
  'bookshelf',
  'tallshelf',
  'sidetable',
  'bed',
  'crate',
  'lamp',
  'plant',
  'tallplant',
  'cactus',
  'globe',
  'bookpile',
  'radio',
  'fishtank',
  'cat',
  'telescope',
  'rug',
  'roundrug',
  'window',
  'poster',
  'clock',
  'corkboard',
  'wallshelf',
  'lights',
  'whiteboard',
] as const
export type ModelName = (typeof MODELS)[number]
/** Theme roles an item's main material can take (studyroom-look §1: roles only). */
export type Tint = 'wood' | 'paper' | 'accent' | 'rest' | 'good' | 'danger'

export interface CatalogItem extends ItemDef {
  name: string
  category: 'furniture' | 'decor' | 'wall'
  model: ModelName
  tint?: Tint
  light?: boolean
  price: number
}

export interface CatalogAccessory {
  id: string
  name: string
  slot: 'head' | 'face'
  price: number
}

export const CATALOG: ReadonlyMap<string, CatalogItem> = new Map(
  (catalogJson.items as unknown as CatalogItem[]).map((item) => [item.id, item]),
)

/** Accessories sold in the shop (the starter set in content/avatar.ts stays free, decision 0008). */
export const SHOP_ACCESSORIES: readonly CatalogAccessory[] = catalogJson.accessories as CatalogAccessory[]

/** What every new person and every new shared room owns from the start (seeded in SQL too). */
export const STARTER = catalogJson.starter

export const PERSONAL_SIZE = 8
export const SHARED_SIZE = 12

const at = (item_id: string, x: number, z: number, rot: Rot = 0): LayoutItem => ({ item_id, x, z, rot })
/** A chair with its desk in front of it (the pairing every desk layout uses). */
const deskAt = (x: number, z: number): LayoutItem[] => [at('chair_wood', x, z), at('desk_oak', x, z + 1, 2)]

export interface LayoutTemplate {
  id: string
  name: string
  layout: LayoutItem[]
}

/** Ready-made arrangements of the starter things (decision 0014); the first one is the default room. */
export const PERSONAL_TEMPLATES: readonly LayoutTemplate[] = [
  {
    id: 'cozy',
    name: 'Cozy corner',
    layout: [
      at('rug_stripe', 1, 1),
      ...deskAt(2, 2),
      at('lamp_floor', 1, 3),
      at('plant_pot', 0, 0),
      at('bookshelf_tall', 0, 4, 1),
      at('plant_tall', 5, 0),
      at('beanbag', 5, 5),
      at('side_table', 6, 5),
      at('book_pile', 4, 1),
      at('window_double', 2, 0),
      at('poster', 5, 0),
      at('clock', 7, 0),
      at('corkboard', 0, 2, 1),
    ],
  },
  {
    id: 'reading',
    name: 'Reading nook',
    layout: [
      at('rug_stripe', 3, 3),
      ...deskAt(1, 0),
      at('plant_pot', 0, 0),
      at('lamp_floor', 0, 1),
      at('bookshelf_tall', 0, 5, 1),
      at('beanbag', 4, 4),
      at('side_table', 5, 4),
      at('book_pile', 3, 4),
      at('plant_tall', 7, 0),
      at('window_double', 3, 0),
      at('poster', 6, 0),
      at('clock', 1, 0),
      at('corkboard', 0, 3, 1),
    ],
  },
  {
    id: 'window',
    name: 'By the window',
    layout: [
      at('rug_stripe', 2, 1),
      ...deskAt(3, 1),
      at('lamp_floor', 2, 2),
      at('plant_pot', 5, 1),
      at('bookshelf_tall', 0, 0, 1),
      at('plant_tall', 0, 7),
      at('beanbag', 6, 6),
      at('side_table', 7, 6),
      at('book_pile', 6, 5),
      at('window_double', 3, 0),
      at('clock', 6, 0),
      at('poster', 0, 1, 1),
      at('corkboard', 0, 4, 1),
    ],
  },
]

export const SHARED_TEMPLATES: readonly LayoutTemplate[] = [
  {
    id: 'hall',
    name: 'Study hall',
    layout: [
      at('rug_long', 1, 1),
      ...deskAt(2, 2),
      ...deskAt(4, 2),
      ...deskAt(2, 5),
      ...deskAt(4, 5),
      at('bookshelf', 0, 2, 1),
      at('plant_pot', 0, 0),
      at('plant_pot', 11, 0),
      at('plant_tall', 0, 10),
      at('lamp_floor', 6, 2),
      at('lamp_floor', 6, 5),
      at('beanbag', 8, 7),
      at('beanbag', 10, 7),
      at('side_table', 9, 7),
      at('book_pile', 9, 8),
      at('radio', 11, 5),
      at('window_double', 2, 0),
      at('whiteboard', 5, 0),
      at('fairy_lights', 8, 0),
      at('clock', 0, 0),
      at('poster', 11, 0),
      at('corkboard', 0, 5, 1),
      at('wall_shelf', 0, 8, 1),
    ],
  },
  {
    id: 'library',
    name: 'Library',
    layout: [
      at('rug_long', 4, 2, 1),
      ...deskAt(4, 3),
      ...deskAt(6, 3),
      ...deskAt(8, 3),
      ...deskAt(10, 3),
      at('bookshelf', 0, 1, 1),
      at('plant_pot', 0, 0),
      at('plant_pot', 11, 0),
      at('plant_tall', 11, 11),
      at('lamp_floor', 0, 5),
      at('lamp_floor', 11, 6),
      at('beanbag', 2, 9),
      at('beanbag', 4, 9),
      at('side_table', 3, 9),
      at('book_pile', 3, 10),
      at('radio', 11, 3),
      at('window_double', 4, 0),
      at('fairy_lights', 7, 0),
      at('clock', 11, 0),
      at('poster', 1, 0),
      at('whiteboard', 0, 4, 1),
      at('corkboard', 0, 7, 1),
      at('wall_shelf', 0, 10, 1),
    ],
  },
  {
    id: 'cafe',
    name: 'Café',
    layout: [
      at('rug_long', 8, 3),
      ...deskAt(2, 2),
      ...deskAt(6, 2),
      ...deskAt(2, 7),
      ...deskAt(6, 7),
      at('bookshelf', 0, 4, 1),
      at('plant_pot', 0, 0),
      at('plant_pot', 11, 0),
      at('plant_tall', 0, 11),
      at('lamp_floor', 4, 4),
      at('lamp_floor', 4, 9),
      at('beanbag', 9, 5),
      at('beanbag', 10, 6),
      at('side_table', 9, 6),
      at('book_pile', 10, 4),
      at('radio', 11, 11),
      at('window_double', 5, 0),
      at('fairy_lights', 1, 0),
      at('clock', 8, 0),
      at('poster', 10, 0),
      at('corkboard', 0, 1, 1),
      at('wall_shelf', 0, 5, 1),
      at('whiteboard', 0, 8, 1),
    ],
  },
]

/** The room you start with (and see until you save a layout of your own). */
export const DEFAULT_PERSONAL: LayoutItem[] = [...(PERSONAL_TEMPLATES[0]?.layout ?? [])]
export const DEFAULT_SHARED: LayoutItem[] = [...(SHARED_TEMPLATES[0]?.layout ?? [])]
