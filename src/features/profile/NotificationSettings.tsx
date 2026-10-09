import { useEffect } from 'react'
import { copy } from '../../content/copy'
import { useAuth } from '../../stores/auth'
import { usePush } from '../../stores/push'

const t = copy.push

/** Push on this device, plus which kinds you want (SPEC §5.5). "Room is active" is per room. */
export function NotificationSettings() {
  const profile = useAuth((s) => s.profile)
  const updateSettings = useAuth((s) => s.updateSettings)
  const { status, refresh, offer, disable } = usePush()

  useEffect(() => {
    void refresh()
  }, [refresh])

  if (!profile) return null
  const notify = profile.settings.notify ?? {}
  return (
    <section aria-labelledby="notify-heading" className="card p-5">
      <h2 id="notify-heading" className="font-display text-xl font-bold">
        {t.section}
      </h2>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted" data-testid="push-status">
          {status ? t.device[status] : copy.common.loading}
        </p>
        {status === 'on' ? (
          <button type="button" className="btn btn-secondary" onClick={() => void disable()}>
            {t.turnOff}
          </button>
        ) : status === 'ask' || status === 'off' || status === 'needs_install' || status === 'denied' ? (
          <button type="button" className="btn btn-primary" onClick={() => void offer('room')}>
            {t.turnOn}
          </button>
        ) : null}
      </div>
      <ul className="mt-3 space-y-2">
        {(['phase_end', 'checkin'] as const).map((kind) => (
          <li key={kind}>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                className="h-5 w-5 accent-[var(--accent)]"
                checked={notify[kind] !== false}
                onChange={(e) => void updateSettings({ notify: { ...notify, [kind]: e.target.checked } })}
              />
              {t.types[kind]}
            </label>
          </li>
        ))}
      </ul>
    </section>
  )
}
