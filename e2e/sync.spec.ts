import { expect, test } from '@playwright/test'
import { mockSupabase, noSync, readyProfile, sharedRoom, signIn } from './mock-supabase'

const syncOn = (minutesIn: number) => ({
  ...noSync,
  sync_pomodoro: true,
  sync_epoch: new Date(Date.now() - minutesIn * 60_000).toISOString(),
})

test('in a shared-pomodoro room, Start joins the current focus', async ({ page }) => {
  const state = await mockSupabase(page, {
    profile: readyProfile,
    rooms: [sharedRoom({ sync_pomodoro: true })],
    roomInfo: syncOn(10),
  })
  await signIn(page)
  await page.goto('/room/room-chem')
  await expect(page.getByTestId('sync-phase')).toContainText(/Focus · 1[45]:\d\d left/)
  await expect(page.getByRole('radio', { name: 'Stopwatch' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Join this focus' }).click()
  await expect
    .poll(() => state.calls.find((c) => c.name === 'start_session')?.body)
    .toMatchObject({
      p_kind: 'pomodoro',
      p_planned_seconds: null,
    })
})

test('late in a focus, or on the shared break, you join the next one', async ({ page }) => {
  await mockSupabase(page, {
    profile: readyProfile,
    rooms: [sharedRoom({ sync_pomodoro: true })],
    roomInfo: syncOn(27),
  })
  await signIn(page)
  await page.goto('/room/room-chem')
  await expect(page.getByTestId('sync-phase')).toContainText('Break together')
  await expect(page.getByText('Shared break: say hi with a reaction.')).toBeVisible()
  await page.getByRole('button', { name: /^Join the next focus in/ }).click()
  await expect(page.getByText(/You’re in. Starting in/)).toBeVisible()
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByRole('button', { name: /^Join the next focus in/ })).toBeVisible()
})

test('home shows which rooms run a shared pomodoro', async ({ page }) => {
  await mockSupabase(page, { profile: readyProfile, rooms: [sharedRoom({ sync_pomodoro: true })] })
  await signIn(page)
  await page.goto('/')
  await expect(page.getByRole('link', { name: /IB Chem/ })).toContainText('Shared pomodoro')
})
