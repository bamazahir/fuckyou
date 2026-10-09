import { useEffect, useState, type FormEvent } from 'react'
import { Dialog } from '../../components/Dialog'
import { ErrorText } from '../../components/Screen'
import { copy } from '../../content/copy'
import { rpcErrorCode, supabase } from '../../lib/supabase'
import { useRooms } from '../../stores/rooms'

const t = copy.settingsSheet

interface Report {
  id: number
  target_type: string
  reason: keyof typeof copy.reportSheet.reasons
  note: string | null
  created_at: string
}

export function RoomSettings({
  roomId,
  name,
  onClose,
}: {
  roomId: string
  name: string
  onClose: () => void
}) {
  const [newName, setNewName] = useState(name)
  const [error, setError] = useState<string | null>(null)
  const [reports, setReports] = useState<Report[] | null>(null)
  const reload = useRooms((s) => s.load)

  useEffect(() => {
    let cancelled = false
    void supabase.rpc('room_reports', { p_room_id: roomId }).then(({ data }) => {
      if (!cancelled) setReports((data as Report[] | null) ?? [])
    })
    return () => {
      cancelled = true
    }
  }, [roomId])

  async function rename(e: FormEvent) {
    e.preventDefault()
    const { error: err } = await supabase.rpc('set_room', { p_room_id: roomId, p_name: newName })
    if (err) return setError(rpcErrorCode(err))
    void reload()
    onClose()
  }

  async function newLink() {
    const { error: err } = await supabase.rpc('regen_invite', { p_room_id: roomId })
    if (err) return setError(rpcErrorCode(err))
    void reload()
  }

  return (
    <Dialog title={t.title} onClose={onClose} labelledBy="settings-title">
      <form onSubmit={rename} className="mt-4">
        <label htmlFor="room-rename" className="block text-sm font-bold">
          {t.rename}
        </label>
        <div className="mt-1 flex gap-2">
          <input
            id="room-rename"
            value={newName}
            maxLength={40}
            onChange={(e) => setNewName(e.target.value)}
            className="field"
          />
          <button type="submit" className="btn btn-primary">
            {t.save}
          </button>
        </div>
      </form>
      <div className="mt-5">
        <button type="button" className="btn btn-secondary" onClick={() => void newLink()}>
          {t.newLink}
        </button>
        <p className="mt-1 text-sm text-muted">{t.newLinkHint}</p>
      </div>
      <h3 className="font-display mt-6 font-bold">{t.reports}</h3>
      {reports !== null && reports.length === 0 && <p className="text-sm text-muted">{t.noReports}</p>}
      <ul className="mt-2 space-y-2 text-sm">
        {(reports ?? []).map((r) => (
          <li key={r.id} className="card p-3">
            <p className="font-bold">{copy.reportSheet.reasons[r.reason] ?? r.reason}</p>
            {r.note && <p>{r.note}</p>}
          </li>
        ))}
      </ul>
      <ErrorText code={error} />
      <button type="button" className="btn btn-secondary mt-6" onClick={onClose}>
        {copy.common.back}
      </button>
    </Dialog>
  )
}
