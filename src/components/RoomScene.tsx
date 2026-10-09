import { useId } from 'react'
import type { Avatar } from '../lib/db'
import { BeanShape } from './Bean'

/**
 * The 2D room vignette (until the isometric scene in M4): wall, window with the real time of day,
 * shelf, lamp, desk and up to three beans. Every color is a theme role (studyroom-look §1).
 */
export function RoomScene({
  beans,
  night,
  lampOn = beans.length > 0,
  label,
}: {
  beans: Avatar[]
  night: boolean
  lampOn?: boolean
  label: string
}) {
  const glow = useId()
  const sky = useId()
  const seats = beans.slice(0, 3)
  const seatX = [150, 205, 95]
  return (
    <svg viewBox="0 0 360 170" className="block h-auto w-full" role="img" aria-label={label}>
      <defs>
        <radialGradient id={glow} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="var(--glow)" stopOpacity={night ? 0.55 : 0.25} />
          <stop offset="1" stopColor="var(--glow)" stopOpacity="0" />
        </radialGradient>
        <clipPath id={sky}>
          <rect x="226" y="18" width="96" height="66" rx="6" />
        </clipPath>
      </defs>

      {/* wall + floor */}
      <rect width="360" height="170" fill="var(--wall)" />
      <rect y="140" width="360" height="30" fill="var(--wood)" />
      <path d="M0 140 h360" stroke="var(--line)" strokeWidth="3" />

      {/* window with the time of day */}
      <rect x="226" y="18" width="96" height="66" rx="6" fill="var(--window)" />
      <g clipPath={`url(#${sky})`}>
        {night ? (
          <>
            <circle cx="296" cy="38" r="9" fill="var(--surface)" />
            <circle cx="300" cy="35" r="8" fill="var(--window)" />
            {[
              [244, 30],
              [262, 52],
              [282, 66],
              [312, 58],
              [252, 72],
            ].map(([x, y]) => (
              <circle key={`${x}-${y}`} cx={x} cy={y} r="1.6" fill="var(--surface)" />
            ))}
          </>
        ) : (
          <>
            <circle cx="300" cy="36" r="10" fill="var(--glow)" />
            <path d="M240 64 a10 10 0 0 1 18 -6 a8 8 0 0 1 14 6 z" fill="var(--surface)" />
          </>
        )}
      </g>
      <rect x="226" y="18" width="96" height="66" rx="6" fill="none" stroke="var(--line)" strokeWidth="3" />
      <path d="M274 18 v66 M226 51 h96" stroke="var(--line)" strokeWidth="2.5" />

      {/* shelf with books */}
      <path d="M20 62 h84" stroke="var(--line)" strokeWidth="4" strokeLinecap="round" />
      {[
        [26, 'var(--accent)', 22],
        [36, 'var(--rest)', 26],
        [46, 'var(--surface-2)', 20],
        [55, 'var(--good)', 24],
        [66, 'var(--danger)', 18],
      ].map(([x, fill, h]) => (
        <rect
          key={String(x)}
          x={Number(x)}
          y={62 - Number(h)}
          width="8"
          height={Number(h)}
          fill={String(fill)}
          stroke="var(--line)"
          strokeWidth="2"
        />
      ))}
      <path d="M80 60 l10 -18 l8 2 l-10 18 z" fill="var(--surface)" stroke="var(--line)" strokeWidth="2" />

      {/* plant */}
      <path d="M30 140 v-14 h22 v14 z" fill="var(--surface-2)" stroke="var(--line)" strokeWidth="2.5" />
      <path
        d="M41 126 c-10 -6 -12 -18 -6 -26 c4 8 8 14 6 26 z M41 126 c10 -6 14 -16 8 -24 c-4 8 -8 14 -8 24 z"
        fill="var(--good)"
        stroke="var(--line)"
        strokeWidth="2"
      />

      {/* lamp + glow */}
      {lampOn && <circle cx="272" cy="104" r="70" fill={`url(#${glow})`} />}
      <path
        d="M258 92 h28 l9 20 h-46 z"
        fill={lampOn ? 'var(--glow)' : 'var(--surface-2)'}
        stroke="var(--line)"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path d="M272 112 v12" stroke="var(--line)" strokeWidth="3" />

      {/* beans sit behind the desk */}
      {seats.map((avatar, i) => (
        <BeanShape key={i} avatar={avatar} transform={`translate(${(seatX[i] ?? 150) - 24} 76) scale(0.4)`} />
      ))}
      {seats.length === 0 && (
        <path
          d="M148 98 h40 v26 M152 124 v-26"
          fill="none"
          stroke="var(--line)"
          strokeWidth="3"
          strokeLinecap="round"
        />
      )}

      {/* desk */}
      <rect
        x="70"
        y="122"
        width="236"
        height="12"
        rx="3"
        fill="var(--wood)"
        stroke="var(--line)"
        strokeWidth="2.5"
      />
      <path d="M86 134 v8 M290 134 v8" stroke="var(--line)" strokeWidth="4" strokeLinecap="round" />
      <rect
        x="168"
        y="112"
        width="34"
        height="10"
        rx="2"
        fill="var(--surface)"
        stroke="var(--line)"
        strokeWidth="2"
      />
      <rect
        x="120"
        y="114"
        width="16"
        height="8"
        rx="1.5"
        fill="var(--accent)"
        stroke="var(--line)"
        strokeWidth="2"
      />
    </svg>
  )
}
