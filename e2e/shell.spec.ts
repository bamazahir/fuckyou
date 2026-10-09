import { expect, test } from '@playwright/test'
import { mockSupabase, readyProfile, signIn, SUPABASE_URL } from './mock-supabase'

test('signed-out visitors land on sign-in', async ({ page }) => {
  await mockSupabase(page)
  await page.goto('/')
  await expect(page).toHaveURL(/\/signin$/)
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible()
  await page.getByLabel('Email').fill('ana@example.com')
  await page.getByRole('button', { name: 'Email me a sign-in link' }).click()
  await expect(page.getByText(/Check ana@example.com/)).toBeVisible()
})

test('signed-in users see the five tabs and can navigate', async ({ page }) => {
  await mockSupabase(page, { profile: readyProfile })
  await signIn(page)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Hi, Ana.' })).toBeVisible()
  const nav = page.getByRole('navigation', { name: 'Main' })
  for (const tab of ['Home', 'Rooms', 'My Room', 'Stats', 'You'])
    await expect(nav.getByRole('link', { name: tab })).toBeVisible()
  await nav.getByRole('link', { name: 'You' }).click()
  await expect(page.getByRole('heading', { name: 'Ana', exact: true })).toBeVisible()
})

test('unknown paths show the not-found card', async ({ page }) => {
  await mockSupabase(page, { profile: readyProfile })
  await signIn(page)
  await page.goto('/nope')
  await expect(page.getByRole('heading', { name: 'This room does not exist' })).toBeVisible()
})

test('is installable: manifest is linked and the service worker activates', async ({ page }) => {
  await mockSupabase(page)
  await page.goto('/signin')
  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href')
  expect(manifestHref).toBe('/manifest.webmanifest')
  const manifest = await (await page.request.get('/manifest.webmanifest')).json()
  expect(manifest.display).toBe('standalone')
  expect(manifest.icons.some((i: { sizes: string }) => i.sizes === '512x512')).toBe(true)
  await page.evaluate(() => navigator.serviceWorker.ready)
  await expect
    .poll(() => page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.active?.state))
    .toBe('activated')
})

test('makes no requests to third-party hosts', async ({ page, baseURL }) => {
  await mockSupabase(page, { profile: readyProfile })
  await signIn(page)
  const allowed = new Set([new URL(baseURL ?? 'http://localhost').origin, new URL(SUPABASE_URL).origin])
  const foreign: string[] = []
  page.on('request', (req) => {
    const url = req.url()
    if (!url.startsWith('data:') && !allowed.has(new URL(url).origin)) foreign.push(url)
  })
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  expect(foreign).toEqual([])
})
