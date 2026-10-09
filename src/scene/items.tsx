// Procedural furniture (studyroom-look §3, option 1: built in code, zero license risk).
// Each model sits in its own frame: origin at the bottom-centre of the footprint, facing +z.
import { useScene } from './context'
import { Ball, Box, Cylinder } from './parts'

const LEG = 0.05

function Legs({ w, d, h, color }: { w: number; d: number; h: number; color: string }) {
  const x = w / 2 - LEG
  const z = d / 2 - LEG
  return (
    <>
      {[
        [-x, -z],
        [x, -z],
        [-x, z],
        [x, z],
      ].map(([lx, lz]) => (
        <Box key={`${lx}${lz}`} size={[LEG, h, LEG]} position={[lx ?? 0, h / 2, lz ?? 0]} color={color} />
      ))}
    </>
  )
}

/** Study desk: the sitter is on the +z side. A modesty panel on the back hides their legs. */
export function Desk({ color }: { color?: string }) {
  const { c, lampOn } = useScene()
  const top_ = color ?? c.wood
  const top = 0.72
  return (
    <group position={[0, 0, 0.08]}>
      <Box size={[0.94, 0.06, 0.66]} position={[0, top, 0]} color={top_} />
      <group position={[0, 0, 0]}>
        <Legs w={0.9} d={0.62} h={top - 0.03} color={c.woodDark} />
      </group>
      <Box size={[0.86, 0.36, 0.04]} position={[0, top - 0.24, -0.29]} color={c.woodDark} />
      {/* notebook, a book and a little desk lamp */}
      <Box
        size={[0.3, 0.02, 0.22]}
        position={[0.05, top + 0.04, 0.12]}
        rotation={[0, 0.15, 0]}
        color={c.paper}
      />
      <Box
        size={[0.2, 0.06, 0.26]}
        position={[-0.28, top + 0.06, 0.02]}
        rotation={[0, -0.2, 0]}
        color={c.accent}
      />
      <group position={[0.32, top + 0.03, -0.18]}>
        <Cylinder top={0.06} height={0.03} position={[0, 0.015, 0]} color={c.line} outline={false} />
        <Box size={[0.025, 0.26, 0.025]} position={[0, 0.15, 0]} color={c.line} outline={false} />
        <Cylinder
          top={0.045}
          bottom={0.1}
          height={0.1}
          position={[0, 0.3, 0.02]}
          color={lampOn ? c.glow : c.paper2}
          glow={lampOn ? 0.9 : 0}
        />
      </group>
    </group>
  )
}

/** Chair facing +z, nudged towards the desk so the sitter is close to it. */
export function Chair({ color }: { color?: string }) {
  const { c } = useScene()
  const wood = color ?? c.wood
  const seat = 0.42
  return (
    <group position={[0, 0, 0.2]}>
      <Box size={[0.46, 0.05, 0.44]} position={[0, seat, 0]} color={wood} />
      <Legs w={0.42} d={0.4} h={seat - 0.025} color={c.woodDark} />
      <Box size={[0.46, 0.42, 0.05]} position={[0, seat + 0.24, -0.2]} color={wood} />
    </group>
  )
}

export function Rug({ w, d, color }: { w: number; d: number; color?: string }) {
  const { c } = useScene()
  return (
    <>
      <Box size={[w - 0.3, 0.02, d - 0.3]} position={[0, 0.01, 0]} color={color ?? c.rug} shadow={false} />
      <Box
        size={[w - 0.8, 0.022, d - 0.8]}
        position={[0, 0.011, 0]}
        color={c.rugInner}
        shadow={false}
        outline={false}
      />
    </>
  )
}

export function Lamp() {
  const { c, lampOn } = useScene()
  return (
    <>
      <Cylinder top={0.17} height={0.04} position={[0, 0.02, 0]} color={c.line} />
      <Cylinder top={0.025} height={1.28} position={[0, 0.66, 0]} color={c.line} outline={false} />
      <Cylinder
        top={0.13}
        bottom={0.24}
        height={0.28}
        segments={8}
        position={[0, 1.4, 0]}
        color={lampOn ? c.glow : c.paper2}
        glow={lampOn ? 0.85 : 0}
      />
    </>
  )
}

