import { copy } from '../../content/copy'
import { formatClock } from '../../core/time'

const stats = [
  { label: copy.profile.lifetime, value: formatClock(0) },
  { label: copy.profile.thisWeek, value: formatClock(0) },
  { label: copy.profile.streak, value: '0' },
]

export function ProfilePage() {
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-bold">{copy.profile.title}</h1>
      <dl className="grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="card p-4">
            <dt className="text-sm text-muted">{s.label}</dt>
            <dd className="font-display mt-1 text-2xl font-bold tabular-nums">{s.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
