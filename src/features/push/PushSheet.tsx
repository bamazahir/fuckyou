import { Dialog } from '../../components/Dialog'
import { copy } from '../../content/copy'
import { usePush } from '../../stores/push'

const t = copy.push

/** The one place notifications are asked for, at first need (SPEC §5.1). */
export function PushSheet() {
  const { prompt, enable, dismiss } = usePush()
  if (!prompt) return null
  if (prompt.kind === 'install')
    return (
      <Dialog title={t.installTitle} onClose={dismiss} labelledBy="push-title">
        <p className="mt-3">{t.installBody}</p>
        <ol className="mt-3 list-decimal space-y-1 pl-6">
          {t.installSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <button type="button" className="btn btn-primary mt-5 w-full" onClick={dismiss}>
          {t.ok}
        </button>
      </Dialog>
    )
  if (prompt.kind === 'denied')
    return (
      <Dialog title={t.deniedTitle} onClose={dismiss} labelledBy="push-title">
        <p className="mt-3">{t.deniedBody}</p>
        <button type="button" className="btn btn-primary mt-5 w-full" onClick={dismiss}>
          {t.ok}
        </button>
      </Dialog>
    )
  return (
    <Dialog
      title={prompt.reason === 'room' ? t.askTitleRoom : t.askTitle}
      onClose={dismiss}
      labelledBy="push-title"
    >
      <p className="mt-3">{t.askBody}</p>
      <div className="mt-5 flex gap-3">
        <button type="button" className="btn btn-secondary" onClick={dismiss}>
          {t.notNow}
        </button>
        <button type="button" className="btn btn-primary flex-1" onClick={() => void enable()}>
          {t.allow}
        </button>
      </div>
    </Dialog>
  )
}
