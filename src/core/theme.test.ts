import { describe, expect, it } from 'vitest'
import { DEFAULT_THEME, parseThemeChoice, resolveMode } from './theme'

describe('parseThemeChoice', () => {
  it('keeps valid choices', () => {
    expect(parseThemeChoice({ theme: 'library', mode: 'dark' })).toEqual({ theme: 'library', mode: 'dark' })
  })

  it('falls back to the default for anything unknown', () => {
    expect(parseThemeChoice({ theme: 'neon', mode: 'sepia' })).toEqual(DEFAULT_THEME)
    expect(parseThemeChoice(null)).toEqual(DEFAULT_THEME)
    expect(parseThemeChoice('blossom')).toEqual(DEFAULT_THEME)
  })
})

describe('resolveMode', () => {
  it('follows local time in auto', () => {
    expect(resolveMode('auto', 14)).toBe('light')
    expect(resolveMode('auto', 2)).toBe('dark')
  })

  it('respects a fixed choice', () => {
    expect(resolveMode('dark', 14)).toBe('dark')
    expect(resolveMode('light', 2)).toBe('light')
  })
})
