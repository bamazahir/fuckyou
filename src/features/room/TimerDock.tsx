import type { Station } from '../../core/radio'
import { rovingKeys } from '../../components/roving'
import { RadioPill } from '../radio/RadioPanel'
import { useEffect, useRef, useState } from 'react'
import { ErrorText } from '../../components/Screen'
import { useNow } from '../../components/useNow'
import { copy } from '../../content/copy'
import { clampFocusMinutes, DEFAULT_POMODORO, timerView } from '../../core/timer'
import { formatClock } from '../../core/time'
import type { SessionRow } from '../../lib/db'
import { useAuth } from '../../stores/auth'
import { useTimer } from '../../stores/timer'
import { shortDuration } from '../../core/room'
import { joinAction, syncPhase, type SyncSettings } from '../../core/sync'
import { usePush } from '../../stores/push'
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

function Running({ session, together }: { session: SessionRow; together: boolean }) {
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
          <p className="text-sm font-bold text-muted">{together ? copy.sync.badge : t.focusing}</p>
          <p className="font-display text-6xl font-bold tabular-nums" aria-live="off" data-testid="timer">
            {big}
          </p>
          {session.status_line && <p className="mt-1 max-w-48 truncate text-sm">{session.status_line}</p>}
        </div>
      </div>
      {view.checkinDue && view.checkinSecondsLeft !== null && (
        <div className="card mt-4 w-full bg-accent p-4 text-on-accent">
          {/* Only the title is announced; the countdown below changes every second. */}
          <p className="font-display text-lg font-bold" role="alert">
            {t.checkinTitle}
          </p>
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

function StatusLine({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <>
      <label htmlFor="status-line" className="mt-5 block text-sm font-bold">
        {t.statusLabel}
      </label>
      <input
        id="status-line"
        maxLength={60}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t.statusPlaceholder}
        className="field mt-1"
      />
    </>
  )
}

/** Shared pomodoro (SPEC §6.2.1): one cycle for the whole room; Start joins the current phase. */
function SyncDock({ roomId, sync, together }: { roomId: string; sync: SyncSettings; together: number }) {
  const { busy, error, start } = useTimer()
  const now = useNow(true)
  const [statusLine, setStatusLine] = useState('')
  const [waitingUntil, setWaitingUntil] = useState<number | null>(null)
  const timer = useRef<number | null>(null)
  const p = syncPhase(sync, now)
  const action = joinAction(p)

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
    },
    [],
  )

  const joinNow = () => {
    void start(roomId, 'pomodoro', null, statusLine).then(() => {
      if (!useTimer.getState().error) void usePush.getState().offer('timer')
    })
  }
  // Wait for the next shared focus, then start automatically (while this screen is open).
  const joinNext = () => {
    setWaitingUntil(p.nextFocusAtMs)
    timer.current = window.setTimeout(
      () => {
        timer.current = null
        setWaitingUntil(null)
        joinNow()
      },
      Math.max(0, p.nextFocusAtMs - now + 300),
    )
  }
  const cancel = () => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = null
    setWaitingUntil(null)
  }

  const toNext = formatClock(Math.ceil((p.nextFocusAtMs - now) / 1000))
  const clock = formatClock(Math.ceil(p.left))
  return (
    <div>
      <p className="pill">{copy.sync.badge}</p>
      <p className="mt-3 text-center font-bold" data-testid="sync-phase">
        {p.phase === 'focus' ? copy.sync.focus(clock, together) : copy.sync.breakTogether(clock)}
      </p>
      <p
        className={`font-display mt-2 text-center text-6xl font-bold tabular-nums ${p.phase === 'break' ? 'text-rest' : ''}`}
      >
        {clock}
      </p>
      <StatusLine value={statusLine} onChange={setStatusLine} />
      <ErrorText code={error} />
      {waitingUntil !== null ? (
        <div className="mt-5 text-center">
          <p className="font-bold">{copy.sync.waiting(toNext)}</p>
          <button type="button" className="btn btn-secondary mt-3" onClick={cancel}>
            {copy.sync.cancelWait}
          </button>
        </div>
      ) : action === 'join_now' ? (
        <button
          type="button"
          className="btn btn-primary mt-5 w-full text-lg"
          onClick={joinNow}
          disabled={busy}
        >
          {copy.sync.joinNow}
        </button>
      ) : (
        <button
          type="button"
          className="btn btn-primary mt-5 w-full text-lg"
          onClick={joinNext}
          disabled={busy}
        >
          {copy.sync.joinNext(toNext)}
        </button>
      )}
    </div>
  )
}

export function TimerDock({
  roomId,
  sync = null,
  together = 0,
  radio,
}: {
  roomId: string
  /** The room's station, for the radio pill. */
  radio?: Station
  /** Set in rooms that run a shared pomodoro. */
  sync?: SyncSettings | null
  /** How many are focusing in the room right now (for the shared-cycle line). */
  together?: number
}) {
  const { phase, busy, error, start } = useTimer()
  const savedFocus = useAuth((s) => s.profile?.settings.focusMinutes)
  const [kind, setKind] = useState<'pomodoro' | 'stopwatch'>('pomodoro')
  const [focusMinutes, setFocusMinutes] = useState(() =>
    clampFocusMinutes(savedFocus ?? DEFAULT_POMODORO.focusMinutes),
  )
  const [statusLine, setStatusLine] = useState('')

  const { stats } = useMyHistory()
  const begin = () =>
    void start(roomId, kind, kind === 'pomodoro' ? focusMinutes * 60 : null, statusLine).then(() => {
      if (kind === 'pomodoro' && !useTimer.getState().error) void usePush.getState().offer('timer')
    })

  return (
    <section aria-label={t.timerLabel} className="card card-raised p-5 md:p-6">
      {radio && radio.kind !== 'silence' && (
        <div className="-mt-1 mb-3 flex justify-end">
          <RadioPill roomId={roomId} station={radio} />
        </div>
      )}
      {phase.name === 'running' && <Running session={phase.session} together={sync !== null} />}
      {sync && phase.name !== 'running' && <SyncDock roomId={roomId} sync={sync} together={together} />}
      {!sync && phase.name === 'break' && (
        <Break endsAtMs={phase.endsAtMs} minutes={phase.minutes} onStartNext={begin} />
      )}
      {!sync && (phase.name === 'idle' || phase.name === 'ended') && (
        <div>
          <div role="radiogroup" aria-label={t.typeLabel} className="grid grid-cols-2 gap-2">
            {(['pomodoro', 'stopwatch'] as const).map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={kind === k}
                tabIndex={kind === k ? 0 : -1}
                onKeyDown={rovingKeys}
                className={`chip ${kind === k ? 'chip-on' : ''}`}
                onClick={() => setKind(k)}
              >
                {t[k]}
              </button>
            ))}
          </div>
          {kind === 'pomodoro' && (
            <div role="radiogroup" aria-label={t.lengthLabel} className="mt-3 grid grid-cols-3 gap-2">
              {FOCUS_CHOICES.map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={focusMinutes === m}
                  tabIndex={focusMinutes === m ? 0 : -1}
                  onKeyDown={rovingKeys}
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
          <StatusLine value={statusLine} onChange={setStatusLine} />
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
