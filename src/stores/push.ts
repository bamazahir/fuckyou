// Web push on this device (SPEC §5.1, §9): status, asking at first need, subscribing and cleanup.
import { create } from 'zustand'
import { vapidPublicKey } from '../config'
import { base64UrlToBytes, isIOSDevice, pushStatus, type PushStatus } from '../core/push'
import { supabase } from '../lib/supabase'

const ASKED_KEY = 'studyroom.push.asked'

function readAsked(): boolean {
  try {
    return window.localStorage.getItem(ASKED_KEY) === '1'
  } catch {
    return false
  }
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  try {
    return await navigator.serviceWorker.ready
  } catch {
    return null
  }
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await registration()
  return (await reg?.pushManager.getSubscription()) ?? null
}

async function readStatus(): Promise<PushStatus> {
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  const hasPushManager = 'PushManager' in window && vapidPublicKey !== ''
  const hasNotification = 'Notification' in window
  return pushStatus({
    hasServiceWorker: 'serviceWorker' in navigator,
    hasPushManager,
    hasNotification,
    isIOS: isIOSDevice(navigator.userAgent, navigator.maxTouchPoints),
    standalone,
    permission: hasNotification ? Notification.permission : 'denied',
    subscribed: hasPushManager && (await currentSubscription()) !== null,
  })
}

/** What the "turn on notifications?" sheet should show, if anything. */
export type PushPrompt = { kind: 'ask' | 'install' | 'denied'; reason: 'timer' | 'room' } | null

interface PushState {
  status: PushStatus | null
  asked: boolean
  prompt: PushPrompt
  refresh: () => Promise<PushStatus>
  /** Call at first need. Shows the right sheet once (timer) or every time (explicit room toggle). */
  offer: (reason: 'timer' | 'room') => Promise<PushStatus>
  enable: () => Promise<PushStatus>
  disable: () => Promise<void>
  dismiss: () => void
}

export const usePush = create<PushState>((set, get) => ({
  status: null,
  asked: readAsked(),
  prompt: null,

  refresh: async () => {
    const status = await readStatus()
    set({ status })
    return status
  },

  offer: async (reason) => {
    const status = await get().refresh()
    if (reason === 'timer' && get().asked) return status
    if (status === 'ask' || status === 'off') set({ prompt: { kind: 'ask', reason } })
    else if (status === 'needs_install') set({ prompt: { kind: 'install', reason } })
    else if (status === 'denied' && reason === 'room') set({ prompt: { kind: 'denied', reason } })
    return status
  },

  enable: async () => {
    try {
      window.localStorage.setItem(ASKED_KEY, '1')
    } catch {
      // storage blocked: we may ask again next time
    }
    set({ asked: true, prompt: null })
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return get().refresh()
    const reg = await registration()
    if (!reg) return get().refresh()
    try {
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64UrlToBytes(vapidPublicKey),
        }))
      const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
      const { error } = await supabase.rpc('save_push_subscription', {
        p_endpoint: json.endpoint,
        p_p256dh: json.keys?.p256dh,
        p_auth: json.keys?.auth,
      })
      if (error) await sub.unsubscribe()
    } catch {
      // the push service was unreachable; status below reflects what happened
    }
    return get().refresh()
  },

  /** Turns pushes off for this device (also on sign-out, ship-audit §C). */
  disable: async () => {
    const sub = await currentSubscription()
    if (sub) {
      await supabase.rpc('delete_push_subscription', { p_endpoint: sub.endpoint })
      await sub.unsubscribe()
    }
    await get().refresh()
  },

  dismiss: () => {
    try {
      window.localStorage.setItem(ASKED_KEY, '1')
    } catch {
      // ignore
    }
    set({ asked: true, prompt: null })
  },
}))
