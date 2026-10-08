import { expect, test } from '@playwright/test'

test('home renders the shell with three tabs', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Your rooms' })).toBeVisible()
  const nav = page.getByRole('navigation', { name: 'Main' })
  for (const tab of ['Home', 'My Room', 'Profile']) {
    await expect(nav.getByRole('link', { name: tab })).toBeVisible()
  }
})

test('tabs navigate between pages', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Profile' }).click()
  await expect(page).toHaveURL(/\/profile$/)
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible()
  await page.getByRole('link', { name: 'My Room' }).click()
  await expect(page.getByRole('heading', { name: 'My Room' })).toBeVisible()
})

test('unknown paths show the not-found card', async ({ page }) => {
  await page.goto('/nope')
  await expect(page.getByRole('heading', { name: 'This room does not exist' })).toBeVisible()
})

test('is installable: manifest is linked and the service worker activates', async ({ page }) => {
  await page.goto('/')
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
  const origin = new URL(baseURL ?? 'http://localhost').origin
  const foreign: string[] = []
  page.on('request', (req) => {
    const url = req.url()
    if (!url.startsWith('data:') && new URL(url).origin !== origin) foreign.push(url)
  })
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  expect(foreign).toEqual([])
})
