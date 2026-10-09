// What a finished session pays once its note is saved (SPEC §6.5). Pure; the server is authoritative
// (private.session_coins + the 720/day cap), this is for showing an estimate before saving.

export const DAILY_CAP = 720

export function sessionCoins(
  focusSeconds: number,
  kind: 'pomodoro' | 'stopwatch',
  plannedSeconds: number | null,
): number {
  const minutes = Math.floor(Math.max(0, focusSeconds) / 60)
  const bonus =
    kind === 'pomodoro' && (plannedSeconds ?? 0) >= 1200 && focusSeconds >= (plannedSeconds ?? 0) ? 5 : 0
  return minutes + bonus
}

/** The estimate after the daily cap, given what was already earned today. */
export function cappedCoins(coins: number, earnedToday: number): number {
  return Math.max(0, Math.min(coins, DAILY_CAP - earnedToday))
}

/** Balances can go negative after a void; the UI shows 0 with a note (SPEC §6.5). */
export function shownBalance(balance: number): { coins: number; inDebt: boolean } {
  return balance < 0 ? { coins: 0, inDebt: true } : { coins: balance, inDebt: false }
}
