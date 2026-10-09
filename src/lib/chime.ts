// A soft two-note chime made with WebAudio, so no audio file is needed (SPEC §5.3 "someone sat down").
let ctx: AudioContext | null = null

export function chime(): void {
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    const now = ctx.currentTime
    for (const [i, freq] of [659.25, 987.77].entries()) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0, now + i * 0.12)
      gain.gain.linearRampToValueAtTime(0.08, now + i * 0.12 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.12 + 0.9)
      osc.connect(gain).connect(ctx.destination)
      osc.start(now + i * 0.12)
      osc.stop(now + i * 0.12 + 1)
    }
  } catch {
    // Audio blocked until a user gesture, or unsupported: stay silent.
  }
}
