// More procedural furniture, decor and wall items for the M5 shop (studyroom-look §3, option 1).
// Same frame as items.tsx: origin at the footprint's bottom-centre, facing +z; wall items hang on −z.
import type { CatalogItem, Tint } from '../content/layouts'
import { useScene } from './context'
import { Bookshelf, Chair, Cushion, Desk, Lamp, Plant, Rug, Window } from './items'
import { Ball, Box, Cylinder, Torus } from './parts'

function useTint(tint: Tint | undefined, fallback: string): string {
  const { c } = useScene()
  if (!tint) return fallback
  return tint === 'wood' ? c.wood : tint === 'paper' ? c.paper : c[tint]
}

function Stool() {
  const { c } = useScene()
  return (
    <group position={[0, 0, 0.15]}>
      <Cylinder top={0.2} height={0.06} position={[0, 0.5, 0]} color={c.wood} />
      {[0, 2.1, 4.2].map((a) => (
        <Box
          key={a}
          size={[0.04, 0.5, 0.04]}
          position={[Math.sin(a) * 0.13, 0.24, Math.cos(a) * 0.13]}
          rotation={[Math.cos(a) * 0.12, 0, -Math.sin(a) * 0.12]}
          color={c.woodDark}
        />
      ))}
    </group>
  )
}

function Armchair({ color }: { color: string }) {
  return (
    <group position={[0, 0, 0.05]}>
      <Box size={[0.76, 0.3, 0.7]} position={[0, 0.2, 0]} color={color} />
      <Box size={[0.76, 0.5, 0.16]} position={[0, 0.5, -0.27]} color={color} />
      {[-0.32, 0.32].map((x) => (
        <Box key={x} size={[0.14, 0.24, 0.66]} position={[x, 0.45, 0.02]} color={color} />
      ))}
    </group>
  )
}

function Beanbag({ color }: { color: string }) {
  return (
    <group position={[0, 0.17, 0]} scale={[1, 0.55, 1]}>
      <Ball radius={0.36} detail={2} color={color} />
    </group>
  )
}

function Sofa({ color }: { color: string }) {
  return (
    <group position={[0, 0, 0.05]}>
      <Box size={[1.8, 0.3, 0.72]} position={[0, 0.2, 0]} color={color} />
      <Box size={[1.8, 0.48, 0.16]} position={[0, 0.5, -0.28]} color={color} />
      {[-0.84, 0.84].map((x) => (
        <Box key={x} size={[0.14, 0.26, 0.7]} position={[x, 0.46, 0]} color={color} />
      ))}
      {[-0.45, 0.45].map((x) => (
        <Box key={x} size={[0.8, 0.08, 0.56]} position={[x, 0.39, 0.04]} color={color} />
      ))}
    </group>
  )
}

function TallShelf() {
  const { c } = useScene()
  const books: [number, number, keyof typeof c][] = [
    [0.07, 0.26, 'accent'],
    [0.05, 0.3, 'rest'],
    [0.08, 0.24, 'danger'],
    [0.06, 0.28, 'good'],
  ]
  return (
    <group position={[0, 0, -0.3]}>
      <Box size={[0.78, 2.1, 0.36]} position={[0, 1.05, 0]} color={c.wood} />
      {[0.5, 1.0, 1.5].map((y, row) => (
        <group key={y}>
          <Box size={[0.68, 0.38, 0.02]} position={[0, y + 0.2, 0.17]} color={c.woodDark} outline={false} />
          {books.map(([w, h, color], i) => (
            <Box
              key={i}
              size={[w, h, 0.22]}
              position={[-0.24 + i * 0.1 + row * 0.02, y + 0.03 + h / 2, 0.1]}
              color={c[color]}
              outline={false}
            />
          ))}
        </group>
      ))}
    </group>
  )
}

function SideTable() {
  const { c } = useScene()
  return (
    <>
      <Cylinder top={0.26} height={0.05} position={[0, 0.5, 0]} color={c.wood} />
      <Cylinder top={0.04} height={0.48} position={[0, 0.25, 0]} color={c.woodDark} outline={false} />
      <Cylinder top={0.16} height={0.03} position={[0, 0.015, 0]} color={c.woodDark} />
      <Cylinder top={0.06} height={0.1} position={[0.06, 0.58, 0.02]} color={c.accent} />
    </>
  )
}

