import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AvatarStack } from '../../components/AvatarStack'
import { LoadFailed } from '../../components/LoadFailed'
import { NoWebGL } from '../../components/NoWebGL'
import { DEFAULT_SHARED, SHARED_SIZE } from '../../content/layouts'
import { RoomView } from '../room/RoomView'
import { ThumbRenderer } from '../shop/ItemThumb'
import { ErrorText, Screen } from '../../components/Screen'
import { useDaypart } from '../../components/useDaypart'
import { copy, errorMessage } from '../../content/copy'
import { parseInviteCode } from '../../core/room'
import type { RoomPreview } from '../../lib/db'
import { rpcErrorCode, supabase } from '../../lib/supabase'
import { useAuth } from '../../stores/auth'
import { pendingInvite, useRooms } from '../../stores/rooms'

const t = copy.invite

/** Public invite page (SPEC §5.1 step 0): see the room before signing in. */
export function InvitePage() {
  const { code: raw = '' } = useParams()
  const code = parseInviteCode(raw)
  const navigate = useNavigate()
  const daypart = useDaypart()
  const status = useAuth((s) => s.status)
  const join = useRooms((s) => s.join)
  const [preview, setPreview] = useState<RoomPreview | null>(null)
  const [error, setError] = useState<string | null>(code ? null : 'room_not_found')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!code) return
    let cancelled = false
    void supabase.rpc('preview_room', { p_code: code }).then(({ data, error: err }) => {
      if (cancelled) return
      if (err) setError(rpcErrorCode(err))
      else setPreview(data as RoomPreview)
    })
    return () => {
      cancelled = true
    }
  }, [code, attempt])

  async function onJoin() {
    if (!code) return
    if (status !== 'ready') {
      pendingInvite.set(code)
      navigate('/signin')
      return
    }
    const res = await join(code)
    if (res.error) return setError(res.error)
    navigate(`/room/${res.id}`, { replace: true })
  }

  return (
    <Screen>
      <ThumbRenderer />
      <div className="card card-raised overflow-hidden">
        <RoomView
          className="h-56 sm:h-72"
          size={SHARED_SIZE}
          layout={DEFAULT_SHARED}
          walkIn={false}
          avatars={(preview?.studying ?? []).map((p, i) => ({
            id: `${i}`,
            name: p.display_name,
            avatar: p.avatar,
            state: 'focus' as const,
            clock: null,
            ariaLabel: p.display_name,
          }))}
          night={daypart === 'night'}
          lampOn
          label={preview?.name ?? ''}
          fallback={<NoWebGL />}
        />
        <div className="border-t-2 border-line p-6">
          {preview ? (
            <>
              <h1 className="font-display text-2xl font-bold">{t.title(preview.name)}</h1>
              <p className="text-muted">{t.members(preview.member_count)}</p>
              <h2 className="mt-4 text-sm font-bold">{t.studyingNow}</h2>
              {preview.studying.length > 0 ? (
                <div className="mt-2 flex items-center gap-3">
                  <AvatarStack people={preview.studying} size={34} />
                  <p className="text-sm">{preview.studying.map((p) => p.display_name).join(', ')}</p>
                </div>
              ) : (
                <p className="mt-1 text-sm text-muted">{t.nobody}</p>
              )}
              <button type="button" className="btn btn-primary mt-6 w-full" onClick={() => void onJoin()}>
                {status === 'ready' ? t.join : t.signInFirst}
              </button>
            </>
          ) : (
            error &&
            (error === 'room_not_found' || error === 'rate_limited' ? (
              <p className="font-bold">{error === 'rate_limited' ? errorMessage(error) : t.notFound}</p>
            ) : (
              <LoadFailed
                compact
                onRetry={() => {
                  setError(null)
                  setAttempt((n) => n + 1)
                }}
              />
            ))
          )}
          {preview && <ErrorText code={error} />}
        </div>
      </div>
    </Screen>
  )
}
