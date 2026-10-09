import { copy } from '../../content/copy'
import { shortDuration } from '../../core/room'

/**
 * Last 7 days of focus (dataviz: single series → one hue, no legend, title names it; thin rounded bars
 * anchored to the baseline; only today is direct-labeled; native tooltips + an accessible list).
 */
export function WeekChart({
  days,
  timeZone,
}: {
  days: { date: string; seconds: number }[]
  timeZone: string
}) {
  const W = 320
  const H = 140
  const base = H - 22
  const top = 18
  const max = Math.max(...days.map((d) => d.seconds), 25 * 60)
  const slot = W / days.length
  const barW = 22
  const dayName = (date: string) =>
    new Intl.DateTimeFormat(undefined, { weekday: 'short', timeZone: 'UTC' }).format(
      new Date(`${date}T12:00:00Z`),
    )
  const longName = (date: string) =>
    new Intl.DateTimeFormat(undefined, {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    }).format(new Date(`${date}T12:00:00Z`))
  void timeZone

  return (
    <figure className="m-0">
      <figcaption className="font-display text-xl font-bold">{copy.profile.weekChart}</figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-2 block h-auto w-full"
        role="img"
        aria-label={copy.profile.weekChart}
      >
        {/* recessive baseline */}
        <path d={`M0 ${base} H${W}`} stroke="var(--surface-2)" strokeWidth="2" />
        {days.map((d, i) => {
          const h = d.seconds === 0 ? 0 : Math.max(6, ((base - top) * d.seconds) / max)
          const x = i * slot + (slot - barW) / 2
          const today = i === days.length - 1
          const r = Math.min(4, h / 2)
          return (
            <g key={d.date}>
              <title>{`${longName(d.date)}: ${shortDuration(d.seconds)}`}</title>
              {/* generous hit target for the tooltip */}
              <rect x={i * slot} y={top - 10} width={slot} height={base - top + 10} fill="transparent" />
              {h > 0 && (
                <path
                  d={`M${x} ${base} V${base - h + r} Q${x} ${base - h} ${x + r} ${base - h} H${x + barW - r} Q${x + barW} ${base - h} ${x + barW} ${base - h + r} V${base} Z`}
                  fill={today ? 'var(--accent)' : 'var(--surface-2)'}
                  stroke="var(--line)"
                  strokeWidth="2"
                />
              )}
              {today && d.seconds > 0 && (
                <text
                  x={x + barW / 2}
                  y={base - h - 6}
                  textAnchor="middle"
                  fontSize="12"
                  fontWeight="700"
                  fill="var(--ink)"
                >
                  {shortDuration(d.seconds)}
                </text>
              )}
              <text
                x={i * slot + slot / 2}
                y={H - 6}
                textAnchor="middle"
                fontSize="12"
                fill={today ? 'var(--ink)' : 'var(--muted)'}
                fontWeight={today ? 700 : 400}
              >
                {dayName(d.date)}
              </text>
            </g>
          )
        })}
      </svg>
      <ul className="sr-only">
        {days.map((d) => (
          <li key={d.date}>{`${longName(d.date)}: ${shortDuration(d.seconds)}`}</li>
        ))}
      </ul>
    </figure>
  )
}
