// Profile stats from a user's own sessions (SPEC §5.5): lifetime, this week, day streak.
// Days and weeks follow the profile time zone; a week starts Monday 00:00.

export interface FinishedSession {
  startedAtMs: number
  focusSeconds: number
}

export const STREAK_DAY_MIN_SECONDS = 25 * 60

/** Local calendar date (YYYY-MM-DD) of an instant in a time zone. */
export function localDate(ms: number, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(ms))
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** The Monday (YYYY-MM-DD) of the week containing a local date. */
export function weekStart(date: string): string {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay() // 0 = Sunday
  return addDays(date, -((dow + 6) % 7))
}

export interface ProfileStats {
  lifetimeSeconds: number
  thisWeekSeconds: number
  streakDays: number
}

export function profileStats(
  sessions: readonly FinishedSession[],
  nowMs: number,
  timeZone: string,
): ProfileStats {
  const today = localDate(nowMs, timeZone)
  const thisWeek = weekStart(today)
  const perDay = new Map<string, number>()
  let lifetimeSeconds = 0
  let thisWeekSeconds = 0
  for (const s of sessions) {
    const day = localDate(s.startedAtMs, timeZone)
    lifetimeSeconds += s.focusSeconds
    if (weekStart(day) === thisWeek) thisWeekSeconds += s.focusSeconds
    perDay.set(day, (perDay.get(day) ?? 0) + s.focusSeconds)
  }
  const studied = (d: string) => (perDay.get(d) ?? 0) >= STREAK_DAY_MIN_SECONDS
  // A streak survives until the end of today: count back from today, or from yesterday if today is empty.
  let cursor = studied(today) ? today : addDays(today, -1)
  let streakDays = 0
  while (studied(cursor)) {
    streakDays += 1
    cursor = addDays(cursor, -1)
  }
  return { lifetimeSeconds, thisWeekSeconds, streakDays }
}
