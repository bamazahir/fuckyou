import { useEffect, useState } from 'react'
import { daypartAt, msUntilNextDaypart, type Daypart } from '../core/daypart'

/** Keeps <html data-daypart> in sync with the viewer's local time. */
export function useDaypart(): Daypart {
  const [daypart, setDaypart] = useState<Daypart>(() => daypartAt(new Date().getHours()))

  useEffect(() => {
    document.documentElement.dataset.daypart = daypart
    const timer = window.setTimeout(
      () => setDaypart(daypartAt(new Date().getHours())),
      msUntilNextDaypart(new Date()) + 1000,
    )
    return () => window.clearTimeout(timer)
  }, [daypart])

  return daypart
}
