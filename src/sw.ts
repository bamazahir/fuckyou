/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

declare let self: ServiceWorkerGlobalScope

void self.skipWaiting()
clientsClaim()

// App shell only. Supabase API responses are cross-origin and never cached (ship-audit §C).
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')))

// Web push (SPEC §9). Every push shows a notification: iOS revokes subscriptions that stay silent.
interface PushData {
  title?: string
  body?: string
  tag?: string
  url?: string
}

/** Only open paths in this app ("/room/…"), never another site ("//evil.example"). */
function sameOriginPath(raw: unknown): string {
  if (typeof raw !== 'string') return '/'
  try {
    const url = new URL(raw, self.location.origin)
    return url.origin === self.location.origin ? url.pathname + url.search : '/'
  } catch {
    return '/'
  }
}

self.addEventListener('push', (event) => {
  let data: PushData = {}
  try {
    data = (event.data?.json() as PushData | undefined) ?? {}
  } catch {
    data = {}
  }
  const url = sameOriginPath(data.url)
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Studyroom', {
      body: data.body ?? '',
      tag: data.tag,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const raw = (event.notification.data as { url?: unknown } | null)?.url
  const url = sameOriginPath(raw)
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin)
      if (open) {
        await open.focus()
        await open.navigate(url).catch(() => undefined)
        return
      }
      await self.clients.openWindow(url)
    })(),
  )
})
