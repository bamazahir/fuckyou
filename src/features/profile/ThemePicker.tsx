import { copy } from '../../content/copy'
import { THEME_PREVIEWS } from '../../content/themes'
import { THEME_IDS, type ThemeMode } from '../../core/theme'
import { useTheme } from '../../stores/theme'

const MODES: ThemeMode[] = ['auto', 'light', 'dark']

export function ThemePicker() {
  const { theme, mode, resolved, set } = useTheme()
  return (
    <section aria-labelledby="theme-heading" className="card p-5">
      <h2 id="theme-heading" className="font-display text-xl font-bold">
        {copy.theme.title}
      </h2>
      <div
        role="radiogroup"
        aria-label={copy.theme.title}
        className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4"
      >
        {THEME_IDS.map((id) => {
          const p = THEME_PREVIEWS[id][resolved]
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={theme === id}
              onClick={() => set({ theme: id })}
              className={`overflow-hidden rounded-[12px] border-2 border-line text-left ${theme === id ? 'outline-3 outline-offset-2 outline-accent' : ''}`}
            >
              <span className="flex h-16 items-end gap-1.5 p-2" style={{ backgroundColor: p.bg }}>
                <span
                  className="h-10 flex-1 rounded-md border-2 border-black/40"
                  style={{ backgroundColor: p.surface }}
                />
                <span
                  className="h-6 w-6 rounded-full border-2 border-black/40"
                  style={{ backgroundColor: p.accent }}
                />
              </span>
              <span className="block bg-surface px-2 py-1.5 font-bold text-ink">
                {THEME_PREVIEWS[id].label}
              </span>
            </button>
          )
        })}
      </div>
      <div role="radiogroup" aria-label="Light or dark" className="mt-4 grid grid-cols-3 gap-2">
        {MODES.map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            className={`chip ${mode === m ? 'chip-on' : ''}`}
            onClick={() => set({ mode: m })}
          >
            {copy.theme.mode[m]}
          </button>
        ))}
      </div>
      <p className="mt-2 text-sm text-muted">{copy.theme.autoHint}</p>
    </section>
  )
}
