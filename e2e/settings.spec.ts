import { expect, test } from '@playwright/test'
import { mockSupabase, readyProfile, signIn } from './mock-supabase'

test('themes switch the whole app and are remembered', async ({ page }) => {
  await mockSupabase(page, { profile: readyProfile })
  await signIn(page)
  await page.goto('/profile')
  await page.getByRole('radio', { name: 'Library' }).click()
  await page.getByRole('radio', { name: 'Dark' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'library')
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark')
  // Library dark wall (after the 600ms color transition)
  await expect
    .poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor))
    .toBe('rgb(30, 58, 47)')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'library')
})

test('a pending teen asks a parent, and the parent page grants consent', async ({ page }) => {
  const state = await mockSupabase(page, { profile: { ...readyProfile, consent_status: 'pending' } })
  await signIn(page)
  await page.goto('/')
  await expect(page).toHaveURL(/\/waiting$/)
  await page.getByLabel('Parent or guardian’s email').fill('parent@example.com')
  await page.getByRole('button', { name: 'Send the request' }).click()
  await expect(page.getByRole('status')).toContainText('Sent to parent@example.com')
  expect(state.calls.find((c) => c.name === 'request_parental_consent')?.body).toMatchObject({
    p_parent_email: 'parent@example.com',
  })

  await page.goto('/consent/some-token')
  await expect(page.getByRole('heading', { name: 'Kid would like to use Studyroom' })).toBeVisible()
  await page.getByRole('button', { name: 'I’m their parent or guardian and I agree' }).click()
  await expect(page.getByText('Thank you. The account is active.')).toBeVisible()
})

test('the privacy page is public', async ({ page }) => {
  await mockSupabase(page)
  await page.goto('/privacy')
  await expect(page.getByRole('heading', { name: 'What we collect' })).toBeVisible()
})

test('deleting the account needs the handle typed out', async ({ page }) => {
  const state = await mockSupabase(page, { profile: readyProfile })
  await signIn(page)
  await page.goto('/profile')
  await page.getByRole('button', { name: 'Delete my account' }).click()
  const dialog = page.getByRole('dialog', { name: 'Delete my account' })
  const confirm = dialog.getByRole('button', { name: 'Delete forever' })
  await expect(confirm).toBeDisabled()
  await dialog.getByRole('textbox').fill('ana')
  await confirm.click()
  await expect(page).toHaveURL(/\/signin$/)
  expect(state.calls.some((c) => c.name === 'delete_my_account')).toBe(true)
})
