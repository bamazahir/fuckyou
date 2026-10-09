import { describe, expect, it } from 'vitest'
import {
  clampVolume,
  isPlayable,
  needsSeek,
  radioPosition,
  resolveStation,
  type Station,
  type Track,
} from './radio'

const track = (duration_s: number, title = 't'): Track => ({
  title,
  artist: 'a',
  src: 'https://x/a.opus',
  duration_s,
  license: 'CC0',
  source_url: 'https://x',
})
const epoch = Date.UTC(2026, 0, 1)

describe('radioPosition', () => {
  const tracks = [track(100, 'one'), track(50, 'two')]
  it('walks through the playlist and loops', () => {
    expect(radioPosition(epoch + 30_000, epoch, tracks)).toEqual({ index: 0, offsetS: 30, leftS: 70 })
    expect(radioPosition(epoch + 120_000, epoch, tracks)).toEqual({ index: 1, offsetS: 20, leftS: 30 })
    expect(radioPosition(epoch + 160_000, epoch, tracks)).toEqual({ index: 0, offsetS: 10, leftS: 90 })
  })
  it('handles times before the epoch', () => {
    expect(radioPosition(epoch - 10_000, epoch, tracks)).toEqual({ index: 1, offsetS: 40, leftS: 10 })
  })
  it('gives two devices with the same clock the same answer', () => {
    const now = Date.UTC(2026, 9, 9, 14, 3, 7, 250)
    expect(radioPosition(now, epoch, tracks)).toEqual(radioPosition(now, epoch, tracks))
  })
  it('has nothing to say about an empty playlist', () => {
    expect(radioPosition(epoch, epoch, [])).toBeNull()
    expect(radioPosition(epoch, epoch, [track(0)])).toBeNull()
  })
  it('skips zero-length tracks', () => {
    expect(radioPosition(epoch + 5_000, epoch, [track(0), track(10)])).toEqual({
      index: 1,
      offsetS: 5,
      leftS: 5,
    })
  })
})

describe('stations', () => {
  const stations: Station[] = [
    { id: 'lofi', name: 'Lofi', emoji: '🎧', kind: 'tracks', tracks: [] },
    { id: 'rain', name: 'Rain', emoji: '🌧️', kind: 'generated', generator: 'rain' },
    { id: 'silence', name: 'Silence', emoji: '🤫', kind: 'silence' },
  ]
  it('a playlist without tracks is not playable', () => {
    expect(stations.map(isPlayable)).toEqual([false, true, true])
  })
  it('falls back to the first playable station', () => {
    expect(resolveStation(stations, 'lofi').id).toBe('rain')
    expect(resolveStation(stations, 'nope').id).toBe('rain')
    expect(resolveStation(stations, null).id).toBe('rain')
    expect(resolveStation(stations, 'silence').id).toBe('silence')
  })
})

describe('helpers', () => {
  it('re-seeks only on real drift', () => {
    expect(needsSeek(10, 10.3)).toBe(false)
    expect(needsSeek(10, 10.5)).toBe(true)
  })
  it('clamps stored volume', () => {
    expect(clampVolume(2)).toBe(1)
    expect(clampVolume(-1)).toBe(0)
    expect(clampVolume('loud')).toBe(0.6)
    expect(clampVolume(Number.NaN)).toBe(0.6)
    expect(clampVolume(0.3)).toBe(0.3)
  })
})
