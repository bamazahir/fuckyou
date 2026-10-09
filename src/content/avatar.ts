import type { Accessory, Avatar, AvatarColors, BottomStyle, HairStyle, TopStyle } from '../lib/db'

// Curated swatches only (studyroom-look §2): skin ×8, hair ×10, body/top ×16.
export const SKIN = [
  '#F7D7C4',
  '#EDC0A2',
  '#E1A97F',
  '#C98B5E',
  '#A86F45',
  '#8A5734',
  '#6B4127',
  '#4A2C1B',
] as const
export const HAIR = [
  '#2B2622',
  '#4A3426',
  '#7A4E2D',
  '#B07A4F',
  '#E2B866',
  '#F3E2B3',
  '#A6A09A',
  '#C2523C',
  '#3E4F8C',
  '#6FA06B',
] as const
export const CLOTH = [
  '#FFC86B',
  '#E0654A',
  '#6FA06B',
  '#7FB2D9',
  '#44527D',
  '#2F3A5C',
  '#B07A4F',
  '#F6EFE4',
  '#C7A6E0',
  '#F2A7B8',
  '#9BC9B4',
  '#E8E29A',
  '#8C8C8C',
  '#2B2622',
  '#D98E3F',
  '#5E8C9E',
] as const

export const AVATAR_SLOTS: { key: keyof AvatarColors; swatches: readonly string[] }[] = [
  { key: 'skin', swatches: SKIN },
  { key: 'hair', swatches: HAIR },
  { key: 'top', swatches: CLOTH },
  { key: 'body', swatches: CLOTH },
  { key: 'accent', swatches: CLOTH },
]

export const DEFAULT_ACCENT = '#E0654A'

export const HAIR_STYLES: readonly HairStyle[] = ['short', 'long', 'curly', 'bun']

export const hairOf = (avatar: Avatar): HairStyle =>
  avatar.hair && HAIR_STYLES.includes(avatar.hair) ? avatar.hair : 'short'

export const TOP_STYLES: readonly TopStyle[] = ['tee', 'hoodie', 'stripes', 'collar']
export const BOTTOM_STYLES: readonly BottomStyle[] = ['trousers', 'shorts', 'skirt']

/** Starter accessories, free for everyone (decision 0008). One per slot: a hat, glasses, headphones, a scarf. */
export const ACCESSORIES: readonly { id: Accessory; slot: 'head' | 'face' | 'ears' | 'neck' }[] = [
  { id: 'beanie', slot: 'head' },
  { id: 'cap', slot: 'head' },
  { id: 'bow', slot: 'head' },
  { id: 'glasses', slot: 'face' },
  { id: 'headphones', slot: 'ears' },
  { id: 'scarf', slot: 'neck' },
]

export interface Look {
  hair: HairStyle
  top: TopStyle
  bottom: BottomStyle
  accessories: ReadonlySet<Accessory>
  accent: string
}

/** Fills defaults and drops unknown values, so old or odd avatars always render. */
export function lookOf(avatar: Avatar): Look {
  const top = avatar.outfit?.top
  const bottom = avatar.outfit?.bottom
  const known = new Set(ACCESSORIES.map((a) => a.id))
  return {
    hair: hairOf(avatar),
    top: top && TOP_STYLES.includes(top) ? top : 'tee',
    bottom: bottom && BOTTOM_STYLES.includes(bottom) ? bottom : 'trousers',
    accessories: new Set((avatar.accessories ?? []).filter((a) => known.has(a))),
    accent: avatar.colors.accent ?? DEFAULT_ACCENT,
  }
}

/** Turns an accessory on or off; turning one on replaces any other in the same slot. */
export function toggleAccessory(avatar: Avatar, id: Accessory): Avatar {
  const current = avatar.accessories ?? []
  if (current.includes(id)) return { ...avatar, accessories: current.filter((a) => a !== id) }
  const slot = ACCESSORIES.find((a) => a.id === id)?.slot
  const kept = current.filter((a) => ACCESSORIES.find((x) => x.id === a)?.slot !== slot)
  return { ...avatar, accessories: [...kept, id] }
}

/** Character art constants (studyroom-look §1 exception): the same in every theme. */
export const FACE = {
  eye: '#1E1A17',
  shine: '#FFFFFF',
  blush: '#F29A8E',
  shoe: '#3A302A',
  collar: '#FBF7F0',
} as const

const pick = <T>(xs: readonly T[], r: number): T => xs[Math.floor(r * xs.length) % xs.length] as T

export function randomAvatar(rand: () => number = Math.random): Avatar {
  return {
    hair: pick(HAIR_STYLES, rand()),
    outfit: { top: pick(TOP_STYLES, rand()), bottom: pick(BOTTOM_STYLES, rand()) },
    accessories: rand() < 0.5 ? [] : [pick(ACCESSORIES, rand()).id],
    colors: {
      skin: pick(SKIN, rand()),
      hair: pick(HAIR, rand()),
      body: pick(CLOTH, rand()),
      top: pick(CLOTH, rand()),
      accent: pick(CLOTH, rand()),
    },
  }
}
