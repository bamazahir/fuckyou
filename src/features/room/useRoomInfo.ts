import { useCallback, useEffect, useState } from 'react'
import type { LayoutItem } from '../../core/grid'
import type { SyncSettings } from '../../core/sync'
import { supabase } from '../../lib/supabase'

export interface RoomInfo {
  /** Shared pomodoro settings, or null when the room doesn't run one. */
  sync: SyncSettings | null
  notifyActive: boolean
  /** The saved layout ([] = the starter room) and the room bank. */
  layout: LayoutItem[]
  bank: number
}

interface Row {
  sync_pomodoro: boolean
  sync_focus_s: number
  sync_break_s: number
  sync_epoch: string
  notify_active: boolean
  layout?: LayoutItem[]
  bank_coins?: number
}

/** room_info, refetched when the room's sync settings change (the 'sync' broadcast bumps `key`). */
export function useRoomInfo(roomId: string, key: number) {
  const [info, setInfo] = useState<RoomInfo | null>(null)
  const [reload, setReload] = useState(0)
  useEffect(() => {
    let cancelled = false
    void supabase.rpc('room_info', { p_room_id: roomId }).then(({ data }) => {
      const r = data as Row | null
      if (cancelled || !r) return
      setInfo({
        sync: r.sync_pomodoro
          ? { epochMs: Date.parse(r.sync_epoch), focusS: r.sync_focus_s, breakS: r.sync_break_s }
          : null,
        notifyActive: r.notify_active,
        layout: Array.isArray(r.layout) ? r.layout : [],
        bank: r.bank_coins ?? 0,
      })
    })
    return () => {
      cancelled = true
    }
  }, [roomId, key, reload])
  const refetch = useCallback(() => setReload((k) => k + 1), [])
  return { info, refetch }
}
