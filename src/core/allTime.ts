// All-time stats helpers for the Stats tab: streaks, a calendar heatmap and day series, all on
// 'YYYY-MM-DD' local dates (already in the person's timezone, from my_stats()).

export interface DayTotal {
  d: string
  s: number
}

const DAY = 86_400_000
const toMs = (iso: string) => Date.parse(`${iso}T00:00:00Z`)
const toIso = (ms: number) => new Date(ms).toISOString().slice(0, 10)

/** "YYYY-MM-DD" for a moment in a timezone. */
export function localDate(ms: number, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ms)
}

/** The last `n` days up to `today`, oldest first, with 0 for days without study. */
export function lastDays(days: readonly DayTotal[], today: string, n: number): DayTotal[] {
  const by = new Map(days.map((x) => [x.d, x.s]))
  const end = toMs(today)
  return Array.from({ length: n }, (_, i) => {
    const d = toIso(end - (n - 1 - i) * DAY)
    return { d, s: by.get(d) ?? 0 }
  })
}

/** Current streak (ending today, or yesterday if today has nothing yet) and the best ever. */
export function streaks(days: readonly DayTotal[], today: string): { current: number; best: number } {
  const studied = new Set(days.filter((x) => x.s > 0).map((x) => x.d))
  let best = 0
  let run = 0
  let prev: number | null = null
  for (const d of [...studied].sort()) {
    const ms = toMs(d)
    run = prev !== null && ms - prev === DAY ? run + 1 : 1
    best = Math.max(best, run)
    prev = ms
  }
  let current = 0
  let cursor = toMs(today)
  if (!studied.has(today)) cursor -= DAY
  while (studied.has(toIso(cursor))) {
    current++
    cursor -= DAY
  }
  return { current, best }
}

/** Weeks (Monday first) × 7 days ending with the week of `today`; days after today are null. */
export function calendar(days: readonly DayTotal[], today: string, weeks: number): (DayTotal | null)[][] {
  const by = new Map(days.map((x) => [x.d, x.s]))
  const end = toMs(today)
  const weekday = (new Date(end).getUTCDay() + 6) % 7 // Monday = 0
  const start = end - weekday * DAY - (weeks - 1) * 7 * DAY
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, i) => {
      const ms = start + (w * 7 + i) * DAY
      if (ms > end) return null
      const d = toIso(ms)
      return { d, s: by.get(d) ?? 0 }
    }),
  )
}

/** Heatmap shade, 0–4: none, under 30 min, under 1 h, under 2 h, 2 h or more. */
export function level(seconds: number): 0 | 1 | 2 | 3 | 4 {
  if (seconds <= 0) return 0
  if (seconds < 1800) return 1
  if (seconds < 3600) return 2
  if (seconds < 7200) return 3
  return 4
}
