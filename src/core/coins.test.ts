import { describe, expect, it } from 'vitest'
import { cappedCoins, sessionCoins, shownBalance } from './coins'

describe('sessionCoins (mirrors private.session_coins)', () => {
  it('pays a coin per whole focus minute', () => {
    expect(sessionCoins(3000, 'stopwatch', null)).toBe(50)
    expect(sessionCoins(59, 'stopwatch', null)).toBe(0)
  })

  it('adds 5 for a full pomodoro of 20 minutes or more', () => {
    expect(sessionCoins(1500, 'pomodoro', 1500)).toBe(30)
    expect(sessionCoins(1400, 'pomodoro', 1500)).toBe(23)
    expect(sessionCoins(900, 'pomodoro', 900)).toBe(15)
  })
})

describe('cappedCoins', () => {
  it('stops at 720 a day', () => {
    expect(cappedCoins(30, 700)).toBe(20)
    expect(cappedCoins(30, 720)).toBe(0)
    expect(cappedCoins(30, 0)).toBe(30)
  })
})

describe('shownBalance', () => {
  it('never shows a negative balance', () => {
    expect(shownBalance(-12)).toEqual({ coins: 0, inDebt: true })
    expect(shownBalance(40)).toEqual({ coins: 40, inDebt: false })
  })
})
