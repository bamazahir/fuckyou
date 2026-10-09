import type { Avatar, AvatarColors, HairStyle } from '../lib/db'

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
  { key: 'body', swatches: CLOTH },
  { key: 'top', swatches: CLOTH },
]

export const HAIR_STYLES: readonly HairStyle[] = ['short', 'long', 'curly', 'bun']

export const hairOf = (avatar: Avatar): HairStyle =>
  avatar.hair && HAIR_STYLES.includes(avatar.hair) ? avatar.hair : 'short'

/** Character art constants (studyroom-look §1 exception): the same in every theme. */
export const FACE = { eye: '#1E1A17', shine: '#FFFFFF', blush: '#F29A8E', shoe: '#3A302A' } as const

const pick = <T>(xs: readonly T[], r: number): T => xs[Math.floor(r * xs.length) % xs.length] as T

export function randomAvatar(rand: () => number = Math.random): Avatar {
  return {
    hair: pick(HAIR_STYLES, rand()),
    colors: {
      skin: pick(SKIN, rand()),
      hair: pick(HAIR, rand()),
      body: pick(CLOTH, rand()),
      top: pick(CLOTH, rand()),
    },
  }
}
