import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import list from '../content/blocked-words.json'
import { isClean, normalizeWords, type BlockedWord } from './filter'

const words = list.words as BlockedWord[]

describe('normalizeWords', () => {
  it('lowercases, undoes leetspeak and splits on non-letters', () => {
    expect(normalizeWords('Sh1t-HAPPENS 4 r3al')).toEqual(['shit', 'happens', 'a', 'real'])
  })
})

describe('isClean', () => {
  it('passes ordinary study text, including words that merely contain a blocked word', () => {
    for (const ok of [
      'HL Chem IA — data analysis',
      'class assignment on Scunthorpe',
      'Cockburn street essay',
      'grape juice',
      'Dickens reading',
      'Night Owl 2026',
    ]) {
      expect(isClean(ok, words), ok).toBe(true)
    }
  })

  it('catches blocked words, variants and leetspeak', () => {
    for (const bad of ['fuck this', 'FUCKING maths', 'sh1t', 'you b!tch', 'kys', 'a$$hole']) {
      expect(isClean(bad, words), bad).toBe(false)
    }
  })
})

describe('blocked-words.json and the database seed', () => {
  it('match exactly', () => {
    const dir = fileURLToPath(new URL('../../supabase/migrations', import.meta.url))
    const sql = readdirSync(dir)
      .map((f: string) => readFileSync(join(dir, f), 'utf8'))
      .join('\n')
    const seeded = [...sql.matchAll(/\('([a-z]+)', '(exact|prefix|anywhere)'\)/g)]
      .map((m) => `${m[1]}:${m[2]}`)
      .sort()
    expect(seeded).toEqual(words.map((x) => `${x.w}:${x.m}`).sort())
  })
})
