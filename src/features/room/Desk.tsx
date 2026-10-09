import { Bean } from '../../components/Bean'
import { useNow } from '../../components/useNow'
import { copy } from '../../content/copy'
import { timerView } from '../../core/timer'
import { formatClock } from '../../core/time'
import type { LiveMember } from '../../lib/db'

const t = copy.room

/** One person at their desk: bean, live timer, status line, state. */
export function Desk({
  m,
  isMe,
  bubble,
  onOpen,
}: {
  m: LiveMember
  isMe: boolean
  bubble?: string
  onOpen: () => void
}) {
  const now = useNow(true)
  const focusing = m.state === 'focus'
  const view = focusing
    ? timerView(
        {
          kind: m.kind,
          startedAtMs: Date.parse(m.started_at),
          plannedSeconds: m.planned_seconds,
          nextCheckinAtMs: null,
        },
        now,
      )
    : null
  const breakLeft =
    !focusing && m.break_until ? Math.max(0, Math.ceil((Date.parse(m.break_until) - now) / 1000)) : 0
  const big = view ? formatClock(view.remaining ?? view.elapsed) : formatClock(breakLeft)

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`card relative flex w-full flex-col items-center px-3 pb-3 pt-4 text-center ${isMe ? 'card-raised' : ''}`}
      aria-label={`${m.display_name}, ${focusing ? t.focusingLabel : t.onBreak}, ${big}`}
    >
      {bubble && (
        <span className="pill absolute -top-3 right-2 text-lg" aria-hidden="true">
          {bubble}
        </span>
      )}
      <span className="relative">
        <Bean colors={m.avatar.colors} size={56} title={m.display_name} />
        <span
          className={`absolute -right-1 bottom-1 h-3.5 w-3.5 rounded-full border-2 border-line ${focusing ? 'bg-good' : 'bg-rest'}`}
          aria-hidden="true"
        />
      </span>
      {/* the desk edge the bean sits behind */}
      <span
        className="-mt-3 block h-3 w-4/5 rounded-sm border-2 border-line bg-wood-desk"
        aria-hidden="true"
      />
      <span className="mt-2 w-full truncate font-bold">
        {m.display_name}
        {isMe && <span className="font-normal text-muted"> ({t.you})</span>}
      </span>
      <span className={`font-display text-2xl font-bold tabular-nums ${focusing ? '' : 'text-rest'}`}>
        {big}
      </span>
      <span className="w-full truncate text-sm text-muted">
        {focusing ? m.status_line || t.focusingLabel : t.onBreak}
      </span>
    </button>
  )
}

export function EmptyDesk() {
  return (
    <div
      className="flex min-h-40 flex-col items-center justify-center rounded-[14px] border-2 border-dashed border-on-bg-muted/50 p-3 text-center text-sm text-on-bg-muted"
      aria-hidden="true"
    >
      <span className="mb-2 block h-3 w-4/5 rounded-sm border-2 border-dashed border-on-bg-muted/50" />
      {t.freeDesk}
    </div>
  )
}
