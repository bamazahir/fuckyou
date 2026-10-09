import { useState } from 'react'
import { Loading, LoadFailed } from '../../components/LoadFailed'
import { copy } from '../../content/copy'
import { formatClock } from '../../core/time'
import type { SessionRow } from '../../lib/db'
import { nowMs } from '../../lib/servertime'
import { NoteDialog } from '../room/NoteDialog'
import { useMyHistory } from './useMyHistory'

const t = copy.profile
const DAY_MS = 24 * 60 * 60 * 1000

/** Your recent sessions, with "Add a note" while a session is under a day old. */
export function HistoryList({ timeZone, onChanged }: { timeZone: string; onChanged?: () => void }) {
  const [reloadKey, setReloadKey] = useState(0)
  const { sessions, failed, retry } = useMyHistory(reloadKey)
  const [noteFor, setNoteFor] = useState<SessionRow | null>(null)
  const dateFmt = new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  })
  return (
    <section aria-labelledby="history-heading" className="card p-5">
      <h2 id="history-heading" className="font-display text-xl font-bold">
        {t.historyTitle}
      </h2>
      {sessions === null && (failed ? <LoadFailed compact onRetry={retry} /> : <Loading />)}
      {sessions !== null && sessions.length === 0 && <p className="mt-2 text-muted">{t.historyEmpty}</p>}
      <ul className="mt-3 divide-y-2 divide-surface-2">
        {(sessions ?? []).slice(0, 30).map((s) => {
          const canNote =
            s.status === 'completed' && !s.note && s.ended_at && nowMs() - Date.parse(s.ended_at) < DAY_MS
          return (
            <li key={s.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3">
              <div className="min-w-0">
                <p className="font-bold">
                  {copy.room[s.kind]} ·{' '}
                  <span className="tabular-nums">{formatClock(s.focus_seconds ?? 0)}</span>
                  {s.status === 'voided' && <span className="ml-2 text-danger">{t.voided}</span>}
                </p>
                <p className="text-sm text-muted">{dateFmt.format(new Date(s.started_at))}</p>
                {s.note && <p className="mt-1 text-sm break-words">{s.note}</p>}
              </div>
              {canNote && (
                <button type="button" className="btn btn-secondary text-sm" onClick={() => setNoteFor(s)}>
                  {t.addNote}
                </button>
              )}
            </li>
          )
        })}
      </ul>
      {noteFor && (
        <NoteDialog
          sessionId={noteFor.id}
          focusSeconds={noteFor.focus_seconds ?? 0}
          kind={noteFor.kind}
          plannedSeconds={noteFor.planned_seconds}
          onClose={(saved) => {
            setNoteFor(null)
            if (saved) {
              setReloadKey((k) => k + 1)
              onChanged?.()
            }
          }}
        />
      )}
    </section>
  )
}
