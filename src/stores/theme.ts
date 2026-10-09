import { create } from 'zustand'
import { THEME_PREVIEWS } from '../content/themes'
import { DEFAULT_THEME, parseThemeChoice, resolveMode, type ThemeChoice } from '../core/theme'
import { supabase } from '../lib/supabase'

const KEY = 'studyroom.theme'

function readLocal(): ThemeChoice {
  try {
    return parseThemeChoice(JSON.parse(window.localStorage.getItem(KEY) ?? 'null'))
  } catch {
    return DEFAULT_THEME
  }
}

/** Writes data-theme / data-mode on <html> and keeps the browser chrome color in step. */
export function applyTheme(choice: ThemeChoice, now: Date = new Date()): 'light' | 'dark' {
  const mode = resolveMode(choice.mode, now.getHours())
  const root = document.documentElement
  root.dataset.theme = choice.theme
  root.dataset.mode = mode
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', THEME_PREVIEWS[choice.theme][mode].nav)
  return mode
}

interface ThemeState extends ThemeChoice {
  resolved: 'light' | 'dark'
  set: (choice: Partial<ThemeChoice>) => void
  adoptFromProfile: (settings: Record<string, unknown> | undefined) => void
  tick: () => void
}

export const useTheme = create<ThemeState>((set, get) => {
  const initial = readLocal()
  return {
    ...initial,
    resolved: applyTheme(initial),
    set: (patch) => {
      const next = parseThemeChoice({ theme: get().theme, mode: get().mode, ...patch })
      try {
        window.localStorage.setItem(KEY, JSON.stringify(next))
      } catch {
        // storage blocked: the choice still applies for this visit
      }
      set({ ...next, resolved: applyTheme(next) })
      // Remember it on the account too (profiles.settings is user-editable, SPEC §8.2).
      void supabase.auth.getSession().then(async ({ data }) => {
        const uid = data.session?.user.id
        if (!uid) return
        const { data: row } = await supabase.from('profiles').select('settings').eq('id', uid).maybeSingle()
        const settings = {
          ...((row as { settings?: object } | null)?.settings ?? {}),
          theme: next.theme,
          mode: next.mode,
        }
        await supabase.from('profiles').update({ settings }).eq('id', uid)
      })
    },
    adoptFromProfile: (settings) => {
      if (!settings || !('theme' in settings)) return
      const next = parseThemeChoice(settings)
      try {
        window.localStorage.setItem(KEY, JSON.stringify(next))
      } catch {
        // ignore
      }
      set({ ...next, resolved: applyTheme(next) })
    },
    tick: () => set({ resolved: applyTheme({ theme: get().theme, mode: get().mode }) }),
  }
})
