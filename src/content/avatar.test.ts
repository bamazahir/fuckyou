import { describe, expect, it } from 'vitest'
import type { Avatar } from '../lib/db'
import { DEFAULT_ACCENT, HAIR_STYLES, hairOf, lookOf, randomAvatar, toggleAccessory } from './avatar'

const colors = { body: '#6FA06B', skin: '#E8B98F', hair: '#2B2622', top: '#7FB2D9' }

describe('hairOf', () => {
  it('reads the hairstyle', () => {
    expect(hairOf({ colors, hair: 'bun' })).toBe('bun')
  })

  it('treats old avatars and unknown values as short hair', () => {
    expect(hairOf({ colors })).toBe('short')
    expect(hairOf({ colors, hair: 'mohawk' } as unknown as Avatar)).toBe('short')
  })
})

describe('randomAvatar', () => {
  it('always picks a known hairstyle', () => {
    for (const r of [0, 0.3, 0.6, 0.99]) expect(HAIR_STYLES).toContain(randomAvatar(() => r).hair)
  })
})

describe('lookOf', () => {
  it('fills defaults for old avatars', () => {
    const look = lookOf({ colors })
    expect(look).toMatchObject({ hair: 'short', top: 'tee', bottom: 'trousers', accent: DEFAULT_ACCENT })
    expect(look.accessories.size).toBe(0)
  })

  it('drops unknown pieces', () => {
    const look = lookOf({
      colors,
      outfit: { top: 'tuxedo', bottom: 'skirt' },
      accessories: ['crown', 'glasses'],
    } as unknown as Avatar)
    expect(look.top).toBe('tee')
    expect(look.bottom).toBe('skirt')
    expect([...look.accessories]).toEqual(['glasses'])
  })
})

describe('toggleAccessory', () => {
  it('adds and removes', () => {
    const on = toggleAccessory({ colors }, 'glasses')
    expect(on.accessories).toEqual(['glasses'])
    expect(toggleAccessory(on, 'glasses').accessories).toEqual([])
  })

  it('swaps hats instead of stacking them', () => {
    const a = toggleAccessory(toggleAccessory({ colors, accessories: ['scarf'] }, 'beanie'), 'cap')
    expect(a.accessories).toEqual(['scarf', 'cap'])
  })
})
