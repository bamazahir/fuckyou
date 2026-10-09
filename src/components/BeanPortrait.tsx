import { useEffect } from 'react'
import type { Avatar } from '../lib/db'
import { hasWebGL } from '../lib/webgl'
import { beanKey, useThumbs } from '../stores/thumbs'

/**
 * A 3D-rendered head-and-shoulders picture of a bean, in a round frame (rendered once per look on the
 * device, by the thumbnail studio). Until it's ready, or without WebGL, a plain disc in their colors.
 */
export function BeanPortrait({ avatar, size = 40, title }: { avatar: Avatar; size?: number; title: string }) {
  const key = beanKey(avatar)
  const url = useThumbs((s) => s.urls[key])
  const requestBean = useThumbs((s) => s.requestBean)
  useEffect(() => {
    if (hasWebGL()) requestBean(avatar)
  }, [key, avatar, requestBean])
  return (
    <span
      role="img"
      aria-label={title}
      className="relative inline-block shrink-0 overflow-hidden rounded-full border-2 border-line bg-surface-2"
      style={{ width: size, height: size }}
    >
      {url ? (
        <img src={url} alt="" width={size} height={size} className="block size-full" draggable={false} />
      ) : (
        <span
          aria-hidden="true"
          className="absolute inset-x-[18%] bottom-[-12%] top-[22%] rounded-full"
          style={{ background: avatar.colors.top }}
        >
          <span
            className="absolute left-1/2 top-[-38%] block aspect-square w-[78%] -translate-x-1/2 rounded-full"
            style={{ background: avatar.colors.skin }}
          />
        </span>
      )}
    </span>
  )
}
