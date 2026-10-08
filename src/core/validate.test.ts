import { describe, expect, it } from 'vitest'
import { displayNameError, handleError, normalizeHandle, noteError } from './validate'

describe('handles', () => {
  it('normalizes to trimmed lowercase', () => {
    expect(normalizeHandle('  Ana_B ')).toBe('ana_b')
  })

  it('accepts 3–20 lowercase letters, digits and underscores', () => {
    expect(handleError('ana')).toBeNull()
    expect(handleError('Night_Owl_2026')).toBeNull()
  })

  it('explains what is wrong', () => {
    expect(handleError('ab')).toBe('too_short')
    expect(handleError('a'.repeat(21))).toBe('too_long')
    expect(handleError('ana b')).toBe('bad_chars')
    expect(handleError('ana-b')).toBe('bad_chars')
  })
})

describe('display names', () => {
  it('needs 1–30 characters after trimming', () => {
    expect(displayNameError('Ana')).toBeNull()
    expect(displayNameError('   ')).toBe('empty')
    expect(displayNameError('x'.repeat(31))).toBe('too_long')
  })
})

describe('notes', () => {
  it('needs 3–140 characters after trimming', () => {
    expect(noteError('finished Q3')).toBeNull()
    expect(noteError(' ok ')).toBe('too_short')
    expect(noteError('x'.repeat(141))).toBe('too_long')
  })
})
