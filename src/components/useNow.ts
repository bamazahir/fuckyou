import { useEffect, useState } from 'react'
import { nowMs } from '../lib/servertime'

/** Server-clock time, re-rendering every `intervalMs` while `active`. */
export function useNow(active: boolean, intervalMs = 1000): number {
  const [now, setNow] = useState(nowMs)
  useEffect(() => {
    if (!active) return
    const id = window.setInterval(() => setNow(nowMs()), intervalMs)
    return () => window.clearInterval(id)
  }, [active, intervalMs])
  return now
}