function Bed({ color }: { color: string }) {
  const { c } = useScene()
  return (
    <group position={[0, 0, 0]}>
      <Box size={[1.7, 0.3, 2.7]} position={[0, 0.2, 0]} color={c.wood} />
      <Box size={[1.6, 0.16, 2.5]} position={[0, 0.42, 0.05]} color={c.paper} />
      <Box size={[1.62, 0.18, 1.6]} position={[0, 0.45, 0.5]} color={color} />
      <Box size={[0.6, 0.12, 0.36]} position={[-0.38, 0.55, -0.95]} color={c.paper} />
      <Box size={[0.6, 0.12, 0.36]} position={[0.38, 0.55, -0.95]} color={c.paper} />
      <Box size={[1.7, 0.8, 0.1]} position={[0, 0.5, -1.33]} color={c.woodDark} />
    </group>
  )
}

function Crate() {
  const { c } = useScene()
  return (
    <>
      <Box size={[0.6, 0.48, 0.6]} position={[0, 0.24, 0]} color={c.wood} />
      {[0.12, 0.36].map((y) => (
        <Box key={y} size={[0.62, 0.05, 0.62]} position={[0, y, 0]} color={c.woodDark} outline={false} />
      ))}
    </>
  )
}

function TallPlant() {
  const { c } = useScene()
  return (
    <>
      <Cylinder top={0.22} bottom={0.18} height={0.4} segments={8} position={[0, 0.2, 0]} color={c.pot} />
      <Cylinder top={0.025} height={0.9} position={[0, 0.8, 0]} color={c.woodDark} outline={false} />
      {[
        [0, 1.35, 0, 0.26],
        [0.16, 1.1, 0.06, 0.2],
        [-0.15, 1.18, -0.05, 0.19],
        [0.05, 1.55, 0.04, 0.17],
      ].map(([x = 0, y = 0, z = 0, r = 0.2]) => (
        <Ball key={`${x}${y}`} radius={r} position={[x, y, z]} color={c.good} />
      ))}
    </>
  )
}

function Cactus() {
  const { c } = useScene()
  return (
    <>
      <Cylinder top={0.15} bottom={0.12} height={0.22} segments={8} position={[0, 0.11, 0]} color={c.pot} />
      <Cylinder top={0.08} height={0.42} segments={8} position={[0, 0.43, 0]} color={c.good} />
      <Ball radius={0.08} position={[0, 0.64, 0]} color={c.good} />
      <Cylinder
        top={0.045}
        height={0.16}
        segments={6}
        position={[0.11, 0.48, 0]}
        rotation={[0, 0, -0.9]}
        color={c.good}
      />
      <Ball radius={0.035} position={[0, 0.73, 0.02]} color={c.danger} outline={false} />
    </>
  )
}

function Globe() {
  const { c } = useScene()
  return (
    <>
      <Cylinder top={0.14} height={0.04} position={[0, 0.02, 0]} color={c.woodDark} />
      <Cylinder top={0.02} height={0.6} position={[0, 0.32, 0]} color={c.woodDark} outline={false} />
      <Ball radius={0.22} detail={2} position={[0, 0.78, 0]} color={c.rest} />
      <Ball radius={0.1} position={[0.12, 0.84, 0.1]} color={c.good} outline={false} />
      <Ball radius={0.08} position={[-0.1, 0.72, 0.13]} color={c.good} outline={false} />
      <Torus
        radius={0.25}
        tube={0.015}
        position={[0, 0.78, 0]}
        rotation={[0, Math.PI / 2, 0.4]}
        color={c.woodDark}
        outline={false}
      />
    </>
  )
}

function BookPile() {
  const { c } = useScene()
  const pile: [number, keyof typeof c, number][] = [
    [0.08, 'rest', 0],
    [0.07, 'accent', 0.3],
    [0.09, 'danger', -0.2],
    [0.06, 'good', 0.5],
  ]
  let y = 0
  return (
    <>
      {pile.map(([h, color, rot]) => {
        const at = y + h / 2
        y += h
        return (
          <Box
            key={color}
            size={[0.4, h, 0.3]}
            position={[0, at, 0]}
            rotation={[0, rot, 0]}
            color={c[color]}
          />
        )
      })}
    </>
  )
}

function Radio() {
  const { c } = useScene()
  return (
    <group position={[0, 0, -0.1]}>
      <Box size={[0.5, 0.3, 0.2]} position={[0, 0.15, 0]} color={c.danger} />
      <Cylinder
        top={0.08}
        height={0.02}
        position={[-0.12, 0.16, 0.105]}
        rotation={[Math.PI / 2, 0, 0]}
        color={c.line}
        outline={false}
      />
      <Box size={[0.14, 0.08, 0.02]} position={[0.12, 0.18, 0.105]} color={c.paper} outline={false} />
      <Box
        size={[0.01, 0.3, 0.01]}
        position={[0.2, 0.42, 0]}
        rotation={[0, 0, -0.3]}
        color={c.line}
        outline={false}
      />
    </group>
  )
}

