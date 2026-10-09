import { describe, expect, it } from 'vitest'
import { fullLabels, labelWidth, type LabelBox } from './labels'

const box = (id: string, x: number, y: number): LabelBox => ({ id, x, y, width: 100, height: 24 })

describe('fullLabels', () => {
  it('shows every label when they are apart', () => {
    expect([...fullLabels([box('a', 0, 0), box('b', 200, 0), box('c', 0, 100)], 12, new Set())]).toEqual([
      'a',
      'b',
      'c',
    ])
  })

  it('shrinks a label that would overlap an earlier one', () => {
    expect([...fullLabels([box('a', 0, 0), box('b', 50, 10), box('c', 300, 0)], 12, new Set())]).toEqual([
      'a',
      'c',
    ])
  })

  it('always shows pinned labels (you, or the one just tapped)', () => {
    const out = fullLabels([box('a', 0, 0), box('me', 10, 0)], 12, new Set(['me']))
    expect(out.has('me')).toBe(true)
  })

  it('above the limit, shows only pinned labels', () => {
    const many = Array.from({ length: 13 }, (_, i) => box(`p${i}`, i * 300, 0))
    expect([...fullLabels(many, 12, new Set(['p3']))]).toEqual(['p3'])
  })
})

describe('labelWidth', () => {
  it('grows with the text', () => {
    expect(labelWidth('Mia', '25:00')).toBeLessThan(labelWidth('Alexandra', '1:25:00'))
  })
})
