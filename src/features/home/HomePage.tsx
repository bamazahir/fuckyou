import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PersonalRoomView } from '../myroom/PersonalRoomView'
import { useDaypart } from '../../components/useDaypart'
import { copy } from '../../content/copy'
import { shortDuration } from '../../core/room'
import { useAuth } from '../../stores/auth'
import { useRooms } from '../../stores/rooms'
import { Loading, LoadFailed } from '../../components/LoadFailed'
import { useMyHistory } from '../stats/useMyHistory'
import { CreateRoomDialog, JoinRoomDialog } from './RoomDialogs'
import { RoomCard } from '../rooms/RoomCard'
import { useTimer } from '../../stores/timer'

const t = copy.home

export function HomePage() {
  const daypart = useDaypart()
  const profile = useAuth((s) => s.profile)
  const personalRoomId = useAuth((s) => s.personalRoomId)
  const { rooms, roomsError, load } = useRooms()
  const { stats } = useMyHistory()
  const [dialog, setDialog] = useState<'create' | 'join' | null>(null)
  const phase = useTimer((s) => s.phase)
  const studyingIn = phase.name === 'running' ? phase.session.room_id : null

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
        <PersonalRoomView className="h-56 sm:h-72" />
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
          <Link to="/rooms" className="btn btn-secondary">
            {t.allRooms}
          </Link>
        </div>

        {rooms === null &&
          (roomsError ? <LoadFailed code={roomsError} onRetry={() => void load()} /> : <Loading />)}
        {rooms !== null && rooms.length === 0 && (
          <div className="card p-6">
            <h3 className="font-display text-xl font-bold">{t.emptyTitle}</h3>
            <p className="mt-2 max-w-prose text-muted">{t.emptyBody}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className="btn btn-primary" onClick={() => setDialog('create')}>
                {t.createRoom}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setDialog('join')}>
                {t.joinWithCode}
              </button>
              <Link to="/rooms" className="btn btn-secondary">
                {copy.rooms.tabs.discover}
              </Link>
            </div>
          </div>
        )}

        <ul className="grid gap-4 md:grid-cols-2">
          {[...(rooms ?? [])]
            .sort((a, b) => b.studying_count - a.studying_count)
            .slice(0, 4)
            .map((r) => (
              <li key={r.id}>
                <RoomCard room={r} here={r.id === studyingIn} />
              </li>
            ))}
        </ul>
      </section>

      {dialog === 'create' && <CreateRoomDialog onClose={() => setDialog(null)} />}
      {dialog === 'join' && <JoinRoomDialog onClose={() => setDialog(null)} />}
    </div>
  )
}
