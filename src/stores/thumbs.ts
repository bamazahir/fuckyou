// Shop thumbnails, rendered on the device in the current theme by scene/Thumbs.tsx and cached per theme.
import { create } from 'zustand'

interface ThumbState {
  urls: Record<string, string>
  queue: string[]
  request: (key: string) => void
  done: (key: string, url: string) => void
}

export const useThumbs = create<ThumbState>((set, get) => ({
  urls: {},
  queue: [],
  request: (key) => {
    const { urls, queue } = get()
    if (urls[key] || queue.includes(key)) return
    set({ queue: [...queue, key] })
  },
  done: (key, url) =>
    set((s) => ({ urls: { ...s.urls, [key]: url }, queue: s.queue.filter((k) => k !== key) })),
}))

/** Cache key: theme + mode + item, so a theme change re-renders thumbnails in the new colors. */
export const thumbKey = (theme: string, mode: string, itemId: string) => `${theme}:${mode}:${itemId}`
