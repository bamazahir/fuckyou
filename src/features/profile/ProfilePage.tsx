import { useState } from 'react'
import { Bean } from '../../components/Bean'
import { copy } from '../../content/copy'
import { shortDuration } from '../../core/room'
import { formatClock } from '../../core/time'
import type { SessionRow } from '../../lib/db'
import { nowMs } from '../../lib/servertime'
import { useAuth } from '../../stores/auth'
import { NoteDialog } from '../room/NoteDialog'
import { useMyHistory } from '../stats/useMyHistory'
import { AccountSection } from './AccountSection'
import { NotificationSettings } from './NotificationSettings'
import { ThemePicker } from './ThemePicker'
import { WeekChart } from './WeekChart'

const t = copy.profile
const DAY_MS = 24 * 60 * 60 * 1000

export function ProfilePage() {
  const profile = useAuth((s) => s.profile)
  const [reloadKey, setReloadKey] = useState(0)
  const { sessions, stats } = useMyHistory(reloadKey)
  const [noteFor, setNoteFor] = useState<SessionRow | null>(null)

  if (!profile) return null
  const dateFmt = new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: profile.tz,
  })

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-4">
        <Bean avatar={profile.avatar} size={64} title={profile.display_name} />
        <div>
          <h1 className="font-display text-3xl font-bold">{profile.display_name}</h1>
          <p className="text-on-bg-muted">@{profile.handle}</p>
        </div>
      </header>

      <section className="card card-raised p-5">
        <dl className="grid grid-cols-3 gap-3">
          {[
            { label: t.lifetime, value: shortDuration(stats?.lifetimeSeconds ?? 0) },
            { label: t.thisWeek, value: shortDuration(stats?.thisWeekSeconds ?? 0) },
            { label: t.streak, value: String(stats?.streakDays ?? 0) },
          ].map((s) => (
            <div key={s.label}>
              <dt className="text-sm text-muted">{s.label}</dt>
              <dd className="font-display mt-1 text-2xl font-bold tabular-nums">{s.value}</dd>
            </div>
          ))}
        </dl>
        {stats && (
          <div className="mt-5 border-t-2 border-surface-2 pt-4">
            <WeekChart days={stats.lastSevenDays} timeZone={profile.tz} />
          </div>
        )}
      </section>

      <section aria-labelledby="history-heading" className="card p-5">
        <h2 id="history-heading" className="font-display text-xl font-bold">
          {t.historyTitle}
        </h2>
        {sessions !== null && sessions.length === 0 && <p className="mt-2 text-muted">{t.historyEmpty}</p>}
        <ul className="mt-3 divide-y-2 divide-surface-2">
          {(sessions ?? []).slice(0, 30).map((s) => {
            const canNote =
              s.status === 'completed' && !s.note && s.ended_at && nowMs() - Date.parse(s.ended_at) < DAY_MS
            return (
              <li key={s.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3">
                <div>
                  <p className="font-bold">
                    {copy.room[s.kind]} ·{' '}
                    <span className="tabular-nums">{formatClock(s.focus_seconds ?? 0)}</span>
                    {s.status === 'voided' && <span className="ml-2 text-danger">{t.voided}</span>}
                  </p>
                  <p className="text-sm text-muted">{dateFmt.format(new Date(s.started_at))}</p>
                  {s.note && <p className="mt-1 text-sm">{s.note}</p>}
                </div>
                {canNote && (
                  <button type="button" className="btn btn-secondary text-sm" onClick={() => setNoteFor(s)}>
                    {t.addNote}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      </section>

      <ThemePicker />
      <NotificationSettings />
      <AccountSection />

      {noteFor && (
        <NoteDialog
          sessionId={noteFor.id}
          focusSeconds={noteFor.focus_seconds ?? 0}
          onClose={(saved) => {
            setNoteFor(null)
            if (saved) setReloadKey((k) => k + 1)
          }}
        />
      )}
    </div>
  )
}
