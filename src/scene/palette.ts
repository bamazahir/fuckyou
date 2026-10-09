// Scene colors. Everything comes from the active theme's roles (studyroom-look §1) except the light
// colors and the bean's eyes, which are art constants and stay the same in every theme.
import { Color } from 'three'

export const LIGHT = {
  key: '#FFD9A0',
  sky: '#9DB4E0',
  ground: '#5A4636',
} as const

export const EYE = '#1E1A17'

const ROLES = [
  'wall',
  'window',
  'wood',
  'glow',
  'line',
  'surface',
  'surface-2',
  'accent',
  'good',
  'rest',
  'danger',
] as const
type Role = (typeof ROLES)[number]

export interface SceneColors {
  wall: string
  wallLow: string
  skirting: string
  window: string
  wood: string
  woodDark: string
  floor: string
  floorAlt: string
  slab: string
  glow: string
  line: string
  paper: string
  paper2: string
  accent: string
  good: string
  rest: string
  danger: string
  pot: string
  rug: string
  rugInner: string
}

const FALLBACK: Record<Role, string> = {
  wall: '#3A4670',
  window: '#1D2747',
  wood: '#BA8456',
  glow: '#FFC86B',
  line: '#2B2622',
  surface: '#FBF7F0',
  'surface-2': '#E8DCC8',
  accent: '#FFC86B',
  good: '#6FA06B',
  rest: '#7FB2D9',
  danger: '#C2523C',
}

const mix = (a: string, b: string, t: number) => `#${new Color(a).lerp(new Color(b), t).getHexString()}`

/** Reads the role variables off <html> (set by the theme store) and derives the scene shades. */
export function readSceneColors(): SceneColors {
  const style = getComputedStyle(document.documentElement)
  const role = (name: Role) => style.getPropertyValue(`--${name}`).trim() || FALLBACK[name]
  const r = Object.fromEntries(ROLES.map((name) => [name, role(name)])) as Record<Role, string>
  return {
    wall: r.wall,
    wallLow: mix(r.wall, r.line, 0.14),
    skirting: mix(r.wood, r.line, 0.35),
    window: r.window,
    wood: r.wood,
    woodDark: mix(r.wood, r.line, 0.3),
    floor: mix(r.wood, r.line, 0.12),
    floorAlt: mix(r.wood, r.line, 0.2),
    slab: mix(r.wood, r.line, 0.5),
    glow: r.glow,
    line: r.line,
    paper: r.surface,
    paper2: r['surface-2'],
    accent: r.accent,
    good: r.good,
    rest: r.rest,
    danger: r.danger,
    pot: mix(r.danger, r.wood, 0.45),
    rug: mix(r.accent, r.surface, 0.25),
    rugInner: mix(r.rest, r.surface, 0.2),
  }
}
