import { describe, expect, it } from 'vitest'
import { cellCenter, isoFrame, isoProject, rotateY, toScreen, viewFrame, visibleWalls } from './iso'

describe('isoProject', () => {
  it('puts the origin in the middle and +y straight up', () => {
    expect(isoProject([0, 0, 0])).toEqual([0, 0])
    const [x, y] = isoProject([0, 1, 0])
    expect(x).toBeCloseTo(0)
    expect(y).toBeGreaterThan(0)
  })

  it('sends +x to the lower right and +z to the lower left', () => {
    const [ax, ay] = isoProject([1, 0, 0])
    const [bx, by] = isoProject([0, 0, 1])
    expect(ax).toBeGreaterThan(0)
    expect(ay).toBeLessThan(0)
    expect(bx).toBeLessThan(0)
    expect(by).toBeLessThan(0)
  })

  it('collapses the view direction to a single point', () => {
    const [x, y] = isoProject([1, 1, 1])
    expect(x).toBeCloseTo(0)
    expect(y).toBeCloseTo(0)
  })
})

describe('isoFrame', () => {
  const floor = [
    [-4, 0, -4],
    [4, 0, -4],
    [-4, 0, 4],
    [4, 0, 4],
  ] as const

  it('fits the content inside the viewport with a margin', () => {
    const frame = isoFrame(floor, 400, 300, 0.9)
    for (const p of floor) {
      const [px, py] = toScreen(frame, p)
      expect(px).toBeGreaterThanOrEqual(19.9)
      expect(px).toBeLessThanOrEqual(380.1)
      expect(py).toBeGreaterThanOrEqual(14.9)
      expect(py).toBeLessThanOrEqual(285.1)
    }
  })

  it('centres off-centre content by moving the target', () => {
    const shifted = floor.map(([x, y, z]) => [x + 3, y, z] as const)
    const frame = isoFrame(shifted, 400, 300)
    const [cx, cy] = toScreen(frame, [3, 0, 0])
    expect(cx).toBeCloseTo(200)
    expect(cy).toBeCloseTo(150)
    // The target projects onto the content centre.
    const [tx, ty] = isoProject(frame.target)
    expect(tx).toBeCloseTo(frame.center[0])
    expect(ty).toBeCloseTo(frame.center[1])
  })

  it('zooms in on a wider viewport only as far as the height allows', () => {
    expect(isoFrame(floor, 2000, 300).zoom).toBeCloseTo(isoFrame(floor, 4000, 300).zoom)
  })
})

describe('cellCenter', () => {
  it('centres the grid on the origin', () => {
    expect(cellCenter(0, 0, 8)).toEqual([-3.5, -3.5])
    expect(cellCenter(7, 7, 8)).toEqual([3.5, 3.5])
  })
})

describe('turning the room', () => {
  it('rotates like three.js rotation.y', () => {
    expect(rotateY([1, 2, 0], 1)).toEqual([0, 2, -1])
    expect(rotateY([1, 2, 0], 2)).toEqual([-1, 2, 0])
    expect(rotateY([0, 0, 1], 1)).toEqual([1, 0, 0])
  })
  it('keeps the two far walls in view', () => {
    expect(visibleWalls(0)).toEqual(['n', 'w'])
    expect(visibleWalls(1)).toEqual(['n', 'e'])
    expect(visibleWalls(2)).toEqual(['s', 'e'])
    expect(visibleWalls(3)).toEqual(['w', 's'])
  })
})

describe('viewFrame', () => {
  const base = isoFrame(
    [
      [-4, 0, -4],
      [4, 0, 4],
      [-4, 2.5, 4],
      [4, 2.5, -4],
    ],
    400,
    300,
  )
  it('is the fitted view at 1×, whatever the pan', () => {
    const { frame, pan } = viewFrame(base, 1, [5, -5])
    expect(pan).toEqual([0, 0])
    expect(frame.zoom).toBeCloseTo(base.zoom)
    expect(frame.center).toEqual(base.center)
  })
  it('zooms in and keeps the target on the screen centre', () => {
    const { frame } = viewFrame(base, 2, [0.5, 0.25])
    expect(frame.zoom).toBeCloseTo(base.zoom * 2)
    const [tx, ty] = isoProject(frame.target)
    expect(tx).toBeCloseTo(base.center[0] + 0.5)
    expect(ty).toBeCloseTo(base.center[1] + 0.25)
  })
  it('never pans past the fitted view', () => {
    const { pan } = viewFrame(base, 2, [1000, -1000])
    expect(pan[0]).toBeCloseTo(base.width / base.zoom / 4)
    expect(pan[1]).toBeCloseTo(-base.height / base.zoom / 4)
  })
  it('caps the zoom', () => {
    expect(viewFrame(base, 50, [0, 0]).frame.zoom).toBeCloseTo(base.zoom * 3)
  })
})