function FishTank() {
  const { c, lampOn } = useScene()
  return (
    <>
      <Box size={[0.7, 0.4, 0.5]} position={[0, 0.2, 0]} color={c.woodDark} />
      <Box size={[0.66, 0.42, 0.46]} position={[0, 0.61, 0]} color={c.window} glow={lampOn ? 0.5 : 0.2} />
      <Ball radius={0.04} position={[0.1, 0.65, 0.2]} color={c.accent} glow={0.3} outline={false} />
      <Ball radius={0.03} position={[-0.12, 0.55, 0.2]} color={c.danger} glow={0.3} outline={false} />
      <Box size={[0.66, 0.04, 0.46]} position={[0, 0.84, 0]} color={c.woodDark} />
    </>
  )
}

function Cat() {
  const { c } = useScene()
  return (
    <group position={[0, 0, 0]}>
      <Cylinder top={0.26} height={0.06} segments={10} position={[0, 0.03, 0]} color={c.rest} />
      <group position={[0, 0.15, 0]} scale={[1.2, 0.6, 1]}>
        <Ball radius={0.18} color={c.danger} />
      </group>
      <Ball radius={0.11} position={[0.17, 0.16, 0.06]} color={c.danger} />
      {[-0.05, 0.05].map((z) => (
        <Cylinder
          key={z}
          top={0.001}
          bottom={0.04}
          height={0.07}
          segments={4}
          position={[0.2, 0.28, 0.06 + z]}
          color={c.danger}
        />
      ))}
      <Torus
        radius={0.13}
        tube={0.025}
        arc={Math.PI}
        position={[-0.05, 0.08, 0.12]}
        rotation={[Math.PI / 2, 0, 0]}
        color={c.danger}
      />
    </group>
  )
}

function Telescope() {
  const { c } = useScene()
  return (
    <>
      {[0, 2.1, 4.2].map((a) => (
        <Box
          key={a}
          size={[0.035, 0.8, 0.035]}
          position={[Math.sin(a) * 0.14, 0.38, Math.cos(a) * 0.14]}
          rotation={[Math.cos(a) * 0.2, 0, -Math.sin(a) * 0.2]}
          color={c.woodDark}
        />
      ))}
      <group position={[0, 0.85, 0]} rotation={[0.9, 0.6, 0]}>
        <Cylinder top={0.07} bottom={0.09} height={0.8} color={c.paper} />
        <Cylinder top={0.095} height={0.06} position={[0, 0.4, 0]} color={c.accent} />
      </group>
    </>
  )
}

function RoundRug({ w, color }: { w: number; color: string }) {
  const { c } = useScene()
  return (
    <>
      <Cylinder
        top={w / 2 - 0.2}
        height={0.02}
        segments={16}
        position={[0, 0.01, 0]}
        color={color}
        shadow={false}
      />
      <Cylinder
        top={w / 2 - 0.6}
        height={0.022}
        segments={16}
        position={[0, 0.011, 0]}
        color={c.rugInner}
        shadow={false}
        outline={false}
      />
    </>
  )
}

function Poster({ color }: { color: string }) {
  const { c } = useScene()
  return (
    <group position={[0, 1.55, 0.03]}>
      <Box size={[0.55, 0.75, 0.02]} color={c.paper} />
      <Box size={[0.45, 0.45, 0.01]} position={[0, 0.07, 0.015]} color={color} outline={false} />
      <Ball radius={0.09} position={[0.08, 0.14, 0.025]} color={c.glow} glow={0.3} outline={false} />
      <Box size={[0.36, 0.05, 0.01]} position={[0, -0.25, 0.015]} color={c.line} outline={false} />
    </group>
  )
}

function Clock() {
  const { c } = useScene()
  return (
    <group position={[0, 1.75, 0.04]}>
      <Cylinder top={0.24} height={0.05} rotation={[Math.PI / 2, 0, 0]} color={c.paper} />
      <Box size={[0.025, 0.15, 0.01]} position={[0, 0.06, 0.03]} color={c.line} outline={false} />
      <Box size={[0.11, 0.025, 0.01]} position={[0.05, 0, 0.03]} color={c.line} outline={false} />
    </group>
  )
}

function Corkboard() {
  const { c } = useScene()
  const notes: [number, number, keyof typeof c][] = [
    [-0.4, 0.12, 'paper'],
    [-0.05, -0.08, 'accent'],
    [0.35, 0.1, 'rest'],
    [0.15, 0.18, 'good'],
  ]
  return (
    <group position={[0, 1.5, 0.03]}>
      <Box size={[1.4, 0.85, 0.04]} color={c.woodDark} />
      <Box size={[1.28, 0.73, 0.02]} position={[0, 0, 0.02]} color={c.pot} outline={false} />
      {notes.map(([x, y, color]) => (
        <Box
          key={x}
          size={[0.24, 0.24, 0.01]}
          position={[x, y, 0.035]}
          rotation={[0, 0, x * 0.3]}
          color={c[color]}
          outline={false}
        />
      ))}
    </group>
  )
}

