// Renders one picture at a time into a small hidden canvas and keeps a PNG of it: shop items (3/4 iso
// view, studyroom-look §3) and bean portraits (head and shoulders, from the front). Transparent background.
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Box3, type Group, type OrthographicCamera } from 'three'
import { CATALOG } from '../content/layouts'
import { isoFrame, type Vec3 } from '../core/iso'
import { useThumbs } from '../stores/thumbs'
import { SceneContext, type SceneEnv } from './context'
import { Bean3D } from './Bean3D'
import { ItemModel } from './models'
import { LIGHT, readSceneColors } from './palette'

const PX = 192

function Studio({ itemKey }: { itemKey: string }) {
  const id = itemKey.split(':')[3] ?? ''
  const def = CATALOG.get(id)
  const done = useThumbs((s) => s.done)
  const get = useThree((s) => s.get)
  const frames = useRef(0)
  const group = useRef<Group>(null)
  const [zoom, setZoom] = useState(50)

  useLayoutEffect(() => {
    if (!def) done(itemKey, '') // not a room item: nothing to draw
  }, [def, done, itemKey])

  // Frame the model's real bounds, so a crate fills its picture as much as a bookshelf does.
  useLayoutEffect(() => {
    const g = group.current
    if (!g) return
    const box = new Box3().setFromObject(g)
    if (box.isEmpty()) return
    const pts: Vec3[] = []
    for (const x of [box.min.x, box.max.x])
      for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) pts.push([x, y, z])
    const frame = isoFrame(pts, PX, PX, 0.9)
    const camera = get().camera as OrthographicCamera
    const [x, y, z] = frame.target
    camera.zoom = frame.zoom
    camera.position.set(x + 10, y + 10, z + 10)
    camera.lookAt(x, y, z)
    camera.updateProjectionMatrix()
    frames.current = 0
    setZoom(frame.zoom) // outlines are sized in pixels, so they follow the zoom (one extra render)
  }, [def, get])

  // Two frames to settle, then capture.
  useFrame(({ gl }) => {
    frames.current += 1
    if (frames.current === 3) done(itemKey, gl.domElement.toDataURL('image/png'))
  })

  const env: SceneEnv = useMemo(
    () => ({
      c: readSceneColors(),
      outline: 1.7 / zoom,
      lampOn: true,
      night: false,
      shadows: false,
      reducedMotion: true,
    }),
    [zoom],
  )
  if (!def) return null
  return (
    <SceneContext.Provider value={env}>
      <hemisphereLight args={[LIGHT.sky, LIGHT.ground, 1.9]} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[4, 10, 7]} color={LIGHT.key} intensity={2.1} />
      <group ref={group}>
        <ItemModel def={def} />
      </group>
    </SceneContext.Provider>
  )
}

function BeanStudio({ beanKey }: { beanKey: string }) {
  const avatar = useThumbs((s) => s.beans[beanKey])
  const done = useThumbs((s) => s.done)
  const get = useThree((s) => s.get)
  const frames = useRef(0)
  const group = useRef<Group>(null)
  const [zoom, setZoom] = useState(200)

  useLayoutEffect(() => {
    if (!avatar) done(beanKey, '')
  }, [avatar, done, beanKey])

  // Head and shoulders: the top 62% of the standing bean, seen from the front and a little above.
  useLayoutEffect(() => {
    const g = group.current
    if (!g) return
    const box = new Box3().setFromObject(g)
    if (box.isEmpty()) return
    const h = box.max.y - box.min.y
    const crop = h * 0.62
    const cy = box.max.y - crop / 2 + h * 0.02
    const camera = get().camera as OrthographicCamera
    camera.zoom = (PX / crop) * 0.92
    camera.position.set(0, cy + 2.2, 10)
    camera.lookAt(0, cy, 0)
    camera.updateProjectionMatrix()
    frames.current = 0
    setZoom(camera.zoom)
  }, [avatar, get])

  useFrame(({ gl }) => {
    frames.current += 1
    if (frames.current === 4) done(beanKey, gl.domElement.toDataURL('image/png'))
  })

  const env: SceneEnv = useMemo(
    () => ({
      c: readSceneColors(),
      outline: 1.6 / zoom,
      lampOn: true,
      night: false,
      shadows: false,
      reducedMotion: true,
    }),
    [zoom],
  )
  if (!avatar) return null
  return (
    <SceneContext.Provider value={env}>
      <hemisphereLight args={[LIGHT.sky, LIGHT.ground, 1.9]} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[3, 6, 10]} color={LIGHT.key} intensity={2} />
      <group ref={group}>
        <Bean3D
          id={beanKey}
          avatar={avatar}
          state="idle"
          position={[0, 0, 0]}
          facing={0.25}
          seat="chair"
          standing
        />
      </group>
    </SceneContext.Provider>
  )
}

/** Stays mounted while a screen needs thumbnails: one WebGL context, idle when the queue is empty. */
export default function ThumbStudio() {
  const next = useThumbs((s) => s.queue[0])
  return (
    <div aria-hidden="true" style={{ position: 'fixed', left: -10000, top: 0, width: PX, height: PX }}>
      <Canvas
        orthographic
        flat
        dpr={1}
        frameloop={next ? 'always' : 'never'}
        gl={{ preserveDrawingBuffer: true, antialias: true, alpha: true }}
        camera={{ position: [10, 10, 10], zoom: 50, near: 0.1, far: 100 }}
      >
        {next &&
          (next.startsWith('bean:') ? (
            <BeanStudio key={next} beanKey={next} />
          ) : (
            <Studio key={next} itemKey={next} />
          ))}
      </Canvas>
    </div>
  )
}
