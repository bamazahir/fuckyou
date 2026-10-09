// The isometric room (SPEC §10): orthographic true-iso camera fitted to the room, flat-shaded
// procedural furniture, seated beans and DOM labels (name + timer + state) projected on top.
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber'
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { MeshBasicMaterial, type DirectionalLight, type OrthographicCamera } from 'three'
import { CATALOG } from '../content/layouts'
import { rotatedSize, type LayoutItem } from '../core/grid'
import { pointToCell } from '../core/edit'
import { cellCenter, isoFrame, toScreen, type IsoFrame, type Vec3 } from '../core/iso'
import { fullLabels, labelWidth } from '../core/labels'
import { assignSeats, MAX_LABELS, seatList, type Seat } from '../core/seats'
import type { Avatar } from '../lib/db'
import { useTheme } from '../stores/theme'
import { Bean3D, BEAN_HEIGHT, type BeanState } from './Bean3D'
import { SceneContext, useScene, type SceneEnv } from './context'
import { Cushion, ItemModel } from './models'
import { styleColors, type RoomStyle } from '../content/roomStyles'
import { LIGHT, readSceneColors, withRoomStyle } from './palette'
import { Box } from './parts'

export interface SceneAvatar {
  id: string
  name: string
  avatar: Avatar
  state: BeanState
  /** Timer text for the label, or null for no timer. */
  clock: string | null
  bubble?: string
  isMe?: boolean
  ariaLabel: string
}

export interface IsoRoomProps {
  size: number
  layout: readonly LayoutItem[]
  /** Present people, in join order. */
  avatars: readonly SceneAvatar[]
  night: boolean
  lampOn: boolean
  label: string
  onSelect?: (id: string) => void
  /** Animate people walking in when they first appear (off for the first render). */
  walkIn?: boolean
  /** Decorating: the whole room is framed, people are hidden, and taps go to these handlers. */
  edit?: SceneEdit
  /** The room's wall and floor finishes (content/roomStyles). */
  roomStyle?: RoomStyle | null
}

export interface SceneEdit {
  /** The item being placed or moved, where it would go now. */
  ghost: LayoutItem | null
  ghostOk: boolean
  selected: number | null
  onHover: (cell: { x: number; z: number } | null) => void
  onTapCell: (cell: { x: number; z: number }) => void
  onTapItem: (index: number) => void
}

const QUARTER = Math.PI / 2
const SLAB = 0.3
const WALL_T = 0.18
const FACING: Record<number, [number, number]> = { 0: [0, 1], 1: [1, 0], 2: [0, -1], 3: [-1, 0] }

function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [size, setSize] = useState<[number, number]>([0, 0])
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => setSize([el.clientWidth, el.clientHeight])
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return [ref, size] as const
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const on = () => setReduced(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return reduced
}

/** Keeps seats stable as people come and go (derived state, updated during render). */
function useSeating(ids: readonly string[], seatCount: number) {
  const key = ids.join('|')
  const [state, setState] = useState(() => ({ key, map: assignSeats(new Map(), ids, seatCount) }))
  if (state.key !== key) {
    const next = { key, map: assignSeats(state.map, ids, seatCount) }
    setState(next)
    return next.map
  }
  return state.map
}

function wallHeight(size: number) {
  return size > 8 ? 2.7 : 2.5
}

/**
 * What the camera fits: the furniture, the people and the stretch of back wall behind them, so a
 * small group fills the view and a crowd zooms out. The empty front of the room may be cropped.
 */
function framePoints(
  size: number,
  layout: readonly LayoutItem[],
  people: readonly [number, number, number][],
  /** Decorating: fit the whole floor, so every cell can be reached. */
  whole = false,
): Vec3[] {
  const h = size / 2
  const xs: number[] = whole ? [-h, h] : []
  const zs: number[] = whole ? [-h, h] : []
  for (const item of layout) {
    const def = CATALOG.get(item.item_id)
    if (!def) continue
    if (def.layer === 'wall') {
      const along = item.rot === 0 ? item.x : item.z
      const span = [along - h, along + def.footprint[0] - h]
      if (item.rot === 0) xs.push(...span)
      else zs.push(...span)
      continue
    }
    const [w, d] = rotatedSize(def, item.rot)
    xs.push(item.x - h, item.x + w - h)
    zs.push(item.z - h, item.z + d - h)
  }
  for (const [x, , z] of people) {
    xs.push(x - 0.6, x + 0.6)
    zs.push(z - 0.6, z + 0.6)
  }
  const pad = 0.4
  const x0 = Math.max(-h, Math.min(...xs) - pad)
  const x1 = Math.min(h, Math.max(...xs) + pad)
  const z0 = Math.max(-h, Math.min(...zs) - pad)
  const z1 = Math.min(h, Math.max(...zs) + pad)
  const top = wallHeight(size)
  const back = -h - WALL_T
  const floorY = (x: number, z: number) => (x >= h - 0.01 || z >= h - 0.01 ? -SLAB : 0)
  const points: Vec3[] = [
    [x1, floorY(x1, z1), z1],
    [x0, floorY(x0, z1), z1],
    [x1, floorY(x1, z0), z0],
    [x0, top, back],
    [x1, top, back],
    [back, top, z0],
    [back, top, z1],
  ]
  for (const [x, y, z] of people) points.push([x, y + BEAN_HEIGHT + 0.7, z])
  return points
}

