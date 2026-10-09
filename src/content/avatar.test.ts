import { describe, expect, it } from 'vitest'
import type { Avatar } from '../lib/db'
import {
  DEFAULT_ACCENT,
  EXPRESSIONS,
  expressionOf,
  HAIR_STYLES,
  hairOf,
  lookOf,
  randomAvatar,
  toggleAccessory,
} from './avatar'

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

describe('expressions', () => {
  it('match the SQL list in private.valid_avatar', async () => {
    const { readFileSync } = await import('node:fs')
    const sql = readFileSync('supabase/migrations/20261013000000_m8_hub.sql', 'utf8')
    const list = /a ->> 'expression', ''\) in\s*\(([^)]*)\)/.exec(sql)?.[1] ?? ''
    expect(list.match(/'([a-z_]+)'/g)?.map((s) => s.slice(1, -1))).toEqual([...EXPRESSIONS])
  })
  it('unknown or missing faces render as happy', () => {
    const base = { colors: { body: '#000000', skin: '#000000', hair: '#000000', top: '#000000' } }
    expect(expressionOf(base)).toBe('happy')
    expect(expressionOf({ ...base, expression: 'grumpy' as never })).toBe('happy')
    expect(expressionOf({ ...base, expression: 'cat' })).toBe('cat')
  })
})
