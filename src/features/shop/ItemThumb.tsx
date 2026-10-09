import { lazy, Suspense, useEffect } from 'react'
import { hasWebGL } from '../../lib/webgl'
import { thumbKey, useThumbs } from '../../stores/thumbs'
import { useTheme } from '../../stores/theme'

const ThumbStudio = lazy(() => import('../../scene/Thumbs'))

/** Mount once on a screen that shows thumbnails; it renders queued items in the background. */
export function ThumbRenderer() {
  if (!hasWebGL()) return null
  return (
    <Suspense fallback={null}>
      <ThumbStudio />
    </Suspense>
  )
}

/** A rendered picture of a catalog item, in the current theme (falls back to its name's first letter). */
export function ItemThumb({ itemId, name, size = 96 }: { itemId: string; name: string; size?: number }) {
  const theme = useTheme((s) => s.theme)
  const mode = useTheme((s) => s.resolved)
  const key = thumbKey(theme, mode, itemId)
  const url = useThumbs((s) => s.urls[key])
  const request = useThumbs((s) => s.request)
  useEffect(() => {
    if (hasWebGL()) request(key)
  }, [key, request])
  return url ? (
    <img src={url} alt="" width={size} height={size} className="block" draggable={false} />
  ) : (
    <span
      className="font-display grid place-items-center rounded-xl bg-surface-2 text-2xl font-bold text-muted"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {name.slice(0, 1)}
    </span>
  )
}
