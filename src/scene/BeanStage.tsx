// A live 3D bean for the avatar editor and onboarding: standing, turning slowly so every side shows.
import { Canvas, useFrame } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import type { Group } from 'three'
import type { Avatar } from '../lib/db'
import { Bean3D } from './Bean3D'
import { SceneContext, type SceneEnv } from './context'
import { LIGHT, readSceneColors } from './palette'

function Turntable({ avatar, reducedMotion }: { avatar: Avatar; reducedMotion: boolean }) {
  const spin = useRef<Group>(null)
  useFrame(({ clock }) => {
    if (spin.current && !reducedMotion) spin.current.rotation.y = 0.35 * Math.sin(clock.elapsedTime * 0.6)
  })
  return (
    <group ref={spin}>
      <Bean3D
        id="preview"
        avatar={avatar}
        state="idle"
        position={[0, 0, 0]}
        facing={0}
        seat="chair"
        standing
      />
    </group>
  )
}

export default function BeanStage({ avatar, label, size }: { avatar: Avatar; label: string; size: number }) {
  // The whole bean (about 1.4 units tall) with a little room around it.
  const zoom = size / 1.6
  const [reducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const env: SceneEnv = useMemo(
    () => ({
      c: readSceneColors(),
      outline: 1.6 / zoom,
      lampOn: true,
      night: false,
      shadows: false,
      reducedMotion,
    }),
    [reducedMotion, zoom],
  )
  return (
    <div role="img" aria-label={label} className="size-full">
      <Canvas
        orthographic
        flat
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        camera={{ position: [0, 1.6, 10], zoom, near: 0.1, far: 100 }}
        onCreated={({ camera }) => camera.lookAt(0, 0.66, 0)}
        aria-hidden="true"
      >
        <SceneContext.Provider value={env}>
          <hemisphereLight args={[LIGHT.sky, LIGHT.ground, 1.9]} />
          <ambientLight intensity={0.7} />
          <directionalLight position={[3, 6, 10]} color={LIGHT.key} intensity={2} />
          <Turntable avatar={avatar} reducedMotion={reducedMotion} />
        </SceneContext.Provider>
      </Canvas>
    </div>
  )
}
