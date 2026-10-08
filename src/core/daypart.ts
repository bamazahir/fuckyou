export type Daypart = 'day' | 'night'

/** The room follows the viewer's local time: day 06:00–17:59, night otherwise (studyroom-look §1). */
export function daypartAt(localHour: number): Daypart {
  return localHour >= 6 && localHour < 18 ? 'day' : 'night'
}

/** Milliseconds from `now` until the daypart next changes, for scheduling a re-render. */
export function msUntilNextDaypart(now: Date): number {
  const next = new Date(now)
  const h = now.getHours()
  next.setHours(h < 6 ? 6 : h < 18 ? 18 : 30, 0, 0, 0)
  return next.getTime() - now.getTime()
}
