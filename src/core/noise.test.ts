import { describe, expect, it } from 'vitest'
import { makeNoise, rng } from './noise'

const SR = 8000
const rms = (x: Float32Array) => Math.sqrt(x.reduce((a, v) => a + v * v, 0) / x.length)

describe('rng', () => {
  it('is deterministic and in [0, 1)', () => {
    const a = rng(42)
    const b = rng(42)
    for (let i = 0; i < 1000; i++) {
      const v = a()
      expect(v).toBe(b())
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

describe.each(['rain', 'cafe', 'brown'] as const)('%s', (kind) => {
  const [left = new Float32Array(), right = new Float32Array()] = makeNoise(kind, SR, 4, 3)
  it('is two channels of the right length', () => {
    expect(left).toHaveLength(SR * 4)
    expect(right).toHaveLength(SR * 4)
  })
  it('stays finite and under full scale, and is audible', () => {
    for (const ch of [left, right]) {
      expect(ch.every((v) => Number.isFinite(v) && Math.abs(v) <= 0.8 + 1e-6)).toBe(true)
      expect(rms(ch)).toBeGreaterThan(0.05)
    }
  })
  it('has decorrelated channels (wide, not mono)', () => {
    expect(left.some((v, i) => Math.abs(v - (right[i] ?? 0)) > 0.05)).toBe(true)
  })
  it('loops without a click', () => {
    const ch = left
    let maxStep = 0
    for (let i = 1; i < ch.length; i++) maxStep = Math.max(maxStep, Math.abs((ch[i] ?? 0) - (ch[i - 1] ?? 0)))
    expect(Math.abs((ch[0] ?? 0) - (ch[ch.length - 1] ?? 0))).toBeLessThanOrEqual(maxStep)
  })
  it('is the same for the same seed', () => {
    expect(makeNoise(kind, SR, 1, 9)[0]).toEqual(makeNoise(kind, SR, 1, 9)[0])
  })
})
