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

const OWNER_KEY = 'studyroom.push.owner'

/** The service worker, waiting at most `waitMs` for it (`ready` never settles without one). */
async function registration(waitMs = 0): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  try {
    const now = await navigator.serviceWorker.getRegistration()
    if (now?.active || waitMs === 0) return now ?? null
    return await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>((resolve) => window.setTimeout(() => resolve(null), waitMs)),
    ])
  } catch {
    return null
  }
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await registration()
  try {
    return (await reg?.pushManager.getSubscription()) ?? null
  } catch {
    return null
  }
}

function readOwner(): string | null {
  try {
    return window.localStorage.getItem(OWNER_KEY)
  } catch {
    return null
  }
}

function writeOwner(uid: string | null) {
  try {
    if (uid) window.localStorage.setItem(OWNER_KEY, uid)
    else window.localStorage.removeItem(OWNER_KEY)
  } catch {
    // storage blocked: the next sign-in re-binds again
  }
}

async function saveSubscription(sub: PushSubscription): Promise<boolean> {
  const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
  const { error } = await supabase.rpc('save_push_subscription', {
    p_endpoint: json.endpoint,
    p_p256dh: json.keys?.p256dh,
    p_auth: json.keys?.auth,
  })
  if (error) return false
  const { data } = await supabase.auth.getSession()
  writeOwner(data.session?.user.id ?? null)
  return true
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
  /** After sign-in: a device subscribed for another account is moved to this one (shared devices). */
  claimDevice: (uid: string) => Promise<void>
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

  claimDevice: async (uid) => {
    const sub = await currentSubscription()
    if (sub && readOwner() !== uid) await saveSubscription(sub)
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
    const reg = await registration(5_000)
    if (!reg) return get().refresh()
    try {
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64UrlToBytes(vapidPublicKey),
        }))
      if (!(await saveSubscription(sub))) await sub.unsubscribe()
      else void supabase.rpc('log_event', { p_name: 'push_enabled', p_props: {} })
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
      await sub.unsubscribe().catch(() => false)
    }
    writeOwner(null)
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
