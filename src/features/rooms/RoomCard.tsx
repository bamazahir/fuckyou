import { Link } from 'react-router-dom'
import { AvatarStack } from '../../components/AvatarStack'
import { copy } from '../../content/copy'
import type { MyRoom } from '../../lib/db'

const t = copy.home

/** One of your rooms: who's in it right now, and your place on its week board. */
export function RoomCard({ room, here = false }: { room: MyRoom; here?: boolean }) {
  return (
    <Link
      to={`/room/${room.id}`}
      className="card card-raised flex min-h-28 flex-col justify-between gap-3 p-4 transition-transform hover:-translate-y-0.5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-xl font-bold break-words">{room.name}</h3>
          <div className="mt-1 flex flex-wrap gap-1">
            {room.sync_pomodoro && <span className="pill">{copy.sync.badge}</span>}
            {here && <span className="pill bg-accent text-on-accent">{copy.rooms.youreHere}</span>}
          </div>
        </div>
        <AvatarStack people={room.studying} size={32} />
      </div>
      <p className="flex flex-wrap items-center gap-2 text-sm">
        <span
          className={`inline-block h-2.5 w-2.5 rounded-full border-2 border-line ${room.studying_count > 0 ? 'bg-good' : 'bg-surface-2'}`}
          aria-hidden="true"
        />
        <span className="font-bold">{t.studyingNow(room.studying_count)}</span>
        <span className="text-muted">· {t.members(room.member_count)}</span>
        {room.week_rank ? <span className="pill ml-auto">{t.weekRank(room.week_rank)}</span> : null}
      </p>
    </Link>
  )
}
