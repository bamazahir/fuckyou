// The avatar (SPEC §10, decision 0007): a chibi kid with a big round head, small body and stubby
// limbs, four color slots and a hairstyle. Seated at a chair or on a floor cushion: writing while
// focusing, sipping from a mug on a break, looking around when idle. Walks in the first time it appears.
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useRef, useState, type ReactNode } from 'react'
import type { Group } from 'three'
import { FACE, lookOf, type Look } from '../content/avatar'
import type { Avatar, Expression, HairStyle } from '../lib/db'
import { useScene } from './context'
import { Ball, Box, Capsule, Cylinder, Dome, Torus, type V3 } from './parts'

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

type Eyes = 'dot' | 'wide' | 'arc' | 'closed' | 'sleepy' | 'wink'
type Mouth = 'small' | 'smile' | 'grin' | 'o' | 'flat' | 'tongue' | 'cat'

/** Each expression is a pair of eyes and a mouth (plus brows for "focused"). */
const FACES: Record<Expression, { eyes: Eyes; mouth: Mouth; brows?: true }> = {
  happy: { eyes: 'dot', mouth: 'smile' },
  joyful: { eyes: 'arc', mouth: 'grin' },
  calm: { eyes: 'closed', mouth: 'small' },
  focused: { eyes: 'dot', mouth: 'flat', brows: true },
  sleepy: { eyes: 'sleepy', mouth: 'o' },
  surprised: { eyes: 'wide', mouth: 'o' },
  cheeky: { eyes: 'wink', mouth: 'tongue' },
  cat: { eyes: 'arc', mouth: 'cat' },
}

const quiet = { outline: false, shadow: false } as const

function Eye({ kind, x, y, z }: { kind: Exclude<Eyes, 'wink'>; x: number; y: number; z: number }) {
  if (kind === 'arc')
    // ^ : the top half of a ring
    return (
      <Torus
        radius={0.034}
        tube={0.011}
        arc={Math.PI}
        position={[x, y - 0.012, z]}
        color={FACE.eye}
        {...quiet}
      />
    )
  if (kind === 'closed')
    // ‿ : content, eyes shut
    return (
      <Torus
        radius={0.032}
        tube={0.01}
        arc={Math.PI}
        position={[x, y + 0.012, z]}
        rotation={[0, 0, Math.PI]}
        color={FACE.eye}
        {...quiet}
      />
    )
  if (kind === 'sleepy')
    return <Box size={[0.07, 0.013, 0.01]} position={[x, y - 0.012, z]} color={FACE.eye} {...quiet} />
  const big = kind === 'wide'
  return (
    <group position={[x, y, z]}>
      <group scale={big ? [1.15, 1.25, 0.7] : [1, 1.35, 0.7]}>
        <Ball radius={big ? 0.046 : 0.04} color={FACE.eye} {...quiet} />
      </group>
      <Ball
        radius={big ? 0.017 : 0.013}
        detail={0}
        position={[0.012, 0.022, 0.03]}
        color={FACE.shine}
        {...quiet}
      />
      {big && (
        <Ball radius={0.008} detail={0} position={[-0.014, -0.016, 0.03]} color={FACE.shine} {...quiet} />
      )}
    </group>
  )
}

