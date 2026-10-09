import { useEffect, useRef, type ReactNode } from 'react'

/** Modal sheet built on <dialog> (focus trap, Esc, backdrop for free). */
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
      className="card card-raised m-auto max-h-[90dvh] w-[min(30rem,calc(100%-2rem))] overflow-y-auto p-6 backdrop:bg-black/60"
    >
      <h2 id={labelledBy} className="font-display text-2xl font-bold">
        {title}
      </h2>
      {children}
    </dialog>
  )
}
