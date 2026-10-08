import { Navigate, useParams } from 'react-router-dom'
import { copy } from '../../content/copy'
import { useAuth } from '../../stores/auth'
import { useTimer } from '../../stores/timer'
import { NoteDialog } from './NoteDialog'
import { TimerDock } from './TimerDock'

export function RoomPage() {
  const { roomId } = useParams()
  const personalRoomId = useAuth((s) => s.personalRoomId)
  const { phase, afterEnded } = useTimer()

  // M1: only your personal room exists. Shared rooms arrive in M2.
  if (!roomId || roomId !== personalRoomId) return <Navigate to="/" replace />

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-bold">{copy.myRoom.title}</h1>
        <span className="rounded-full border-2 border-ink bg-paper px-3 py-1 text-sm font-bold text-ink">
          {copy.room.soloBadge}
        </span>
      </header>
      <TimerDock roomId={roomId} />
      {phase.name === 'ended' && (
        <NoteDialog
          key={phase.session.id}
          sessionId={phase.session.id}
          focusSeconds={phase.session.focus_seconds ?? 0}
          onClose={() => void afterEnded()}
        />
      )}
    </div>
  )
}
