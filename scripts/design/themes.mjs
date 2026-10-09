// Theme palette source + contrast check. `node scripts/design/themes.mjs` prints any pair below its minimum
// and writes src/styles/themes.css. Every color in the app comes from here (studyroom-look §1).
import { writeFileSync } from 'node:fs'

const shared = {
  light: { good: '#3B7A37', rest: '#356A9E', danger: '#AE3A24' },
  dark: { good: '#86D18F', rest: '#93C3F0', danger: '#FF9A86' },
}

export const THEMES = {
  lamplight: {
    label: 'Lamplight',
    dark: {
      bg: '#2F3A5C',
      pattern: '#3A4670',
      onBg: '#F6EFE4',
      onBgMuted: '#C8C6D6',
      surface: '#F6EFE4',
      surface2: '#EADFCC',
      field: '#FFFFFF',
      ink: '#2B2622',
      muted: '#675D53',
      line: '#2B2622',
      accent: '#FFC86B',
      onAccent: '#2B2622',
      nav: '#222B47',
      onNav: '#F6EFE4',
      wall: '#3A4670',
      window: '#1D2747',
      wood: '#BA8456',
      glow: '#FFC86B',
      ...shared.light,
      sceneDark: true,
    },
    light: {
      bg: '#ECE3D3',
      pattern: '#E1D5C0',
      onBg: '#2B2622',
      onBgMuted: '#5E554C',
      surface: '#FBF7F0',
      surface2: '#EFE6D6',
      field: '#FFFFFF',
      ink: '#2B2622',
      muted: '#675D53',
      line: '#2B2622',
      accent: '#FFC86B',
      onAccent: '#2B2622',
      nav: '#2F3A5C',
      onNav: '#F6EFE4',
      wall: '#E2D6C1',
      window: '#A9D3EE',
      wood: '#BA8456',
      glow: '#FFC86B',
      ...shared.light,
      sceneDark: false,
    },
  },
  library: {
    label: 'Library',
    dark: {
      bg: '#1E3A2F',
      pattern: '#25463A',
      onBg: '#F3EEDC',
      onBgMuted: '#C3CBB8',
      surface: '#F3EEDC',
      surface2: '#E4DCC3',
      field: '#FFFDF6',
      ink: '#1F2A24',
      muted: '#585C4C',
      line: '#1F2A24',
      accent: '#E0B04F',
      onAccent: '#1F2A24',
      nav: '#152B22',
      onNav: '#F3EEDC',
      wall: '#25463A',
      window: '#17263A',
      wood: '#8C5A34',
      glow: '#F2CF7A',
      ...shared.light,
      sceneDark: true,
    },
    light: {
      bg: '#DCE5D3',
      pattern: '#CFDBC4',
      onBg: '#1F2A24',
      onBgMuted: '#4B5646',
      surface: '#FAF7EC',
      surface2: '#ECE6D2',
      field: '#FFFFFF',
      ink: '#1F2A24',
      muted: '#585C4C',
      line: '#1F2A24',
      accent: '#E0B04F',
      onAccent: '#1F2A24',
      nav: '#1E3A2F',
      onNav: '#F3EEDC',
      wall: '#CFDBC4',
      window: '#B9DCEB',
      wood: '#8C5A34',
      glow: '#F2CF7A',
      ...shared.light,
      sceneDark: false,
    },
  },
  blossom: {
    label: 'Blossom',
    dark: {
      bg: '#3E2440',
      pattern: '#4A2D4C',
      onBg: '#FBEFF2',
      onBgMuted: '#D9C3D2',
      surface: '#FFF6F8',
      surface2: '#F5E1E8',
      field: '#FFFFFF',
      ink: '#3A2233',
      muted: '#6B5262',
      line: '#3A2233',
      accent: '#F49CB3',
      onAccent: '#3A2233',
      nav: '#2E1A30',
      onNav: '#FBEFF2',
      wall: '#4A2D4C',
      window: '#2A1C3D',
      wood: '#B07A62',
      glow: '#FFC9A8',
      ...shared.light,
      sceneDark: true,
    },
    light: {
      bg: '#F5E1E7',
      pattern: '#EDD2DB',
      onBg: '#3A2233',
      onBgMuted: '#634A5A',
      surface: '#FFFAFB',
      surface2: '#F6E6EC',
      field: '#FFFFFF',
      ink: '#3A2233',
      muted: '#6B5262',
      line: '#3A2233',
      accent: '#F49CB3',
      onAccent: '#3A2233',
      nav: '#3E2440',
      onNav: '#FBEFF2',
      wall: '#EDD2DB',
      window: '#C9DDF2',
      wood: '#B07A62',
      glow: '#FFC9A8',
      ...shared.light,
      sceneDark: false,
    },
  },
  observatory: {
    label: 'Observatory',
    dark: {
      bg: '#161A2E',
      pattern: '#2A3058',
      onBg: '#E8E9F5',
      onBgMuted: '#AEB2CF',
      surface: '#232847',
      surface2: '#2F3560',
      field: '#1A1E36',
      ink: '#EDEEF8',
      muted: '#B5B8D6',
      line: '#8C93CC',
      accent: '#B9A7F2',
      onAccent: '#161A2E',
      nav: '#10132A',
      onNav: '#E8E9F5',
      wall: '#1F2440',
      window: '#0E1124',
      wood: '#5B5F86',
      glow: '#D8CCFF',
      ...shared.dark,
      sceneDark: true,
    },
    light: {
      bg: '#E3E5F2',
      pattern: '#D6D9EC',
      onBg: '#1C2040',
      onBgMuted: '#4F5478',
      surface: '#FFFFFF',
      surface2: '#ECEEF8',
      field: '#FFFFFF',
      ink: '#1C2040',
      muted: '#545979',
      line: '#1C2040',
      accent: '#B9A7F2',
      onAccent: '#1C2040',
      nav: '#161A2E',
      onNav: '#E8E9F5',
      wall: '#D6D9EC',
      window: '#BFD3F5',
      wood: '#7D81A8',
      glow: '#D8CCFF',
      ...shared.light,
      sceneDark: false,
    },
  },
}

