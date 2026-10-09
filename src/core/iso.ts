// True isometric camera maths (SPEC §10: orthographic camera at (10,10,10) looking at the origin). Pure.

export type Vec3 = readonly [number, number, number]

const R2 = Math.SQRT2
const R6 = Math.sqrt(6)

/** View-space coordinates of a world point: x to the right, y up (camera looking along -(1,1,1)). */
export function isoProject([x, y, z]: Vec3): [number, number] {
  return [(x - z) / R2, (2 * y - x - z) / R6]
}

export interface IsoFrame {
  /** Pixels per world unit (the orthographic camera's zoom). */
  zoom: number
  /** World point the camera looks at, so the content is centred. */
  target: [number, number, number]
  /** View-space centre of the content. */
  center: [number, number]
  width: number
  height: number
}

/** Zoom and target that fit `points` into a width×height viewport, leaving (1 − margin) free. */
export function isoFrame(points: readonly Vec3[], width: number, height: number, margin = 0.92): IsoFrame {
  const projected = points.map(isoProject)
  const xs = projected.map((p) => p[0])
  const ys = projected.map((p) => p[1])
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  const spanX = Math.max(maxX - minX, 1e-6)
  const spanY = Math.max(maxY - minY, 1e-6)
  const zoom = Math.max(1, Math.min((width * margin) / spanX, (height * margin) / spanY))
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  // right = (1,0,-1)/√2, up = (-1,2,-1)/√6
  const target: [number, number, number] = [cx / R2 - cy / R6, (2 * cy) / R6, -cx / R2 - cy / R6]
  return { zoom, target, center: [cx, cy], width, height }
}

/** Where a world point lands in the viewport, in CSS pixels from the top-left. */
export function toScreen(frame: IsoFrame, point: Vec3): [number, number] {
  const [sx, sy] = isoProject(point)
  return [
    frame.width / 2 + (sx - frame.center[0]) * frame.zoom,
    frame.height / 2 - (sy - frame.center[1]) * frame.zoom,
  ]
}

/** World position of the centre of cell (x, z) in a size×size room centred on the origin. */
export function cellCenter(x: number, z: number, size: number): [number, number] {
  return [x - size / 2 + 0.5, z - size / 2 + 0.5]
}