function WallShelf() {
  const { c } = useScene()
  return (
    <group position={[0, 1.35, 0.13]}>
      <Box size={[1.4, 0.05, 0.26]} color={c.wood} />
      <group position={[-0.4, 0.03, 0]}>
        <Cylinder top={0.09} bottom={0.07} height={0.14} position={[0, 0.07, 0]} color={c.pot} />
        <Ball radius={0.11} position={[0, 0.22, 0]} color={c.good} />
      </group>
      {[0.05, 0.13, 0.2, 0.26].map((x, i) => (
        <Box
          key={x}
          size={[0.06, 0.24 - i * 0.02, 0.18]}
          position={[x, 0.14 - i * 0.01, 0]}
          color={[c.accent, c.rest, c.danger, c.paper][i] ?? c.accent}
          outline={false}
        />
      ))}
      <Cylinder top={0.06} height={0.1} position={[0.48, 0.08, 0]} color={c.paper} />
    </group>
  )
}

function Lights({ w }: { w: number }) {
  const { c, lampOn } = useScene()
  const n = w * 4
  return (
    <group position={[0, 2.0, 0.05]}>
      {Array.from({ length: n }, (_, i) => {
        const x = -w / 2 + 0.25 + (i * (w - 0.5)) / (n - 1)
        const y = -Math.sin((i / (n - 1)) * Math.PI) * 0.18
        const color = [c.glow, c.accent, c.danger, c.rest][i % 4] ?? c.glow
        return (
          <Ball
            key={i}
            radius={0.045}
            detail={0}
            position={[x, y, 0]}
            color={color}
            glow={lampOn ? 1 : 0.4}
            outline={false}
          />
        )
      })}
    </group>
  )
}

function Whiteboard() {
  const { c } = useScene()
  return (
    <group position={[0, 1.45, 0.03]}>
      <Box size={[1.4, 0.9, 0.04]} color={c.line} />
      <Box size={[1.32, 0.82, 0.02]} position={[0, 0, 0.02]} color={c.paper} outline={false} />
      <Box size={[0.5, 0.03, 0.01]} position={[-0.25, 0.2, 0.035]} color={c.rest} outline={false} />
      <Box size={[0.7, 0.03, 0.01]} position={[-0.15, 0.08, 0.035]} color={c.rest} outline={false} />
      <Box size={[0.35, 0.03, 0.01]} position={[0.2, -0.1, 0.035]} color={c.danger} outline={false} />
      <Box size={[1.2, 0.05, 0.1]} position={[0, -0.45, 0.06]} color={c.line} />
    </group>
  )
}

/** Draws any catalog item in its own frame. */
export function ItemModel({ def }: { def: CatalogItem }) {
  const { c } = useScene()
  const [w, d] = def.footprint
  const tint = useTint(def.tint, '')
  switch (def.model) {
    case 'desk':
      return <Desk color={tint || undefined} />
    case 'chair':
      return <Chair color={tint || undefined} />
    case 'stool':
      return <Stool />
    case 'armchair':
      return <Armchair color={tint || c.rest} />
    case 'beanbag':
      return <Beanbag color={tint || c.accent} />
    case 'sofa':
      return <Sofa color={tint || c.good} />
    case 'bookshelf':
      return <Bookshelf w={w} />
    case 'tallshelf':
      return <TallShelf />
    case 'sidetable':
      return <SideTable />
    case 'bed':
      return <Bed color={tint || c.rest} />
    case 'crate':
      return <Crate />
    case 'lamp':
      return <Lamp />
    case 'plant':
      return <Plant />
    case 'tallplant':
      return <TallPlant />
    case 'cactus':
      return <Cactus />
    case 'globe':
      return <Globe />
    case 'bookpile':
      return <BookPile />
    case 'radio':
      return <Radio />
    case 'fishtank':
      return <FishTank />
    case 'cat':
      return <Cat />
    case 'telescope':
      return <Telescope />
    case 'rug':
      return <Rug w={w} d={d} color={tint || undefined} />
    case 'roundrug':
      return <RoundRug w={w} color={tint || c.rug} />
    case 'window':
      return <Window w={w} />
    case 'poster':
      return <Poster color={tint || c.rest} />
    case 'clock':
      return <Clock />
    case 'corkboard':
      return <Corkboard />
    case 'wallshelf':
      return <WallShelf />
    case 'lights':
      return <Lights w={w} />
    case 'whiteboard':
      return <Whiteboard />
  }
}

export { Cushion }
