import { Screen } from '../../components/Screen'
import { copy } from '../../content/copy'
import { useAuth } from '../../stores/auth'

function StatusCard({ title, body, signOut }: { title: string; body: string; signOut?: boolean }) {
  const doSignOut = useAuth((s) => s.signOut)
  return (
    <Screen>
      <div className="card card-raised p-6">
        <h1 className="font-display text-2xl font-bold">{title}</h1>
        <p className="mt-3">{body}</p>
        {signOut && (
          <button type="button" className="btn btn-secondary mt-5" onClick={() => void doSignOut()}>
            {copy.common.signOut}
          </button>
        )}
      </div>
    </Screen>
  )
}

export const UnconfiguredPage = () => (
  <StatusCard title={copy.unconfigured.title} body={copy.unconfigured.body} />
)
export const BlockedPage = () => <StatusCard title={copy.blocked.title} body={copy.blocked.body} />
export const LoadErrorPage = () => (
  <StatusCard title={copy.errors.load_failed} body={copy.errors.generic} signOut />
)

export function LoadingPage() {
  return (
    <Screen>
      <p className="text-center text-on-bg-muted" role="status">
        {copy.common.loading}
      </p>
    </Screen>
  )
}
