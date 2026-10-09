import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AvatarStack } from '../../components/AvatarStack'
import { RoomScene } from '../../components/RoomScene'
import { useDaypart } from '../../components/useDaypart'
import { copy } from '../../content/copy'
import { shortDuration } from '../../core/room'
import { useAuth } from '../../stores/auth'
import { useRooms } from '../../stores/rooms'
import { Loading, LoadFailed } from '../../components/LoadFailed'
import { useTimer } from '../../stores/timer'
import { useMyHistory } from '../stats/useMyHistory'
import { CreateRoomDialog, JoinRoomDialog } from './RoomDialogs'

const t = copy.home

export function HomePage() {
  const daypart = useDaypart()
  const profile = useAuth((s) => s.profile)
  const personalRoomId = useAuth((s) => s.personalRoomId)
  const studying = useTimer((s) => s.phase.name === 'running')
  const { rooms, roomsError, load } = useRooms()
  const { stats } = useMyHistory()
  const [dialog, setDialog] = useState<'create' | 'join' | null>(null)

  useEffect(() => {
    void load()
    const id = window.setInterval(() => void load(), 30_000)
    return () => window.clearInterval(id)
  }, [load])

  if (!profile) return null
  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-4xl font-bold">{t.hi(profile.display_name)}</h1>
        <p className="mt-1 text-lg text-on-bg-muted">{t.greeting[daypart]}</p>
      </header>

      <section className="card card-raised overflow-hidden">
        <RoomScene
          beans={[profile.avatar]}
          night={daypart === 'night'}
          lampOn={studying || daypart === 'night'}
          label={t.soloTitle}
        />
        <div className="border-t-2 border-line">
          <dl className="grid grid-cols-3 divide-x-2 divide-surface-2">
            {[
              { label: t.today, value: shortDuration(stats?.todaySeconds ?? 0) },
              { label: t.thisWeek, value: shortDuration(stats?.thisWeekSeconds ?? 0) },
              { label: t.streak, value: t.streakDays(stats?.streakDays ?? 0) },
            ].map((s) => (
              <div key={s.label} className="px-4 py-3">
                <dt className="text-sm text-muted">{s.label}</dt>
                <dd className="font-display text-xl font-bold tabular-nums">{s.value}</dd>
              </div>
            ))}
          </dl>
          {personalRoomId && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t-2 border-surface-2 px-4 py-3">
              <p className="text-muted">{t.soloBody}</p>
              <Link to={`/room/${personalRoomId}`} className="btn btn-primary">
                {t.soloButton}
              </Link>
            </div>
          )}
        </div>
      </section>

      <section aria-labelledby="rooms-heading" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="rooms-heading" className="font-display text-2xl font-bold">
            {t.roomsHeading}
          </h2>
          <div className="flex gap-2">
            <button type="button" className="btn btn-secondary" onClick={() => setDialog('join')}>
              {t.joinWithCode}
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setDialog('create')}>
              {t.createRoom}
            </button>
          </div>
        </div>

        {rooms === null && (roomsError ? <LoadFailed onRetry={() => void load()} /> : <Loading />)}
        {rooms !== null && rooms.length === 0 && (
          <div className="card p-6">
            <h3 className="font-display text-xl font-bold">{t.emptyTitle}</h3>
            <p className="mt-2 max-w-prose text-muted">{t.emptyBody}</p>
          </div>
        )}

        <ul className="grid gap-4 md:grid-cols-2">
          {(rooms ?? []).map((r) => (
            <li key={r.id}>
              <Link
                to={`/room/${r.id}`}
                className="card card-raised flex min-h-28 flex-col justify-between gap-3 p-4 hover:-translate-y-0.5 transition-transform"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-xl font-bold">{r.name}</h3>
                    {r.sync_pomodoro && <span className="pill mt-1">{copy.sync.badge}</span>}
                  </div>
                  <AvatarStack people={r.studying} size={28} />
                </div>
                <p className="flex items-center gap-2 text-sm">
                  <span
                    className={`inline-block h-2.5 w-2.5 rounded-full border-2 border-line ${r.studying_count > 0 ? 'bg-good' : 'bg-surface-2'}`}
                    aria-hidden="true"
                  />
                  <span className="font-bold">{t.studyingNow(r.studying_count)}</span>
                  <span className="text-muted">· {t.members(r.member_count)}</span>
                  {r.week_rank ? <span className="pill ml-auto">{t.weekRank(r.week_rank)}</span> : null}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {dialog === 'create' && <CreateRoomDialog onClose={() => setDialog(null)} />}
      {dialog === 'join' && <JoinRoomDialog onClose={() => setDialog(null)} />}
    </div>
  )
}
