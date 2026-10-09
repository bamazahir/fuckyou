import { useId } from 'react'
import { FACE, lookOf, type Look } from '../content/avatar'
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

function HairBack({ style, color, hat }: { style: HairStyle; color: string; hat: boolean }) {
  if (style === 'long') return <path d={LONG_BACK} fill={color} {...LINE} />
  if (style === 'curly')
    return (
      <>
        {CURLS_BACK.map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r={13} fill={color} {...LINE} />
        ))}
      </>
    )
  if (style === 'bun' && !hat) return <circle cx={60} cy={8} r={12} fill={color} {...LINE} />
  return null
}

function HairFront({ style, color, hat }: { style: HairStyle; color: string; hat: boolean }) {
  if (style === 'curly' && hat)
    return (
      <>
        {CURLS_FRONT.filter(([, y]) => y > 20).map(([x, y, r]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y + 8} r={r} fill={color} {...LINE} />
        ))}
      </>
    )
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

const TORSO = 'M44 82 h32 l5 26 a4 4 0 0 1 -4 5 h-34 a4 4 0 0 1 -4 -5 z'

function Legs({ look, colors }: { look: Look; colors: Avatar['colors'] }) {
  const thigh = look.bottom === 'skirt' ? colors.skin : colors.body
  const shin = look.bottom === 'trousers' ? colors.body : colors.skin
  return (
    <>
      {[46, 63].map((x) => (
        <g key={x}>
          <rect x={x} y="112" width="11" height="18" rx="5" fill={shin} {...LINE} />
          {thigh !== shin && <rect x={x} y="110" width="11" height="9" rx="4" fill={thigh} {...LINE} />}
        </g>
      ))}
      <ellipse cx="51" cy="131" rx="8" ry="5" fill={FACE.shoe} {...LINE} />
      <ellipse cx="69" cy="131" rx="8" ry="5" fill={FACE.shoe} {...LINE} />
    </>
  )
}

function Torso({ look, colors, clip }: { look: Look; colors: Avatar['colors']; clip: string }) {
  return (
    <>
      {look.top === 'hoodie' && (
        <path d="M40 90 C34 76 46 70 60 70 C74 70 86 76 80 90 z" fill={colors.top} {...LINE} />
      )}
      <path d={TORSO} fill={colors.top} {...LINE} />
      {look.top === 'stripes' && (
        <g clipPath={`url(#${clip})`}>
          <rect x="36" y="92" width="48" height="5" fill={look.accent} />
          <rect x="36" y="101" width="48" height="5" fill={look.accent} />
        </g>
      )}
      {look.top === 'hoodie' && (
        <>
          <rect x="50" y="98" width="20" height="9" rx="3" fill={colors.top} {...LINE} strokeWidth={2.5} />
          <path d="M56 84 v8 M64 84 v8" stroke={FACE.collar} strokeWidth="2.2" strokeLinecap="round" />
        </>
      )}
      {look.top === 'collar' && (
        <path
          d="M50 81 l10 9 l-12 2 z M70 81 l-10 9 l12 2 z"
          fill={FACE.collar}
          {...LINE}
          strokeWidth={2.5}
        />
      )}
      {look.bottom === 'skirt' ? (
        <path d="M42 102 h36 l8 16 a3 3 0 0 1 -3 4 h-46 a3 3 0 0 1 -3 -4 z" fill={colors.body} {...LINE} />
      ) : (
        <path d="M40 104 h40 l1 6 a4 4 0 0 1 -4 5 h-34 a4 4 0 0 1 -4 -5 z" fill={colors.body} {...LINE} />
      )}
    </>
  )
}

