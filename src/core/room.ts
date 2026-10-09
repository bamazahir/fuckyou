// Pure helpers for the shared room view (SPEC §5.3).

export function isNightOwlHour(localHour: number): boolean {
  return localHour >= 0 && localHour < 5
}

/** "1h 12m" / "25m" / "<1m". */
export function shortDuration(seconds: number): string {
  if (seconds < 60) return '<1m'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export type Banner = { kind: 'alone' | 'night_owl'; seconds: number } | { kind: 'empty' } | null

/** Banner for the room: alone (proud, not lonely), night-owl variant, or an empty room. */
export function roomBanner(
  liveUserIds: readonly string[],
  me: string,
  mySittingSeconds: number,
  localHour: number,
): Banner {
  if (liveUserIds.length === 0) return { kind: 'empty' }
  if (liveUserIds.length === 1 && liveUserIds[0] === me) {
    return { kind: isNightOwlHour(localHour) ? 'night_owl' : 'alone', seconds: mySittingSeconds }
  }
  return null
}

/** Client-side rate limit for reactions and nudges: one per `gapMs` per sender (SPEC §9). */
export function createRateLimiter(gapMs: number) {
  const last = new Map<string, number>()
  return (key: string, nowMs: number): boolean => {
    const prev = last.get(key)
    if (prev !== undefined && nowMs - prev < gapMs) return false
    last.set(key, nowMs)
    return true
  }
}

const INVITE_RE = /^[0-9A-HJKMNP-TV-Z]{8}$/

/** Pulls an invite code out of a pasted code or link (…/j/ABCD1234). */
export function parseInviteCode(input: string): string | null {
  const raw = input.trim()
  const fromLink = /\/j\/([A-Za-z0-9]{8})\b/.exec(raw)?.[1]
  const code = (fromLink ?? raw).toUpperCase()
  return INVITE_RE.test(code) ? code : null
}
