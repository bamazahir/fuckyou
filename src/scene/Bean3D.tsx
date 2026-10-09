// The avatar (SPEC §10, decision 0007): a chibi kid with a big round head, small body and stubby
// limbs, four color slots and a hairstyle. Seated at a chair or on a floor cushion: writing while
// focusing, sipping from a mug on a break, looking around when idle. Walks in the first time it appears.
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useRef, useState, type ReactNode } from 'react'
import type { Group } from 'three'
import { FACE, hairOf } from '../content/avatar'
import type { Avatar, HairStyle } from '../lib/db'
import { useScene } from './context'
import { Ball, Box, Capsule, Cylinder, type V3 } from './parts'

const HEAD_R = 0.27
const HIP_SIT = 0.06
const HIP_STAND = 0.27
const NECK = 0.52
/** Height of the top of the hair above the seat when sitting, in world units. */
export const BEAN_HEIGHT = HIP_SIT + NECK + HEAD_R + 0.06

export type BeanState = 'focus' | 'break' | 'idle'
type Pose = 'stand' | 'chair' | 'floor'

const hash = (s: string) => [...s].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 997, 7) / 997
const easeOut = (t: number) => 1 - (1 - t) ** 3

function Face() {
  const z = HEAD_R * 0.9
  const y = -0.02
  const quiet = { outline: false, shadow: false } as const
  return (
    <>
      {[-0.09, 0.09].map((x) => (
        <group key={x} position={[x, y, z]}>
          <group scale={[1, 1.35, 0.7]}>
            <Ball radius={0.04} color={FACE.eye} {...quiet} />
          </group>
          <Ball radius={0.013} detail={0} position={[0.012, 0.022, 0.03]} color={FACE.shine} {...quiet} />
        </group>
      ))}
      {[-0.16, 0.16].map((x) => (
        <Cylinder
          key={x}
          top={0.045}
          height={0.01}
          segments={8}
          position={[x, y - 0.065, z - 0.035]}
          rotation={[Math.PI / 2, 0, -x]}
          color={FACE.blush}
          {...quiet}
        />
      ))}
      <Box size={[0.05, 0.014, 0.01]} position={[0, y - 0.085, z - 0.01]} color={FACE.eye} {...quiet} />
    </>
  )
}

function Cap({ color }: { color: string }) {
  return (
    <group rotation={[-0.3, 0, 0]}>
      <group scale={[1.04, 0.9, 1.04]} position={[0, 0.05, -0.01]}>
        <Ball radius={HEAD_R} detail={2} color={color} position={[0, 0.03, -0.03]} />
      </group>
    </group>
  )
}

function Fringe({ color, xs = [-0.12, 0, 0.12] }: { color: string; xs?: number[] }) {
  return (
    <>
      {xs.map((x) => (
        <group key={x} position={[x, 0.15, 0.17]} scale={[1, 0.7, 0.6]}>
          <Ball radius={0.1} color={color} outline={false} />
        </group>
      ))}
    </>
  )
}

const CURLS: V3[] = [
  [0, 0.27, 0],
  [0.15, 0.22, 0.08],
  [-0.15, 0.22, 0.08],
  [0.2, 0.15, -0.1],
  [-0.2, 0.15, -0.1],
  [0, 0.2, -0.18],
  [0.24, 0.02, -0.04],
  [-0.24, 0.02, -0.04],
  [0.12, 0.05, -0.22],
  [-0.12, 0.05, -0.22],
  [0.08, 0.2, 0.18],
  [-0.08, 0.2, 0.18],
]

