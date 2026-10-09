import { useEffect, useRef, type ReactNode } from 'react'
import { copy } from '../content/copy'

/**
 * Modal sheet built on <dialog> (focus trap, Esc, backdrop for free). It always has a close button and
 * closes on a backdrop tap, because phones have no Esc key.
 */
export function Dialog({
  title,
  onClose,
  children,
  labelledBy = 'dialog-title',
}: {
  title: string
  onClose: () => void
  children: ReactNode
  labelledBy?: string
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal()
  }, [])
  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        // The backdrop belongs to the <dialog> element: a click on it lands outside the box.
        if (e.target !== e.currentTarget) return
        const r = e.currentTarget.getBoundingClientRect()
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onClose()
      }}
      className="card card-raised m-auto max-h-[90dvh] w-[min(30rem,calc(100%-2rem))] overflow-y-auto overscroll-contain p-6 backdrop:bg-black/60"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 id={labelledBy} className="font-display min-w-0 text-2xl font-bold break-words">
          {title}
        </h2>
        <button
          type="button"
          className="btn btn-secondary -mt-1 -mr-2 size-11 shrink-0 p-0 text-xl leading-none"
          onClick={onClose}
          aria-label={copy.common.close}
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>
      {children}
    </dialog>
  )
}