function lum(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const f = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
export const contrast = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

// [foreground, background, minimum]
const PAIRS = [
  ['onBg', 'bg', 4.5],
  ['onBgMuted', 'bg', 4.5],
  ['ink', 'surface', 7],
  ['muted', 'surface', 4.5],
  ['ink', 'surface2', 4.5],
  ['muted', 'surface2', 4.5],
  ['ink', 'field', 4.5],
  ['onAccent', 'accent', 4.5],
  ['onNav', 'nav', 4.5],
  ['good', 'surface', 3],
  ['rest', 'surface', 4.5],
  ['danger', 'surface', 4.5],
  ['line', 'surface', 3],
]

let failures = 0
for (const [name, t] of Object.entries(THEMES)) {
  for (const mode of ['light', 'dark']) {
    for (const [fg, bg, min] of PAIRS) {
      const c = contrast(t[mode][fg], t[mode][bg])
      if (c < min) {
        failures++
        console.log(`FAIL ${name}/${mode}: ${fg} on ${bg} = ${c.toFixed(2)} (< ${min})`)
      }
    }
  }
}

const VARS = {
  bg: 'bg',
  pattern: 'pattern',
  onBg: 'on-bg',
  onBgMuted: 'on-bg-muted',
  surface: 'surface',
  surface2: 'surface-2',
  field: 'field',
  ink: 'ink',
  muted: 'muted',
  line: 'line',
  accent: 'accent',
  onAccent: 'on-accent',
  nav: 'nav',
  onNav: 'on-nav',
  good: 'good',
  rest: 'rest',
  danger: 'danger',
  wall: 'wall',
  window: 'window',
  wood: 'wood',
  glow: 'glow',
}
const block = (sel, p) =>
  `${sel} {\n${Object.entries(VARS)
    .map(([k, v]) => `  --${v}: ${p[k]};`)
    .join('\n')}\n  color-scheme: ${p.surface === '#232847' ? 'dark' : p.sceneDark ? 'dark' : 'light'};\n}\n`
let css = '/* Generated by scripts/design/themes.mjs — edit the palette there, not here. */\n'
for (const [name, t] of Object.entries(THEMES)) {
  for (const mode of ['light', 'dark']) {
    const sel =
      `:root[data-theme='${name}'][data-mode='${mode}']` +
      (name === 'lamplight' && mode === 'dark' ? ',\n:root' : '')
    css += block(sel, t[mode])
  }
}
const preview = Object.fromEntries(
  Object.entries(THEMES).map(([id, t]) => [
    id,
    {
      label: t.label,
      light: { bg: t.light.bg, surface: t.light.surface, accent: t.light.accent, nav: t.light.nav },
      dark: { bg: t.dark.bg, surface: t.dark.surface, accent: t.dark.accent, nav: t.dark.nav },
    },
  ]),
)
const ts = `// Generated by scripts/design/themes.mjs — theme picker previews and meta theme-color.\nexport const THEME_PREVIEWS = ${JSON.stringify(preview, null, 2)} as const\n`
if (process.argv.includes('--write')) {
  writeFileSync(new URL('../../src/styles/themes.css', import.meta.url), css)
  writeFileSync(new URL('../../src/content/themes.ts', import.meta.url), ts)
}
console.log(failures === 0 ? 'all theme pairs pass' : `${failures} failing pairs`)
process.exitCode = failures ? 1 : 0
