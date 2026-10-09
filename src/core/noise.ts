// The noise stations, synthesised as short seamless loops (decision 0013): no audio files, so nothing
// to license, download or cache. Deterministic for a seed, so tests can check them.
import type { NoiseKind } from './radio'

/** Small, fast, seeded PRNG (mulberry32) returning [0, 1). */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const white = (r: () => number) => r() * 2 - 1

function brown(out: Float32Array, r: () => number): void {
  let last = 0
  for (let i = 0; i < out.length; i++) {
    last = (last + 0.02 * white(r)) / 1.02
    out[i] = last * 3.5
  }
}

/** Paul Kellet's economy pink filter. */
function pink(out: Float32Array, r: () => number): void {
  let b0 = 0
  let b1 = 0
  let b2 = 0
  for (let i = 0; i < out.length; i++) {
    const w = white(r)
    b0 = 0.99765 * b0 + w * 0.099046
    b1 = 0.963 * b1 + w * 0.2965164
    b2 = 0.57 * b2 + w * 1.0526913
    out[i] = (b0 + b1 + b2 + w * 0.1848) * 0.11
  }
}

const coeff = (hz: number, sampleRate: number) => 1 - Math.exp((-2 * Math.PI * hz) / sampleRate)

function lowpass(x: Float32Array, hz: number, sampleRate: number): void {
  const a = coeff(hz, sampleRate)
  let y = 0
  for (let i = 0; i < x.length; i++) x[i] = y += a * ((x[i] ?? 0) - y)
}

function highpass(x: Float32Array, hz: number, sampleRate: number): void {
  const a = coeff(hz, sampleRate)
  let low = 0
  for (let i = 0; i < x.length; i++) {
    const v = x[i] ?? 0
    low += a * (v - low)
    x[i] = v - low
  }
}

/** A short decaying tone added at `at` (rain drops, cups on saucers). */
function ping(out: Float32Array, at: number, hz: number, decayS: number, amp: number, sampleRate: number) {
  const decay = decayS * sampleRate
  const len = Math.min(out.length - at, Math.ceil(decay * 5))
  for (let k = 0; k < len; k++) {
    const i = at + k
    out[i] = (out[i] ?? 0) + amp * Math.exp(-k / decay) * Math.sin((2 * Math.PI * hz * k) / sampleRate)
  }
}

function rain(out: Float32Array, r: () => number, sampleRate: number, loopS: number): void {
  pink(out, r)
  highpass(out, 500, sampleRate)
  lowpass(out, 7000, sampleRate) // soft, not hissy
  // A slow swell, a whole number of cycles per loop so it repeats seamlessly.
  for (let i = 0; i < out.length; i++)
    out[i] = (out[i] ?? 0) * 1.4 * (1 + 0.12 * Math.sin((2 * Math.PI * 2 * i) / (loopS * sampleRate)))
  for (let n = Math.round(loopS * 45); n > 0; n--) {
    const near = r() < 0.08
    ping(
      out,
      Math.floor(r() * out.length),
      1800 + r() * 3600,
      0.004 + r() * 0.01,
      near ? 0.12 + r() * 0.1 : 0.02 + r() * 0.05,
      sampleRate,
    )
  }
}

function cafe(out: Float32Array, r: () => number, sampleRate: number, loopS: number): void {
  // Murmur: voice-band noise whose loudness drifts like a room of conversations.
  pink(out, r)
  highpass(out, 180, sampleRate)
  lowpass(out, 900, sampleRate)
  lowpass(out, 1400, sampleRate)
  const env = new Float32Array(out.length)
  for (let i = 0; i < env.length; i++) env[i] = white(r)
  lowpass(env, 0.6, sampleRate)
  lowpass(env, 0.6, sampleRate)
  let peak = 0
  for (const v of env) peak = Math.max(peak, Math.abs(v))
  for (let i = 0; i < out.length; i++)
    out[i] = (out[i] ?? 0) * 3 * (0.65 + (0.35 * (env[i] ?? 0)) / (peak || 1))
  // Cups and spoons, now and then.
  for (let n = Math.round(loopS * 0.5); n > 0; n--) {
    const at = Math.floor(r() * out.length)
    const hz = 2200 + r() * 2000
    const amp = 0.03 + r() * 0.05
    ping(out, at, hz, 0.06 + r() * 0.08, amp, sampleRate)
    ping(out, at, hz * 2.76, 0.03, amp * 0.5, sampleRate)
  }
}

/** Blends the extra tail into the start, so the loop point has no click. */
function seamless(x: Float32Array, n: number, fade: number): Float32Array {
  const out = x.slice(0, n)
  for (let k = 0; k < fade; k++) {
    const t = k / fade
    out[k] = (x[k] ?? 0) * Math.sqrt(t) + (x[n + k] ?? 0) * Math.sqrt(1 - t)
  }
  return out
}

function normalize(x: Float32Array, peakTo: number): void {
  let peak = 0
  for (const v of x) peak = Math.max(peak, Math.abs(v))
  if (peak === 0) return
  const g = peakTo / peak
  for (let i = 0; i < x.length; i++) x[i] = (x[i] ?? 0) * g
}

/** Two channels (left, right) of a loop `seconds` long, peak 0.8. */
export function makeNoise(kind: NoiseKind, sampleRate: number, seconds: number, seed = 1): Float32Array[] {
  const n = Math.round(sampleRate * seconds)
  const fade = Math.round(sampleRate * 0.5)
  return [seed, seed + 7919].map((s) => {
    const r = rng(s)
    const x = new Float32Array(n + fade)
    if (kind === 'brown') brown(x, r)
    else if (kind === 'rain') rain(x, r, sampleRate, seconds)
    else cafe(x, r, sampleRate, seconds)
    const out = seamless(x, n, fade)
    normalize(out, 0.8)
    return out
  })
}
