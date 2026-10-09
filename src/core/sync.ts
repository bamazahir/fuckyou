// Room-synced pomodoro phase maths (SPEC §6.2.1). Pure; mirrored by private.sync_phase in SQL.

export interface SyncSettings {
  epochMs: number
  focusS: number
  breakS: number
}

export interface SyncPhase {
  phase: 'focus' | 'break'
  /** Seconds left in the current phase. */
  left: number
  /** When the next shared focus starts (ms). */
  nextFocusAtMs: number
}

/** Below this much focus left, offer "join the next focus" instead of a short session. */
export const JOIN_LATE_MIN_S = 5 * 60

export function syncPhase(s: SyncSettings, nowMs: number): SyncPhase {
  const cycle = s.focusS + s.breakS
  const pos = ((((nowMs - s.epochMs) / 1000) % cycle) + cycle) % cycle
  const toNextFocus = cycle - pos
  if (pos < s.focusS)
    return { phase: 'focus', left: s.focusS - pos, nextFocusAtMs: nowMs + toNextFocus * 1000 }
  return { phase: 'break', left: toNextFocus, nextFocusAtMs: nowMs + toNextFocus * 1000 }
}

/** What Start does right now: join this focus, or wait for the next one. */
export function joinAction(p: SyncPhase): 'join_now' | 'join_next' {
  return p.phase === 'focus' && p.left >= JOIN_LATE_MIN_S ? 'join_now' : 'join_next'
}
