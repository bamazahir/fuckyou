import { useUi } from '../stores/ui'

export function Toasts() {
  const toasts = useUi((s) => s.toasts)
  return (
    <div
      aria-live="polite"
      role="status"
      className="pointer-events-none fixed inset-x-0 top-[max(3.5rem,env(safe-area-inset-top))] z-50 flex flex-col items-center gap-2 px-4"
    >
      {toasts.map((t) => (
        <p key={t.id} className="card card-raised pointer-events-auto px-4 py-2 font-bold">
          {t.text}
        </p>
      ))}
    </div>
  )
}
