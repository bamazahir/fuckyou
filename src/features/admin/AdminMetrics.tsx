import { useEffect, useState } from 'react'
import { Loading, LoadFailed } from '../../components/LoadFailed'
import { copy } from '../../content/copy'
import { percent, toCsv } from '../../core/csv'
import { supabase } from '../../lib/supabase'

const t = copy.metrics

interface Week {
  week: string
  wau: number
  hours: number
  sessions: number
  sessions_per_user: number
  sync_pomodoros: number
  shared_pomodoros: number
  solo_pomodoros: number
  signups: number
}
interface Cohort {
  week: string
  size: number
  d1: number | null
  d7: number | null
  d30: number | null
}
interface Metrics {
  people: number
  weekly: Week[]
  daily: { day: string; dau: number }[]
  retention: Cohort[]
}

const shortDate = (iso: string) =>
  new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
    new Date(`${iso}T12:00:00Z`),
  )

/** Single series → one hue, no legend; bars anchored to the baseline; native tooltips + the table below. */
function HoursChart({ weeks }: { weeks: Week[] }) {
  const W = 560
  const H = 160
  const base = H - 24
  const top = 16
  const max = Math.max(1, ...weeks.map((w) => w.hours))
  const slot = W / weeks.length
  const barW = Math.min(28, slot - 6)
  return (
    <figure className="m-0">
      <figcaption className="font-display text-xl font-bold">{t.hoursChart}</figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-2 block h-auto w-full"
        role="img"
        aria-label={t.hoursChart}
      >
        <path d={`M0 ${base} H${W}`} stroke="var(--surface-2)" strokeWidth="2" />
        {weeks.map((w, i) => {
          const h = w.hours === 0 ? 0 : Math.max(4, ((base - top) * w.hours) / max)
          const x = i * slot + (slot - barW) / 2
          const r = Math.min(4, h / 2)
          const last = i === weeks.length - 1
          return (
            <g key={w.week}>
              <title>{`${shortDate(w.week)}: ${w.hours} h`}</title>
              <rect x={i * slot} y={top - 8} width={slot} height={base - top + 8} fill="transparent" />
              {h > 0 && (
                <path
                  d={`M${x} ${base} V${base - h + r} Q${x} ${base - h} ${x + r} ${base - h} H${x + barW - r} Q${x + barW} ${base - h} ${x + barW} ${base - h + r} V${base} Z`}
                  fill={last ? 'var(--accent)' : 'var(--surface-2)'}
                  stroke="var(--line)"
                  strokeWidth="2"
                />
              )}
              {last && (
                <text
                  x={x + barW / 2}
                  y={base - h - 6}
                  textAnchor="middle"
                  fontSize="12"
                  fill="var(--ink)"
                  fontWeight="700"
                >
                  {w.hours}
                </text>
              )}
              {(i % 2 === weeks.length % 2 || last) && (
                <text x={x + barW / 2} y={H - 6} textAnchor="middle" fontSize="11" fill="var(--muted)">
                  {shortDate(w.week)}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </figure>
  )
}

export function AdminMetrics() {
  const [m, setM] = useState<Metrics | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let cancelled = false
    void supabase.rpc('admin_metrics', { p_weeks: 12 }).then(({ data, error }) => {
      if (cancelled) return
      setFailed(Boolean(error) || !data)
      if (!error && data) setM(data as Metrics)
    })
    return () => {
      cancelled = true
    }
  }, [attempt])
  if (!m) return failed ? <LoadFailed onRetry={() => setAttempt((n) => n + 1)} /> : <Loading />

  const thisWeek = m.weekly.at(-1)
  const today = m.daily.at(-1)
  const weeklyHeader = [
    t.cols.week,
    t.cols.wau,
    t.cols.hours,
    t.cols.sessions,
    t.cols.perUser,
    t.cols.sync,
    t.cols.shared,
    t.cols.solo,
    t.cols.signups,
  ]
  const weeklyRows = m.weekly.map((w) => [
    w.week,
    w.wau,
    w.hours,
    w.sessions,
    w.sessions_per_user,
    w.sync_pomodoros,
    w.shared_pomodoros,
    w.solo_pomodoros,
    w.signups,
  ])
  const retentionHeader = [t.cols.week, t.cols.size, t.cols.d1, t.cols.d7, t.cols.d30]
  const retentionRows = m.retention.map((c) => [
    c.week,
    c.size,
    percent(c.d1, c.size),
    percent(c.d7, c.size),
    percent(c.d30, c.size),
  ])

  function download() {
    const csv = toCsv(weeklyHeader, weeklyRows) + '\r\n' + toCsv(retentionHeader, retentionRows)
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = 'studyroom-metrics.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const table = (caption: string, header: string[], rows: (string | number)[][]) => (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm tabular-nums">
        <caption className="font-display mb-2 text-left text-lg font-bold">{caption}</caption>
        <thead>
          <tr className="border-b-2 border-line">
            {header.map((h) => (
              <th key={h} scope="col" className="px-2 py-1 font-bold whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={header.length} className="px-2 py-2 text-muted">
                {t.empty}
              </td>
            </tr>
          )}
          {rows.map((r) => (
            <tr key={String(r[0])} className="border-b border-surface-2">
              {r.map((v, i) => (
                <td key={i} className="px-2 py-1 whitespace-nowrap">
                  {i === 0 ? shortDate(String(v)) : v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  return (
    <section aria-labelledby="metrics-heading" className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="metrics-heading" className="font-display text-2xl font-bold">
            {t.title}
          </h2>
          <p className="text-sm text-on-bg-muted">{t.hint}</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={download}>
          {t.csv}
        </button>
      </div>
      <dl className="card grid grid-cols-2 divide-surface-2 sm:grid-cols-4 sm:divide-x-2">
        {[
          { label: t.people, value: m.people },
          { label: t.wau, value: thisWeek?.wau ?? 0 },
          { label: t.hours, value: thisWeek?.hours ?? 0 },
          { label: t.dau, value: today?.dau ?? 0 },
        ].map((s) => (
          <div key={s.label} className="px-4 py-3">
            <dt className="text-sm text-muted">{s.label}</dt>
            <dd className="font-display text-2xl font-bold tabular-nums">{s.value}</dd>
          </div>
        ))}
      </dl>
      <div className="card p-5">
        <HoursChart weeks={m.weekly} />
      </div>
      <div className="card space-y-6 p-5">
        {table(t.weeklyTable, weeklyHeader, weeklyRows)}
        {table(t.retentionTable, retentionHeader, retentionRows)}
      </div>
    </section>
  )
}
