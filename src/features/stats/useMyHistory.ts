import { useEffect, useState } from 'react'
import { profileStats, type ProfileStats } from '../../core/stats'
import type { SessionRow } from '../../lib/db'
import { nowMs } from '../../lib/servertime'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../stores/auth'
import { useTimer } from '../../stores/timer'

async function fetchHistory(): Promise<SessionRow[]> {
  const { data } = await supabase
    .from('sessions')
    .select('*')
    .neq('status', 'active')
    .order('started_at', { ascending: false })
    .limit(500)
  return (data as SessionRow[] | null) ?? []
}

/** Your own finished sessions and the stats derived from them; refreshes when a session ends. */
export function useMyHistory(reloadKey = 0): { sessions: SessionRow[] | null; stats: ProfileStats | null } {
  const tz = useAuth((s) => s.profile?.tz ?? 'UTC')
  const timerPhase = useTimer((s) => s.phase.name)
  const [sessions, setSessions] = useState<SessionRow[] | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetchHistory().then((rows) => {
      if (!cancelled) setSessions(rows)
    })
    return () => {
      cancelled = true
    }
  }, [timerPhase, reloadKey])

  const stats =
    sessions &&
    profileStats(
      sessions
        .filter((s) => s.status === 'completed')
        .map((s) => ({ startedAtMs: Date.parse(s.started_at), focusSeconds: s.focus_seconds ?? 0 })),
      nowMs(),
      tz,
    )
  return { sessions, stats }
}
