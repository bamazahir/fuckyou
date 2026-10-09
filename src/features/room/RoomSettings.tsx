import { useEffect, useState, type FormEvent } from 'react'
import { LoadFailed } from '../../components/LoadFailed'
import { Dialog } from '../../components/Dialog'
import { ErrorText } from '../../components/Screen'
import { copy } from '../../content/copy'
import { rpcErrorCode, supabase } from '../../lib/supabase'
import type { SyncSettings } from '../../core/sync'
import { useRooms } from '../../stores/rooms'

const t = copy.settingsSheet

interface Report {
  id: number
  target_type: string
  reason: keyof typeof copy.reportSheet.reasons
  note: string | null
  created_at: string
}

const SYNC_LENGTHS = [
  [25, 5],
  [50, 10],
] as const

export function RoomSettings({
  roomId,
  name,
  sync,
  onSyncChanged,
  onClose,
}: {
  roomId: string
  name: string
  sync: SyncSettings | null
  onSyncChanged: () => void
  onClose: () => void
}) {
  const [newName, setNewName] = useState(name)
  const [error, setError] = useState<string | null>(null)
  const [reports, setReports] = useState<Report[] | null>(null)
  const [reportsFailed, setReportsFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const reload = useRooms((s) => s.load)

  useEffect(() => {
    let cancelled = false
    void supabase.rpc('room_reports', { p_room_id: roomId }).then(({ data, error: err }) => {
      if (cancelled) return
      setReportsFailed(Boolean(err))
      if (!err) setReports((data as Report[] | null) ?? [])
    })
    return () => {
      cancelled = true
    }
  }, [roomId, attempt])

  async function rename(e: FormEvent) {
    e.preventDefault()
    const { error: err } = await supabase.rpc('set_room', { p_room_id: roomId, p_name: newName })
    if (err) return setError(rpcErrorCode(err))
    void reload()
    onClose()
  }

  async function setSync(params: {
    p_sync_pomodoro?: boolean
    p_sync_focus_s?: number
    p_sync_break_s?: number
  }) {
    const { error: err } = await supabase.rpc('set_room', { p_room_id: roomId, ...params })
    if (err) return setError(rpcErrorCode(err))
    void reload()
    onSyncChanged()
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
      <fieldset className="mt-5">
        <legend className="text-sm font-bold">{copy.sync.settingsTitle}</legend>
        <p className="text-sm text-muted">{copy.sync.settingsHint}</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {[true, false].map((on) => (
            <button
              key={String(on)}
              type="button"
              aria-pressed={(sync !== null) === on}
              className={`chip ${(sync !== null) === on ? 'chip-on' : ''}`}
              onClick={() => void setSync({ p_sync_pomodoro: on })}
            >
              {on ? copy.sync.on : copy.sync.off}
            </button>
          ))}
        </div>
        {sync && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            {SYNC_LENGTHS.map(([f, b]) => (
              <button
                key={f}
                type="button"
                aria-pressed={sync.focusS === f * 60 && sync.breakS === b * 60}
                className={`chip ${sync.focusS === f * 60 && sync.breakS === b * 60 ? 'chip-on' : ''}`}
                onClick={() => void setSync({ p_sync_focus_s: f * 60, p_sync_break_s: b * 60 })}
              >
                {copy.sync.lengths(f, b)}
              </button>
            ))}
          </div>
        )}
      </fieldset>
      <div className="mt-5">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => window.confirm(t.newLinkConfirm) && void newLink()}
        >
          {t.newLink}
        </button>
        <p className="mt-1 text-sm text-muted">{t.newLinkHint}</p>
      </div>
      <h3 className="font-display mt-6 font-bold">{t.reports}</h3>
      {reportsFailed && <LoadFailed compact onRetry={() => setAttempt((n) => n + 1)} />}
      {reports !== null && reports.length === 0 && <p className="text-sm text-muted">{t.noReports}</p>}
      <ul className="mt-2 space-y-2 text-sm">
        {(reports ?? []).map((r) => (
          <li key={r.id} className="card p-3">
            <p className="font-bold">{copy.reportSheet.reasons[r.reason] ?? r.reason}</p>
            {r.note && <p className="break-words">{r.note}</p>}
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