function seatPosition(seat: Seat, size: number): [number, number, number] {
  const [x, z] = cellCenter(seat.x, seat.z, size)
  const [fx, fz] = FACING[seat.facing] ?? [0, 1]
  return [x + fx * seat.nudge, seat.height, z + fz * seat.nudge]
}

function CameraRig({ frame }: { frame: IsoFrame }) {
  const get = useThree((s) => s.get)
  const invalidate = useThree((s) => s.invalidate)
  useLayoutEffect(() => {
    const camera = get().camera as OrthographicCamera
    const [x, y, z] = frame.target
    camera.zoom = frame.zoom
    camera.position.set(x + 10, y + 10, z + 10)
    camera.lookAt(x, y, z)
    camera.updateProjectionMatrix()
    invalidate()
  }, [get, frame, invalidate])
  return null
}

/** Renders at most ~30 fps while something is animating and the page is visible (frameloop="demand"). */
function Ticker({ active }: { active: boolean }) {
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    if (!active) return
    let raf = 0
    let last = 0
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop)
      if (document.hidden || t - last < 33) return
      last = t
      invalidate()
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [active, invalidate])
  return null
}

function KeyLight({ size, shadows, night }: { size: number; shadows: boolean; night: boolean }) {
  const ref = useRef<DirectionalLight>(null)
  useLayoutEffect(() => {
    const light = ref.current
    if (!light) return
    const cam = light.shadow.camera
    cam.left = -size
    cam.right = size
    cam.top = size
    cam.bottom = -size
    cam.near = 0.5
    cam.far = 60
    cam.updateProjectionMatrix()
  }, [size])
  return (
    <directionalLight
      ref={ref}
      position={[size * 0.45, size * 1.2, size * 0.8]}
      color={LIGHT.key}
      intensity={night ? 0.9 : 2.1}
      castShadow={shadows}
      shadow-mapSize={[1024, 1024]}
      shadow-bias={-0.0006}
      shadow-normalBias={0.02}
    />
  )
}

/** Floor slab with planks, and the two back walls with a wainscot band and skirting boards. */
const Shell = memo(function Shell({ size }: { size: number }) {
  const { c } = useScene()
  const h = size / 2
  const top = wallHeight(size)
  const low = 0.95
  return (
    <group>
      <Box size={[size, SLAB - 0.02, size]} position={[0, -SLAB / 2 - 0.01, 0]} color={c.slab} />
      {Array.from({ length: size }, (_, i) => (
        <Box
          key={i}
          size={[1, 0.02, size]}
          position={[i - h + 0.5, -0.01, 0]}
          color={i % 2 ? c.floorAlt : c.floor}
          outline={false}
          shadow={false}
        />
      ))}
      <Box
        size={[size + WALL_T, top, WALL_T]}
        position={[-WALL_T / 2, top / 2 - SLAB, -h - WALL_T / 2]}
        color={c.wall}
      />
      <Box size={[WALL_T, top, size]} position={[-h - WALL_T / 2, top / 2 - SLAB, 0]} color={c.wall} />
      <Box
        size={[size, low, 0.02]}
        position={[0, low / 2, -h + 0.01]}
        color={c.wallLow}
        outline={false}
        shadow={false}
      />
      <Box
        size={[0.02, low, size]}
        position={[-h + 0.01, low / 2, 0]}
        color={c.wallLow}
        outline={false}
        shadow={false}
      />
      <Box size={[size, 0.1, 0.05]} position={[0, low, -h + 0.025]} color={c.skirting} outline={false} />
      <Box size={[0.05, 0.1, size]} position={[-h + 0.025, low, 0]} color={c.skirting} outline={false} />
      <Box size={[size, 0.14, 0.05]} position={[0, 0.07, -h + 0.025]} color={c.skirting} outline={false} />
      <Box size={[0.05, 0.14, size]} position={[-h + 0.025, 0.07, 0]} color={c.skirting} outline={false} />
    </group>
  )
})

