// Pictures rendered on the device by scene/Thumbs.tsx: shop items (per theme) and bean portraits.
import { create } from 'zustand'
import type { Avatar } from '../lib/db'

interface ThumbState {
  urls: Record<string, string>
  queue: string[]
  /** The avatar behind each queued bean key. */
  beans: Record<string, Avatar>
  request: (key: string) => void
  requestBean: (avatar: Avatar) => string
  done: (key: string, url: string) => void
}

/** Same avatar, same key, whatever order its fields were saved in. */
export function beanKey(avatar: Avatar): string {
  const sort = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(sort)
      : v && typeof v === 'object'
        ? Object.fromEntries(
            Object.entries(v as Record<string, unknown>)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([k, x]) => [k, sort(x)]),
          )
        : v
  return `bean:${JSON.stringify(sort(avatar))}`
}

export const useThumbs = create<ThumbState>((set, get) => ({
  urls: {},
  queue: [],
  beans: {},
  request: (key) => {
    const { urls, queue } = get()
    if (urls[key] !== undefined || queue.includes(key)) return
    set({ queue: [...queue, key] })
  },
  requestBean: (avatar) => {
    const key = beanKey(avatar)
    const { urls, queue, beans } = get()
    if (urls[key] === undefined && !queue.includes(key))
      set({ queue: [...queue, key], beans: { ...beans, [key]: avatar } })
    return key
  },
  done: (key, url) =>
    set((s) => ({ urls: { ...s.urls, [key]: url }, queue: s.queue.filter((k) => k !== key) })),
}))

/** Cache key: theme + mode + item, so a theme change re-renders thumbnails in the new colors. */
export const thumbKey = (theme: string, mode: string, itemId: string) => `item:${theme}:${mode}:${itemId}`
