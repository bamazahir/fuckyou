import { expect, test } from '@playwright/test'
import { mockSupabase, readyProfile, signIn } from './mock-supabase'

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