/** One layout item in its place (floor items by footprint corner, wall items on their wall). */
function ItemAt({ item, size, onTap }: { item: LayoutItem; size: number; onTap?: () => void }) {
  const def = CATALOG.get(item.item_id)
  if (!def) return null
  const h = size / 2
  const tap = onTap
    ? (e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation()
        onTap()
      }
    : undefined
  if (def.layer === 'wall') {
    const w = def.footprint[0]
    const along = (item.rot === 0 ? item.x : item.z) + w / 2 - h
    return (
      <group
        position={item.rot === 0 ? [along, 0, -h] : [-h, 0, along]}
        rotation={[0, item.rot === 0 ? 0 : QUARTER, 0]}
        onClick={tap}
      >
        <ItemModel def={def} />
      </group>
    )
  }
  const [w, d] = rotatedSize(def, item.rot)
  return (
    <group
      position={[item.x + w / 2 - h, 0, item.z + d / 2 - h]}
      rotation={[0, item.rot * QUARTER, 0]}
      onClick={tap}
    >
      <ItemModel def={def} />
    </group>
  )
}

/** A flat marker showing an item's footprint (on the floor, or on its wall). */
function Footprint({ item, size, color }: { item: LayoutItem; size: number; color: string }) {
  const def = CATALOG.get(item.item_id)
  if (!def) return null
  const h = size / 2
  if (def.layer === 'wall') {
    const w = def.footprint[0]
    const along = (item.rot === 0 ? item.x : item.z) + w / 2 - h
    return (
      <group
        position={item.rot === 0 ? [along, 1.2, -h + 0.02] : [-h + 0.02, 1.2, along]}
        rotation={[0, item.rot === 0 ? 0 : QUARTER, 0]}
      >
        <Box size={[w - 0.05, 2.2, 0.02]} color={color} glow={0.4} outline={false} shadow={false} />
      </group>
    )
  }
  const [w, d] = rotatedSize(def, item.rot)
  return (
    <Box
      size={[w - 0.06, 0.03, d - 0.06]}
      position={[item.x + w / 2 - h, 0.02, item.z + d / 2 - h]}
      color={color}
      glow={0.4}
      outline={false}
      shadow={false}
    />
  )
}

const Items = memo(function Items({
  layout,
  size,
  onTapItem,
}: {
  layout: readonly LayoutItem[]
  size: number
  onTapItem?: (index: number) => void
}) {
  return (
    <>
      {layout.map((item, i) => (
        <ItemAt key={i} item={item} size={size} onTap={onTapItem ? () => onTapItem(i) : undefined} />
      ))}
    </>
  )
})

/** Invisible surfaces that turn pointer positions into cells while decorating. */
function EditSurfaces({ size, edit }: { size: number; edit: SceneEdit }) {
  const h = size / 2
  const top = wallHeight(size)
  const cell = (x: number, z: number) => pointToCell(x, z, size)
  const clampCell = (v: number) => Math.max(0, Math.min(size - 1, Math.floor(v + h)))
  const hidden = useMemo(
    () => new MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    [],
  )
  return (
    <>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.03, 0]}
        material={hidden}
        onPointerMove={(e) => {
          e.stopPropagation()
          edit.onHover(cell(e.point.x, e.point.z))
        }}
        onPointerOut={() => edit.onHover(null)}
        onClick={(e) => {
          e.stopPropagation()
          const c = cell(e.point.x, e.point.z)
          if (c) edit.onTapCell(c)
        }}
      >
        <planeGeometry args={[size, size]} />
      </mesh>
      {/* back wall (x) and side wall (z), for wall items */}
      <mesh
        position={[0, top / 2, -h + 0.05]}
        material={hidden}
        onPointerMove={(e) => {
          e.stopPropagation()
          edit.onHover({ x: clampCell(e.point.x), z: 0 })
        }}
        onClick={(e) => {
          e.stopPropagation()
          edit.onTapCell({ x: clampCell(e.point.x), z: 0 })
        }}
      >
        <planeGeometry args={[size, top]} />
      </mesh>
      <mesh
        position={[-h + 0.05, top / 2, 0]}
        rotation={[0, Math.PI / 2, 0]}
        material={hidden}
        onPointerMove={(e) => {
          e.stopPropagation()
          edit.onHover({ x: 0, z: clampCell(e.point.z) })
        }}
        onClick={(e) => {
          e.stopPropagation()
          edit.onTapCell({ x: 0, z: clampCell(e.point.z) })
        }}
      >
        <planeGeometry args={[size, top]} />
      </mesh>
    </>
  )
}

