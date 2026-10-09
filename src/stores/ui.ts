import { create } from 'zustand'

export interface Toast {
  id: number
  text: string
}

interface UiState {
  toasts: Toast[]
  toast: (text: string) => void
  dismiss: (id: number) => void
}

let nextId = 1

export const useUi = create<UiState>((set, get) => ({
  toasts: [],
  toast: (text) => {
    const id = nextId++
    set({ toasts: [...get().toasts.slice(-2), { id, text }] })
    window.setTimeout(() => get().dismiss(id), 4000)
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}))
