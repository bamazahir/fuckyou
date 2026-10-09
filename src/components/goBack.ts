import type { NavigateFunction } from 'react-router-dom'

/** Back within the app; opened from a link (no in-app history) goes to `fallback` instead of leaving. */
export function goBack(navigate: NavigateFunction, fallback: string): void {
  const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
  if (idx > 0) void navigate(-1)
  else void navigate(fallback, { replace: true })
}
