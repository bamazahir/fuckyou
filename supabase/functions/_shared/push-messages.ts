// Notification texts (server side; the app's own strings live in src/content/copy.ts).
// Payloads carry no private data: a room name and a display name the recipient can already see.

export type PushKind = 'phase_end' | 'checkin' | 'room_active'

export interface PushMessage {
  title: string
  body: string
  /** Same tag replaces an older notification instead of stacking. */
  tag: string
  /** Path to open when tapped. */
  url: string
}

const clip = (s: unknown, n: number) => String(s ?? '').slice(0, n)

export function pushMessage(kind: PushKind, payload: Record<string, unknown>): PushMessage {
  const room = typeof payload.room_id === 'string' ? payload.room_id : ''
  const url = room ? `/room/${room}` : '/'
  switch (kind) {
    case 'phase_end':
      return payload.sync
        ? { title: 'Break together ☕', body: 'Focus done. Take five with the room.', tag: 'phase', url }
        : { title: 'Break time ☕', body: 'Nice focus. Stretch, drink some water.', tag: 'phase', url }
    case 'checkin':
      return { title: 'Still studying?', body: 'Tap to keep your stopwatch going.', tag: 'checkin', url }
    case 'room_active':
      return {
        title: `${clip(payload.room_name, 40)} is active`,
        body: `${clip(payload.name, 30)} just started studying.`,
        tag: `room-${room}`,
        url,
      }
  }
}

/** How long a push service may hold the message before it's pointless (seconds). */
export const PUSH_TTL: Record<PushKind, number> = { phase_end: 600, checkin: 600, room_active: 1800 }
