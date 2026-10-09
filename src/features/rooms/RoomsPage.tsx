import { useEffect, useState } from 'react'
import { Loading, LoadFailed } from '../../components/LoadFailed'
import { rovingKeys } from '../../components/roving'
import { copy } from '../../content/copy'
import { useRooms } from '../../stores/rooms'
import { useTimer } from '../../stores/timer'
import { CreateRoomDialog, JoinRoomDialog } from '../home/RoomDialogs'
import { DiscoverList } from './DiscoverList'
import { RoomCard } from './RoomCard'

const t = copy.rooms

/** All your rooms in one place (you study in one at a time, and can move), plus rooms to discover. */
export function RoomsPage() {
  const { rooms, roomsError, load } = useRooms()
  const phase = useTimer((s) => s.phase)
  const [tab, setTab] = useState<'mine' | 'discover'>('mine')
  const [dialog, setDialog] = useState<'create' | 'join' | null>(null)
  const studyingIn = phase.name === 'running' ? phase.session.room_id : null

  useEffect(() => {
    void load()
    const id = window.setInterval(() => void load(), 30_000)
    return () => window.clearInterval(id)
  }, [load])

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl font-bold">{t.title}</h1>
          <p className="mt-1 text-on-bg-muted">{t.hint}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn btn-secondary" onClick={() => setDialog('join')}>
            {copy.home.joinWithCode}
          </button>
          <button type="button" className="btn btn-primary" onClick={() => setDialog('create')}>
            {copy.home.createRoom}
          </button>
        </div>
      </header>

      <div role="tablist" aria-label={t.title} className="grid grid-cols-2 gap-2 sm:max-w-sm">
        {(['mine', 'discover'] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            tabIndex={tab === k ? 0 : -1}
            onKeyDown={rovingKeys}
            className={`chip ${tab === k ? 'chip-on' : ''}`}
            onClick={() => setTab(k)}
          >
            {t.tabs[k]}
          </button>
        ))}
      </div>

      <div role="tabpanel" aria-label={t.tabs[tab]}>
        {tab === 'mine' ? (
          <>
            {rooms === null &&
              (roomsError ? <LoadFailed code={roomsError} onRetry={() => void load()} /> : <Loading />)}
            {rooms !== null && rooms.length === 0 && (
              <div className="card p-6">
                <h2 className="font-display text-xl font-bold">{copy.home.emptyTitle}</h2>
                <p className="mt-2 max-w-prose text-muted">{copy.home.emptyBody}</p>
              </div>
            )}
            <ul className="grid gap-4 md:grid-cols-2">
              {(rooms ?? []).map((r) => (
                <li key={r.id}>
                  <RoomCard room={r} here={r.id === studyingIn} />
                </li>
              ))}
            </ul>
          </>
        ) : (
          <DiscoverList />
        )}
      </div>

      {dialog === 'create' && <CreateRoomDialog onClose={() => setDialog(null)} />}
      {dialog === 'join' && <JoinRoomDialog onClose={() => setDialog(null)} />}
    </div>
  )
}
