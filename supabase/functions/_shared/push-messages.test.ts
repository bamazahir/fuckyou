import { describe, expect, it } from 'vitest'
import { pushMessage } from './push-messages'

describe('pushMessage', () => {
  it('says break together in sync rooms', () => {
    expect(pushMessage('phase_end', { room_id: 'r1', sync: true })).toMatchObject({
      title: 'Break together ☕',
      url: '/room/r1',
    })
    expect(pushMessage('phase_end', { room_id: 'r1', sync: false }).title).toBe('Break time ☕')
  })

  it('names the room and who started, clipped', () => {
    const m = pushMessage('room_active', { room_id: 'r2', room_name: 'IB Chem', name: 'Mia' })
    expect(m).toEqual({
      title: 'IB Chem is active',
      body: 'Mia just started studying.',
      tag: 'room-r2',
      url: '/room/r2',
    })
    expect(pushMessage('room_active', { room_name: 'x'.repeat(99) }).title.length).toBeLessThan(60)
  })

  it('falls back to home without a room', () => {
    expect(pushMessage('checkin', {}).url).toBe('/')
  })
})
