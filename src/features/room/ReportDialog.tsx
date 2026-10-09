import { useState, type FormEvent } from 'react'
import { Dialog } from '../../components/Dialog'
import { ErrorText } from '../../components/Screen'
import { copy } from '../../content/copy'
import { rpcErrorCode, supabase } from '../../lib/supabase'
import { useUi } from '../../stores/ui'

const t = copy.reportSheet
type Reason = keyof typeof t.reasons

export function ReportDialog({
  targetType,
  targetId,
  roomId,
  name,
  onClose,
}: {
  targetType: 'user' | 'room' | 'status_line'
  targetId: string
  roomId: string
  name: string
  onClose: () => void
}) {
  const [reason, setReason] = useState<Reason>('harassment')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const toast = useUi((s) => s.toast)

  async function send(e: FormEvent) {
    e.preventDefault()
    const { error: err } = await supabase.rpc('report', {
      p_target_type: targetType,
      p_target_id: targetId,
      p_room_id: roomId,
      p_reason: reason,
      p_note: note.trim() || null,
    })
    if (err) return setError(rpcErrorCode(err))
    toast(t.sent)
    onClose()
  }

  return (
    <Dialog title={t.title(name)} onClose={onClose} labelledBy="report-title">
      <form onSubmit={send}>
        <fieldset className="mt-4 space-y-2">
          <legend className="text-sm font-bold">{t.reasonLabel}</legend>
          {(Object.keys(t.reasons) as Reason[]).map((r) => (
            <label key={r} className={`chip justify-start px-3 ${reason === r ? 'chip-on' : ''}`}>
              <input
                type="radio"
                name="reason"
                value={r}
                checked={reason === r}
                onChange={() => setReason(r)}
                className="sr-only"
              />
              {t.reasons[r]}
            </label>
          ))}
        </fieldset>
        <label htmlFor="report-note" className="mt-4 block text-sm font-bold">
          {t.noteLabel}
        </label>
        <textarea
          id="report-note"
          rows={2}
          maxLength={140}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="field mt-1 resize-none"
        />
        <ErrorText code={error} />
        <div className="mt-5 flex gap-3">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {copy.home.cancel}
          </button>
          <button type="submit" className="btn btn-primary flex-1">
            {t.send}
          </button>
        </div>
      </form>
    </Dialog>
  )
}
