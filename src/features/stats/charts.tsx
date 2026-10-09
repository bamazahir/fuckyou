import { useLayoutEffect, useRef, useState } from 'react'
import { level, type DayTotal } from '../../core/allTime'
import { shortDuration } from '../../core/room'

// Small single-series SVG charts for the Stats tab (dataviz skill): one hue, thin rounded bars on a
// recessive baseline, a hover/focus readout instead of numbers on every bar, and a table for screen
// readers. No legends: each chart's title names its one series.

export interface Bar {
  key: string
  /** Axis label (shown for some bars only). */
  tick?: string
  /** Full label for the readout and the table. */
  label: string
  value: number
}

export function BarChart({
  title,
  bars,
  height = 150,
  highlight,
}: {
  title: string
  bars: readonly Bar[]
  height?: number
  /** Key of the bar drawn in the accent (e.g. today). */
  highlight?: string
}) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 640
  const top = 8
  const base = height - 22
  const max = Math.max(...bars.map((b) => b.value), 1)
  const slot = W / Math.max(bars.length, 1)
  const barW = Math.max(3, Math.min(28, slot * 0.62))
  const shown = hover !== null ? bars[hover] : bars.find((b) => b.key === highlight)
  return (
    <figure className="m-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <figcaption className="font-display text-lg font-bold">{title}</figcaption>
        <p className="text-sm text-muted tabular-nums" aria-hidden="true">
          {shown ? `${shown.label} · ${shortDuration(shown.value)}` : ' '}
        </p>
      </div>
      <svg
        viewBox={`0 0 ${W} ${height}`}
        className="mt-1 block h-auto w-full"
        aria-hidden="true"
        onPointerLeave={() => setHover(null)}
      >
        <path d={`M0 ${base} H${W}`} stroke="var(--surface-2)" strokeWidth="2" />
        {bars.map((b, i) => {
          const h = b.value === 0 ? 0 : Math.max(4, ((base - top) * b.value) / max)
          const x = i * slot + (slot - barW) / 2
          const r = Math.min(4, h / 2, barW / 2)
          const on = hover === i || b.key === highlight
          return (
            <g key={b.key} onPointerEnter={() => setHover(i)}>
              <rect x={i * slot} y={0} width={slot} height={base} fill="transparent" />
              {h > 0 && (
                <path
                  d={`M${x} ${base} V${base - h + r} Q${x} ${base - h} ${x + r} ${base - h} H${x + barW - r} Q${x + barW} ${base - h} ${x + barW} ${base - h + r} V${base} Z`}
                  fill={on ? 'var(--accent)' : 'var(--rest)'}
                  stroke="var(--line)"
                  strokeWidth="1.5"
                />
              )}
              {b.tick && (
                <text
                  x={i * slot + slot / 2}
                  y={height - 6}
                  textAnchor="middle"
                  fontSize="13"
                  fill="var(--muted)"
                >
                  {b.tick}
                </text>
              )}
            </g>
          )
        })}
      </svg>
      <table className="sr-only">
        <caption>{title}</caption>
        <tbody>
          {bars.map((b) => (
            <tr key={b.key}>
              <th scope="row">{b.label}</th>
              <td>{shortDuration(b.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}

const SHADES = [
  'var(--surface-2)',
  'color-mix(in oklab, var(--accent) 35%, var(--surface))',
  'color-mix(in oklab, var(--accent) 60%, var(--surface))',
  'color-mix(in oklab, var(--accent) 82%, var(--surface))',
  'var(--accent)',
]

/** A study calendar: one square per day, Monday at the top, darker = more time (single hue). */
export function Heatmap({
  title,
  weeks,
  dayLabel,
  legend,
}: {
  title: string
  weeks: readonly (DayTotal | null)[][]
  dayLabel: (d: string) => string
  legend: { less: string; more: string }
}) {
  const [hover, setHover] = useState<DayTotal | null>(null)
  const scroller = useRef<HTMLDivElement>(null)
  // Start at the recent end (today is on the right).
  useLayoutEffect(() => {
    const el = scroller.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [weeks.length])
  const cell = 13
  const gap = 3
  const W = weeks.length * (cell + gap)
  const H = 7 * (cell + gap)
  return (
    <figure className="m-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <figcaption className="font-display text-lg font-bold">{title}</figcaption>
        <p className="text-sm text-muted tabular-nums" aria-hidden="true">
          {hover ? `${dayLabel(hover.d)} · ${shortDuration(hover.s)}` : ' '}
        </p>
      </div>
      <div ref={scroller} className="mt-2 overflow-x-auto overscroll-x-contain pb-1">
        <svg
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          aria-hidden="true"
          onPointerLeave={() => setHover(null)}
        >
          {weeks.map((week, w) =>
            week.map((day, i) =>
              day ? (
                <rect
                  key={day.d}
                  x={w * (cell + gap)}
                  y={i * (cell + gap)}
                  width={cell}
                  height={cell}
                  rx={3}
                  fill={SHADES[level(day.s)]}
                  stroke={hover?.d === day.d ? 'var(--line)' : 'none'}
                  strokeWidth={2}
                  onPointerEnter={() => setHover(day)}
                />
              ) : null,
            ),
          )}
        </svg>
      </div>
      <div className="mt-2 flex items-center gap-1 text-xs text-muted" aria-hidden="true">
        {legend.less}
        {SHADES.map((s) => (
          <span key={s} className="inline-block size-3 rounded-[3px]" style={{ background: s }} />
        ))}
        {legend.more}
      </div>
      <table className="sr-only">
        <caption>{title}</caption>
        <tbody>
          {weeks
            .flat()
            .filter((d): d is DayTotal => d !== null && d.s > 0)
            .map((d) => (
              <tr key={d.d}>
                <th scope="row">{dayLabel(d.d)}</th>
                <td>{shortDuration(d.s)}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </figure>
  )
}

/** Where your time went, room by room: labelled horizontal bars. */
export function RoomBars({ title, rows }: { title: string; rows: readonly { name: string; s: number }[] }) {
  const max = Math.max(...rows.map((r) => r.s), 1)
  return (
    <figure className="m-0">
      <figcaption className="font-display text-lg font-bold">{title}</figcaption>
      <ul className="mt-2 space-y-2">
        {rows.map((r) => (
          <li key={r.name} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-sm">
            <span className="truncate font-bold">{r.name}</span>
            <span className="h-3 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
              <span
                className="block h-full rounded-full border border-line bg-rest"
                style={{ width: `${Math.max(4, (r.s / max) * 100)}%` }}
              />
            </span>
            <span className="tabular-nums text-muted">{shortDuration(r.s)}</span>
          </li>
        ))}
      </ul>
    </figure>
  )
}
