import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import catalog from './catalog.json'
import { MODELS } from './layouts'

describe('catalog.json', () => {
  it('has the ~40 items the spec asks for, priced 20–1500, with unique ids', () => {
    const all = [...catalog.items, ...catalog.accessories]
    expect(all.length).toBeGreaterThanOrEqual(35)
    expect(new Set(all.map((i) => i.id)).size).toBe(all.length)
    for (const i of all) expect(i.price, i.id).toBeGreaterThanOrEqual(20)
    for (const i of all) expect(i.price, i.id).toBeLessThanOrEqual(1500)
  })

  it('only uses models the scene can draw, and starter items that exist', () => {
    const ids = new Set(catalog.items.map((i) => i.id))
    for (const i of catalog.items) expect(MODELS as readonly string[], i.id).toContain(i.model)
    for (const id of [...catalog.starter.personal, ...catalog.starter.shared])
      expect(ids.has(id), id).toBe(true)
  })

  it('matches the SQL seed and the generated layout parity test', () => {
    expect(() =>
      execFileSync('node', ['scripts/catalog/generate.mjs', '--check'], { stdio: 'pipe' }),
    ).not.toThrow()
  })
})
