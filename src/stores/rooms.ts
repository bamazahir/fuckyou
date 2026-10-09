import { create } from 'zustand'
import type { MyRoom } from '../lib/db'
import { rpcErrorCode, supabase } from '../lib/supabase'

const PENDING_INVITE_KEY = 'studyroom.pendingInvite'

interface RoomsState {
  rooms: MyRoom[] | null
  /** Set when loading rooms failed (rooms stays as it was, so a failure never reads as "no rooms"). */
  roomsError: string | null
  blocked: Set<string>
  blocksError: string | null
  load: () => Promise<void>
  loadBlocks: () => Promise<void>
  create: (name: string) => Promise<{ id?: string; error?: string }>
  join: (code: string) => Promise<{ id?: string; error?: string }>
  leave: (roomId: string) => Promise<string | null>
  /** Returns an error code, or null once the server has it. */
  block: (userId: string) => Promise<string | null>
  unblock: (userId: string) => Promise<string | null>
}

export const useRooms = create<RoomsState>((set, get) => ({
  rooms: null,
  roomsError: null,
  blocked: new Set(),
  blocksError: null,

  load: async () => {
    const { data, error } = await supabase.rpc('my_rooms')
    if (error) return set({ roomsError: rpcErrorCode(error) })
    set({ rooms: (data as MyRoom[] | null) ?? [], roomsError: null })
  },

  loadBlocks: async () => {
    const { data, error } = await supabase.from('blocks').select('blocked_id')
    if (error) return set({ blocksError: rpcErrorCode(error) })
    set({
      blocked: new Set(((data as { blocked_id: string }[] | null) ?? []).map((b) => b.blocked_id)),
      blocksError: null,
    })
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
    const { error } = await supabase.rpc('block_user', { p_user_id: userId })
    if (error) return rpcErrorCode(error)
    set({ blocked: new Set([...get().blocked, userId]) })
    return null
  },

  unblock: async (userId) => {
    const { error } = await supabase.rpc('unblock_user', { p_user_id: userId })
    if (error) return rpcErrorCode(error)
    const next = new Set(get().blocked)
    next.delete(userId)
    set({ blocked: next })
    return null
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
