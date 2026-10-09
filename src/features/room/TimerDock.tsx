import { useEffect, useState } from 'react'
import { ErrorText } from '../../components/Screen'
import { useNow } from '../../components/useNow'
import { copy } from '../../content/copy'
import { clampFocusMinutes, DEFAULT_POMODORO, timerView } from '../../core/timer'
import { formatClock } from '../../core/time'
import type { SessionRow } from '../../lib/db'
import { useAuth } from '../../stores/auth'
import { useTimer } from '../../stores/timer'
import { shortDuration } from '../../core/room'
import { useMyHistory } from '../stats/useMyHistory'

const t = copy.room
const FOCUS_CHOICES = [15, 25, 50] as const

function toActive(s: SessionRow) {
  return {
    kind: s.kind,
    startedAtMs: Date.parse(s.started_at),
    plannedSeconds: s.planned_seconds,
    nextCheckinAtMs: s.next_checkin_at ? Date.parse(s.next_checkin_at) : null,
  }
}

function ProgressRing({ progress }: { progress: number }) {
  const r = 108
  const c = 2 * Math.PI * r
  return (
    <svg viewBox="0 0 240 240" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden="true">
      <circle cx="120" cy="120" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="12" />
      <circle
        cx="120"
        cy="120"
        r={r}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="12"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - progress)}
        style={{ transition: 'stroke-dashoffset 1s linear' }}
      />
    </svg>
  )
}

function Running({ session }: { session: SessionRow }) {
  const now = useNow(true)
  const { end, checkin, busy } = useTimer()
  const view = timerView(toActive(session), now)

  // A finished pomodoro (or 4h cap) ends on its own; the server agrees (idempotent end_session).
  useEffect(() => {
    if (view.finished) void end()
  }, [view.finished, end])

  const big = view.remaining !== null ? formatClock(view.remaining) : formatClock(view.elapsed)
  return (
    <div className="flex flex-col items-center">
      <div className="relative grid h-60 w-60 place-items-center">
        {view.progress !== null && <ProgressRing progress={view.progress} />}
        <div className="text-center">
          <p className="text-sm font-bold text-muted">{t.focusing}</p>
          <p className="font-display text-6xl font-bold tabular-nums" aria-live="off" data-testid="timer">
            {big}
          </p>
          {session.status_line && <p className="mt-1 max-w-48 truncate text-sm">{session.status_line}</p>}
        </div>
      </div>
      {view.checkinDue && view.checkinSecondsLeft !== null && (
        <div className="card mt-4 w-full bg-accent p-4 text-on-accent" role="alert">
          <p className="font-display text-lg font-bold">{t.checkinTitle}</p>
          <p className="text-sm">{t.checkinBody(formatClock(view.checkinSecondsLeft))}</p>
          <button type="button" className="btn btn-secondary mt-3" onClick={() => void checkin()}>
            {t.checkinButton}
          </button>
        </div>
      )}
      <button type="button" className="btn btn-secondary mt-5" onClick={() => void end()} disabled={busy}>
        {session.kind === 'pomodoro' ? t.endEarly : t.end}
      </button>
    </div>
  )
}

function Break({
  endsAtMs,
  minutes,
  onStartNext,
}: {
  endsAtMs: number
  minutes: number
  onStartNext: () => void
}) {
  const now = useNow(true)
  const skipBreak = useTimer((s) => s.skipBreak)
  const left = Math.max(0, Math.ceil((endsAtMs - now) / 1000))
  return (
    <div className="text-center">
      <p className="font-display text-xl font-bold">{t.breakTitle(minutes)}</p>
      <p className="font-display mt-2 text-6xl font-bold tabular-nums text-rest">{formatClock(left)}</p>
      <p className="mt-2 text-sm text-muted">{t.breakBody}</p>
      <div className="mt-5 flex justify-center gap-3">
        <button type="button" className="btn btn-primary" onClick={onStartNext}>
          {t.startNext}
        </button>
        {left > 0 && (
          <button type="button" className="btn btn-secondary" onClick={skipBreak}>
            {t.skipBreak}
          </button>
        )}
      </div>
    </div>
  )
}

export function TimerDock({ roomId }: { roomId: string }) {
  const { phase, busy, error, start } = useTimer()
  const savedFocus = useAuth((s) => s.profile?.settings.focusMinutes)
  const [kind, setKind] = useState<'pomodoro' | 'stopwatch'>('pomodoro')
  const [focusMinutes, setFocusMinutes] = useState(() =>
    clampFocusMinutes(savedFocus ?? DEFAULT_POMODORO.focusMinutes),
  )
  const [statusLine, setStatusLine] = useState('')

  const { stats } = useMyHistory()
  const begin = () => void start(roomId, kind, kind === 'pomodoro' ? focusMinutes * 60 : null, statusLine)

  return (
    <section aria-label="Timer" className="card card-raised p-5 md:p-6">
      {phase.name === 'running' && <Running session={phase.session} />}
      {phase.name === 'break' && (
        <Break endsAtMs={phase.endsAtMs} minutes={phase.minutes} onStartNext={begin} />
      )}
      {(phase.name === 'idle' || phase.name === 'ended') && (
        <div>
          <div role="radiogroup" aria-label="Timer type" className="grid grid-cols-2 gap-2">
            {(['pomodoro', 'stopwatch'] as const).map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={kind === k}
                className={`chip ${kind === k ? 'chip-on' : ''}`}
                onClick={() => setKind(k)}
              >
                {t[k]}
              </button>
            ))}
          </div>
          {kind === 'pomodoro' && (
            <div role="radiogroup" aria-label="Focus length" className="mt-3 grid grid-cols-3 gap-2">
              {FOCUS_CHOICES.map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={focusMinutes === m}
                  className={`chip ${focusMinutes === m ? 'chip-on' : ''}`}
                  onClick={() => setFocusMinutes(m)}
                >
                  {t.minutes(m)}
                </button>
              ))}
            </div>
          )}
          <p className="font-display mt-5 text-center text-6xl font-bold tabular-nums">
            {kind === 'pomodoro' ? formatClock(focusMinutes * 60) : formatClock(0)}
          </p>
          <label htmlFor="status-line" className="mt-5 block text-sm font-bold">
            {t.statusLabel}
          </label>
          <input
            id="status-line"
            maxLength={60}
            value={statusLine}
            onChange={(e) => setStatusLine(e.target.value)}
            placeholder={t.statusPlaceholder}
            className="field mt-1"
          />
          <ErrorText code={error} />
          <button
            type="button"
            className="btn btn-primary mt-5 w-full text-lg"
            onClick={begin}
            disabled={busy}
          >
            {t.start}
          </button>
          {stats && stats.todaySeconds > 0 && (
            <p className="mt-3 text-center text-sm text-muted">
              {t.todayTotal(shortDuration(stats.todaySeconds))}
            </p>
          )}
        </div>
      )}
    </section>
  )
}