/** Night lamps: a warm point light at each lamp (desk lamps in rooms without one), at most 4. */
function lampPositions(layout: readonly LayoutItem[], size: number): [number, number, number][] {
  const h = size / 2
  const at = (item: LayoutItem, y: number): [number, number, number] => {
    const def = CATALOG.get(item.item_id)
    const [w, d] = def ? rotatedSize(def, item.rot) : [1, 1]
    return [item.x + w / 2 - h, y, item.z + d / 2 - h]
  }
  const lamps = layout.filter((i) => CATALOG.get(i.item_id)?.light).map((i) => at(i, 1.35))
  const desks = layout.filter((i) => CATALOG.get(i.item_id)?.model === 'desk').map((i) => at(i, 1.1))
  return (lamps.length > 0 ? lamps : desks).slice(0, 4)
}

export default function IsoRoom({
  size,
  layout,
  avatars,
  night,
  lampOn,
  label,
  onSelect,
  walkIn = true,
  edit,
  roomStyle,
}: IsoRoomProps) {
  const [ref, [width, height]] = useElementSize<HTMLDivElement>()
  const theme = useTheme((s) => s.theme)
  const mode = useTheme((s) => s.resolved)
  const reducedMotion = useReducedMotion()
  const [selected, setSelected] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  // A lost WebGL context (low memory, too many canvases, a GPU reset) leaves a blank box; rebuild the
  // canvas (at most twice, so a broken GPU can't loop).
  const [generation, setGeneration] = useState(0)
  const [firstIds] = useState(() => new Set(avatars.map((a) => a.id)))
  const finish = styleColors(roomStyle)
  const colors = useMemo(
    () => withRoomStyle(readSceneColors(), finish.wall, finish.floor),
    [theme, mode, finish.wall, finish.floor], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const shadows = useMemo(() => (navigator.hardwareConcurrency ?? 8) > 4, [])
  const seats = useMemo(() => seatList(layout, size, CATALOG), [layout, size])
  const seating = useSeating(
    avatars.map((a) => a.id),
    seats.length,
  )
  const placed = avatars.flatMap((a) => {
    const index = seating.get(a.id)
    const seat = index === undefined ? undefined : seats[index]
    return seat ? [{ a, seat, pos: seatPosition(seat, size) }] : []
  })
  const peopleKey = placed.map((p) => p.pos.join()).join('|')
  const editing = edit !== undefined
  const frame = useMemo(
    () =>
      width > 0 && height > 0
        ? isoFrame(
            framePoints(size, layout, edit ? [] : placed.map((p) => p.pos), Boolean(edit)),
            width,
            height,
          )
        : null,
    [width, height, size, layout, peopleKey, editing], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const lamps = useMemo(() => lampPositions(layout, size), [layout, size])
  const zoom = frame?.zoom ?? 0
  const env = useMemo<SceneEnv | null>(
    () => (zoom > 0 ? { c: colors, outline: 1.7 / zoom, lampOn, night, shadows, reducedMotion } : null),
    [colors, zoom, lampOn, night, shadows, reducedMotion],
  )
  const door: [number, number, number] = [size / 2 - 0.4, 0, size / 2 - 0.4]

  const select = (id: string) => {
    setSelected(id)
    onSelect?.(id)
  }
  const labels = (() => {
    if (!frame) return []
    const items = placed.map(({ a, pos }) => {
      const [x, y] = toScreen(frame, [pos[0], pos[1] + BEAN_HEIGHT + 0.12, pos[2]])
      return { a, x, y }
    })
    const rank = (a: SceneAvatar) => (a.isMe ? 0 : a.id === selected ? 1 : 2)
    const ordered = [...items].sort((p, q) => rank(p.a) - rank(q.a))
    const pinned = new Set(items.filter((p) => rank(p.a) < 2).map((p) => p.a.id))
    const full = fullLabels(
      ordered.map(({ a, x, y }) => ({ id: a.id, x, y, width: labelWidth(a.name, a.clock), height: 26 })),
      MAX_LABELS,
      pinned,
    )
    return items.map((p) => ({ ...p, full: full.has(p.a.id) }))
  })()

  return (
    <div
      ref={ref}
      className="relative h-full w-full select-none"
      role="group"
      aria-label={label}
      data-scene-ready={ready || undefined}
    >
      {frame && env && (
        <Canvas
          key={generation}
          orthographic
          frameloop="demand"
          dpr={[1, 1.5]}
          flat
          shadows={shadows}
          camera={{ position: [10, 10, 10], zoom: frame.zoom, near: 0.1, far: 200 }}
          gl={{ antialias: true, powerPreference: 'low-power' }}
          onPointerMissed={() => setSelected(null)}
          onCreated={({ gl }) => {
            setReady(true)
            // Browsers evict the oldest context when a page has too many; a fresh canvas gets a new one.
            gl.domElement.addEventListener(
              'webglcontextlost',
              (e) => {
                e.preventDefault()
                if (generation < 2) window.setTimeout(() => setGeneration((n) => n + 1), 250)
              },
              { once: true },
            )
          }}
          aria-hidden="true"
        >
          <SceneContext.Provider value={env}>
            <CameraRig frame={frame} />
            <Ticker active={!reducedMotion && avatars.length > 0} />
            <hemisphereLight args={[LIGHT.sky, LIGHT.ground, night ? 1.1 : 1.9]} />
            <ambientLight intensity={night ? 0.35 : 0.6} />
            <KeyLight size={size} shadows={shadows} night={night} />
            {lampOn &&
              lamps.map((p) => (
                <pointLight
                  key={p.join()}
                  position={p}
                  color={colors.glow}
                  intensity={night ? 5 : 2}
                  distance={5}
                  decay={1.6}
                />
              ))}
            <Shell size={size} />
            <Items layout={layout} size={size} onTapItem={edit?.onTapItem} />
            {edit && <EditSurfaces size={size} edit={edit} />}
            {edit && edit.selected !== null && layout[edit.selected] && (
              <Footprint item={layout[edit.selected] as LayoutItem} size={size} color={colors.accent} />
            )}
            {edit?.ghost && (
              <>
                <ItemAt item={edit.ghost} size={size} />
                <Footprint item={edit.ghost} size={size} color={edit.ghostOk ? colors.good : colors.danger} />
              </>
            )}
            {!edit &&
              placed.map(({ a, seat, pos }) => (
                <group key={a.id}>
                  {seat.kind === 'cushion' && (
                    <group position={[pos[0], 0, pos[2]]}>
                      <Cushion color={a.isMe ? colors.accent : colors.rest} />
                    </group>
                  )}
                  <Bean3D
                    id={a.id}
                    avatar={a.avatar}
                    seat={seat.height >= 0.3 ? 'chair' : 'floor'}
                    state={a.state}
                    position={pos}
                    facing={seat.facing * QUARTER}
                    from={walkIn && !firstIds.has(a.id) ? door : undefined}
                    onSelect={() => select(a.id)}
                  />
                </group>
              ))}
          </SceneContext.Provider>
        </Canvas>
      )}
      {frame && ready && !edit && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {labels.map(({ a, x, y, full }) => {
            const fresh = walkIn && !firstIds.has(a.id)
            const dot = (
              <span
                className={`h-2.5 w-2.5 shrink-0 rounded-full border-2 border-line ${a.state === 'break' ? 'bg-rest' : a.state === 'focus' ? 'bg-good' : 'bg-surface-2'}`}
                aria-hidden="true"
              />
            )
            return (
              <div
                key={a.id}
                className={`absolute flex -translate-x-1/2 -translate-y-full flex-col items-center ${fresh ? 'scene-label-in' : ''}`}
                style={{ left: x, top: y, zIndex: full ? 2 : 1 }}
              >
                {a.bubble && (
                  <span className="scene-bubble mb-1 text-2xl" aria-hidden="true">
                    {a.bubble}
                  </span>
                )}
                <button
                  type="button"
                  className={`pointer-events-auto ${full ? `scene-label ${a.isMe ? 'scene-label-me' : ''}` : 'scene-dot'}`}
                  aria-label={a.ariaLabel}
                  onClick={() => select(a.id)}
                >
                  {dot}
                  {full && <span className="max-w-[7rem] truncate">{a.name}</span>}
                  {full && a.clock && <span className="font-display tabular-nums">{a.clock}</span>}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
