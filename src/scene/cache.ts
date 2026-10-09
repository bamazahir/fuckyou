// Shared geometries and materials, so a room full of desks and beans reuses a handful of GPU objects.
import { BackSide, MeshBasicMaterial, MeshStandardMaterial, type BufferGeometry } from 'three'

const geometries = new Map<string, BufferGeometry>()
export function cachedGeometry<T extends BufferGeometry>(key: string, make: () => T): T {
  let g = geometries.get(key)
  if (!g) {
    g = make()
    geometries.set(key, g)
  }
  return g as T
}

const materials = new Map<string, MeshStandardMaterial | MeshBasicMaterial>()
export function solid(color: string, glow = 0): MeshStandardMaterial {
  const key = `s${color}${glow}`
  let m = materials.get(key) as MeshStandardMaterial | undefined
  if (!m) {
    m = new MeshStandardMaterial({
      color,
      flatShading: true,
      roughness: 0.85,
      metalness: 0,
      emissive: glow > 0 ? color : '#000000',
      emissiveIntensity: glow,
    })
    materials.set(key, m)
  }
  return m
}

export function hull(color: string): MeshBasicMaterial {
  const key = `h${color}`
  let m = materials.get(key) as MeshBasicMaterial | undefined
  if (!m) {
    m = new MeshBasicMaterial({ color, side: BackSide })
    materials.set(key, m)
  }
  return m
}
