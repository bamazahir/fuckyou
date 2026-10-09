import { daypartAt } from './daypart'

export const THEME_IDS = ['lamplight', 'library', 'blossom', 'observatory'] as const
export type ThemeId = (typeof THEME_IDS)[number]
export type ThemeMode = 'auto' | 'light' | 'dark'

export interface ThemeChoice {
  theme: ThemeId
  mode: ThemeMode
}

export const DEFAULT_THEME: ThemeChoice = { theme: 'lamplight', mode: 'auto' }

/** Accepts anything (stored settings, localStorage) and returns a valid choice. */
export function parseThemeChoice(raw: unknown): ThemeChoice {
  const o = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  const theme = (THEME_IDS as readonly unknown[]).includes(o.theme)
    ? (o.theme as ThemeId)
    : DEFAULT_THEME.theme
  const mode = o.mode === 'light' || o.mode === 'dark' || o.mode === 'auto' ? o.mode : DEFAULT_THEME.mode
  return { theme, mode }
}

/** Auto follows local time: light by day, dark by night (the 2am room stays lamp-lit). */
export function resolveMode(mode: ThemeMode, localHour: number): 'light' | 'dark' {
  if (mode !== 'auto') return mode
  return daypartAt(localHour) === 'day' ? 'light' : 'dark'
}
