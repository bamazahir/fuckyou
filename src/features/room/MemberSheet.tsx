import { useEffect, useState } from 'react'
import { Bean } from '../../components/Bean'
import { Dialog } from '../../components/Dialog'
import { ErrorText } from '../../components/Screen'
import { copy } from '../../content/copy'
import { formatClock } from '../../core/time'
import type { RoomMember } from '../../lib/db'
import { rpcErrorCode, supabase } from '../../lib/supabase'
import { useRooms } from '../../stores/rooms'
import { ReportDialog } from './ReportDialog'

const t = copy.profileSheet

interface MemberSession {
  id: string
  kind: 'pomodoro' | 'stopwatch'
  status: 'completed' | 'voided'
  started_at: string
  focus_seconds: number | null
  void_reason: string | null
}

export function MemberSheet({
  roomId,
  member,
  myRole,
  meId,
  onNudge,
  onClose,
  onChanged,
}: {
  roomId: string
  member: RoomMember
  myRole: RoomMember['role']
  meId: string
  onNudge: () => void
  onClose: () => void
  onChanged: () => void
}) {
  const { blocked, block, unblock } = useRooms()
  const [reporting, setReporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sessions, setSessions] = useState<MemberSession[] | null>(null)
  const [voidFor, setVoidFor] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const isMe = member.user_id === meId
  const canModerate = !isMe && (myRole === 'owner' || (myRole === 'mod' && member.role === 'member'))

  useEffect(() => {
    if (!canModerate) return
    let cancelled = false
    void supabase
      .rpc('room_member_sessions', { p_room_id: roomId, p_user_id: member.user_id })
      .then(({ data }) => {
        if (!cancelled) setSessions((data as MemberSession[] | null) ?? [])
      })
    return () => {
      cancelled = true
    }
  }, [canModerate, roomId, member.user_id, voidFor])

  async function run(fn: string, args: Record<string, unknown>) {
    setError(null)
    const { error: err } = await supabase.rpc(fn, args)
    if (err) return setError(rpcErrorCode(err))
    onChanged()
  }

  if (reporting) {
    return (
      <ReportDialog
        targetType="user"
        targetId={member.user_id}
        roomId={roomId}
        name={member.display_name}
        onClose={() => setReporting(false)}
      />
    )
  }

  return (
    <Dialog title={member.display_name} onClose={onClose} labelledBy="member-title">
      <div className="mt-2 flex items-center gap-4">
        <Bean avatar={member.avatar} size={64} title={member.display_name} />
        <div>
          <p className="text-muted">@{member.handle}</p>
          {member.role !== 'member' && (
            <p className="mt-1 inline-block rounded-full border-2 border-line bg-accent px-2 text-sm font-bold text-on-accent">
              {member.role === 'owner' ? t.roleOwner : t.roleMod}
            </p>
          )}
        </div>
      </div>

      {!isMe && (
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary" onClick={onNudge}>
            {copy.room.nudge} 👋
          </button>
          {blocked.has(member.user_id) ? (
            <button type="button" className="btn btn-secondary" onClick={() => void unblock(member.user_id)}>
              {copy.room.unblock}
            </button>
          ) : (
            <button type="button" className="btn btn-secondary" onClick={() => void block(member.user_id)}>
              {copy.room.block}
            </button>
          )}
          <button type="button" className="btn btn-secondary" onClick={() => setReporting(true)}>
            {copy.room.report}
          </button>
        </div>
      )}

      {canModerate && (
        <div className="mt-6 border-t-2 border-surface-2 pt-4">
          <div className="flex flex-wrap gap-2">
            {myRole === 'owner' && member.role === 'member' && (
              <button
                type="button"
                className="btn btn-secondary text-sm"
                onClick={() =>
                  void run('set_role', { p_room_id: roomId, p_user_id: member.user_id, p_role: 'mod' })
                }
              >
                {t.makeMod}
              </button>
            )}
            {myRole === 'owner' && member.role === 'mod' && (
              <button
                type="button"
                className="btn btn-secondary text-sm"
                onClick={() =>
                  void run('set_role', { p_room_id: roomId, p_user_id: member.user_id, p_role: 'member' })
                }
              >
                {t.removeMod}
              </button>
            )}
            {myRole === 'owner' && (
              <button
                type="button"
                className="btn btn-secondary text-sm"
                onClick={() =>
                  void run('transfer_ownership', { p_room_id: roomId, p_user_id: member.user_id })
                }
              >
                {t.makeOwner}
              </button>
            )}
            <button
              type="button"
              className="btn btn-secondary text-sm text-danger"
              onClick={() => {
                if (window.confirm(t.removeConfirm(member.display_name))) {
                  void run('remove_member', { p_room_id: roomId, p_user_id: member.user_id }).then(onClose)
                }
              }}
            >
              {t.remove}
            </button>
          </div>
          <h3 className="font-display mt-5 font-bold">{t.sessions}</h3>
          <ul className="mt-2 space-y-2">
            {(sessions ?? []).map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>
                  {new Date(s.started_at).toLocaleString(undefined, {
                    weekday: 'short',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}{' '}
                  · <span className="tabular-nums">{formatClock(s.focus_seconds ?? 0)}</span>
                  {s.status === 'voided' && <span className="ml-2 text-danger">{t.voided}</span>}
                </span>
                {s.status === 'completed' && voidFor !== s.id && (
                  <button
                    type="button"
                    className="btn btn-secondary min-h-9 text-sm"
                    onClick={() => setVoidFor(s.id)}
                  >
                    {t.void}
                  </button>
                )}
                {voidFor === s.id && (
                  <form
                    className="flex w-full gap-2"
                    onSubmit={(e) => {
                      e.preventDefault()
                      void run('void_session', { p_session_id: s.id, p_reason: reason }).then(() => {
                        setVoidFor(null)
                        setReason('')
                      })
                    }}
                  >
                    <input
                      aria-label={t.voidReason}
                      placeholder={t.voidReason}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      maxLength={140}
                      className="field min-h-9 flex-1 py-1"
                    />
                    <button type="submit" className="btn btn-primary min-h-9 text-sm">
                      {t.void}
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      <ErrorText code={error} />
      <button type="button" className="btn btn-secondary mt-6" onClick={onClose}>
        {copy.common.back}
      </button>
    </Dialog>
  )
}
