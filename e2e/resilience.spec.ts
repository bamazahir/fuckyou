import { expect, test } from '@playwright/test'
import { mockSupabase, readyProfile, sharedRoom, signIn } from './mock-supabase'

test('going offline shows a calm banner, and it goes away when back', async ({ page, context }) => {
  await mockSupabase(page, { profile: readyProfile })
  await signIn(page)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'No shared rooms yet' })).toBeVisible()
  await context.setOffline(true)
  await expect(page.getByText(/You’re offline/)).toBeVisible()
  await context.setOffline(false)
  await expect(page.getByText(/You’re offline/)).toBeHidden()
})

test('rarely used screens load on demand', async ({ page }) => {
  await mockSupabase(page, { profile: readyProfile, balance: 10 })
  await signIn(page)
  await page.goto('/shop')
  await expect(page.getByRole('heading', { name: 'Shop' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible()
})

test.describe('without a service worker', () => {
  // With the service worker the chunk would come from its precache, which is the happy path.
  test.use({ serviceWorkers: 'block' })
  test('a missing code chunk (after a deploy) offers a reload instead of a blank page', async ({ page }) => {
    await mockSupabase(page, { profile: readyProfile })
    await signIn(page)
    await page.route('**/assets/ShopPage-*.js', (route) => route.abort())
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'No shared rooms yet' })).toBeVisible()
    await page.goto('/shop')
    await expect(page.getByRole('heading', { name: 'Studyroom was updated' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Reload' })).toBeVisible()
  })
})

test('a failed load says so and retries, instead of claiming you have no rooms', async ({ page }) => {
  await mockSupabase(page, { profile: readyProfile })
  await signIn(page)
  let fail = true
  await page.route('**/rest/v1/rpc/my_rooms', (route) => (fail ? route.abort() : route.fallback()))
  await page.goto('/')
  await expect(page.getByRole('alert')).toContainText('Couldn’t load this')
  await expect(page.getByRole('heading', { name: 'No shared rooms yet' })).toHaveCount(0)
  fail = false
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByRole('heading', { name: 'No shared rooms yet' })).toBeVisible()
})

test('deleting your account only signs you out once the server has done it', async ({ page }) => {
  const state = await mockSupabase(page, { profile: readyProfile })
  await signIn(page)
  await page.route('**/rest/v1/rpc/delete_my_account', (route) => route.abort())
  await page.goto('/profile')
  await page.getByRole('button', { name: 'Delete my account' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('ana').fill('ana')
  await dialog.getByRole('button', { name: 'Delete forever' }).click()
  await expect(dialog.getByRole('alert')).toContainText('Couldn’t reach Studyroom')
  expect(state.profile).not.toBeNull()
  await expect(page).toHaveURL(/\/profile$/)
})

test('the room editor never opens on a guess when the room failed to load', async ({ page }) => {
  test.setTimeout(45_000)
  await mockSupabase(page, { profile: readyProfile, rooms: [sharedRoom()] })
  await signIn(page)
  await page.route('**/rest/v1/room_inventory*', (route) => route.abort())
  await page.goto('/room/room-chem/decorate')
  // supabase-js retries failed reads a few times before giving up.
  await expect(page.getByRole('alert')).toContainText('Couldn’t load this', { timeout: 25_000 })
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toHaveCount(0)
})
