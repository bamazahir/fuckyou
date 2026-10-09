import { expect, test } from '@playwright/test'
import { mockSupabase, readyProfile, signIn } from './mock-supabase'

test('My Room shows your bean in the 3D room and lets you recolor it', async ({ page }) => {
  const state = await mockSupabase(page, { profile: readyProfile })
  await signIn(page)
  await page.goto('/me')
  await expect(page.getByRole('heading', { name: 'My Room' })).toBeVisible()
  await expect(page.locator('canvas')).toBeVisible()
  await expect(page.getByRole('button', { name: /^Ana, / })).toBeVisible()

  await page.getByRole('button', { name: 'Change bean' }).click()
  const dialog = page.getByRole('dialog', { name: 'Your bean' })
  await dialog.locator('label.swatch', { has: page.getByLabel('Hair #C2523C') }).click()
  await dialog.getByText('Curly', { exact: true }).click()
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Bean updated')).toBeVisible()
  const patch = state.calls.find((c) => c.name === 'PATCH profiles')
  expect(patch?.body).toMatchObject({ avatar: { hair: 'curly', colors: { hair: '#C2523C' } } })
})

test('Study here opens your personal room with the timer', async ({ page }) => {
  await mockSupabase(page, { profile: readyProfile })
  await signIn(page)
  await page.goto('/me')
  await page.getByRole('link', { name: 'Study here' }).click()
  await expect(page).toHaveURL(/\/room\/room-personal$/)
  await expect(page.getByRole('button', { name: 'Start' })).toBeVisible()
})
