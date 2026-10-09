// Low-poly building blocks: flat-shaded solids with an ink outline (an inverted hull grown by a fixed
// world thickness), so the scene matches the UI's 2px borders (studyroom-look §2).
import {
  BoxGeometry,
  CapsuleGeometry,
  CylinderGeometry,
  IcosahedronGeometry,
  SphereGeometry,
  TorusGeometry,
  type BufferGeometry,
} from 'three'
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

/** Capsule along y: total height = length + 2 × radius, centred on its position. */
export function Capsule({ radius, length, ...props }: PartProps & { radius: number; length: number }) {
  const { outline: t } = useScene()
  const geometry = cachedGeometry(`cap${radius},${length}`, () => new CapsuleGeometry(radius, length, 3, 8))
  const total = length + 2 * radius
  return (
    <Part
      geometry={geometry}
      grow={[(radius + t) / radius, (total + 2 * t) / total, (radius + t) / radius]}
      {...props}
    />
  )
}

/** Ring in the xy plane (rotate it to lie flat). `arc` < 2π makes an arch, starting from +x. */
export function Torus({
  radius,
  tube,
  arc = Math.PI * 2,
  ...props
}: PartProps & { radius: number; tube: number; arc?: number }) {
  const { outline: t } = useScene()
  const geometry = cachedGeometry(
    `tor${radius},${tube},${arc}`,
    () => new TorusGeometry(radius, tube, 6, 16, arc),
  )
  const s = (tube + t) / tube
  return <Part geometry={geometry} grow={[1 + (t / radius) * 0.5, 1 + (t / radius) * 0.5, s]} {...props} />
}

/** Open spherical cap (top of a sphere down to `theta` radians from the pole), e.g. a hat crown. */
export function Dome({ radius, theta, ...props }: PartProps & { radius: number; theta: number }) {
  const geometry = cachedGeometry(
    `dome${radius},${theta}`,
    () => new SphereGeometry(radius, 12, 6, 0, Math.PI * 2, 0, theta),
  )
  return <Part geometry={geometry} grow={[1, 1, 1]} {...props} outline={false} />
}
