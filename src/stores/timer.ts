import { create } from 'zustand'
import type { SessionKind } from '../core/accounting'
import { breakMinutesAfter } from '../core/timer'
import type { SessionRow } from '../lib/db'
import { nowMs } from '../lib/servertime'
import { rpcErrorCode, supabase } from '../lib/supabase'

export type TimerPhase =
  | { name: 'idle' }
  | { name: 'running'; session: SessionRow }
  | { name: 'ended'; session: SessionRow }
  | { name: 'break'; endsAtMs: number; minutes: number }

interface TimerState {
  phase: TimerPhase
  busy: boolean
  error: string | null
  loadActive: () => Promise<void>
  start: (
    roomId: string,
    kind: SessionKind,
    plannedSeconds: number | null,
    statusLine: string,
  ) => Promise<void>
  end: () => Promise<void>
  checkin: () => Promise<void>
  /** Saves the note; returns the coins it paid, or null on error. */
  submitNote: (sessionId: string, note: string) => Promise<number | null>
  /** `shared`: the room runs a shared pomodoro, whose break the dock shows instead. */
  afterEnded: (opts?: { shared?: boolean }) => Promise<void>
  skipBreak: () => void
}

export const useTimer = create<TimerState>((set, get) => ({
  phase: { name: 'idle' },
  busy: false,
  error: null,

  loadActive: async () => {
    const { data } = await supabase.from('sessions').select('*').eq('status', 'active').maybeSingle()
    if (data) set({ phase: { name: 'running', session: data as SessionRow } })
  },

  start: async (roomId, kind, plannedSeconds, statusLine) => {
    set({ busy: true, error: null })
    const { data, error } = await supabase.rpc('start_session', {
      p_room_id: roomId,
      p_kind: kind,
      p_planned_seconds: plannedSeconds,
      p_status_line: statusLine.trim() || null,
    })
    set({ busy: false })
    if (error) return set({ error: rpcErrorCode(error) })
    set({ phase: { name: 'running', session: data as SessionRow } })
  },

  end: async () => {
    const { phase } = get()
    if (phase.name !== 'running' || get().busy) return
    set({ busy: true, error: null })
    const { data, error } = await supabase.rpc('end_session', { p_session_id: phase.session.id })
    set({ busy: false })
    if (error) return set({ error: rpcErrorCode(error) })
    set({ phase: { name: 'ended', session: data as SessionRow } })
  },

  checkin: async () => {
    const { phase } = get()
    if (phase.name !== 'running') return
    const { data, error } = await supabase.rpc('checkin', { p_session_id: phase.session.id })
    if (error) {
      // Too late: the server already ended it. Show the end sheet with the stored result.
      const { data: row } = await supabase.from('sessions').select('*').eq('id', phase.session.id).single()
      if (row) set({ phase: { name: 'ended', session: row as SessionRow } })
      return
    }
    set({ phase: { name: 'running', session: data as SessionRow } })
  },

  submitNote: async (sessionId, note) => {
    const { data, error } = await supabase.rpc('submit_note', {
      p_session_id: sessionId,
      p_note: note,
      p_public: false,
    })
    if (error) {
      set({ error: rpcErrorCode(error) })
      return null
    }
    return typeof data === 'number' ? data : 0
  },

  /** After the end sheet: pomodoros go to a break, stopwatches back to idle. */
  afterEnded: async (opts) => {
    const { phase } = get()
    if (phase.name !== 'ended') return
    if (phase.session.kind !== 'pomodoro' || opts?.shared) return set({ phase: { name: 'idle' } })
    const { count } = await supabase
      .from('sessions')
      .select('id', { count: 'exact', head: true })
      .eq('sitting_id', phase.session.sitting_id)
      .eq('kind', 'pomodoro')
      .eq('status', 'completed')
    const minutes = breakMinutesAfter(count ?? 1)
    set({ phase: { name: 'break', minutes, endsAtMs: nowMs() + minutes * 60_000 } })
  },

  skipBreak: () => set({ phase: { name: 'idle' } }),
}))
