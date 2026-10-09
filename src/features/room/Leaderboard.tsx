import { useEffect, useState } from 'react'
import { Bean } from '../../components/Bean'
import { copy } from '../../content/copy'
import { shortDuration } from '../../core/room'
import type { LeaderboardTab, LeaderRow } from '../../lib/db'
import { supabase } from '../../lib/supabase'

const TABS: LeaderboardTab[] = ['live', 'week', 'alltime', 'lifetime']

export function Leaderboard({
  roomId,
  meId,
  refreshKey,
}: {
  roomId: string
  meId: string
  refreshKey: number
}) {
  const [tab, setTab] = useState<LeaderboardTab>('week')
  const [rows, setRows] = useState<LeaderRow[] | null>(null)

  useEffect(() => {
    let cancelled = false
    void supabase.rpc('leaderboard', { p_room_id: roomId, p_tab: tab }).then(({ data }) => {
      if (!cancelled) setRows((data as LeaderRow[] | null) ?? [])
    })
    return () => {
      cancelled = true
    }
  }, [roomId, tab, refreshKey])

  return (
    <div>
      <div role="tablist" aria-label={copy.room.tabs.leaderboard} className="grid grid-cols-4 gap-1">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            className={`chip px-1 text-sm ${tab === t ? 'chip-on' : ''}`}
            onClick={() => setTab(t)}
          >
            {copy.room.boards[t]}
          </button>
        ))}
      </div>
      <p className="mt-2 text-sm text-muted">{copy.room.boardHint[tab]}</p>
      {rows !== null && rows.length === 0 && <p className="mt-3 text-muted">{copy.room.boardEmpty}</p>}
      <ol className="mt-2 divide-y-2 divide-surface-2" aria-label={copy.room.boards[tab]}>
        {(rows ?? []).map((r) => (
          <li key={r.user_id} className="flex items-center gap-3 py-2">
            <span className="font-display w-6 text-right text-lg font-bold tabular-nums">{r.rank}</span>
            <Bean avatar={r.avatar} size={28} title={r.display_name} />
            <span className="flex-1 truncate font-bold">
              {r.display_name}
              {r.user_id === meId && (
                <span className="ml-1 text-sm font-normal text-muted">({copy.room.you})</span>
              )}
              {r.is_present && (
                <span className="ml-2 inline-block h-2 w-2 rounded-full bg-good" aria-label="studying now" />
              )}
            </span>
            <span className="font-display font-bold tabular-nums">{shortDuration(r.seconds)}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
