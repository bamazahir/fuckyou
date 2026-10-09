// Renders one catalog item at a time into a small hidden canvas and keeps a PNG of it (shop thumbnails,
// studyroom-look §3: same lighting, 3/4 iso view, transparent background).
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Box3, type Group, type OrthographicCamera } from 'three'
import { CATALOG } from '../content/layouts'
import { isoFrame, type Vec3 } from '../core/iso'
import { useThumbs } from '../stores/thumbs'
import { SceneContext, type SceneEnv } from './context'
import { ItemModel } from './models'
import { LIGHT, readSceneColors } from './palette'

const PX = 192

function Studio({ itemKey }: { itemKey: string }) {
  const id = itemKey.split(':')[2] ?? ''
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
        {next && <Studio key={next} itemKey={next} />}
      </Canvas>
    </div>
  )
}
