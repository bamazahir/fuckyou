import { useId } from 'react'
import type { AvatarColors } from '../lib/db'

/** 2D bean used until the isometric scene arrives (M4). Same proportions as the app icon. */
export function Bean({ colors, size = 120, title }: { colors: AvatarColors; size?: number; title?: string }) {
  const clip = useId()
  return (
    <svg
      viewBox="0 0 120 140"
      width={size}
      height={(size * 140) / 120}
      role="img"
      aria-label={title ?? 'Bean avatar'}
    >
      <defs>
        <clipPath id={clip}>
          <rect x="24" y="58" width="72" height="78" rx="36" />
        </clipPath>
      </defs>
      {/* body = trousers/lower half, top = shirt over the upper half */}
      <rect x="24" y="58" width="72" height="78" rx="36" fill={colors.body} />
      <rect x="20" y="54" width="80" height="50" fill={colors.top} clipPath={`url(#${clip})`} />
      <path d="M24 104 h72" stroke="#2B2622" strokeWidth="3" clipPath={`url(#${clip})`} />
      <rect x="24" y="58" width="72" height="78" rx="36" fill="none" stroke="#2B2622" strokeWidth="4" />
      <circle cx="60" cy="46" r="34" fill={colors.skin} stroke="#2B2622" strokeWidth="4" />
      <path
        d="M27 40 a33 33 0 0 1 66 0 c-17 -11 -49 -11 -66 0 z"
        fill={colors.hair}
        stroke="#2B2622"
        strokeWidth="3"
      />
      <circle cx="49" cy="52" r="4" fill="#2B2622" />
      <circle cx="71" cy="52" r="4" fill="#2B2622" />
    </svg>
  )
}
