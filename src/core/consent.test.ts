import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import table from '../content/consent-ages.json'
import { consentAgeFor, consentStatusFor } from './consent'

describe('consentAgeFor', () => {
  it('looks countries up case-insensitively', () => {
    expect(consentAgeFor('de', table)).toBe(16)
    expect(consentAgeFor('US', table)).toBe(13)
    expect(consentAgeFor('IN', table)).toBe(18)
  })

  it('uses 16 for countries not in the table', () => {
    expect(consentAgeFor('ZZ', table)).toBe(16)
  })
})

describe('consentStatusFor', () => {
  it('blocks under-13s everywhere', () => {
    expect(consentStatusFor('under_13', 'US', table)).toBe('blocked')
  })

  it('needs a parent below the country consent age', () => {
    expect(consentStatusFor('15', 'DE', table)).toBe('pending')
    expect(consentStatusFor('14', 'FR', table)).toBe('pending')
    expect(consentStatusFor('16-17', 'IN', table)).toBe('pending')
  })

  it('needs no parent at or above it', () => {
    expect(consentStatusFor('13', 'GB', table)).toBe('not_required')
    expect(consentStatusFor('15', 'FR', table)).toBe('not_required')
    expect(consentStatusFor('16-17', 'DE', table)).toBe('not_required')
    expect(consentStatusFor('18+', 'IN', table)).toBe('not_required')
  })
})

describe('consent-ages.json and the database seed', () => {
  it('match exactly', () => {
    const dir = fileURLToPath(new URL('../../supabase/migrations', import.meta.url))
    const sql = readdirSync(dir)
      .map((f: string) => readFileSync(join(dir, f), 'utf8'))
      .join('\n')
    const seeded = [...sql.matchAll(/\('([A-Z]{2})', (\d+)\)/g)].map((m) => `${m[1]}=${m[2]}`).sort()
    const json = table.entries.map((e) => `${e.country}=${e.consentAge}`).sort()
    expect(seeded).toEqual(json)
    expect(sql).toContain('select 16') // private.default_consent_age()
    expect(table.defaultConsentAge).toBe(16)
  })
})
