// Mirrors private.session_end_time / finish_session in supabase/migrations (SPEC §6.4).
// The server is authoritative; this exists so the UI shows the same number the server will store.

export const HARD_CAP_SECONDS = 4 * 60 * 60

export type SessionKind = 'pomodoro' | 'stopwatch'

export interface SessionTiming {
  kind: SessionKind
  startedAtMs: number
  plannedSeconds: number | null
}

/** When a session would end if finished at `endMs`: clamped to start, the 4h cap and a pomodoro's plan. */
export function effectiveEndMs(s: SessionTiming, endMs: number): number {
  const caps = [s.startedAtMs + HARD_CAP_SECONDS * 1000]
  if (s.kind === 'pomodoro' && s.plannedSeconds !== null) caps.push(s.startedAtMs + s.plannedSeconds * 1000)
  return Math.min(Math.max(endMs, s.startedAtMs), ...caps)
}

export function focusSeconds(s: SessionTiming, endMs: number): number {
  return Math.floor((effectiveEndMs(s, endMs) - s.startedAtMs) / 1000)
}
