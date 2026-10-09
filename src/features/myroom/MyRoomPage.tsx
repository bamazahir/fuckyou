import { useState } from 'react'
import { Link } from 'react-router-dom'
import { copy } from '../../content/copy'
import { useAuth } from '../../stores/auth'
import { AvatarEditor } from './AvatarEditor'
import { PersonalRoomView } from './PersonalRoomView'

const t = copy.myRoom

/** Your room, read-only until decorating arrives in M5 (SPEC §5.4). */
export function MyRoomPage() {
  const personalRoomId = useAuth((s) => s.personalRoomId)
  const [editing, setEditing] = useState(false)
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-bold">{t.title}</h1>
        <div className="flex gap-2">
          <button type="button" className="btn btn-secondary" onClick={() => setEditing(true)}>
            {t.editBean}
          </button>
          {personalRoomId && (
            <Link to={`/room/${personalRoomId}`} className="btn btn-primary">
              {t.studyHere}
            </Link>
          )}
        </div>
      </header>
      <div className="card card-raised overflow-hidden">
        <PersonalRoomView className="h-[min(60svh,520px)] min-h-72 lg:h-[600px]" />
        <p className="border-t-2 border-line bg-surface-2 px-4 py-2 text-muted">{t.body}</p>
      </div>
      {editing && <AvatarEditor onClose={() => setEditing(false)} />}
    </div>
  )
}
