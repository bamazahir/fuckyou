import { copy } from '../content/copy'

/** Where a 3D room would be, on a device that can't draw one. */
export function NoWebGL({ className = '' }: { className?: string }) {
  return (
    <p className={`grid min-h-40 place-items-center p-6 text-center text-muted ${className}`} role="status">
      {copy.room.noWebgl}
    </p>
  )
}
