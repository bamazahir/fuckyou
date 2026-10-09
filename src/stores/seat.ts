// The chair you picked in your own room, on this device (decision 0015). Shared rooms keep it on
// the server (choose_seat) so everyone sees it; your own room has nobody else to show it to.
import { create } from 'zustand'

const KEY = 'studyroom.seat.personal'

function read(): number | null {
  try {
    const n = Number(window.localStorage.getItem(KEY))
    return window.localStorage.getItem(KEY) !== null && Number.isInteger(n) && n >= 0 && n < 64 ? n : null
  } catch {
    return null
  }
}

export const usePersonalSeat = create<{ seat: number | null; pick: (seat: number) => void }>((set) => ({
  seat: read(),
  pick: (seat) => {
    set({ seat })
    try {
      window.localStorage.setItem(KEY, String(seat))
    } catch {
      // Private mode or blocked storage: the chair just isn't remembered.
    }
  },
}))
