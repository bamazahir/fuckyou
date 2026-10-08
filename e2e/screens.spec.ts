import { test } from '@playwright/test'
import { mockSupabase, readyProfile, signIn } from './mock-supabase'

// Screenshot set for the studyroom-look §4 review. Off by default: SCREENSHOTS=1 pnpm test:e2e screens
test.skip(!process.env.SCREENSHOTS, 'set SCREENSHOTS=1 to capture review screenshots')

for (const hour of [14, 23]) {
  const when = hour === 14 ? 'day' : 'night'

  test(`screens (${when})`, async ({ page }, info) => {
    const shot = (name: string) =>
      page.screenshot({ path: `test-results/screens/${info.project.name}-${when}-${name}.png` })
    await page.clock.setFixedTime(new Date(2026, 9, 8, hour, 0, 0))

    await mockSupabase(page)
    await page.goto('/signin')
    await shot('01-signin')

    await page.unrouteAll()
    await mockSupabase(page)
    await signIn(page)
    await page.goto('/onboarding')
    await page.getByLabel('Where do you live?').selectOption('GB')
    await page.getByText('16–17').click()
    await shot('02-onboarding-age')
    await page.getByRole('button', { name: 'Next' }).click()
    await page.getByLabel('Handle').fill('ana')
    await page.getByLabel('Display name').fill('Ana')
    await page.getByRole('button', { name: 'Next' }).click()
    await shot('03-onboarding-bean')

    await page.unrouteAll()
    await mockSupabase(page, { profile: readyProfile })
    await page.goto('/')
    await shot('04-home')
    await page.goto('/room/room-personal')
    await shot('05-room-idle')
    await page.getByLabel('What are you working on?').fill('HL Chem IA — data analysis')
    await page.getByRole('button', { name: 'Start' }).click()
    await page.getByTestId('timer').waitFor()
    await shot('06-room-running')
    await page.getByRole('button', { name: 'End early' }).click()
    await page.getByRole('dialog').waitFor()
    await shot('07-end-sheet')
    await page.getByLabel('What did you get done?').fill('finished the data table')
    await page.getByRole('button', { name: 'Save note' }).click()
    await shot('08-break')
    await page.goto('/profile')
    await page.getByText('finished the data table').waitFor()
    await shot('09-profile')
  })
}
