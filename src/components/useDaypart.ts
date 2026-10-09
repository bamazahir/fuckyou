import { useEffect } from 'react'
import { daypartAt, msUntilNextDaypart, type Daypart } from '../core/daypart'
import { useTheme } from '../stores/theme'

/** Current daypart; also re-applies the theme when day turns to night (auto mode). */
export function useDaypart(): Daypart {
  const resolved = useTheme((s) => s.resolved)
  const tick = useTheme((s) => s.tick)
  useEffect(() => {
    const timer = window.setTimeout(tick, msUntilNextDaypart(new Date()) + 1000)
    return () => window.clearTimeout(timer)
  }, [resolved, tick])
  return daypartAt(new Date().getHours())
}
