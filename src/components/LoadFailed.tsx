import { copy } from '../content/copy'

/** "Couldn't load this" with a Retry button: the error state for anything fetched (SPEC M7). */
export function LoadFailed({ onRetry, compact = false }: { onRetry: () => void; compact?: boolean }) {
  return (
    <div role="alert" className={compact ? 'flex flex-wrap items-center gap-3 text-sm' : 'card p-5'}>
      <p>{copy.offline.failed}</p>
      <button type="button" className={`btn btn-secondary ${compact ? '' : 'mt-3'}`} onClick={onRetry}>
        {copy.offline.retry}
      </button>
    </div>
  )
}

/** The quiet loading line used while something is fetched. */
export function Loading() {
  return (
    <p role="status" className="text-muted">
      {copy.common.loading}
    </p>
  )
}
