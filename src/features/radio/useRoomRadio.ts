import { useEffect } from 'react'
import type { Station } from '../../core/radio'
import { useRadio } from '../../stores/radio'

/** Keeps the radio on this room's station, and stops it when you leave the room. */
export function useRoomRadio(roomId: string, station: Station) {
  const follow = useRadio((s) => s.follow)
  const leave = useRadio((s) => s.leave)
  useEffect(() => follow(roomId, station), [follow, roomId, station])
  useEffect(() => () => leave(roomId), [leave, roomId])
}
