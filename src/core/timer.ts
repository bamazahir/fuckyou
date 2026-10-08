import { effectiveEndMs, type SessionTiming } from './accounting'

export const CHECKIN_GRACE_SECONDS = 10 * 60

export interface ActiveSession extends SessionTiming {
  nextCheckinAtMs: number | null
}

export interface TimerView {
  /** Seconds focused so far. */
  elapsed: number
  /** Pomodoro: seconds left in the focus block. Stopwatch: null. */
  remaining: number | null
  /** 0..1 progress through a pomodoro; null for a stopwatch. */
  progress: number | null
  /** The focus block is over (pomodoro reached its plan, or the 4h cap). */
  finished: boolean
  /** Stopwatch check-in is due ("Still studying?"). */
  checkinDue: boolean
  /** Seconds left to answer a due check-in before the server ends the session. */
  checkinSecondsLeft: number | null
}

export function timerView(s: ActiveSession, nowMs: number): TimerView {
  const endMs = effectiveEndMs(s, nowMs)
  const elapsed = Math.floor((endMs - s.startedAtMs) / 1000)
  const finished = endMs < nowMs
  if (s.kind === 'pomodoro' && s.plannedSeconds !== null) {
    const remaining = Math.max(0, s.plannedSeconds - elapsed)
    return {
      elapsed,
      remaining,
      progress: Math.min(1, elapsed / s.plannedSeconds),
      finished: finished || remaining === 0,
      checkinDue: false,
      checkinSecondsLeft: null,
    }
  }
  const checkinDue = s.nextCheckinAtMs !== null && nowMs >= s.nextCheckinAtMs
  const checkinSecondsLeft =
    checkinDue && s.nextCheckinAtMs !== null
      ? Math.max(0, Math.ceil((s.nextCheckinAtMs + CHECKIN_GRACE_SECONDS * 1000 - nowMs) / 1000))
      : null
  return { elapsed, remaining: null, progress: null, finished, checkinDue, checkinSecondsLeft }
}

export interface PomodoroSettings {
  focusMinutes: number
  shortBreakMinutes: number
  longBreakMinutes: number
  longBreakEvery: number
}

export const DEFAULT_POMODORO: PomodoroSettings = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  longBreakEvery: 4,
}

/** Break length after the n-th completed focus block in a sitting (1-based). */
export function breakMinutesAfter(
  completedBlocks: number,
  settings: PomodoroSettings = DEFAULT_POMODORO,
): number {
  if (completedBlocks > 0 && completedBlocks % settings.longBreakEvery === 0) return settings.longBreakMinutes
  return settings.shortBreakMinutes
}

/** Focus lengths the server accepts (300..7200 s), in whole minutes. */
export function clampFocusMinutes(minutes: number): number {
  if (!Number.isFinite(minutes)) return DEFAULT_POMODORO.focusMinutes
  return Math.min(120, Math.max(5, Math.round(minutes)))
}