function Hair({ style, color }: { style: HairStyle; color: string }) {
  switch (style) {
    case 'short':
      return (
        <>
          <Cap color={color} />
          <Fringe color={color} />
        </>
      )
    case 'long':
      return (
        <>
          <Cap color={color} />
          <Fringe color={color} />
          <group position={[0, -0.13, -0.12]} scale={[1.25, 1, 0.65]}>
            <Capsule radius={0.2} length={0.16} color={color} />
          </group>
          {[-0.23, 0.23].map((x) => (
            <Capsule key={x} radius={0.065} length={0.2} position={[x, -0.12, 0.02]} color={color} />
          ))}
        </>
      )
    case 'curly':
      return (
        <>
          <Cap color={color} />
          {CURLS.map((p) => (
            <Ball key={p.join()} radius={0.105} position={p} color={color} />
          ))}
        </>
      )
    case 'bun':
      return (
        <>
          <Cap color={color} />
          <Fringe color={color} xs={[-0.1, 0.06]} />
          <Ball radius={0.11} position={[0, 0.27, -0.12]} color={color} />
        </>
      )
  }
}

function Mug() {
  const { c } = useScene()
  return (
    <group position={[0, -0.27, 0.04]} rotation={[1.3, 0, 0]}>
      <Cylinder top={0.06} height={0.11} color={c.accent} />
      <Box size={[0.025, 0.06, 0.04]} position={[0.07, 0, 0]} color={c.accent} outline={false} />
    </group>
  )
}

function Leg({
  pose,
  color,
  innerRef,
  x,
}: {
  pose: Pose
  color: string
  innerRef: React.Ref<Group>
  x: number
}) {
  const hip = pose === 'stand' ? HIP_STAND : HIP_SIT
  let parts: ReactNode
  if (pose === 'stand') {
    parts = (
      <>
        <Capsule radius={0.065} length={0.12} position={[0, -0.13, 0]} color={color} />
        <Box size={[0.1, 0.06, 0.15]} position={[0, -0.24, 0.02]} color={FACE.shoe} />
      </>
    )
  } else if (pose === 'chair') {
    parts = (
      <>
        <Capsule
          radius={0.065}
          length={0.12}
          position={[0, 0, 0.1]}
          rotation={[Math.PI / 2, 0, 0]}
          color={color}
        />
        <Capsule radius={0.06} length={0.12} position={[0, -0.12, 0.2]} color={color} />
        <Box size={[0.1, 0.06, 0.15]} position={[0, -0.24, 0.23]} color={FACE.shoe} />
      </>
    )
  } else {
    parts = (
      <>
        <Capsule
          radius={0.065}
          length={0.32}
          position={[0, 0, 0.2]}
          rotation={[Math.PI / 2, 0, 0]}
          color={color}
        />
        <Box size={[0.1, 0.15, 0.06]} position={[0, 0.03, 0.42]} color={FACE.shoe} />
      </>
    )
  }
  return (
    <group ref={innerRef} position={[x, hip, 0]}>
      {parts}
    </group>
  )
}

const ARM_REST: Record<BeanState, [number, number]> = { focus: [-1.1, -1.15], break: [0, -1.3], idle: [0, 0] }

