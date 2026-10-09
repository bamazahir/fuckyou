// The procedural bean avatar (SPEC §10, studyroom-look §2): capsule body split into trousers + top,
// sphere head, hair cap, two eyes, ink outline. Idle = gentle bob, focusing = writing bob,
// break = holds a mug. Walks in from the door the first time it appears.
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useRef } from 'react'
import { LatheGeometry, SphereGeometry, Vector2, type Group } from 'three'
import type { AvatarColors } from '../lib/db'
import { useScene } from './context'
import { EYE } from './palette'
import { cachedGeometry, hull, solid } from './cache'
import { Ball, Box, Cylinder, type V3 } from './parts'

const R = 0.28
const H = 0.5
const TOTAL = H + 2 * R
const SPLIT = TOTAL * 0.42
const HEAD_R = 0.26
const HEAD_Y = TOTAL + 0.15
export const BEAN_SCALE = 0.8
/** Height of the top of the head above the seat, in world units. */
export const BEAN_HEIGHT = (HEAD_Y + HEAD_R) * BEAN_SCALE

function capsulePoints(from: number, to: number): Vector2[] {
  const pts: Vector2[] = []
  const steps = 6
  const at = (y: number) => {
    if (y < R) return Math.sqrt(Math.max(0, R * R - (R - y) ** 2))
    if (y > R + H) return Math.sqrt(Math.max(0, R * R - (y - R - H) ** 2))
    return R
  }
  const ys = new Set<number>([from, to])
  for (let i = 0; i <= steps; i++) {
    ys.add(R - R * Math.cos((i / steps) * (Math.PI / 2)))
    ys.add(R + H + R * Math.sin((i / steps) * (Math.PI / 2)))
  }
  for (const y of [...ys].filter((y) => y >= from && y <= to).sort((a, b) => a - b))
    pts.push(new Vector2(at(y), y))
  return pts
}

const lower = () => cachedGeometry('bean-lower', () => new LatheGeometry(capsulePoints(0, SPLIT), 10))
const upper = () => cachedGeometry('bean-upper', () => new LatheGeometry(capsulePoints(SPLIT, TOTAL), 10))
const shell = () =>
  cachedGeometry('bean-shell', () =>
    new LatheGeometry(capsulePoints(0, TOTAL), 10).translate(0, -TOTAL / 2, 0),
  )
const hair = () =>
  cachedGeometry('bean-hair', () => new SphereGeometry(HEAD_R + 0.018, 10, 5, 0, Math.PI * 2, 0, 1.3))

const hash = (s: string) => [...s].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 997, 7) / 997
const easeOut = (t: number) => 1 - (1 - t) ** 3

export type BeanState = 'focus' | 'break' | 'idle'

export function Bean3D({
  id,
  colors,
  state,
  position,
  facing,
  from,
  onSelect,
}: {
  id: string
  colors: AvatarColors
  state: BeanState
  position: V3
  /** Rotation about y, radians (0 = facing +z). */
  facing: number
  /** Where the walk-in starts; omit to appear in place. Position and facing are applied per frame. */
  from?: V3
  onSelect?: () => void
}) {
  const { c, outline, shadows, reducedMotion } = useScene()
  const outer = useRef<Group>(null)
  const inner = useRef<Group>(null)
  const born = useRef<number | null>(null)
  const phase = hash(id) * Math.PI * 2
  const t = outline / BEAN_SCALE

  useFrame(({ clock }) => {
    const o = outer.current
    const b = inner.current
    if (!o || !b) return
    const now = clock.elapsedTime
    born.current ??= now
    const walk = from && !reducedMotion ? Math.min(1, (now - born.current) / 0.9) : 1
    const k = easeOut(walk)
    const src = from ?? position
    o.position.set(
      src[0] + (position[0] - src[0]) * k,
      position[1] + (walk < 1 ? Math.abs(Math.sin(walk * Math.PI * 4)) * 0.08 : 0),
      src[2] + (position[2] - src[2]) * k,
    )
    if (walk < 1) {
      o.rotation.y = Math.atan2(position[0] - src[0], position[2] - src[2])
    } else {
      o.rotation.y = facing
    }
    if (reducedMotion) return
    const time = now + phase
    if (state === 'focus') {
      b.position.y = Math.abs(Math.sin(time * 5)) * 0.012
      b.rotation.x = 0.1 + Math.sin(time * 2.5) * 0.02
      b.rotation.z = 0
    } else if (state === 'break') {
      b.position.y = 0
      b.rotation.x = -0.04
      b.rotation.z = Math.sin(time * 0.9) * 0.05
    } else {
      b.position.y = Math.sin(time * 1.6) * 0.015
      b.rotation.x = 0
      b.rotation.z = 0
    }
  })

  const select = onSelect
    ? (e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation()
        onSelect()
      }
    : undefined

  return (
    <group
      ref={outer}
      onClick={select}
      onPointerOver={onSelect ? () => (document.body.style.cursor = 'pointer') : undefined}
      onPointerOut={onSelect ? () => (document.body.style.cursor = '') : undefined}
    >
      <group ref={inner} scale={BEAN_SCALE}>
        <mesh geometry={lower()} material={solid(colors.body)} castShadow={shadows} />
        <mesh
          geometry={upper()}
          material={solid(colors.top)}
          scale={[1.035, 1, 1.035]}
          castShadow={shadows}
        />
        <mesh
          geometry={shell()}
          material={hull(c.line)}
          position={[0, TOTAL / 2, 0]}
          scale={[(R * 1.035 + t) / R, (TOTAL + 2 * t) / TOTAL, (R * 1.035 + t) / R]}
        />
        <Ball radius={HEAD_R} position={[0, HEAD_Y, 0]} color={colors.skin} />
        <mesh
          geometry={hair()}
          material={solid(colors.hair)}
          position={[0, HEAD_Y, 0]}
          rotation={[-0.42, 0, 0]}
        />
        {[-0.095, 0.095].map((x) => (
          <Ball
            key={x}
            radius={0.032}
            detail={0}
            position={[x, HEAD_Y - 0.02, HEAD_R - 0.02]}
            color={EYE}
            outline={false}
            shadow={false}
          />
        ))}
        {state === 'break' && (
          <group position={[0.16, 0.62, 0.3]}>
            <Cylinder top={0.075} height={0.14} color={c.accent} />
            <Box size={[0.03, 0.07, 0.05]} position={[0.09, 0, 0]} color={c.accent} outline={false} />
          </group>
        )}
      </group>
    </group>
  )
}
