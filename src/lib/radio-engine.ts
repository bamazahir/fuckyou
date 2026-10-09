// Plays one station at a time through WebAudio: generated noise loops, or a synced playlist of tracks.
// Everything ends in a hidden <audio> element (via a MediaStream), so the phone treats it as media:
// lock-screen controls attach to it, and iOS volume works. SPEC §11.
import { makeNoise } from '../core/noise'
import { needsSeek, radioPosition, type NoiseKind, type Station, type Track } from '../core/radio'

const LOOP_S = 16
const NOISE_RATE = 44100 // generated once at this rate; WebAudio resamples to the device
const FADE_S = 0.6
/** Per-station loudness, so switching doesn't jump in volume. */
const LEVEL: Record<NoiseKind, number> = { rain: 0.55, cafe: 0.6, brown: 0.45 }

export interface NowPlaying {
  track: Track | null
  offsetS: number
  leftS: number
}

type Channels = Float32Array[]

/** Noise loops are made in a worker (or inline where workers aren't available), once per kind. */
const pending = new Map<NoiseKind, Promise<Channels>>()
let worker: Worker | null | undefined
function noise(kind: NoiseKind): Promise<Channels> {
  const cached = pending.get(kind)
  if (cached) return cached
  const job = new Promise<Channels>((resolve) => {
    if (worker === undefined) {
      try {
        worker = new Worker(new URL('./noise.worker.ts', import.meta.url), { type: 'module' })
      } catch {
        worker = null
      }
    }
    if (!worker) return resolve(makeNoise(kind, NOISE_RATE, LOOP_S))
    const w = worker
    const onMessage = (e: MessageEvent<{ kind: NoiseKind; channels: Channels }>) => {
      if (e.data.kind !== kind) return
      w.removeEventListener('message', onMessage)
      resolve(e.data.channels)
    }
    w.addEventListener('message', onMessage)
    w.addEventListener('error', () => resolve(makeNoise(kind, NOISE_RATE, LOOP_S)), { once: true })
    w.postMessage({ kind, sampleRate: NOISE_RATE, seconds: LOOP_S })
  })
  pending.set(kind, job)
  return job
}

export class RadioEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private out: HTMLAudioElement | null = null
  private buffers = new Map<NoiseKind, AudioBuffer>()
  private stopCurrent: (() => void) | null = null
  private volume = 0.6
  private generation = 0

  constructor(
    private readonly now: () => number,
    private readonly epochMs: number,
  ) {}

  /** Start making a station's sound before anyone presses Play. */
  prewarm(station: Station): void {
    if (station.kind === 'generated') void noise(station.generator)
  }

  /** Must be called from a user gesture the first time (autoplay rules). */
  private audio(): { ctx: AudioContext; master: GainNode } {
    if (!this.ctx || !this.master) {
      this.ctx = new AudioContext()
      this.master = this.ctx.createGain()
      this.master.gain.value = this.volume
      try {
        const dest = this.ctx.createMediaStreamDestination()
        this.master.connect(dest)
        this.out = new Audio()
        this.out.srcObject = dest.stream
      } catch {
        this.master.connect(this.ctx.destination)
      }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    const out = this.out
    if (out && out.paused)
      out.play().catch(() => {
        // The media element was refused: play straight to the speakers instead.
        if (this.master && this.ctx && this.out === out) {
          this.master.connect(this.ctx.destination)
          this.out = null
        }
      })
    return { ctx: this.ctx, master: this.master }
  }

  setVolume(v: number): void {
    this.volume = v
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05)
  }

  async play(station: Station, onTrack: (now: NowPlaying) => void): Promise<void> {
    const { ctx, master } = this.audio()
    this.stop()
    const generation = ++this.generation
    if (station.kind === 'silence') return
    const gain = ctx.createGain()
    gain.gain.value = 0
    gain.connect(master)
    const level = station.kind === 'generated' ? LEVEL[station.generator] : 1
    const fadeIn = () => gain.gain.linearRampToValueAtTime(level, ctx.currentTime + FADE_S)
    const fadeOut = () => {
      const t = ctx.currentTime
      gain.gain.cancelScheduledValues(t)
      gain.gain.setValueAtTime(gain.gain.value, t)
      gain.gain.linearRampToValueAtTime(0, t + FADE_S)
      window.setTimeout(() => gain.disconnect(), FADE_S * 1000 + 50)
    }

    if (station.kind === 'generated') {
      const buf = await this.buffer(ctx, station.generator)
      if (generation !== this.generation) return gain.disconnect() // switched or stopped meanwhile
      const src = ctx.createBufferSource()
      src.buffer = buf
      src.loop = true
      src.connect(gain)
      src.start()
      fadeIn()
      this.stopCurrent = () => {
        fadeOut()
        src.stop(ctx.currentTime + FADE_S + 0.05)
      }
      onTrack({ track: null, offsetS: 0, leftS: 0 })
      return
    }

    // A playlist: everyone hears the same point of the same track (radio model, serverNow()).
    const el = new Audio()
    el.crossOrigin = 'anonymous'
    el.preload = 'auto'
    const node = ctx.createMediaElementSource(el)
    node.connect(gain)
    fadeIn()
    let index = -1
    const seekTo = (s: number) => {
      // Safari ignores currentTime before the metadata is in.
      if (el.readyState >= 1) el.currentTime = s
      else el.addEventListener('loadedmetadata', () => (el.currentTime = s), { once: true })
    }
    const sync = () => {
      const pos = radioPosition(this.now(), this.epochMs, station.tracks)
      if (!pos) return
      const track = station.tracks[pos.index]
      if (!track) return
      if (pos.index !== index) {
        index = pos.index
        el.src = track.src
        seekTo(pos.offsetS)
        void el.play().catch(() => undefined)
      } else if (needsSeek(el.currentTime, pos.offsetS)) {
        seekTo(pos.offsetS)
      }
      onTrack({ track, offsetS: pos.offsetS, leftS: pos.leftS })
    }
    sync()
    el.addEventListener('ended', sync)
    const timer = window.setInterval(sync, 2000)
    this.stopCurrent = () => {
      window.clearInterval(timer)
      el.removeEventListener('ended', sync)
      fadeOut()
      window.setTimeout(() => {
        el.pause()
        el.removeAttribute('src')
        el.load()
      }, FADE_S * 1000)
    }
  }

  stop(): void {
    this.generation++
    if (!this.stopCurrent) return
    this.stopCurrent()
    this.stopCurrent = null
    // Let the audio hardware sleep once the fade is done (unless something started again).
    const generation = this.generation
    window.setTimeout(
      () => {
        if (generation !== this.generation || !this.ctx) return
        this.out?.pause()
        void this.ctx.suspend()
      },
      FADE_S * 1000 + 100,
    )
  }

  private async buffer(ctx: AudioContext, kind: NoiseKind): Promise<AudioBuffer> {
    const cached = this.buffers.get(kind)
    if (cached) return cached
    const channels = await noise(kind)
    const buf = ctx.createBuffer(channels.length, channels[0]?.length ?? 1, NOISE_RATE)
    channels.forEach((data, i) => buf.copyToChannel(data as Float32Array<ArrayBuffer>, i))
    this.buffers.set(kind, buf)
    return buf
  }
}
