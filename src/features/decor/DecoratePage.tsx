import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useDaypart } from '../../components/useDaypart'
import { copy } from '../../content/copy'
import { DEFAULT_PERSONAL, DEFAULT_SHARED, PERSONAL_SIZE, SHARED_SIZE } from '../../content/layouts'
import type { LayoutItem } from '../../core/grid'
import { rpcErrorCode, supabase } from '../../lib/supabase'
import { useAuth } from '../../stores/auth'
import { useWallet } from '../../stores/wallet'
import { RoomEditor } from './RoomEditor'

const t = copy.decor

/** /me/decorate: your room, with your things. */
export function DecorateMyRoomPage() {
  const navigate = useNavigate()
  const daypart = useDaypart()
  const personalRoomId = useAuth((s) => s.personalRoomId)
  const { owned, personalLayout, load, savePersonalLayout } = useWallet()
  useEffect(() => {
    void load()
  }, [load])
  if (!personalRoomId || personalLayout === null) return null
  return (
    <RoomEditor
      size={PERSONAL_SIZE}
      initial={personalLayout.length > 0 ? personalLayout : DEFAULT_PERSONAL}
      owned={owned}
      title={t.edit}
      trayTitle={t.tray}
      night={daypart === 'night'}
      onSave={(layout) => savePersonalLayout(personalRoomId, layout)}
      onDone={() => navigate('/me')}
    />
  )
}

/** /room/:roomId/decorate: a shared room, with the room's things (owners and mods). */
export function DecorateRoomPage() {
  const { roomId = '' } = useParams()
  const navigate = useNavigate()
  const daypart = useDaypart()
  const [data, setData] = useState<{ layout: LayoutItem[]; owned: Map<string, number> } | null>(null)
  useEffect(() => {
    let cancelled = false
    void Promise.all([
      supabase.rpc('room_info', { p_room_id: roomId }),
      supabase.from('room_inventory').select('item_id, qty').eq('room_id', roomId),
    ]).then(([info, inv]) => {
      if (cancelled) return
      setData({
        layout: ((info.data as { layout?: LayoutItem[] } | null)?.layout ?? []) as LayoutItem[],
        owned: new Map(
          ((inv.data as { item_id: string; qty: number }[] | null) ?? []).map((r) => [r.item_id, r.qty]),
        ),
      })
    })
    return () => {
      cancelled = true
    }
  }, [roomId])
  if (!data) return null
  return (
    <RoomEditor
      size={SHARED_SIZE}
      initial={data.layout.length > 0 ? data.layout : DEFAULT_SHARED}
      owned={data.owned}
      title={t.editRoom}
      trayTitle={t.roomTray}
      night={daypart === 'night'}
      onSave={async (layout) => {
        const { error } = await supabase.rpc('save_layout', { p_room_id: roomId, p_layout: layout })
        return error ? rpcErrorCode(error) : null
      }}
      onDone={() => navigate(`/room/${roomId}`)}
    />
  )
}
