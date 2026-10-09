import { expect, test, type Page } from '@playwright/test'
import { mockSupabase, readyProfile, sharedRoom, signIn } from './mock-supabase'

/** Fakes the browser push stack: permission prompt answers "allow", subscribe returns a fixed endpoint. */
async function stubPush(page: Page) {
  await page.addInitScript(() => {
    let sub: unknown = null
    const fake = {
      endpoint: 'https://fcm.googleapis.com/fcm/send/e2e-device',
      toJSON: () => ({
        endpoint: 'https://fcm.googleapis.com/fcm/send/e2e-device',
        keys: { p256dh: 'B'.repeat(87), auth: 'A'.repeat(22) },
      }),
      unsubscribe: async () => {
        sub = null
        return true
      },
    }
    let permission: NotificationPermission = 'default'
    Object.defineProperty(Notification, 'permission', { get: () => permission })
    Notification.requestPermission = async () => {
      permission = 'granted'
      return permission
    }
    PushManager.prototype.getSubscription = async function () {
      return sub as PushSubscription | null
    }
    PushManager.prototype.subscribe = async function () {
      sub = fake
      return fake as unknown as PushSubscription
    }
  })
}

test('the first pomodoro asks once about notifications, and sign-out removes the device', async ({
  page,
}) => {
  await stubPush(page)
  const state = await mockSupabase(page, { profile: readyProfile })
  await signIn(page)
  await page.goto('/room/room-personal')
  await page.getByRole('button', { name: 'Start' }).click()
  const sheet = page.getByRole('dialog', { name: 'Get a ping when it’s break time?' })
  await expect(sheet).toBeVisible()
  await sheet.getByRole('button', { name: 'Turn on' }).click()
  await expect(sheet).toBeHidden()
  await expect
    .poll(() => state.calls.find((c) => c.name === 'save_push_subscription')?.body)
    .toMatchObject({
      p_endpoint: 'https://fcm.googleapis.com/fcm/send/e2e-device',
    })

  // Client-side navigation keeps the stubbed subscription alive.
  await page.getByRole('link', { name: 'You' }).click()
  await expect(page.getByTestId('push-status')).toHaveText('On for this device.')
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect.poll(() => state.calls.some((c) => c.name === 'delete_push_subscription')).toBe(true)
})

test('"Not now" means the timer never asks again', async ({ page }) => {
  await stubPush(page)
  await mockSupabase(page, { profile: readyProfile })
  await signIn(page)
  await page.goto('/room/room-personal')
  await page.getByRole('button', { name: 'Start' }).click()
  await page.getByRole('button', { name: 'Not now' }).click()
  await page.getByRole('button', { name: 'End early' }).click()
  await page.getByRole('button', { name: 'Later' }).click()
  await page.getByRole('button', { name: 'Start next focus' }).click()
  await expect(page.getByRole('button', { name: 'End early' })).toBeVisible()
  await expect(page.getByRole('dialog', { name: 'Get a ping when it’s break time?' })).toHaveCount(0)
})

test.describe('on an iPhone outside the Home Screen', () => {
  test.use({
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  })

  test('explains Add to Home Screen instead of asking', async ({ page }) => {
    await mockSupabase(page, { profile: readyProfile })
    await signIn(page)
    await page.goto('/room/room-personal')
    await page.getByRole('button', { name: 'Start' }).click()
    const sheet = page.getByRole('dialog', { name: 'Add Studyroom to your Home Screen' })
    await expect(sheet).toContainText('Add to Home Screen')
  })
})

test('a room member can ask to hear when the room is active', async ({ page }) => {
  await stubPush(page)
  const state = await mockSupabase(page, { profile: readyProfile, rooms: [sharedRoom()] })
  await signIn(page)
  await page.goto('/room/room-chem')
  await page.getByRole('button', { name: 'Room menu' }).click()
  await page.getByLabel('Tell me when someone starts studying here').check()
  await expect
    .poll(() => state.calls.find((c) => c.name === 'set_room_notify')?.body)
    .toMatchObject({ p_on: true })
  await expect(page.getByRole('dialog', { name: 'Turn on notifications?' })).toBeVisible()
})

test('break-time pushes can be switched off in Profile', async ({ page }) => {
  const state = await mockSupabase(page, { profile: readyProfile })
  await signIn(page)
  await page.goto('/profile')
  await page.getByLabel('Break time').uncheck()
  await expect
    .poll(() => state.calls.find((c) => c.name === 'PATCH profiles')?.body)
    .toMatchObject({ settings: { notify: { phase_end: false } } })
})
