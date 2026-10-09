// What the radio is playing, for which room, and each listener's own volume (SPEC §11).
import { create } from 'zustand'
import { APP_NAME } from '../config'
import { copy } from '../content/copy'
import { STATION_EPOCH_MS } from '../content/stations'
import { clampVolume, type Station } from '../core/radio'
import { RadioEngine, type NowPlaying } from '../lib/radio-engine'
import { nowMs } from '../lib/servertime'

const PREFS_KEY = 'studyroom.radio'
const PERSONAL_KEY = 'studyroom.radio.personal'

function readPrefs(): { volume: number; muted: boolean } {
  try {
    const raw = JSON.parse(window.localStorage.getItem(PREFS_KEY) ?? '{}') as Record<string, unknown>
    return { volume: clampVolume(raw.volume), muted: raw.muted === true }
  } catch {
    return { volume: 0.6, muted: false }
  }
}

function writePrefs(p: { volume: number; muted: boolean }): void {
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(p))
  } catch {
    // Private mode or blocked storage: the setting just isn't remembered.
  }
}

/** The station you picked for your own room, on this device. */
export function personalStation(): string | null {
  try {
    return window.localStorage.getItem(PERSONAL_KEY)
  } catch {
    return null
  }
}
export function savePersonalStation(id: string): void {
  try {
    window.localStorage.setItem(PERSONAL_KEY, id)
  } catch {
    // not remembered
  }
}

let engine: RadioEngine | null = null
const getEngine = () => (engine ??= new RadioEngine(nowMs, STATION_EPOCH_MS))

interface RadioState {
  roomId: string | null
  station: Station | null
  playing: boolean
  now: NowPlaying | null
  volume: number
  muted: boolean
  /** Start (or switch to) a station in a room. Call from a click: browsers need a gesture. */
  play: (roomId: string, station: Station) => Promise<void>
  pause: () => void
  /** The room changed station: follow it if we're playing there. */
  follow: (roomId: string, station: Station) => void
  setVolume: (v: number) => void
  toggleMute: () => void
  /** Leaving the room. */
  leave: (roomId: string) => void
}

export const useRadio = create<RadioState>((set, get) => {
  const prefs = readPrefs()
  const applyVolume = () => {
    const { volume, muted } = get()
    getEngine().setVolume(muted ? 0 : volume)
    writePrefs({ volume, muted })
  }
  const media = (station: Station | null, playing: boolean, now: NowPlaying | null) => {
    if (!('mediaSession' in navigator)) return
    try {
      navigator.mediaSession.playbackState = station ? (playing ? 'playing' : 'paused') : 'none'
      navigator.mediaSession.metadata = station
        ? new MediaMetadata({
            title: now?.track?.title ?? station.name,
            artist: now?.track?.artist ?? copy.radio.generatedArtist,
            album: `${APP_NAME} · ${station.name}`,
            artwork: [{ src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }],
          })
        : null
      const { roomId } = get()
      navigator.mediaSession.setActionHandler('play', () => {
        const s = get().station
        if (s && roomId) void get().play(roomId, s)
      })
      navigator.mediaSession.setActionHandler('pause', () => get().pause())
    } catch {
      // Media Session is optional.
    }
  }

  return {
    roomId: null,
    station: null,
    playing: false,
    now: null,
    volume: prefs.volume,
    muted: prefs.muted,

    play: async (roomId, station) => {
      set({ roomId, station, playing: true })
      applyVolume()
      await getEngine().play(station, (now) => {
        if (get().station?.id !== station.id) return
        set({ now })
        media(station, get().playing, now)
      })
      media(station, true, get().now)
    },

    pause: () => {
      getEngine().stop()
      set({ playing: false })
      media(get().station, false, get().now)
    },

    follow: (roomId, station) => {
      const s = get()
      if (s.roomId !== roomId || s.station?.id === station.id) return
      if (s.playing) void s.play(roomId, station)
      else set({ station, now: null })
    },

    setVolume: (v) => {
      set({ volume: clampVolume(v), muted: false })
      applyVolume()
    },

    toggleMute: () => {
      set({ muted: !get().muted })
      applyVolume()
    },

    leave: (roomId) => {
      if (get().roomId !== roomId) return
      getEngine().stop()
      set({ roomId: null, station: null, playing: false, now: null })
      media(null, false, null)
    },
  }
})
