import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dialog } from '../../components/Dialog'
import { ErrorText } from '../../components/Screen'
import blocked from '../../content/blocked-words.json'
import { copy } from '../../content/copy'
import { isClean, type BlockedWord } from '../../core/filter'
import { parseInviteCode } from '../../core/room'
import { useRooms } from '../../stores/rooms'

const t = copy.home

export function CreateRoomDialog({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const create = useRooms((s) => s.create)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const trimmed = name.trim()

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!isClean(trimmed, blocked.words as BlockedWord[])) return setError('inappropriate_text')
    setBusy(true)
    const res = await create(trimmed)
    setBusy(false)
    if (res.error) return setError(res.error)
    navigate(`/room/${res.id}`)
  }

  return (
    <Dialog title={t.createTitle} onClose={onClose} labelledBy="create-title">
      <form onSubmit={submit} className="mt-4">
        <label htmlFor="room-name" className="block text-sm font-bold">
          {t.nameLabel}
        </label>
        <input
          id="room-name"
          required
          minLength={3}
          maxLength={40}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t.namePlaceholder}
          className="field mt-1"
        />
        <ErrorText code={error} />
        <div className="mt-5 flex gap-3">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {t.cancel}
          </button>
          <button type="submit" className="btn btn-primary flex-1" disabled={busy || trimmed.length < 3}>
            {t.create}
          </button>
        </div>
      </form>
    </Dialog>
  )
}

export function JoinRoomDialog({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const join = useRooms((s) => s.join)
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const code = parseInviteCode(input)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!code) return setError('room_not_found')
    const res = await join(code)
    if (res.error) return setError(res.error)
    navigate(`/room/${res.id}`)
  }

  return (
    <Dialog title={t.joinTitle} onClose={onClose} labelledBy="join-title">
      <form onSubmit={submit} className="mt-4">
        <label htmlFor="invite-code" className="block text-sm font-bold">
          {t.codeLabel}
        </label>
        <input
          id="invite-code"
          required
          autoCapitalize="characters"
          spellCheck={false}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="AB3DK7M9"
          className="field mt-1 font-display tracking-widest"
        />
        <ErrorText code={error} />
        <div className="mt-5 flex gap-3">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {t.cancel}
          </button>
          <button type="submit" className="btn btn-primary flex-1" disabled={!code}>
            {t.join}
          </button>
        </div>
      </form>
    </Dialog>
  )
}
