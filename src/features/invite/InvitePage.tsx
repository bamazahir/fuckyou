import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AvatarStack } from '../../components/AvatarStack'
import { RoomScene } from '../../components/RoomScene'
import { ErrorText, Screen } from '../../components/Screen'
import { useDaypart } from '../../components/useDaypart'
import { copy } from '../../content/copy'
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
  }, [code])

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
      <div className="card card-raised overflow-hidden">
        <RoomScene
          beans={(preview?.studying ?? []).map((p) => p.avatar)}
          night={daypart === 'night'}
          label={preview?.name ?? ''}
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
            error && <p className="font-bold">{t.notFound}</p>
          )}
          {preview && <ErrorText code={error} />}
        </div>
      </div>
    </Screen>
  )
}
