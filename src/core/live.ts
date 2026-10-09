// What a present member's label shows (SPEC §5.3: name + timer + state). Pure.
import { formatClock } from './time'
import { timerView } from './timer'

export interface LiveClockInput {
  state: 'focus' | 'break'
  kind: 'pomodoro' | 'stopwatch'
  started_at: string
  planned_seconds: number | null
  break_until: string | null
}

export interface LiveClock {
  focusing: boolean
  /** "42:10": time left in a pomodoro, time so far on a stopwatch, or break time left. */
  clock: string
}

export function liveClock(m: LiveClockInput, nowMs: number): LiveClock {
  if (m.state === 'focus') {
    const view = timerView(
      {
        kind: m.kind,
        startedAtMs: Date.parse(m.started_at),
        plannedSeconds: m.planned_seconds,
        nextCheckinAtMs: null,
      },
      nowMs,
    )
    return { focusing: true, clock: formatClock(view.remaining ?? view.elapsed) }
  }
  const left = m.break_until ? Math.max(0, Math.ceil((Date.parse(m.break_until) - nowMs) / 1000)) : 0
  return { focusing: false, clock: formatClock(left) }
}

/** Join order for seating: whoever started their current sitting first sits first. */
export function joinOrder<T extends { user_id: string; started_at: string; sitting_seconds: number }>(
  rows: readonly T[],
  nowMs: number,
): string[] {
  const sittingStart = (r: T) => Math.min(Date.parse(r.started_at), nowMs - r.sitting_seconds * 1000)
  return [...rows]
    .sort((a, b) => sittingStart(a) - sittingStart(b) || a.user_id.localeCompare(b.user_id))
    .map((r) => r.user_id)
}
