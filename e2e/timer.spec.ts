import { expect, test } from '@playwright/test'
import { mockSupabase, readyProfile, signIn } from './mock-supabase'

test('a pomodoro runs, ends early, takes a note and shows up in history', async ({ page }) => {
  const state = await mockSupabase(page, { profile: readyProfile })
  await signIn(page)
  await page.goto('/')
  await page.getByRole('link', { name: 'Open my room' }).click()
  await expect(page).toHaveURL(/\/room\/room-personal$/)

  await page.getByRole('radio', { name: '50 min' }).click()
  await page.getByLabel('What are you working on?').fill('HL Chem IA')
  await page.getByRole('button', { name: 'Start' }).click()

  const timer = page.getByTestId('timer')
  await expect(timer).toHaveText(/^4[89]:\d\d$/) // started a minute ago, 50-minute block
  await expect(page.getByText('HL Chem IA')).toBeVisible()
  expect(state.calls.find((c) => c.name === 'start_session')?.body).toMatchObject({
    p_kind: 'pomodoro',
    p_planned_seconds: 3000,
    p_status_line: 'HL Chem IA',
  })

  await page.getByRole('button', { name: 'End early' }).click()
  const dialog = page.getByRole('dialog', { name: 'Nice work' })
  await expect(dialog).toBeVisible()
  await dialog.getByLabel('What did you get done?').fill('finished the data table')
  await dialog.getByRole('button', { name: 'Save note' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText(/^Break · 5 min$/)).toBeVisible()

  await page.getByRole('link', { name: 'Stats' }).click()
  await expect(page.getByText('finished the data table')).toBeVisible()
})

test('a stopwatch counts up and can be ended', async ({ page }) => {
  await mockSupabase(page, { profile: readyProfile })
  await signIn(page)
  await page.goto('/room/room-personal')
  await page.getByRole('radio', { name: 'Stopwatch' }).click()
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(page.getByTestId('timer')).toHaveText(/^1:0\d$/)
  await page.getByRole('button', { name: 'End', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Nice work' })).toBeVisible()
  await page.getByRole('button', { name: 'Later' }).click()
  await expect(page.getByRole('button', { name: 'Start' })).toBeVisible()
})
