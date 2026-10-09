import { copy } from '../content/copy'
import { useOnline } from './useOnline'

/** A calm strip at the top while there's no connection (SPEC M7: offline states everywhere). */
export function OfflineBanner() {
  const online = useOnline()
  // The live region stays mounted (empty while online) so going offline is announced.
  return (
    <div
      role="status"
      className={
        online
          ? 'sr-only'
          : 'sticky top-0 z-50 border-b-2 border-line bg-accent px-4 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-center text-sm font-bold text-on-accent'
      }
    >
      {online ? '' : copy.offline.banner}
    </div>
  )
}
