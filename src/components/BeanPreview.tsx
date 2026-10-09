import { lazy, Suspense } from 'react'
import type { Avatar } from '../lib/db'
import { hasWebGL } from '../lib/webgl'
import { BeanPortrait } from './BeanPortrait'

const BeanStage = lazy(() => import('../scene/BeanStage'))

/** The live 3D bean shown while you change it (a portrait without WebGL). */
export function BeanPreview({ avatar, size, title }: { avatar: Avatar; size: number; title: string }) {
  if (!hasWebGL()) return <BeanPortrait avatar={avatar} size={size} title={title} />
  return (
    <div style={{ width: size, height: size }} className="shrink-0">
      <Suspense fallback={<BeanPortrait avatar={avatar} size={size} title={title} />}>
        <BeanStage avatar={avatar} label={title} size={size} />
      </Suspense>
    </div>
  )
}
