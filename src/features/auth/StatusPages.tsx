import { Screen } from '../../components/Screen'
import { copy } from '../../content/copy'
import { useAuth } from '../../stores/auth'

function StatusCard({ title, body }: { title: string; body: string }) {
  return (
    <Screen>
      <div className="card card-raised p-6">
        <h1 className="font-display text-2xl font-bold">{title}</h1>
        <p className="mt-3">{body}</p>
      </div>
    </Screen>
  )
}

export const UnconfiguredPage = () => (
  <StatusCard title={copy.unconfigured.title} body={copy.unconfigured.body} />
)
export const BlockedPage = () => <StatusCard title={copy.blocked.title} body={copy.blocked.body} />
const SCHEMA_MISSING = /PGRST205|42P01|does not exist|Could not find the table/i

export function LoadErrorPage() {
  const loadError = useAuth((s) => s.loadError)
  const doSignOut = useAuth((s) => s.signOut)
  const schemaMissing = loadError !== null && SCHEMA_MISSING.test(loadError)
  return (
    <Screen>
      <div className="card card-raised p-6">
        <h1 className="font-display text-2xl font-bold">
          {schemaMissing ? copy.loadError.schemaTitle : copy.errors.load_failed}
        </h1>
        <p className="mt-3">{schemaMissing ? copy.loadError.schemaBody : copy.loadError.body}</p>
        {loadError && (
          <p className="mt-3 rounded-lg bg-surface-2 p-3 font-mono text-sm break-words text-muted">
            {loadError}
          </p>
        )}
        <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
            {copy.loadError.retry}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => void doSignOut()}>
            {copy.common.signOut}
          </button>
        </div>
      </div>
    </Screen>
  )
}

export function LoadingPage() {
  return (
    <Screen>
      <p className="text-center text-on-bg-muted" role="status">
        {copy.common.loading}
      </p>
    </Screen>
  )
}
