import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { readdirSync } from 'node:fs'
import { FLOORS, LOOKS, styleColors, WALLS } from './roomStyles'

describe('room styles', () => {
  it('unknown or missing finishes follow the theme', () => {
    expect(styleColors(null)).toEqual({ wall: null, floor: null })
    expect(styleColors({ wall: 'neon', floor: 'theme' })).toEqual({ wall: null, floor: null })
    expect(styleColors({ wall: 'sage', floor: 'walnut' })).toEqual({ wall: '#A9C1A0', floor: '#7A5236' })
  })
  it('match the SQL lists', () => {
    // the newest migration that defines the check
    const dir = 'supabase/migrations'
    const sql =
      readdirSync(dir)
        .sort()
        .map((f) => readFileSync(`${dir}/${f}`, 'utf8'))
        .filter((s) => s.includes('function private.valid_room_style'))
        .at(-1) ?? ''
    const list = (name: string) =>
      (new RegExp(`'${name}', ''\\) in\\s*\\(([^)]*)\\)`).exec(sql)?.[1] ?? '')
        .match(/'([a-z_]+)'/g)
        ?.map((s) => s.slice(1, -1))
    expect(list('wall')).toEqual(WALLS.map((w) => w.id))
    expect(list('floor')).toEqual(FLOORS.map((f) => f.id))
  })
  it('looks only use known finishes, and each look is different', () => {
    for (const look of LOOKS) {
      expect(
        WALLS.some((w) => w.id === look.wall && w.color),
        look.id,
      ).toBe(true)
      expect(
        FLOORS.some((f) => f.id === look.floor && f.color),
        look.id,
      ).toBe(true)
    }
    expect(new Set(LOOKS.map((l) => `${l.wall}/${l.floor}`)).size).toBe(LOOKS.length)
  })
})
