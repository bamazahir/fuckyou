// Which avatar labels get the full "name + timer" pill and which shrink to a dot (SPEC §10). Pure.

export interface LabelBox {
  id: string
  /** Anchor: bottom-centre of the label, in px. */
  x: number
  y: number
  width: number
  height: number
}

/**
 * Greedy: in priority order, a label is shown in full unless it would overlap one already shown,
 * in which case it becomes a dot (still tappable). Above `max` people only the `pinned` labels are full.
 */
export function fullLabels(
  boxes: readonly LabelBox[],
  max: number,
  pinned: ReadonlySet<string>,
): Set<string> {
  const shown: LabelBox[] = []
  const out = new Set<string>()
  const overlaps = (a: LabelBox, b: LabelBox) =>
    Math.abs(a.x - b.x) < (a.width + b.width) / 2 + 4 && a.y - a.height < b.y + 2 && b.y - b.height < a.y + 2
  for (const box of boxes) {
    if (boxes.length > max && !pinned.has(box.id)) continue
    if (!pinned.has(box.id) && shown.some((s) => overlaps(s, box))) continue
    shown.push(box)
    out.add(box.id)
  }
  return out
}

/** Rough pill width for a label, so collisions can be judged before rendering. */
export function labelWidth(name: string, clock: string | null): number {
  return 34 + Math.min(name.length, 14) * 7.5 + (clock ? clock.length * 8 + 6 : 0)
}
