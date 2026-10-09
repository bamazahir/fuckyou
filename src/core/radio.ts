// Ambient radio (SPEC §11): which station plays, and where in it everyone is. Room sync is the
// "radio model": position = (serverNow - epoch) mod total length, so no server needs to stream.

export type NoiseKind = 'rain' | 'cafe' | 'brown'

export interface Track {
  title: string
  artist: string
  /** Public Storage URL (Opus/AAC, ~96 kbps). */
  src: string
  duration_s: number
  license: string
  source_url: string
}

export type Station =
  | { id: string; name: string; emoji: string; kind: 'tracks'; tracks: Track[] }
  | { id: string; name: string; emoji: string; kind: 'generated'; generator: NoiseKind }
  | { id: string; name: string; emoji: string; kind: 'silence' }

/** A station with nothing to play yet (lofi before licensed tracks are added) can't be picked. */
export function isPlayable(s: Station): boolean {
  return s.kind !== 'tracks' || s.tracks.some((t) => t.duration_s > 0)
}

/** The station a room plays: its own if playable, else the first playable one. */
export function resolveStation(stations: readonly Station[], id: string | null | undefined): Station {
  const own = stations.find((s) => s.id === id)
  if (own && isPlayable(own)) return own
  const first = stations.find(isPlayable)
  if (!first) throw new Error('no playable station')
  return first
}

export interface RadioPosition {
  index: number
  /** Seconds into that track. */
  offsetS: number
  /** Seconds until it ends. */
  leftS: number
}

/** Where the station is right now; the same answer on every device with the same server clock. */
export function radioPosition(
  nowMs: number,
  epochMs: number,
  tracks: readonly Track[],
): RadioPosition | null {
  const lengths = tracks.map((t) => Math.max(0, t.duration_s))
  const total = lengths.reduce((a, b) => a + b, 0)
  if (total <= 0) return null
  const raw = ((nowMs - epochMs) / 1000) % total
  let at = raw < 0 ? raw + total : raw
  for (const [index, len] of lengths.entries()) {
    if (at < len) return { index, offsetS: at, leftS: len - at }
    at -= len
  }
  // Floating point can land exactly on the end: that's the start of the first track.
  return { index: lengths.findIndex((l) => l > 0), offsetS: 0, leftS: lengths.find((l) => l > 0) ?? 0 }
}

/** Re-seek a playing track only when it has drifted noticeably (SPEC M6: within 1 s across devices). */
export function needsSeek(currentS: number, expectedS: number, toleranceS = 0.75): boolean {
  return Math.abs(currentS - expectedS) > toleranceS
}

/** 0–1 volume from a stored value (anything odd becomes the default). */
export function clampVolume(v: unknown, fallback = 0.6): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback
}
