// Synthesises a noise loop off the main thread (a few hundred ms of maths on a phone).
import { makeNoise } from '../core/noise'
import type { NoiseKind } from '../core/radio'

interface Job {
  kind: NoiseKind
  sampleRate: number
  seconds: number
}

const scope = self as unknown as {
  onmessage: ((e: MessageEvent<Job>) => void) | null
  postMessage: (message: unknown, transfer: Transferable[]) => void
}

scope.onmessage = (e) => {
  const { kind, sampleRate, seconds } = e.data
  const channels = makeNoise(kind, sampleRate, seconds)
  scope.postMessage(
    { kind, channels },
    channels.map((c) => c.buffer),
  )
}
