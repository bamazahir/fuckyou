import { useEffect, useState } from 'react'
import { Bean } from '../../components/Bean'
import { copy } from '../../content/copy'
import { profileStats } from '../../core/stats'
import { formatClock } from '../../core/time'
import type { SessionRow } from '../../lib/db'
import { nowMs } from '../../lib/servertime'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../stores/auth'
import { useTimer } from '../../stores/timer'
import { NoteDialog } from '../room/NoteDialog'

const t = copy.profile
const DAY_MS = 24 * 60 * 60 * 1000

async function fetchHistory(): Promise<SessionRow[]> {
  const { data } = await supabase
    .from('sessions')
    .select('*')
    .neq('status', 'active')
    .order('started_at', { ascending: false })
    .limit(500)
  return (data as SessionRow[] | null) ?? []
}

function hoursMinutes(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export function ProfilePage() {
  const profile = useAuth((s) => s.profile)
  const signOut = useAuth((s) => s.signOut)
  const timerPhase = useTimer((s) => s.phase.name)
  const [sessions, setSessions] = useState<SessionRow[] | null>(null)
  const [noteFor, setNoteFor] = useState<SessionRow | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    void fetchHistory().then((rows) => {
      if (!cancelled) setSessions(rows)
    })
    return () => {
      cancelled = true
    }
  }, [timerPhase, reloadKey])

  if (!profile) return null
  const finished = (sessions ?? []).filter((s) => s.status === 'completed')
  const stats = profileStats(
    finished.map((s) => ({ startedAtMs: Date.parse(s.started_at), focusSeconds: s.focus_seconds ?? 0 })),
    nowMs(),
    profile.tz,
  )
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
        <Bean colors={profile.avatar.colors} size={64} title={profile.display_name} />
        <div>
          <h1 className="font-display text-3xl font-bold">{profile.display_name}</h1>
          <p className="text-[var(--on-bg-muted)]">@{profile.handle}</p>
        </div>
      </header>

      <dl className="grid grid-cols-3 gap-3">
        {[
          { label: t.lifetime, value: hoursMinutes(stats.lifetimeSeconds) },
          { label: t.thisWeek, value: hoursMinutes(stats.thisWeekSeconds) },
          { label: t.streak, value: String(stats.streakDays) },
        ].map((s) => (
          <div key={s.label} className="card p-4">
            <dt className="text-sm text-muted">{s.label}</dt>
            <dd className="font-display mt-1 text-2xl font-bold tabular-nums">{s.value}</dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="history-heading" className="card p-5">
        <h2 id="history-heading" className="font-display text-xl font-bold">
          {t.historyTitle}
        </h2>
        {sessions !== null && sessions.length === 0 && <p className="mt-2 text-muted">{t.historyEmpty}</p>}
        <ul className="mt-3 divide-y-2 divide-paper-2">
          {(sessions ?? []).map((s) => {
            const canNote =
              s.status === 'completed' && !s.note && s.ended_at && nowMs() - Date.parse(s.ended_at) < DAY_MS
            return (
              <li key={s.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3">
                <div>
                  <p className="font-bold">
                    {copy.room[s.kind]} ·{' '}
                    <span className="tabular-nums">{formatClock(s.focus_seconds ?? 0)}</span>
                    {s.status === 'voided' && <span className="ml-2 text-ember">{t.voided}</span>}
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

      <button type="button" className="btn btn-secondary" onClick={() => void signOut()}>
        {copy.common.signOut}
      </button>

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
