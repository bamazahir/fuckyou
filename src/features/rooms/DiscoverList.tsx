import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loading, LoadFailed } from '../../components/LoadFailed'
import { ErrorText } from '../../components/Screen'
import { copy } from '../../content/copy'
import { rpcErrorCode, supabase } from '../../lib/supabase'
import { useRooms } from '../../stores/rooms'

const t = copy.rooms

interface Listed {
  id: string
  name: string
  member_count: number
  studying_count: number
  sync_pomodoro: boolean
}

/**
 * Rooms their owners chose to list (decision 0014). Only names and counts show here: who's inside
 * stays private until you join. You only see rooms of people in your age group.
 */
export function DiscoverList() {
  const navigate = useNavigate()
  const reload = useRooms((s) => s.load)
  const [rooms, setRooms] = useState<Listed[] | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [joining, setJoining] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void supabase.rpc('discover_rooms').then(({ data, error: err }) => {
      if (cancelled) return
      setFailed(rpcErrorCode(err))
      if (!err) setRooms((data as Listed[] | null) ?? [])
    })
    return () => {
      cancelled = true
    }
  }, [attempt])

  async function join(room: Listed) {
    setError(null)
    setJoining(room.id)
    const { error: err } = await supabase.rpc('join_listed_room', { p_room_id: room.id })
    setJoining(null)
    if (err) return setError(rpcErrorCode(err))
    await reload()
    navigate(`/room/${room.id}`)
  }

  if (failed) return <LoadFailed code={failed} onRetry={() => setAttempt((n) => n + 1)} />
  if (rooms === null) return <Loading />
  return (
    <div className="space-y-4">
      <p className="text-sm text-on-bg-muted">{t.discoverHint}</p>
      <ErrorText code={error} />
      {rooms.length === 0 ? (
        <div className="card p-6">
          <h2 className="font-display text-xl font-bold">{t.discoverEmptyTitle}</h2>
          <p className="mt-2 max-w-prose text-muted">{t.discoverEmptyBody}</p>
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {rooms.map((r) => (
            <li key={r.id} className="card flex flex-col justify-between gap-3 p-4">
              <div className="min-w-0">
                <h3 className="font-display text-xl font-bold break-words">{r.name}</h3>
                {r.sync_pomodoro && <span className="pill mt-1">{copy.sync.badge}</span>}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span
                  className={`inline-block h-2.5 w-2.5 rounded-full border-2 border-line ${r.studying_count > 0 ? 'bg-good' : 'bg-surface-2'}`}
                  aria-hidden="true"
                />
                <span className="font-bold">{copy.home.studyingNow(r.studying_count)}</span>
                <span className="text-muted">· {copy.home.members(r.member_count)}</span>
                <button
                  type="button"
                  className="btn btn-primary ml-auto"
                  disabled={joining !== null}
                  onClick={() => void join(r)}
                  aria-label={t.joinNamed(r.name)}
                >
                  {t.join}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
