import type { RealtimeChannel } from '@supabase/supabase-js'
import { useCallback, useEffect, useRef, useState } from 'react'
import { syncPhase, type SyncSettings } from '../../core/sync'
import { nowMs } from '../../lib/servertime'
import { copy } from '../../content/copy'
import { createRateLimiter } from '../../core/room'
import { chime } from '../../lib/chime'
import type { LiveMember } from '../../lib/db'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../stores/auth'
import { useRooms } from '../../stores/rooms'
import { useUi } from '../../stores/ui'

export const REACTIONS = ['👋', '🔥', '☕', '💪', '🌙'] as const
export type Reaction = (typeof REACTIONS)[number]

export interface Bubble {
  userId: string
  text: string
  at: number
}

async function fetchLive(roomId: string): Promise<LiveMember[] | null> {
  const { data, error } = await supabase.rpc('room_live', { p_room_id: roomId })
  if (error) return null
  return (data as LiveMember[] | null) ?? []
}

/**
 * Live room state (SPEC §9): `room_live` is the source of truth, refreshed on open, every 15s and on
 * every server `state` broadcast. Presence only adds "online now". Reactions/nudges ride on broadcast.
 */
export function useRoomChannel(roomId: string) {
  const me = useAuth((s) => s.profile)
  const blocked = useRooms((s) => s.blocked)
  const toast = useUi((s) => s.toast)
  const [live, setLive] = useState<LiveMember[] | null>(null)
  const [liveFailed, setLiveFailed] = useState(false)
  const [online, setOnline] = useState<Set<string>>(new Set())
  const [bubbles, setBubbles] = useState<Bubble[]>([])
  const [removed, setRemoved] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [syncKey, setSyncKey] = useState(0)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const allowSend = useRef(createRateLimiter(3000))
  const allowReceive = useRef(createRateLimiter(3000))
  const known = useRef<Set<string> | null>(null)
  const syncRef = useRef<SyncSettings | null>(null)
  const setSync = useCallback((s: SyncSettings | null) => {
    syncRef.current = s
  }, [])

  const refresh = useCallback(() => setReloadKey((k) => k + 1), [])

  // Fetch live state; announce people who just sat down.
  useEffect(() => {
    let cancelled = false
    void fetchLive(roomId).then((rows) => {
      if (cancelled) return
      setLiveFailed(rows === null)
      if (rows === null) return
      const studying = new Set(rows.filter((r) => r.state === 'focus').map((r) => r.user_id))
      if (known.current) {
        for (const r of rows) {
          if (
            r.state === 'focus' &&
            !known.current.has(r.user_id) &&
            r.user_id !== me?.id &&
            !blocked.has(r.user_id)
          ) {
            toast(copy.room.sat(r.display_name))
            chime()
          }
        }
      }
      known.current = studying
      setLive(rows)
    })
    return () => {
      cancelled = true
    }
  }, [roomId, reloadKey, me?.id, blocked, toast])

  useEffect(() => {
    const id = window.setInterval(refresh, 15_000)
    return () => window.clearInterval(id)
  }, [refresh])

  useEffect(() => {
    if (!me) return
    const channel = supabase.channel(`room:${roomId}`, {
      config: { private: true, presence: { key: me.id }, broadcast: { self: false } },
    })
    channelRef.current = channel
    const pushBubble = (userId: string, text: string) =>
      setBubbles((b) => [...b.filter((x) => Date.now() - x.at < 4000), { userId, text, at: Date.now() }])

    channel
      .on('broadcast', { event: 'state' }, refresh)
      .on('broadcast', { event: 'joined' }, refresh)
      .on('broadcast', { event: 'sync' }, () => setSyncKey((k) => k + 1))
      .on('broadcast', { event: 'layout' }, () => setSyncKey((k) => k + 1))
      .on('broadcast', { event: 'station' }, () => setSyncKey((k) => k + 1))
      .on('broadcast', { event: 'removed' }, ({ payload }) => {
        // Members can broadcast too, so check with the server before believing it (audit #7).
        if ((payload as { user_id?: string }).user_id === me.id) {
          void supabase.rpc('room_info', { p_room_id: roomId }).then(({ error }) => {
            if (error?.message === 'not_a_member') setRemoved(true)
          })
        }
        refresh()
      })
      .on('broadcast', { event: 'reaction' }, ({ payload }) => {
        const p = payload as { from?: string; emoji?: string }
        if (!p.from || !p.emoji || blocked.has(p.from) || !(REACTIONS as readonly string[]).includes(p.emoji))
          return
        if (!allowReceive.current(p.from, Date.now())) return
        pushBubble(p.from, p.emoji)
      })
      .on('broadcast', { event: 'nudge' }, ({ payload }) => {
        const p = payload as { from?: string; to?: string; name?: string }
        if (!p.from || p.to !== me.id || blocked.has(p.from)) return
        if (syncRef.current && syncPhase(syncRef.current, nowMs()).phase === 'focus') return
        if (!allowReceive.current(`nudge:${p.from}`, Date.now())) return
        toast(copy.room.nudged(String(p.name ?? '').slice(0, 30)))
      })
      .on('presence', { event: 'sync' }, () => setOnline(new Set(Object.keys(channel.presenceState()))))
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') void channel.track({ user_id: me.id })
      })
    return () => {
      channelRef.current = null
      void supabase.removeChannel(channel)
    }
  }, [roomId, me, blocked, refresh, toast])

  const react = useCallback(
    (emoji: Reaction) => {
      if (!me || !allowSend.current('reaction', Date.now())) return false
      void channelRef.current?.send({ type: 'broadcast', event: 'reaction', payload: { from: me.id, emoji } })
      void supabase.rpc('log_event', { p_name: 'reaction_sent', p_props: {} })
      setBubbles((b) => [...b, { userId: me.id, text: emoji, at: Date.now() }])
      return true
    },
    [me],
  )

  const nudge = useCallback(
    (to: string) => {
      if (!me || !allowSend.current(`nudge:${to}`, Date.now())) return false
      void channelRef.current?.send({
        type: 'broadcast',
        event: 'nudge',
        payload: { from: me.id, to, name: me.display_name },
      })
      void supabase.rpc('log_event', { p_name: 'nudge_sent', p_props: {} })
      return true
    },
    [me],
  )

  return { live, liveFailed, online, bubbles, removed, refresh, react, nudge, syncKey, setSync }
}
