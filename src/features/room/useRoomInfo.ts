import { useCallback, useEffect, useState } from 'react'
import type { RoomStyle } from '../../content/roomStyles'
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
  /** The room's radio station id (SPEC §11). */
  stationId: string | null
  /** Wall and floor finishes. */
  style: RoomStyle
  /** Listed in Discover. */
  listed: boolean
}

interface Row {
  sync_pomodoro: boolean
  sync_focus_s: number
  sync_break_s: number
  sync_epoch: string
  notify_active: boolean
  layout?: LayoutItem[]
  bank_coins?: number
  station_id?: string
  style?: RoomStyle
  listed?: boolean
}

/** room_info, refetched when the room's settings change (the 'sync', 'layout' and 'station' broadcasts bump `key`). */
export function useRoomInfo(roomId: string, key: number) {
  const [info, setInfo] = useState<RoomInfo | null>(null)
  const [failed, setFailed] = useState(false)
  const [reload, setReload] = useState(0)
  useEffect(() => {
    let cancelled = false
    void supabase.rpc('room_info', { p_room_id: roomId }).then(({ data, error }) => {
      const r = data as Row | null
      if (cancelled) return
      setFailed(Boolean(error) || !r)
      if (!r) return
      setInfo({
        sync: r.sync_pomodoro
          ? { epochMs: Date.parse(r.sync_epoch), focusS: r.sync_focus_s, breakS: r.sync_break_s }
          : null,
        notifyActive: r.notify_active,
        layout: Array.isArray(r.layout) ? r.layout : [],
        bank: r.bank_coins ?? 0,
        stationId: r.station_id ?? null,
        style: r.style ?? {},
        listed: r.listed ?? false,
      })
    })
    return () => {
      cancelled = true
    }
  }, [roomId, key, reload])
  const refetch = useCallback(() => setReload((k) => k + 1), [])
  return { info, failed, refetch }
}
