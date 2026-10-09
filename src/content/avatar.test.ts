import { describe, expect, it } from 'vitest'
import type { Avatar } from '../lib/db'
import { HAIR_STYLES, hairOf, randomAvatar } from './avatar'

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
