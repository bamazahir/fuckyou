import { create } from 'zustand'
import type { MyRoom } from '../lib/db'
import { rpcErrorCode, supabase } from '../lib/supabase'

const PENDING_INVITE_KEY = 'studyroom.pendingInvite'

interface RoomsState {
  rooms: MyRoom[] | null
  blocked: Set<string>
  load: () => Promise<void>
  loadBlocks: () => Promise<void>
  create: (name: string) => Promise<{ id?: string; error?: string }>
  join: (code: string) => Promise<{ id?: string; error?: string }>
  leave: (roomId: string) => Promise<string | null>
  block: (userId: string) => Promise<void>
  unblock: (userId: string) => Promise<void>
}

export const useRooms = create<RoomsState>((set, get) => ({
  rooms: null,
  blocked: new Set(),

  load: async () => {
    const { data } = await supabase.rpc('my_rooms')
    set({ rooms: (data as MyRoom[] | null) ?? [] })
  },

  loadBlocks: async () => {
    const { data } = await supabase.from('blocks').select('blocked_id')
    set({ blocked: new Set(((data as { blocked_id: string }[] | null) ?? []).map((b) => b.blocked_id)) })
  },

  create: async (name) => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    const { data, error } = await supabase.rpc('create_room', { p_name: name.trim(), p_tz: tz })
    if (error) return { error: rpcErrorCode(error) ?? 'generic' }
    void get().load()
    return { id: (data as { id: string }).id }
  },

  join: async (code) => {
    const { data, error } = await supabase.rpc('join_room', { p_code: code })
    if (error) return { error: rpcErrorCode(error) ?? 'generic' }
    void get().load()
    return { id: (data as { id: string }).id }
  },

  leave: async (roomId) => {
    const { error } = await supabase.rpc('leave_room', { p_room_id: roomId })
    if (error) return rpcErrorCode(error) ?? 'generic'
    void get().load()
    return null
  },

  block: async (userId) => {
    await supabase.rpc('block_user', { p_user_id: userId })
    set({ blocked: new Set([...get().blocked, userId]) })
  },

  unblock: async (userId) => {
    await supabase.rpc('unblock_user', { p_user_id: userId })
    const next = new Set(get().blocked)
    next.delete(userId)
    set({ blocked: next })
  },
}))

/** An invite opened while signed out is remembered until sign-in finishes (SPEC §5.1 step 0). */
export const pendingInvite = {
  get: (): string | null => {
    try {
      return window.sessionStorage.getItem(PENDING_INVITE_KEY)
    } catch {
      return null
    }
  },
  set: (code: string) => {
    try {
      window.sessionStorage.setItem(PENDING_INVITE_KEY, code)
    } catch {
      // storage blocked: the user re-opens the link after signing in
    }
  },
  clear: () => {
    try {
      window.sessionStorage.removeItem(PENDING_INVITE_KEY)
    } catch {
      // ignore
    }
  },
}
