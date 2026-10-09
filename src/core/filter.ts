// Mirrors private.is_clean() (SPEC §13). The database is authoritative; this lets forms warn early.

export type MatchMode = 'exact' | 'prefix' | 'anywhere'
export interface BlockedWord {
  w: string
  m: MatchMode
}

const LEET: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '@': 'a',
  $: 's',
  '!': 'i',
}

/** Lowercase, undo leetspeak, split into letter-only words. */
export function normalizeWords(text: string): string[] {
  const s = [...text.toLowerCase()].map((ch) => LEET[ch] ?? ch).join('')
  return s.split(/[^a-z]+/).filter(Boolean)
}

export function isClean(text: string, words: readonly BlockedWord[]): boolean {
  const tokens = normalizeWords(text)
  const joined = tokens.join('')
  return !words.some(({ w, m }) =>
    m === 'anywhere' ? joined.includes(w) : tokens.some((t) => (m === 'exact' ? t === w : t.startsWith(w))),
  )
}
