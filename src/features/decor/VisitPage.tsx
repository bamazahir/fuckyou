import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { RoomScene } from '../../components/RoomScene'
import { useDaypart } from '../../components/useDaypart'
import { copy } from '../../content/copy'
import { DEFAULT_PERSONAL, PERSONAL_SIZE } from '../../content/layouts'
import type { LayoutItem } from '../../core/grid'
import type { Avatar } from '../../lib/db'
import { rpcErrorCode, supabase } from '../../lib/supabase'
import { Loading, LoadFailed } from '../../components/LoadFailed'
import { RoomView } from '../room/RoomView'

const t = copy.visit

/** A roommate's personal room, read-only (SPEC §5.4; blocks either way hide it). */
export function VisitPage() {
  const { userId = '' } = useParams()
  const navigate = useNavigate()
  const daypart = useDaypart()
  const [room, setRoom] = useState<
    { display_name: string; avatar: Avatar; layout: LayoutItem[] } | null | 'denied'
  >(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let cancelled = false
    void supabase.rpc('visit_room', { p_user_id: userId }).then(({ data, error }) => {
      if (cancelled) return
      const code = rpcErrorCode(error)
      // Only the server's "no" means not allowed; anything else (offline) can be retried.
      if (code && code !== 'not_allowed') return setFailed(true)
      setRoom(
        code || !data ? 'denied' : (data as { display_name: string; avatar: Avatar; layout: LayoutItem[] }),
      )
    })
    return () => {
      cancelled = true
    }
  }, [userId, attempt])
  if (failed)
    return (
      <LoadFailed
        onRetry={() => {
          setFailed(false)
          setAttempt((n) => n + 1)
        }}
      />
    )
  if (room === null) return <Loading />
  if (room === 'denied')
    return (
      <div className="card p-5">
        <p>{t.notAllowed}</p>
        <button type="button" className="btn btn-secondary mt-3" onClick={() => navigate(-1)}>
          {t.back}
        </button>
      </div>
    )
  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-bold">{t.title(room.display_name)}</h1>
        <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}>
          {t.back}
        </button>
      </header>
      <div className="card card-raised overflow-hidden">
        <RoomView
          className="h-[min(60svh,520px)] min-h-72 lg:h-[600px]"
          size={PERSONAL_SIZE}
          layout={room.layout.length > 0 ? room.layout : DEFAULT_PERSONAL}
          walkIn={false}
          avatars={[
            {
              id: userId,
              name: room.display_name,
              avatar: room.avatar,
              state: 'idle',
              clock: null,
              ariaLabel: room.display_name,
            },
          ]}
          night={daypart === 'night'}
          lampOn={daypart === 'night'}
          label={t.title(room.display_name)}
          fallback={
            <RoomScene beans={[room.avatar]} night={daypart === 'night'} label={t.title(room.display_name)} />
          }
        />
      </div>
    </div>
  )
}
