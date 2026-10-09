// Low-poly building blocks: flat-shaded solids with an ink outline (an inverted hull grown by a fixed
// world thickness), so the scene matches the UI's 2px borders (studyroom-look §2).
import { BoxGeometry, CylinderGeometry, IcosahedronGeometry, type BufferGeometry } from 'three'
import { cachedGeometry, hull, solid } from './cache'
import { useScene } from './context'

export type V3 = [number, number, number]

interface PartProps {
  position?: V3
  rotation?: V3
  color: string
  glow?: number
  outline?: boolean
  shadow?: boolean
}

function Part({
  geometry,
  grow,
  position,
  rotation,
  color,
  glow = 0,
  outline = true,
  shadow = true,
}: PartProps & { geometry: BufferGeometry; grow: V3 }) {
  const env = useScene()
  return (
    <group position={position} rotation={rotation}>
      <mesh
        geometry={geometry}
        material={solid(color, glow)}
        castShadow={shadow && env.shadows}
        receiveShadow={env.shadows}
      />
      {outline && <mesh geometry={geometry} material={hull(env.c.line)} scale={grow} />}
    </group>
  )
}

export function Box({ size: [w, h, d], ...props }: PartProps & { size: V3 }) {
  const { outline: t } = useScene()
  const geometry = cachedGeometry(`box${w},${h},${d}`, () => new BoxGeometry(w, h, d))
  return <Part geometry={geometry} grow={[(w + 2 * t) / w, (h + 2 * t) / h, (d + 2 * t) / d]} {...props} />
}

export function Cylinder({
  top,
  bottom = top,
  height,
  segments = 10,
  ...props
}: PartProps & { top: number; bottom?: number; height: number; segments?: number }) {
  const { outline: t } = useScene()
  const r = Math.max(top, bottom)
  const geometry = cachedGeometry(
    `cyl${top},${bottom},${height},${segments}`,
    () => new CylinderGeometry(top, bottom, height, segments),
  )
  return <Part geometry={geometry} grow={[(r + t) / r, (height + 2 * t) / height, (r + t) / r]} {...props} />
}

export function Ball({ radius, detail = 1, ...props }: PartProps & { radius: number; detail?: number }) {
  const { outline: t } = useScene()
  const geometry = cachedGeometry(`ico${radius},${detail}`, () => new IcosahedronGeometry(radius, detail))
  const s = (radius + t) / radius
  return <Part geometry={geometry} grow={[s, s, s]} {...props} />
}
