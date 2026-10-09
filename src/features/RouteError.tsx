import { isRouteErrorResponse, Link, useRouteError } from 'react-router-dom'
import { Screen } from '../components/Screen'
import { copy } from '../content/copy'

// After a deploy, an open tab can ask for a code chunk that no longer exists.
const STALE_CHUNK = /dynamically imported module|Importing a module script failed|error loading dynamically/i

/** Shown instead of a blank screen when a page crashes (React Router errorElement). */
export function RouteError() {
  const error = useRouteError()
  const stale = error instanceof Error && STALE_CHUNK.test(error.message)
  const offline = typeof navigator !== 'undefined' && !navigator.onLine
  const t = copy.routeError
  if (isRouteErrorResponse(error) && error.status === 404) {
    return (
      <Screen>
        <div className="card card-raised p-6">
          <h1 className="font-display text-2xl font-bold">{copy.notFound.title}</h1>
          <Link to="/" className="btn btn-primary mt-5">
            {copy.notFound.back}
          </Link>
        </div>
      </Screen>
    )
  }
  return (
    <Screen>
      <div className="card card-raised p-6" role="alert">
        <h1 className="font-display text-2xl font-bold">
          {offline ? t.offlineTitle : stale ? t.updateTitle : t.title}
        </h1>
        <p className="mt-3">{offline ? t.offlineBody : stale ? t.updateBody : t.body}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
            {t.reload}
          </button>
          <a href="/" className="btn btn-secondary">
            {t.home}
          </a>
        </div>
      </div>
    </Screen>
  )
}
