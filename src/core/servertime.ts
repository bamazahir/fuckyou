/**
 * Server clock offset from one round trip (SPEC §6.1): offset = server − midpoint(t0, t1).
 * All display times use serverNow(offset), never raw Date.now().
 */
export function clockOffset(t0Ms: number, serverMs: number, t1Ms: number): number {
  return Math.round(serverMs - (t0Ms + t1Ms) / 2)
}

export function serverNow(offsetMs: number, localNowMs: number = Date.now()): number {
  return localNowMs + offsetMs
}
