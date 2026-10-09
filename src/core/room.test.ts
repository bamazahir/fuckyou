import { describe, expect, it } from 'vitest'
import { createRateLimiter, isNightOwlHour, parseInviteCode, roomBanner, shortDuration } from './room'

describe('roomBanner', () => {
  it('is proud when you are the only one studying', () => {
    expect(roomBanner(['me'], 'me', 4320, 15)).toEqual({ kind: 'alone', seconds: 4320 })
  })

  it('switches to the night-owl line between midnight and 5am', () => {
    expect(roomBanner(['me'], 'me', 600, 2)).toEqual({ kind: 'night_owl', seconds: 600 })
    expect(isNightOwlHour(5)).toBe(false)
  })

  it('invites you to start when nobody is studying', () => {
    expect(roomBanner([], 'me', 0, 15)).toEqual({ kind: 'empty' })
  })

  it('shows nothing when others are there', () => {
    expect(roomBanner(['me', 'mia'], 'me', 600, 2)).toBeNull()
    expect(roomBanner(['mia'], 'me', 0, 2)).toBeNull()
  })
})

describe('shortDuration', () => {
  it('formats sittings', () => {
    expect(shortDuration(30)).toBe('<1m')
    expect(shortDuration(25 * 60)).toBe('25m')
    expect(shortDuration(72 * 60)).toBe('1h 12m')
  })
})

describe('createRateLimiter', () => {
  it('allows one action per gap per sender', () => {
    const allow = createRateLimiter(3000)
    expect(allow('a', 0)).toBe(true)
    expect(allow('a', 1000)).toBe(false)
    expect(allow('b', 1000)).toBe(true)
    expect(allow('a', 3000)).toBe(true)
  })
})

describe('parseInviteCode', () => {
  it('accepts a bare code in any case', () => {
    expect(parseInviteCode(' ab3dk7m9 ')).toBe('AB3DK7M9')
  })

  it('pulls the code out of an invite link', () => {
    expect(parseInviteCode('https://studyroom.app/j/AB3DK7M9')).toBe('AB3DK7M9')
  })

  it('rejects anything else, including letters the codes never use', () => {
    expect(parseInviteCode('hello')).toBeNull()
    expect(parseInviteCode('ABCDEFGI')).toBeNull() // I is not in the alphabet
  })
})