function Accessories({ look, layer, hairColor }: { look: Look; layer: 'back' | 'front'; hairColor: string }) {
  const a = look.accessories
  const c = look.accent
  if (layer === 'back')
    return a.has('headphones') ? (
      <path
        d="M22 54 C20 14 100 14 98 54"
        fill="none"
        stroke={FACE.eye}
        strokeWidth="6"
        strokeLinecap="round"
      />
    ) : null
  return (
    <>
      {a.has('cat_ears') && (
        <>
          <path d="M28 30 l4 -24 l18 14 z M92 30 l-4 -24 l-18 14 z" fill={hairColor} {...LINE} />
          <path d="M32 24 l2 -11 l9 7 z M88 24 l-2 -11 l-9 7 z" fill={FACE.blush} />
        </>
      )}
      {a.has('beret') && (
        <g transform="rotate(-12 60 14)">
          <ellipse cx="60" cy="16" rx="40" ry="12" fill={c} {...LINE} />
          <circle cx="60" cy="4" r="3.5" fill={c} {...LINE} />
        </g>
      )}
      {a.has('flower') && (
        <g transform="translate(86 24)">
          {[0, 72, 144, 216, 288].map((r) => (
            <circle
              key={r}
              cx={Math.cos((r * Math.PI) / 180) * 6}
              cy={Math.sin((r * Math.PI) / 180) * 6}
              r="5"
              fill={c}
              {...LINE}
              strokeWidth={2}
            />
          ))}
          <circle r="3.5" fill={FACE.collar} />
        </g>
      )}
      {a.has('shades') && (
        <g fill={FACE.eye}>
          <rect x="37" y="51" width="20" height="13" rx="5" />
          <rect x="63" y="51" width="20" height="13" rx="5" />
          <path d="M56 54 h8" stroke={FACE.eye} strokeWidth="3" />
        </g>
      )}
      {a.has('glasses') && (
        <g fill="none" stroke={FACE.eye} strokeWidth="2.6">
          <circle cx="47" cy="57" r="9" />
          <circle cx="73" cy="57" r="9" />
          <path d="M56 56 h8" />
        </g>
      )}
      {a.has('headphones') && (
        <>
          <rect x="15" y="44" width="13" height="22" rx="6" fill={c} {...LINE} />
          <rect x="92" y="44" width="13" height="22" rx="6" fill={c} {...LINE} />
        </>
      )}
      {a.has('beanie') && (
        <>
          <path d="M22 40 C22 6 98 6 98 40 z" fill={c} {...LINE} />
          <rect x="19" y="34" width="82" height="12" rx="6" fill={c} {...LINE} />
          <circle cx="60" cy="6" r="7" fill={c} {...LINE} />
        </>
      )}
      {a.has('cap') && (
        <>
          <path d="M23 38 C23 6 97 6 97 38 z" fill={c} {...LINE} />
          <path d="M60 36 h40 a6 6 0 0 1 0 8 h-40 z" fill={c} {...LINE} />
        </>
      )}
      {a.has('bow') && (
        <g transform="rotate(-20 88 22)">
          <path d="M88 22 l-14 -9 v18 z M88 22 l14 -9 v18 z" fill={c} {...LINE} />
          <circle cx="88" cy="22" r="4" fill={c} {...LINE} />
        </g>
      )}
      {a.has('scarf') && (
        <>
          <rect x="40" y="78" width="40" height="10" rx="5" fill={c} {...LINE} />
          <rect x="64" y="84" width="9" height="18" rx="3" fill={c} {...LINE} transform="rotate(-8 68 84)" />
        </>
      )}
    </>
  )
}

/** The avatar as an SVG group in a 120×140 box, for embedding in scenes. */
export function BeanShape({ avatar, transform }: { avatar: Avatar; transform?: string }) {
  const { colors } = avatar
  const look = lookOf(avatar)
  const clip = useId()
  const hat = look.accessories.has('beanie') || look.accessories.has('cap')
  return (
    <g transform={transform}>
      <defs>
        <clipPath id={clip}>
          <path d={TORSO} />
        </clipPath>
      </defs>
      <HairBack style={look.hair} color={colors.hair} hat={hat} />
      <Legs look={look} colors={colors} />
      {/* arms */}
      <g transform="rotate(12 38 88)">
        <rect x="32" y="86" width="11" height="24" rx="5.5" fill={colors.top} {...LINE} />
        <circle cx="37.5" cy="112" r="5.5" fill={colors.skin} {...LINE} />
      </g>
      <g transform="rotate(-12 82 88)">
        <rect x="77" y="86" width="11" height="24" rx="5.5" fill={colors.top} {...LINE} />
        <circle cx="82.5" cy="112" r="5.5" fill={colors.skin} {...LINE} />
      </g>
      <Torso look={look} colors={colors} clip={clip} />
      <Accessories look={look} layer="back" hairColor={colors.hair} />
      {/* head + face */}
      <circle cx="60" cy="50" r="36" fill={colors.skin} {...LINE} />
      <ellipse cx="38" cy="66" rx="6" ry="3.5" fill={FACE.blush} opacity="0.8" />
      <ellipse cx="82" cy="66" rx="6" ry="3.5" fill={FACE.blush} opacity="0.8" />
      <ellipse cx="47" cy="57" rx="4.2" ry="5.6" fill={FACE.eye} />
      <ellipse cx="73" cy="57" rx="4.2" ry="5.6" fill={FACE.eye} />
      <circle cx="48.6" cy="54.6" r="1.5" fill={FACE.shine} />
      <circle cx="74.6" cy="54.6" r="1.5" fill={FACE.shine} />
      <path d="M56 67 q4 3.5 8 0" fill="none" stroke={FACE.eye} strokeWidth="2.2" strokeLinecap="round" />
      <HairFront style={look.hair} color={colors.hair} hat={hat} />
      <Accessories look={look} layer="front" hairColor={colors.hair} />
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
