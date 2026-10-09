// Plays one station at a time through WebAudio: generated noise loops, or a synced playlist of tracks
// (an <audio> element routed through the same gain, so volume works on iOS too). SPEC §11.
import { makeNoise } from '../core/noise'
import { needsSeek, radioPosition, type NoiseKind, type Station, type Track } from '../core/radio'

const LOOP_S = 16
const FADE_S = 0.6
/** Per-station loudness, so switching doesn't jump in volume. */
const LEVEL: Record<NoiseKind, number> = { rain: 0.55, cafe: 0.6, brown: 0.45 }

export interface NowPlaying {
  track: Track | null
  offsetS: number
  leftS: number
}

export class RadioEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private buffers = new Map<NoiseKind, AudioBuffer>()
  private stopCurrent: (() => void) | null = null
  private volume = 0.6

  constructor(
    private readonly now: () => number,
    private readonly epochMs: number,
  ) {}

  /** Must be called from a user gesture the first time (autoplay rules). */
  private audio(): { ctx: AudioContext; master: GainNode } {
    if (!this.ctx || !this.master) {
      this.ctx = new AudioContext()
      this.master = this.ctx.createGain()
      this.master.gain.value = this.volume
      this.master.connect(this.ctx.destination)
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    return { ctx: this.ctx, master: this.master }
  }

  setVolume(v: number): void {
    this.volume = v
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05)
  }

  async play(station: Station, onTrack: (now: NowPlaying) => void): Promise<void> {
    const { ctx, master } = this.audio()
    this.stop()
    if (station.kind === 'silence') return
    const gain = ctx.createGain()
    gain.gain.value = 0
    gain.connect(master)
    const level = station.kind === 'generated' ? LEVEL[station.generator] : 1
    gain.gain.linearRampToValueAtTime(level, ctx.currentTime + FADE_S)
    const fadeOut = () => {
      const t = ctx.currentTime
      gain.gain.cancelScheduledValues(t)
      gain.gain.setValueAtTime(gain.gain.value, t)
      gain.gain.linearRampToValueAtTime(0, t + FADE_S)
      window.setTimeout(() => gain.disconnect(), FADE_S * 1000 + 50)
    }

    if (station.kind === 'generated') {
      const src = ctx.createBufferSource()
      src.buffer = this.buffer(ctx, station.generator)
      src.loop = true
      src.connect(gain)
      src.start()
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
    let index = -1
    const sync = () => {
      const pos = radioPosition(this.now(), this.epochMs, station.tracks)
      if (!pos) return
      const track = station.tracks[pos.index]
      if (!track) return
      if (pos.index !== index) {
        index = pos.index
        el.src = track.src
        el.currentTime = pos.offsetS
        void el.play().catch(() => undefined)
      } else if (needsSeek(el.currentTime, pos.offsetS)) {
        el.currentTime = pos.offsetS
      }
      onTrack({ track, offsetS: pos.offsetS, leftS: pos.leftS })
    }
    sync()
    el.addEventListener('ended', sync)
    const timer = window.setInterval(sync, 5000)
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
    this.stopCurrent?.()
    this.stopCurrent = null
  }

  /** Generated once per kind and kept: ~16 s of stereo samples. */
  private buffer(ctx: AudioContext, kind: NoiseKind): AudioBuffer {
    const cached = this.buffers.get(kind)
    if (cached) return cached
    const channels = makeNoise(kind, ctx.sampleRate, LOOP_S)
    const buf = ctx.createBuffer(channels.length, channels[0]?.length ?? 1, ctx.sampleRate)
    channels.forEach((data, i) => buf.copyToChannel(data as Float32Array<ArrayBuffer>, i))
    this.buffers.set(kind, buf)
    return buf
  }
}
