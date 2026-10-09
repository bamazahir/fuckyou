import { expect, test } from '@playwright/test'
import { mockSupabase, readyProfile, signIn } from './mock-supabase'

test('admins see usage totals, retention and a CSV export', async ({ page }) => {
  await mockSupabase(page, { profile: { ...readyProfile, is_admin: true } })
  await signIn(page)
  await page.goto('/admin')
  await expect(page.getByRole('heading', { name: 'Admin', exact: true })).toBeVisible()
  await expect(page.getByText('Active this week').locator('..')).toContainText('5')
  await expect(page.getByRole('img', { name: 'Hours studied per week' })).toBeVisible()
  const retention = page.getByRole('table', { name: 'Retention by signup week' })
  await expect(retention).toContainText('67%')
  await expect(retention).toContainText('33%')
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download CSV' }).click()
  expect((await download).suggestedFilename()).toBe('studyroom-metrics.csv')
})

test('everyone else is sent home', async ({ page }) => {
  await mockSupabase(page, { profile: readyProfile })
  await signIn(page)
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/$/)
})