export function Plant() {
  const { c } = useScene()
  return (
    <>
      <Cylinder top={0.2} bottom={0.15} height={0.32} segments={8} position={[0, 0.16, 0]} color={c.pot} />
      <Ball radius={0.2} position={[0, 0.5, 0]} color={c.good} />
      <Ball radius={0.15} position={[0.13, 0.66, 0.06]} color={c.good} />
      <Ball radius={0.14} position={[-0.1, 0.72, -0.06]} color={c.good} />
      <Ball radius={0.11} position={[0.02, 0.86, 0.02]} color={c.good} />
    </>
  )
}

type BookColor = 'accent' | 'rest' | 'paper' | 'good' | 'danger' | 'paper2'
const BOOKS: [number, number, BookColor][] = [
  [0.07, 0.28, 'accent'],
  [0.06, 0.32, 'rest'],
  [0.08, 0.26, 'paper'],
  [0.05, 0.3, 'good'],
  [0.07, 0.34, 'danger'],
  [0.06, 0.27, 'paper2'],
  [0.09, 0.31, 'accent'],
  [0.05, 0.25, 'rest'],
]

/** A shelf's worth of books, cycling widths and colors, starting at a different book per row. */
function bookRow(row: number, inner: number) {
  const out: { key: number; x: number; w: number; h: number; color: BookColor }[] = []
  let x = -inner / 2 + 0.08
  for (let i = 0; i < 40; i++) {
    const [w, h, color] = BOOKS[(i + row * 3) % BOOKS.length] ?? [0.06, 0.3, 'accent']
    if (x + w > inner / 2 - 0.05) break
    out.push({ key: i, x: x + w / 2, w, h, color })
    x += w + 0.012
  }
  return out
}

/** Two cells wide, against the wall behind it (−z). */
export function Bookshelf({ w }: { w: number }) {
  const { c } = useScene()
  const inner = w - 0.3
  const depth = 0.38
  const z = -0.5 + depth / 2 + 0.04
  const shelves = [0.08, 0.52, 0.96, 1.4]
  return (
    <group position={[0, 0, z]}>
      <Box size={[0.06, 1.86, depth]} position={[-inner / 2, 0.93, 0]} color={c.wood} />
      <Box size={[0.06, 1.86, depth]} position={[inner / 2, 0.93, 0]} color={c.wood} />
      <Box
        size={[inner, 1.8, 0.03]}
        position={[0, 0.92, -depth / 2 + 0.015]}
        color={c.woodDark}
        outline={false}
      />
      {[...shelves, 1.84].map((y) => (
        <Box key={y} size={[inner + 0.06, 0.05, depth]} position={[0, y, 0]} color={c.wood} />
      ))}
      {shelves
        .slice(0, 3)
        .flatMap((y, row) =>
          bookRow(row, inner).map((b) => (
            <Box
              key={`${row}-${b.key}`}
              size={[b.w, b.h, 0.26]}
              position={[b.x, y + 0.025 + b.h / 2, 0.02]}
              color={c[b.color]}
              outline={false}
            />
          )),
        )}
    </group>
  )
}

/** Wall window: shows the time of day (sun or moon on the window color). */
export function Window({ w }: { w: number }) {
  const { c, night } = useScene()
  const width = w - 0.5
  const height = 1.1
  const y = 1.5
  return (
    <group position={[0, 0, 0.04]}>
      <Box size={[width + 0.12, height + 0.12, 0.06]} position={[0, y, 0]} color={c.paper} />
      <Box
        size={[width, height, 0.02]}
        position={[0, y, 0.035]}
        color={c.window}
        glow={night ? 0.15 : 0.35}
        outline={false}
      />
      <Ball
        radius={night ? 0.1 : 0.12}
        detail={1}
        position={[width / 4, y + height / 4, 0.05]}
        color={night ? c.paper : c.glow}
        glow={night ? 0.5 : 0.25}
        outline={false}
      />
      <Box size={[0.05, height, 0.03]} position={[0, y, 0.05]} color={c.paper} outline={false} />
      <Box size={[width, 0.05, 0.03]} position={[0, y, 0.05]} color={c.paper} outline={false} />
      <Box size={[width + 0.3, 0.06, 0.18]} position={[0, y - height / 2 - 0.06, 0.06]} color={c.paper} />
    </group>
  )
}

export function Cushion({ color }: { color: string }) {
  return <Cylinder top={0.24} bottom={0.26} height={0.1} segments={8} position={[0, 0.05, 0]} color={color} />
}
