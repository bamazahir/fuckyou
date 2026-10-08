import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ErrorText } from '../../components/Screen'
import { copy } from '../../content/copy'
import { formatClock } from '../../core/time'
import { noteError } from '../../core/validate'
import { useTimer } from '../../stores/timer'

const t = copy.endSheet

/** End-of-session sheet (SPEC §5.6). Also used from History to add a note later. */
export function NoteDialog({
  sessionId,
  focusSeconds,
  onClose,
}: {
  sessionId: string
  focusSeconds: number
  onClose: (saved: boolean) => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const submitNote = useTimer((s) => s.submitNote)

  useEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal()
  }, [])

  async function save(e: FormEvent) {
    e.preventDefault()
    if (noteError(note)) return setError('invalid_note')
    const ok = await submitNote(sessionId, note)
    if (!ok) return setError(useTimer.getState().error ?? 'generic')
    onClose(true)
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby="note-title"
      onCancel={() => onClose(false)}
      className="card card-raised m-auto w-[min(28rem,calc(100%-2rem))] p-6 backdrop:bg-ink/60"
    >
      <form onSubmit={save}>
        <h2 id="note-title" className="font-display text-2xl font-bold">
          {t.title}
        </h2>
        <p className="mt-1">{t.focused(formatClock(focusSeconds))}</p>
        <label htmlFor="note" className="mt-5 block text-sm font-bold">
          {t.noteLabel}
        </label>
        <textarea
          id="note"
          rows={3}
          maxLength={140}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t.notePlaceholder}
          className="field mt-1 resize-none"
        />
        <p className="mt-1 text-sm text-muted">{t.noteHint}</p>
        <ErrorText code={error} />
        <div className="mt-5 flex gap-3">
          <button type="button" className="btn btn-secondary" onClick={() => onClose(false)}>
            {t.later}
          </button>
          <button type="submit" className="btn btn-primary flex-1" disabled={noteError(note) !== null}>
            {t.saveNote}
          </button>
        </div>
      </form>
    </dialog>
  )
}
