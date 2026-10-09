import { useEffect, useMemo, useState } from 'react'
import { Loading, LoadFailed } from '../../components/LoadFailed'
import { copy } from '../../content/copy'
import { calendar, lastDays, localDate, streaks, type DayTotal } from '../../core/allTime'
import { shortDuration } from '../../core/room'
import { nowMs } from '../../lib/servertime'
import { rpcErrorCode, supabase } from '../../lib/supabase'
import { useAuth } from '../../stores/auth'
import { BarChart, Heatmap, RoomBars } from './charts'
import { HistoryList } from './HistoryList'

const t = copy.stats

interface Stats {
  tz: string
  total_seconds: number
  sessions: number
  pomodoros: number
  longest_seconds: number
  first_day: string | null
  days: DayTotal[]
  months: { m: string; s: number }[]
  hours: number[]
  weekdays: number[]
  rooms: { name: string | null; personal: boolean; s: number }[]
}

/** All-time stats and graphs (decision 0014): everything here is your own, never compared. */
export function StatsPage() {
  const profile = useAuth((s) => s.profile)
  const [stats, setStats] = useState<Stats | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    void supabase.rpc('my_stats').then(({ data, error }) => {
      if (cancelled) return
      setFailed(rpcErrorCode(error))
      if (!error && data) setStats(data as Stats)
    })
    return () => {
      cancelled = true
    }
  }, [attempt])

  const tz = stats?.tz ?? profile?.tz ?? 'UTC'
  const today = localDate(nowMs(), tz)
  const view = useMemo(() => {
    if (!stats) return null
    const fmt = (opts: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat(undefined, { ...opts, timeZone: 'UTC' })
    const day = (d: string) => new Date(`${d}T12:00:00Z`)
    const long = fmt({ weekday: 'short', day: 'numeric', month: 'short' })
    const short = fmt({ day: 'numeric' })
    const monthName = fmt({ month: 'short' })
    const monthLong = fmt({ month: 'long', year: 'numeric' })
    const weekdayName = (i: number) =>
      fmt({ weekday: 'short' }).format(day(`2026-10-${String(5 + i).padStart(2, '0')}`))
    const days30 = lastDays(stats.days, today, 30)
    return {
      streak: streaks(stats.days, today),
      month: days30.map((d, i) => ({
        key: d.d,
        tick: i % 5 === 4 || i === 29 ? short.format(day(d.d)) : undefined,
        label: long.format(day(d.d)),
        value: d.s,
      })),
      year: calendar(stats.days, today, 53),
      dayLabel: (d: string) => long.format(day(d)),
      hours: stats.hours.map((s, h) => ({
        key: String(h),
        tick: h % 6 === 0 ? `${h}:00` : undefined,
        label: t.hourRange(h),
        value: s,
      })),
      weekdays: stats.weekdays.map((s, i) => ({
        key: String(i),
        tick: weekdayName(i),
        label: weekdayName(i),
        value: s,
      })),
      months: Array.from({ length: 12 }, (_, i) => {
        const d = new Date(`${today.slice(0, 7)}-01T12:00:00Z`)
        d.setUTCMonth(d.getUTCMonth() - (11 - i))
        const m = d.toISOString().slice(0, 7)
        return {
          key: m,
          tick: monthName.format(d),
          label: monthLong.format(d),
          value: stats.months.find((x) => x.m === m)?.s ?? 0,
        }
      }),
      rooms: stats.rooms.map((r) => ({ name: r.personal ? copy.myRoom.title : (r.name ?? '—'), s: r.s })),
    }
  }, [stats, today])

  if (!profile) return null
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-4xl font-bold">{t.title}</h1>
        <p className="mt-1 text-on-bg-muted">{t.hint}</p>
      </header>

      {failed && <LoadFailed code={failed} onRetry={() => setAttempt((n) => n + 1)} />}
      {!failed && !stats && <Loading />}
      {stats && view && (
        <>
          <section className="card card-raised p-5" aria-label={t.totals}>
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {[
                { label: t.total, value: shortDuration(stats.total_seconds) },
                { label: t.sessions, value: String(stats.sessions) },
                { label: t.pomodoros, value: String(stats.pomodoros) },
                { label: t.streakNow, value: copy.home.streakDays(view.streak.current) },
                { label: t.streakBest, value: copy.home.streakDays(view.streak.best) },
                { label: t.longest, value: shortDuration(stats.longest_seconds) },
              ].map((s) => (
                <div key={s.label}>
                  <dt className="text-sm text-muted">{s.label}</dt>
                  <dd className="font-display mt-1 text-2xl font-bold tabular-nums">{s.value}</dd>
                </div>
              ))}
            </dl>
            {stats.sessions === 0 && <p className="mt-4 text-muted">{t.empty}</p>}
          </section>

          <section className="card p-5">
            <BarChart title={t.last30} bars={view.month} highlight={today} />
          </section>
          <section className="card p-5">
            <Heatmap
              title={t.year}
              weeks={view.year}
              dayLabel={view.dayLabel}
              legend={{ less: t.less, more: t.more }}
            />
          </section>
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="card p-5">
              <BarChart title={t.hoursTitle} bars={view.hours} height={130} />
            </section>
            <section className="card p-5">
              <BarChart title={t.weekdaysTitle} bars={view.weekdays} height={130} />
            </section>
            <section className="card p-5">
              <BarChart title={t.monthsTitle} bars={view.months} height={130} highlight={today.slice(0, 7)} />
            </section>
            <section className="card p-5">
              {view.rooms.length > 0 ? (
                <RoomBars title={t.roomsTitle} rows={view.rooms} />
              ) : (
                <p className="text-muted">{t.empty}</p>
              )}
            </section>
          </div>
        </>
      )}

      <HistoryList timeZone={profile.tz} onChanged={() => setAttempt((n) => n + 1)} />
    </div>
  )
}
