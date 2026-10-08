// Mirrors the database checks so forms can explain problems before submitting.

export const HANDLE_RE = /^[a-z0-9_]{3,20}$/

export function normalizeHandle(raw: string): string {
  return raw.trim().toLowerCase()
}

export function handleError(raw: string): 'too_short' | 'too_long' | 'bad_chars' | null {
  const h = normalizeHandle(raw)
  if (h.length < 3) return 'too_short'
  if (h.length > 20) return 'too_long'
  if (!HANDLE_RE.test(h)) return 'bad_chars'
  return null
}

export function displayNameError(raw: string): 'empty' | 'too_long' | null {
  const n = raw.trim()
  if (n.length === 0) return 'empty'
  if ([...n].length > 30) return 'too_long'
  return null
}

export function noteError(raw: string): 'too_short' | 'too_long' | null {
  const n = raw.trim()
  if ([...n].length < 3) return 'too_short'
  if ([...n].length > 140) return 'too_long'
  return null
}
