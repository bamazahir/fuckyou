import { expect, test } from '@playwright/test'
import { mockSupabase, signIn } from './mock-supabase'

test('under-13s are blocked and their sign-in is removed', async ({ page }) => {
  const state = await mockSupabase(page)
  await signIn(page)
  await page.goto('/')
  await expect(page).toHaveURL(/\/onboarding$/)
  await page.getByLabel('Where do you live?').selectOption('GB')
  await page.getByText('Under 13').click()
  await page.getByRole('button', { name: 'Next' }).click()
  await expect(page.getByRole('heading', { name: 'Studyroom is for ages 13 and up' })).toBeVisible()
  expect(state.calls.map((c) => c.name)).toContain('reject_underage')
})

test('a new user completes onboarding and lands home', async ({ page }) => {
  const state = await mockSupabase(page)
  await signIn(page)
  await page.goto('/onboarding')
  await page.getByLabel('Where do you live?').selectOption('GB')
  await page.getByText('16–17').click()
  await page.getByRole('button', { name: 'Next' }).click()

  await page.getByLabel('Handle').fill('Ana B')
  await expect(page.getByText('Only a–z, 0–9 and _.')).toBeVisible()
  await page.getByLabel('Handle').fill('ana_b')
  await page.getByLabel('Display name').fill('Ana')
  await page.getByRole('button', { name: 'Next' }).click()

  await expect(page.getByRole('heading', { name: 'Make your bean' })).toBeVisible()
  await page.getByRole('button', { name: 'Finish' }).click()
  await expect(page.getByRole('heading', { name: 'Hi, Ana.' })).toBeVisible()

  const call = state.calls.find((c) => c.name === 'complete_profile')
  expect(call?.body).toMatchObject({
    p_handle: 'ana_b',
    p_display_name: 'Ana',
    p_country: 'GB',
    p_age_bracket: '16-17',
  })
})

test('a missing database schema shows the real error and a retry', async ({ page }) => {
  await mockSupabase(page)
  await page.route('http://supabase.test/rest/v1/profiles*', (route) =>
    route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 'PGRST205',
        message: "Could not find the table 'public.profiles' in the schema cache",
      }),
    }),
  )
  await signIn(page)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'The database isn’t set up yet' })).toBeVisible()
  await expect(page.getByText(/PGRST205: Could not find the table/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
})
