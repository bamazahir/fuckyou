// Mirrors public.complete_profile's consent decision (SPEC §13.1). The server decides; the client
// uses this only to show the right next step without a round trip.

export type AgeBracket = 'under_13' | '13' | '14' | '15' | '16-17' | '18+'
export type ConsentStatus = 'not_required' | 'pending' | 'blocked'

export interface ConsentTable {
  defaultConsentAge: number
  entries: readonly { country: string; consentAge: number }[]
}

export const AGE_BRACKETS: readonly AgeBracket[] = ['under_13', '13', '14', '15', '16-17', '18+']

/** The youngest age inside each bracket; the strict reading for consent. */
const MIN_AGE: Record<AgeBracket, number> = {
  under_13: 0,
  '13': 13,
  '14': 14,
  '15': 15,
  '16-17': 16,
  '18+': 18,
}

export function consentAgeFor(country: string, table: ConsentTable): number {
  const code = country.trim().toUpperCase()
  return table.entries.find((e) => e.country === code)?.consentAge ?? table.defaultConsentAge
}

export function consentStatusFor(bracket: AgeBracket, country: string, table: ConsentTable): ConsentStatus {
  if (bracket === 'under_13') return 'blocked'
  return MIN_AGE[bracket] >= consentAgeFor(country, table) ? 'not_required' : 'pending'
}
