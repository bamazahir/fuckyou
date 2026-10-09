// Wall and floor finishes a room can have (decision 0014). Free for everyone; 'theme' means "follow
// the app theme". The SQL check on rooms.style uses the same ids (a unit test keeps them in step).
export interface Finish {
  id: string
  name: string
  /** null = the theme's own color. */
  color: string | null
}

export const WALLS: readonly Finish[] = [
  { id: 'theme', name: 'Theme', color: null },
  { id: 'cream', name: 'Cream', color: '#EFE3CC' },
  { id: 'sage', name: 'Sage', color: '#A9C1A0' },
  { id: 'sky', name: 'Sky', color: '#A9C6E0' },
  { id: 'blush', name: 'Blush', color: '#E8B7B7' },
  { id: 'lavender', name: 'Lavender', color: '#C2B4DE' },
  { id: 'mint', name: 'Mint', color: '#B5DCCB' },
  { id: 'navy', name: 'Navy', color: '#3A4670' },
  { id: 'terracotta', name: 'Terracotta', color: '#C9785B' },
]

export const FLOORS: readonly Finish[] = [
  { id: 'theme', name: 'Theme', color: null },
  { id: 'oak', name: 'Oak', color: '#BA8456' },
  { id: 'birch', name: 'Birch', color: '#D9B98C' },
  { id: 'walnut', name: 'Walnut', color: '#7A5236' },
  { id: 'cherry', name: 'Cherry', color: '#9E5A44' },
  { id: 'slate', name: 'Slate', color: '#7C8290' },
  { id: 'chalk', name: 'Chalk', color: '#E6DED2' },
]

export interface RoomStyle {
  wall?: string
  floor?: string
}

const colorOf = (list: readonly Finish[], id: string | undefined) =>
  list.find((f) => f.id === id)?.color ?? null

/** The colors a room's style asks for (null where it follows the theme). */
export function styleColors(style: RoomStyle | null | undefined): {
  wall: string | null
  floor: string | null
} {
  return { wall: colorOf(WALLS, style?.wall), floor: colorOf(FLOORS, style?.floor) }
}
