import { FACE, hairOf } from '../content/avatar'
import type { Avatar, HairStyle } from '../lib/db'

// 2D version of the chibi avatar (decision 0007), drawn in a 120×140 box to match the 3D one:
// big round head, small body, stubby limbs, blush, and one of four hairstyles.

const LINE = { stroke: 'var(--line)', strokeWidth: 3.5, strokeLinejoin: 'round' as const }

const CAP =
  'M24 54 C21 22 42 9 60 9 C78 9 99 22 96 54 C93 46 89 41 84 38 C80 44 71 45 67 38 C63 45 55 45 51 38 C47 45 39 44 36 38 C31 42 27 47 24 54 Z'
const CAP_SWEPT =
  'M24 54 C21 22 42 9 60 9 C78 9 99 22 96 54 C92 44 86 36 76 33 C66 31 52 38 40 37 C32 40 27 46 24 54 Z'
const LONG_BACK = 'M23 48 C20 18 100 18 97 48 L101 100 C93 107 82 104 79 94 L41 94 C38 104 27 107 19 100 Z'
const CURLS_BACK: [number, number][] = [
  [26, 64],
  [94, 64],
  [22, 46],
  [98, 46],
  [28, 28],
  [92, 28],
  [42, 16],
  [78, 16],
  [60, 11],
]
const CURLS_FRONT: [number, number, number][] = [
  [38, 30, 11],
  [52, 24, 11],
  [68, 24, 11],
  [82, 30, 11],
  [60, 15, 10],
]

function HairBack({ style, color }: { style: HairStyle; color: string }) {
  if (style === 'long') return <path d={LONG_BACK} fill={color} {...LINE} />
  if (style === 'curly')
    return (
      <>
        {CURLS_BACK.map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r={13} fill={color} {...LINE} />
        ))}
      </>
    )
  if (style === 'bun') return <circle cx={60} cy={8} r={12} fill={color} {...LINE} />
  return null
}

function HairFront({ style, color }: { style: HairStyle; color: string }) {
  if (style === 'curly')
    return (
      <>
        {CURLS_FRONT.map(([x, y, r]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill={color} {...LINE} />
        ))}
      </>
    )
  return <path d={style === 'bun' ? CAP_SWEPT : CAP} fill={color} {...LINE} />
}

/** The avatar as an SVG group in a 120×140 box, for embedding in scenes. */
export function BeanShape({ avatar, transform }: { avatar: Avatar; transform?: string }) {
  const { colors } = avatar
  const style = hairOf(avatar)
  return (
    <g transform={transform}>
      <HairBack style={style} color={colors.hair} />
      {/* legs + shoes */}
      <rect x="46" y="112" width="11" height="18" rx="5" fill={colors.body} {...LINE} />
      <rect x="63" y="112" width="11" height="18" rx="5" fill={colors.body} {...LINE} />
      <ellipse cx="51" cy="131" rx="8" ry="5" fill={FACE.shoe} {...LINE} />
      <ellipse cx="69" cy="131" rx="8" ry="5" fill={FACE.shoe} {...LINE} />
      {/* arms */}
      <g transform="rotate(12 38 88)">
        <rect x="32" y="86" width="11" height="24" rx="5.5" fill={colors.top} {...LINE} />
        <circle cx="37.5" cy="112" r="5.5" fill={colors.skin} {...LINE} />
      </g>
      <g transform="rotate(-12 82 88)">
        <rect x="77" y="86" width="11" height="24" rx="5.5" fill={colors.top} {...LINE} />
        <circle cx="82.5" cy="112" r="5.5" fill={colors.skin} {...LINE} />
      </g>
      {/* top + shorts */}
      <path d="M44 82 h32 l5 26 a4 4 0 0 1 -4 5 h-34 a4 4 0 0 1 -4 -5 z" fill={colors.top} {...LINE} />
      <path d="M40 104 h40 l1 6 a4 4 0 0 1 -4 5 h-34 a4 4 0 0 1 -4 -5 z" fill={colors.body} {...LINE} />
      {/* head + face */}
      <circle cx="60" cy="50" r="36" fill={colors.skin} {...LINE} />
      <ellipse cx="38" cy="66" rx="6" ry="3.5" fill={FACE.blush} opacity="0.8" />
      <ellipse cx="82" cy="66" rx="6" ry="3.5" fill={FACE.blush} opacity="0.8" />
      <ellipse cx="47" cy="57" rx="4.2" ry="5.6" fill={FACE.eye} />
      <ellipse cx="73" cy="57" rx="4.2" ry="5.6" fill={FACE.eye} />
      <circle cx="48.6" cy="54.6" r="1.5" fill={FACE.shine} />
      <circle cx="74.6" cy="54.6" r="1.5" fill={FACE.shine} />
      <path d="M56 67 q4 3.5 8 0" fill="none" stroke={FACE.eye} strokeWidth="2.2" strokeLinecap="round" />
      <HairFront style={style} color={colors.hair} />
    </g>
  )
}

/** The avatar as a standalone image. */
export function Bean({ avatar, size = 120, title }: { avatar: Avatar; size?: number; title?: string }) {
  return (
    <svg
      viewBox="-4 -6 128 148"
      width={size}
      height={(size * 148) / 128}
      role="img"
      aria-label={title ?? 'Avatar'}
    >
      <BeanShape avatar={avatar} />
    </svg>
  )
}