export function Bean3D({
  id,
  avatar,
  state,
  position,
  facing,
  seat,
  from,
  onSelect,
}: {
  id: string
  avatar: Avatar
  state: BeanState
  position: V3
  /** Rotation about y, radians (0 = facing +z). */
  facing: number
  seat: 'chair' | 'floor'
  /** Where the walk-in starts; omit to appear in place. Position and facing are applied per frame. */
  from?: V3
  onSelect?: () => void
}) {
  const { reducedMotion } = useScene()
  const { colors } = avatar
  const outer = useRef<Group>(null)
  const body = useRef<Group>(null)
  const head = useRef<Group>(null)
  const armL = useRef<Group>(null)
  const armR = useRef<Group>(null)
  const legL = useRef<Group>(null)
  const legR = useRef<Group>(null)
  const born = useRef<number | null>(null)
  const [walking, setWalking] = useState(() => from !== undefined && !reducedMotion)
  const phase = hash(id) * Math.PI * 2
  const pose: Pose = walking ? 'stand' : seat
  const hip = pose === 'stand' ? HIP_STAND : HIP_SIT
  const [restL, restR] = walking ? [0, 0] : ARM_REST[state]

  useFrame(({ clock }) => {
    const o = outer.current
    if (!o) return
    const now = clock.elapsedTime
    born.current ??= now
    const walk = walking && from ? Math.min(1, (now - born.current) / 1.4) : 1
    if (walking && from) {
      const k = easeOut(walk)
      o.position.set(from[0] + (position[0] - from[0]) * k, 0, from[2] + (position[2] - from[2]) * k)
      o.rotation.y = Math.atan2(position[0] - from[0], position[2] - from[2])
      if (walk >= 1) setWalking(false)
    } else {
      o.position.set(position[0], position[1], position[2])
      o.rotation.y = facing
    }
    const [b, h, l, r, ll, lr] = [
      body.current,
      head.current,
      armL.current,
      armR.current,
      legL.current,
      legR.current,
    ]
    if (!b || !h || !l || !r || !ll || !lr) return
    const t = now + phase
    const still = reducedMotion
    if (walking) {
      const swing = Math.sin(t * 12) * 0.6
      ll.rotation.x = swing
      lr.rotation.x = -swing
      l.rotation.x = -swing * 0.7
      r.rotation.x = swing * 0.7
      b.position.y = Math.abs(Math.sin(t * 12)) * 0.03
      return
    }
    ll.rotation.x = 0
    lr.rotation.x = 0
    b.position.y = still
      ? 0
      : state === 'focus'
        ? Math.abs(Math.sin(t * 4.5)) * 0.006
        : Math.sin(t * 1.6) * 0.008
    if (state === 'focus') {
      l.rotation.x = restL
      r.rotation.x = restR + (still ? 0 : Math.sin(t * 9) * 0.08)
      h.rotation.set(0.1 + (still ? 0 : Math.sin(t * 2) * 0.02), 0, 0)
    } else if (state === 'break') {
      const cycle = (t % 7) / 7
      const sip = still ? 0 : cycle > 0.8 ? Math.sin(((cycle - 0.8) / 0.2) * Math.PI) : 0
      l.rotation.x = restL
      r.rotation.x = restR - sip * 0.6
      h.rotation.set(-0.05 - sip * 0.15, still ? 0 : Math.sin(t * 0.5) * 0.3 * (1 - sip), 0)
    } else {
      l.rotation.x = restL
      r.rotation.x = restR
      h.rotation.set(0, still ? 0 : Math.sin(t * 0.4) * 0.35, 0)
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
      <Leg pose={pose} color={colors.body} innerRef={legL} x={-0.075} />
      <Leg pose={pose} color={colors.body} innerRef={legR} x={0.075} />
      <group ref={body}>
        <Cylinder top={0.17} bottom={0.18} height={0.1} position={[0, hip + 0.04, 0]} color={colors.body} />
        <Cylinder top={0.14} bottom={0.18} height={0.26} position={[0, hip + 0.2, 0]} color={colors.top} />
        {[-1, 1].map((side) => (
          <group
            key={side}
            ref={side < 0 ? armL : armR}
            position={[side * 0.18, hip + 0.3, 0]}
            rotation={[side < 0 ? restL : restR, 0, side * (state === 'idle' || walking ? 0.18 : 0.1)]}
          >
            <Capsule radius={0.05} length={0.12} position={[0, -0.1, 0]} color={colors.top} />
            <Ball radius={0.05} position={[0, -0.21, 0]} color={colors.skin} />
            {side > 0 && state === 'break' && !walking && <Mug />}
          </group>
        ))}
        <group ref={head} position={[0, hip + NECK, 0]}>
          <group scale={[1, 0.94, 1]}>
            <Ball radius={HEAD_R} detail={2} color={colors.skin} />
          </group>
          <Face />
          <Hair style={hairOf(avatar)} color={colors.hair} />
        </group>
      </group>
    </group>
  )
}