function Face({ expression }: { expression: Expression }) {
  const z = HEAD_R * 0.9
  const y = -0.02
  const { eyes, mouth, brows } = FACES[expression]
  const my = y - 0.085
  const mz = z - 0.01
  return (
    <>
      <Eye kind={eyes === 'wink' ? 'dot' : eyes} x={-0.09} y={y} z={z} />
      <Eye kind={eyes === 'wink' ? 'arc' : eyes} x={0.09} y={y} z={z} />
      {brows &&
        [-0.09, 0.09].map((x) => (
          <Box
            key={x}
            size={[0.07, 0.014, 0.01]}
            position={[x, y + 0.085, z - 0.02]}
            rotation={[0, 0, x < 0 ? -0.35 : 0.35]}
            color={FACE.eye}
            {...quiet}
          />
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
      {mouth === 'small' && (
        <Box size={[0.05, 0.014, 0.01]} position={[0, my, mz]} color={FACE.eye} {...quiet} />
      )}
      {mouth === 'flat' && (
        <Box size={[0.07, 0.014, 0.01]} position={[0, my, mz]} color={FACE.eye} {...quiet} />
      )}
      {(mouth === 'smile' || mouth === 'tongue') && (
        <Torus
          radius={0.03}
          tube={0.009}
          arc={Math.PI}
          position={[0, my + 0.018, mz]}
          rotation={[0, 0, Math.PI]}
          color={FACE.eye}
          {...quiet}
        />
      )}
      {mouth === 'tongue' && (
        <group position={[0.01, my - 0.016, mz - 0.004]} scale={[1, 0.8, 0.5]}>
          <Ball radius={0.016} color={FACE.tongue} {...quiet} />
        </group>
      )}
      {mouth === 'grin' && (
        // D on its side: a flattened bowl
        <group position={[0, my + 0.008, mz - 0.006]} rotation={[0, 0, Math.PI]} scale={[1, 0.9, 0.35]}>
          <Dome radius={0.04} theta={Math.PI / 2} color={FACE.eye} {...quiet} />
        </group>
      )}
      {mouth === 'o' && (
        <group position={[0, my - 0.004, mz]} scale={[1, 1.2, 0.45]}>
          <Ball radius={0.019} color={FACE.eye} {...quiet} />
        </group>
      )}
      {mouth === 'cat' &&
        // ω
        [-0.019, 0.019].map((x) => (
          <Torus
            key={x}
            radius={0.019}
            tube={0.008}
            arc={Math.PI}
            position={[x, my + 0.012, mz]}
            rotation={[0, 0, Math.PI]}
            color={FACE.eye}
            {...quiet}
          />
        ))}
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

function Fringe({ color, xs = [-0.12, 0, 0.12], hat }: { color: string; xs?: number[]; hat: boolean }) {
  // Under a hat the fringe peeks out lower, below the brim.
  return (
    <>
      {xs.map((x) => (
        <group
          key={x}
          position={hat ? [x, 0.06, 0.2] : [x, 0.15, 0.17]}
          scale={hat ? [0.9, 0.45, 0.5] : [1, 0.7, 0.6]}
        >
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

function Hair({ style, color, hat }: { style: HairStyle; color: string; hat: boolean }) {
  switch (style) {
    case 'short':
      return (
        <>
          {!hat && <Cap color={color} />}
          <Fringe color={color} hat={hat} />
        </>
      )
    case 'long':
      return (
        <>
          {!hat && <Cap color={color} />}
          <Fringe color={color} hat={hat} />
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
          {!hat && <Cap color={color} />}
          {CURLS.filter((p) => !hat || p[1] < 0.12).map((p) => (
            <Ball key={p.join()} radius={0.105} position={p} color={color} />
          ))}
        </>
      )
    case 'bun':
      return (
        <>
          {!hat && <Cap color={color} />}
          <Fringe color={color} xs={[-0.1, 0.06]} hat={hat} />
          {!hat && <Ball radius={0.11} position={[0, 0.27, -0.12]} color={color} />}
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
  upper,
  lower,
  innerRef,
  x,
}: {
  pose: Pose
  /** Thigh color (trousers or shorts). */
  upper: string
  /** Shin color: trousers, or skin under shorts and skirts. */
  lower: string
  innerRef: React.Ref<Group>
  x: number
}) {
  const hip = pose === 'stand' ? HIP_STAND : HIP_SIT
  const flat = Math.PI / 2
  let parts: ReactNode
  if (pose === 'stand') {
    parts = (
      <>
        <Capsule radius={0.066} length={0.03} position={[0, -0.07, 0]} color={upper} />
        <Capsule radius={0.06} length={0.08} position={[0, -0.15, 0]} color={lower} />
        <Box size={[0.1, 0.06, 0.15]} position={[0, -0.24, 0.02]} color={FACE.shoe} />
      </>
    )
  } else if (pose === 'chair') {
    parts = (
      <>
        <Capsule radius={0.065} length={0.12} position={[0, 0, 0.1]} rotation={[flat, 0, 0]} color={upper} />
        <Capsule radius={0.06} length={0.12} position={[0, -0.12, 0.2]} color={lower} />
        <Box size={[0.1, 0.06, 0.15]} position={[0, -0.24, 0.23]} color={FACE.shoe} />
      </>
    )
  } else {
    parts = (
      <>
        <Capsule radius={0.065} length={0.12} position={[0, 0, 0.1]} rotation={[flat, 0, 0]} color={upper} />
        <Capsule radius={0.06} length={0.14} position={[0, 0, 0.29]} rotation={[flat, 0, 0]} color={lower} />
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

/** Top styles, drawn over the plain torso. */
function TopDetails({ look, top, hip }: { look: Look; top: string; hip: number }) {
  switch (look.top) {
    case 'hoodie':
      return (
        <>
          <group position={[0, hip + 0.36, -0.1]} scale={[1, 0.7, 0.8]}>
            <Ball radius={0.15} color={top} />
          </group>
          <Box
            size={[0.16, 0.07, 0.03]}
            position={[0, hip + 0.13, 0.165]}
            rotation={[-0.15, 0, 0]}
            color={top}
          />
          {[-0.04, 0.04].map((x) => (
            <Box
              key={x}
              size={[0.012, 0.08, 0.012]}
              position={[x, hip + 0.28, 0.15]}
              color={FACE.collar}
              outline={false}
            />
          ))}
        </>
      )
    case 'stripes':
      return (
        <>
          {[0.12, 0.22].map((y) => (
            <Cylinder
              key={y}
              top={0.183 - y * 0.15}
              bottom={0.188 - y * 0.15}
              height={0.035}
              position={[0, hip + y, 0]}
              color={look.accent}
              outline={false}
            />
          ))}
        </>
      )
    case 'collar':
      return (
        <>
          {[-1, 1].map((side) => (
            <Box
              key={side}
              size={[0.09, 0.02, 0.07]}
              position={[side * 0.05, hip + 0.33, 0.1]}
              rotation={[0.5, side * 0.5, side * -0.3]}
              color={FACE.collar}
            />
          ))}
        </>
      )
    case 'tee':
      return null
  }
}

/** Hats, glasses, headphones and bows, in the head's frame. */
function HeadAccessories({ look, hair }: { look: Look; hair: string }) {
  const a = look.accessories
  const big = look.hair === 'curly' ? 1.12 : 1
  return (
    <>
      {a.has('beanie') && (
        <group scale={big} rotation={[-0.15, 0, 0]}>
          <Dome radius={0.295} theta={1.2} position={[0, 0.02, 0]} color={look.accent} />
          <Cylinder top={0.27} bottom={0.29} height={0.08} position={[0, 0.12, 0]} color={look.accent} />
          <Ball radius={0.06} position={[0, 0.34, 0]} color={look.accent} />
        </group>
      )}
      {a.has('cap') && (
        <group scale={big} rotation={[-0.1, 0, 0]}>
          <Dome radius={0.29} theta={1.3} position={[0, 0.02, 0]} color={look.accent} />
          <Cylinder top={0.27} bottom={0.28} height={0.03} position={[0, 0.095, 0]} color={look.accent} />
          <Box
            size={[0.3, 0.025, 0.2]}
            position={[0, 0.095, 0.3]}
            rotation={[0.12, 0, 0]}
            color={look.accent}
          />
        </group>
      )}
      {a.has('bow') && (
        <group position={[0.17 * big, 0.22 * big, 0.06]} rotation={[0, 0, -0.5]}>
          {[-1, 1].map((side) => (
            <group key={side} position={[side * 0.065, 0, 0]} scale={[1, 0.7, 0.5]}>
              <Ball radius={0.065} color={look.accent} />
            </group>
          ))}
          <Ball radius={0.03} color={look.accent} />
        </group>
      )}
      {a.has('beret') && (
        <group position={[0.03, 0.2 * big, -0.02]} rotation={[-0.2, 0, -0.25]}>
          <group scale={[1.05, 0.32, 1.05]}>
            <Ball radius={0.29} detail={2} color={look.accent} />
          </group>
          <Ball radius={0.03} position={[0, 0.1, 0]} color={look.accent} outline={false} />
        </group>
      )}
      {a.has('cat_ears') &&
        [-1, 1].map((side) => (
          <group key={side} position={[side * 0.15 * big, 0.25 * big, 0]} rotation={[0, 0, -side * 0.35]}>
            <Cylinder top={0.001} bottom={0.08} height={0.15} segments={4} color={hair} />
            <Cylinder
              top={0.001}
              bottom={0.045}
              height={0.09}
              segments={4}
              position={[0, -0.01, 0.03]}
              color={FACE.blush}
              outline={false}
            />
          </group>
        ))}
      {a.has('flower') && (
        <group position={[0.19 * big, 0.17 * big, 0.12]}>
          {[0, 1.26, 2.51, 3.77, 5.03].map((t) => (
            <Ball
              key={t}
              radius={0.035}
              position={[Math.cos(t) * 0.045, Math.sin(t) * 0.045, 0]}
              color={look.accent}
            />
          ))}
          <Ball radius={0.025} position={[0, 0, 0.02]} color={FACE.collar} outline={false} />
        </group>
      )}
      {a.has('shades') && (
        <group position={[0, -0.015, HEAD_R + 0.012]}>
          {[-0.09, 0.09].map((x) => (
            <Box key={x} size={[0.12, 0.075, 0.015]} position={[x, 0, 0]} color={FACE.eye} outline={false} />
          ))}
          <Box size={[0.07, 0.014, 0.012]} position={[0, 0.02, 0]} color={FACE.eye} outline={false} />
        </group>
      )}
      {a.has('glasses') && (
        <group position={[0, -0.015, HEAD_R + 0.012]}>
          {[-0.09, 0.09].map((x) => (
            <Torus
              key={x}
              radius={0.058}
              tube={0.011}
              position={[x, 0, 0]}
              color={FACE.eye}
              outline={false}
            />
          ))}
          <Box size={[0.06, 0.012, 0.012]} position={[0, 0.01, 0]} color={FACE.eye} outline={false} />
        </group>
      )}
      {a.has('headphones') && (
        <group scale={big}>
          <Torus radius={0.29} tube={0.022} arc={Math.PI} position={[0, 0.02, -0.02]} color={FACE.eye} />
          {[-1, 1].map((side) => (
            <Cylinder
              key={side}
              top={0.08}
              height={0.07}
              position={[side * 0.28, 0, -0.01]}
              rotation={[0, 0, Math.PI / 2]}
              color={look.accent}
            />
          ))}
        </group>
      )}
    </>
  )
}

function Scarf({ look, hip }: { look: Look; hip: number }) {
  if (!look.accessories.has('scarf')) return null
  return (
    <>
      <Torus
        radius={0.13}
        tube={0.055}
        position={[0, hip + 0.35, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        color={look.accent}
      />
      <Box
        size={[0.07, 0.16, 0.04]}
        position={[0.07, hip + 0.25, 0.16]}
        rotation={[0.25, 0, 0.1]}
        color={look.accent}
      />
    </>
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
  standing = false,
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
  /** Stand instead of sitting (portraits and the editor preview). */
  standing?: boolean
}) {
  const { reducedMotion } = useScene()
  const { colors } = avatar
  const look = lookOf(avatar)
  const hatOn = look.accessories.has('beanie') || look.accessories.has('cap')
  const thigh = look.bottom === 'skirt' ? colors.skin : colors.body
  const shin = look.bottom === 'trousers' ? colors.body : colors.skin
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
  const pose: Pose = walking || standing ? 'stand' : seat
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
      <Leg pose={pose} upper={thigh} lower={shin} innerRef={legL} x={-0.075} />
      <Leg pose={pose} upper={thigh} lower={shin} innerRef={legR} x={0.075} />
      <group ref={body}>
        {look.bottom === 'skirt' ? (
          <Cylinder
            top={0.17}
            bottom={0.27}
            height={0.17}
            position={[0, hip + 0.02, 0]}
            color={colors.body}
          />
        ) : (
          <Cylinder top={0.17} bottom={0.18} height={0.1} position={[0, hip + 0.04, 0]} color={colors.body} />
        )}
        <Cylinder top={0.14} bottom={0.18} height={0.26} position={[0, hip + 0.2, 0]} color={colors.top} />
        <TopDetails look={look} top={colors.top} hip={hip} />
        <Scarf look={look} hip={hip} />
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
          <Face expression={look.expression} />
          <Hair style={look.hair} color={colors.hair} hat={hatOn} />
          <HeadAccessories look={look} hair={colors.hair} />
        </group>
      </group>
    </group>
  )
}
