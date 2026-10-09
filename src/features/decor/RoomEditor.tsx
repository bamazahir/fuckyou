import { useCallback, useMemo, useState } from 'react'
import { ErrorText } from '../../components/Screen'
import { copy } from '../../content/copy'
import { CATALOG } from '../../content/layouts'
import { canPlace, nextRot, placement, remaining } from '../../core/edit'
import type { LayoutItem, Rot } from '../../core/grid'
import { hasWebGL } from '../../lib/webgl'
import type { SceneEdit } from '../../scene/IsoRoom'
import { useUi } from '../../stores/ui'
import { RoomView } from '../room/RoomView'
import { ItemThumb, ThumbRenderer } from '../shop/ItemThumb'

const t = copy.decor

type Mode =
  | { kind: 'idle' }
  | { kind: 'placing'; itemId: string; rot: Rot; cell: { x: number; z: number }; replacing: number | null }

/**
 * Edit mode (SPEC §10): tap a thing in the tray, then tap the floor (or a wall) to place it; tap a placed
 * thing to turn it, move it or put it away. Nothing is saved until Save.
 */
export function RoomEditor({
  size,
  initial,
  owned,
  title,
  trayTitle,
  night,
  onSave,
  onDone,
}: {
  size: number
  initial: readonly LayoutItem[]
  owned: ReadonlyMap<string, number>
  title: string
  trayTitle: string
  night: boolean
  onSave: (layout: LayoutItem[]) => Promise<string | null>
  onDone: () => void
}) {
  const toast = useUi((s) => s.toast)
  const [layout, setLayout] = useState<LayoutItem[]>(() => [...initial])
  const [mode, setMode] = useState<Mode>({ kind: 'idle' })
  const [selected, setSelected] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const placing = mode.kind === 'placing' ? mode : null
  const def = placing ? CATALOG.get(placing.itemId) : undefined
  const shown =
    placing && placing.replacing !== null ? layout.filter((_, i) => i !== placing.replacing) : layout
  const ghost = placing && def ? placement(def, placing.cell, placing.rot, size) : null
  const ghostOk = ghost ? canPlace(shown, ghost, size, CATALOG) : false
  const left = useMemo(() => remaining(owned, layout), [owned, layout])
  const tray = [...left.entries()].filter(([id, n]) => n > 0 && CATALOG.has(id))

  const place = useCallback(() => {
    if (!placing || !ghost || !ghostOk) return
    setLayout((l) => [
      ...(placing.replacing !== null ? l.filter((_, i) => i !== placing.replacing) : l),
      ghost,
    ])
    setMode({ kind: 'idle' })
    setSelected(null)
  }, [placing, ghost, ghostOk])

  const edit: SceneEdit = {
    ghost,
    ghostOk,
    selected: placing ? null : selected,
    onHover: (cell) => {
      if (cell && placing && (cell.x !== placing.cell.x || cell.z !== placing.cell.z))
        setMode({ ...placing, cell })
    },
    onTapCell: (cell) => {
      if (!placing) return setSelected(null)
      // First tap moves the ghost there (phones have no hover); a tap where it already is places it.
      if (placing.cell.x === cell.x && placing.cell.z === cell.z) place()
      else setMode({ ...placing, cell })
    },
    onTapItem: (i) => {
      if (!placing) setSelected(i)
    },
  }

  const pick = (itemId: string) => {
    setSelected(null)
    setError(null)
    setMode({
      kind: 'placing',
      itemId,
      rot: 0,
      cell: { x: Math.floor(size / 2), z: Math.floor(size / 2) },
      replacing: null,
    })
  }

  const rotate = () => {
    if (placing && def) return setMode({ ...placing, rot: nextRot(def, placing.rot) })
    if (selected === null) return
    const item = layout[selected]
    const d = item && CATALOG.get(item.item_id)
    if (!item || !d) return
    const turned = { ...item, rot: nextRot(d, item.rot) }
    if (!canPlace(layout, turned, size, CATALOG, selected)) return setError('blocked')
    setLayout((l) => l.map((x, i) => (i === selected ? turned : x)))
  }

  const move = () => {
    const item = selected !== null ? layout[selected] : undefined
    if (!item || selected === null) return
    setMode({
      kind: 'placing',
      itemId: item.item_id,
      rot: item.rot,
      cell: { x: item.x, z: item.z },
      replacing: selected,
    })
    setSelected(null)
  }

  const putAway = () => {
    if (selected === null) return
    setLayout((l) => l.filter((_, i) => i !== selected))
    setSelected(null)
  }

  async function save() {
    setBusy(true)
    const err = await onSave(layout)
    setBusy(false)
    if (err) return setError(err)
    toast(t.saved)
    onDone()
  }

  if (!hasWebGL()) {
    return (
      <div className="card p-5">
        <p>{copy.errors.generic}</p>
        <button type="button" className="btn btn-secondary mt-3" onClick={onDone}>
          {t.cancel}
        </button>
      </div>
    )
  }

  const selectedItem = selected !== null ? layout[selected] : undefined
  return (
    <div className="space-y-4">
      <ThumbRenderer />
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-bold">{title}</h1>
        <div className="flex gap-2">
          <button type="button" className="btn btn-secondary" onClick={onDone}>
            {t.cancel}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void save()}
            disabled={busy || placing !== null}
          >
            {t.save}
          </button>
        </div>
      </header>
      <div className="card card-raised overflow-hidden">
        <RoomView
          className="aspect-[5/4] w-full max-h-[70svh] lg:aspect-auto lg:h-[560px]"
          size={size}
          layout={shown}
          avatars={[]}
          night={night}
          lampOn
          label={title}
          walkIn={false}
          edit={edit}
          fallback={null}
        />
        <div
          className="flex flex-wrap items-center gap-2 border-t-2 border-line bg-surface-2 px-4 py-2"
          role="toolbar"
        >
          {placing ? (
            <>
              <span className="mr-auto text-sm">{ghostOk ? t.placeHint : t.blocked}</span>
              <button type="button" className="btn btn-secondary" onClick={rotate}>
                {t.rotate}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setMode({ kind: 'idle' })}>
                {t.cancel}
              </button>
              <button type="button" className="btn btn-primary" onClick={place} disabled={!ghostOk}>
                {t.place}
              </button>
            </>
          ) : selectedItem ? (
            <>
              <span className="mr-auto font-bold">{CATALOG.get(selectedItem.item_id)?.name}</span>
              <button type="button" className="btn btn-secondary" onClick={rotate}>
                {t.rotate}
              </button>
              <button type="button" className="btn btn-secondary" onClick={move}>
                {t.move}
              </button>
              <button type="button" className="btn btn-secondary" onClick={putAway}>
                {t.remove}
              </button>
            </>
          ) : (
            <span className="text-sm">{t.placeHint}</span>
          )}
        </div>
      </div>
      <ErrorText code={error} />
      <section aria-labelledby="tray-title" className="card p-4">
        <h2 id="tray-title" className="font-display text-lg font-bold">
          {trayTitle}
        </h2>
        {tray.length === 0 && <p className="mt-1 text-sm text-muted">{t.trayEmpty}</p>}
        <ul className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {tray.map(([id, n]) => {
            const item = CATALOG.get(id)
            if (!item) return null
            const active = placing?.itemId === id && placing.replacing === null
            return (
              <li key={id} className="shrink-0">
                <button
                  type="button"
                  className={`card relative flex w-24 flex-col items-center p-1 text-xs ${active ? 'card-raised bg-accent text-on-accent' : ''}`}
                  onClick={() => pick(id)}
                  aria-label={`${item.name}, ${n}`}
                >
                  <ItemThumb itemId={id} name={item.name} size={72} />
                  <span className="w-full truncate">{item.name}</span>
                  <span className="pill absolute top-1 right-1 px-1.5 py-0 text-xs">{n}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
