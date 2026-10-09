// Whether and how to offer notifications on this device (SPEC §5.1: asked at first need). Pure.

export interface PushEnv {
  hasServiceWorker: boolean
  hasPushManager: boolean
  hasNotification: boolean
  /** iPhone/iPad (including iPadOS reporting as Mac with touch). */
  isIOS: boolean
  /** Running as an installed app (display-mode: standalone, or navigator.standalone on iOS). */
  standalone: boolean
  permission: 'default' | 'granted' | 'denied'
  subscribed: boolean
}

export type PushStatus = 'on' | 'ask' | 'off' | 'denied' | 'needs_install' | 'unsupported'

export function pushStatus(env: PushEnv): PushStatus {
  // iOS only allows web push for apps added to the Home Screen.
  if (env.isIOS && !env.standalone) return 'needs_install'
  if (!env.hasServiceWorker || !env.hasPushManager || !env.hasNotification) return 'unsupported'
  if (env.permission === 'denied') return 'denied'
  if (env.subscribed) return 'on'
  return env.permission === 'granted' ? 'off' : 'ask'
}

export function isIOSDevice(userAgent: string, maxTouchPoints: number): boolean {
  return /iPad|iPhone|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1)
}

/** VAPID public keys are base64url; PushManager.subscribe wants the raw bytes. */
export function base64UrlToBytes(s: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (s.length % 4)) % 4)
  const bin = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}
