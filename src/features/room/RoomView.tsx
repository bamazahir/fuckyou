import { Component, lazy, Suspense, type ReactNode } from 'react'
import { copy } from '../../content/copy'
import { hasWebGL } from '../../lib/webgl'
import type { IsoRoomProps } from '../../scene/IsoRoom'

// three.js only loads on screens that show a room.
const IsoRoom = lazy(() => import('../../scene/IsoRoom'))

class SceneBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

/**
 * The isometric room, or `fallback` (the 2D view) when WebGL is unavailable or the scene fails
 * (SPEC §15 M4). `className` sizes the scene box; the fallback replaces the whole box.
 */
export function RoomView({
  fallback,
  className,
  ...props
}: IsoRoomProps & { fallback: ReactNode; className: string }) {
  if (!hasWebGL()) return <>{fallback}</>
  return (
    <SceneBoundary fallback={fallback}>
      <div className={`scene ${className}`}>
        <Suspense
          fallback={
            <p className="flex h-full items-center justify-center text-muted" role="status">
              {copy.room.sceneLoading}
            </p>
          }
        >
          <IsoRoom {...props} />
        </Suspense>
      </div>
    </SceneBoundary>
  )
}
