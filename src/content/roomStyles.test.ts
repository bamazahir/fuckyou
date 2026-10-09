import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { FLOORS, styleColors, WALLS } from './roomStyles'

describe('room styles', () => {
  it('unknown or missing finishes follow the theme', () => {
    expect(styleColors(null)).toEqual({ wall: null, floor: null })
    expect(styleColors({ wall: 'neon', floor: 'theme' })).toEqual({ wall: null, floor: null })
    expect(styleColors({ wall: 'sage', floor: 'walnut' })).toEqual({ wall: '#A9C1A0', floor: '#7A5236' })
  })
  it('match the SQL lists', () => {
    const sql = readFileSync('supabase/migrations/20261013000000_m8_hub.sql', 'utf8')
    const list = (name: string) =>
      (new RegExp(`'${name}', ''\\) in\\s*\\(([^)]*)\\)`).exec(sql)?.[1] ?? '')
        .match(/'([a-z_]+)'/g)
        ?.map((s) => s.slice(1, -1))
    expect(list('wall')).toEqual(WALLS.map((w) => w.id))
    expect(list('floor')).toEqual(FLOORS.map((f) => f.id))
  })
})
