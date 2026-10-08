import { create } from 'zustand'
import { clockOffset, serverNow } from '../core/servertime'
import { supabase } from './supabase'

interface ClockState {
  offsetMs: number
  sync: () => Promise<void>
}

export const useClock = create<ClockState>((set) => ({
  offsetMs: 0,
  sync: async () => {
    const t0 = Date.now()
    const { data, error } = await supabase.rpc('server_time')
    const t1 = Date.now()
    if (error || typeof data !== 'string') return
    set({ offsetMs: clockOffset(t0, Date.parse(data), t1) })
  },
}))

/** Current time on the server's clock (SPEC §6.1). */
export function nowMs(): number {
  return serverNow(useClock.getState().offsetMs)
}

let timer: number | undefined
export function startClockSync(): void {
  if (timer !== undefined) return
  void useClock.getState().sync()
  timer = window.setInterval(() => void useClock.getState().sync(), 10 * 60 * 1000)
}
