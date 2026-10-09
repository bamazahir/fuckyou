import { expect, test } from '@playwright/test'
import { mockSupabase, readyProfile, sharedRoom, signIn } from './mock-supabase'

test('the room radio: owners pick the station, everyone plays and sets their own volume', async ({
  page,
}) => {
  const state = await mockSupabase(page, { profile: readyProfile, rooms: [sharedRoom()] })
  await signIn(page)
  await page.goto('/room/room-chem')
  await page.getByRole('tab', { name: 'Radio' }).click()
  const stations = page.getByRole('radiogroup', { name: 'Station' })
  await expect(stations.getByRole('radio', { name: /Rain/ })).toHaveAttribute('aria-checked', 'true')
  await expect(stations.getByRole('radio', { name: /Lofi/ })).toBeDisabled()
  await expect(stations.getByRole('radio', { name: /Lofi/ })).toContainText('Soon')

  await stations.getByRole('radio', { name: /Café/ }).click()
  await expect(stations.getByRole('radio', { name: /Café/ })).toHaveAttribute('aria-checked', 'true')
  expect(state.calls.find((c) => c.name === 'set_room')?.body).toEqual({
    p_room_id: 'room-chem',
    p_station_id: 'cafe',
  })

  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Pause Café' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('slider', { name: 'Volume' }).fill('0.3')
  await page.getByRole('button', { name: 'Mute' }).click()
  await expect(page.getByRole('button', { name: 'Unmute' })).toBeVisible()
  const prefs = await page.evaluate(() => window.localStorage.getItem('studyroom.radio'))
  expect(JSON.parse(prefs ?? '{}')).toEqual({ volume: 0.3, muted: true })

  // The pill in the timer dock pauses it too.
  await page.getByRole('button', { name: 'Pause Café' }).click()
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible()
})

test('members can listen but not change the station', async ({ page }) => {
  await mockSupabase(page, { profile: readyProfile, rooms: [sharedRoom({ role: 'member' })] })
  await page.route('**/rest/v1/rpc/room_members_list', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  )
  await signIn(page)
  await page.goto('/room/room-chem')
  await page.getByRole('tab', { name: 'Radio' }).click()
  await expect(page.getByText('The room’s owner or a mod picks the station.')).toBeVisible()
  await expect(page.getByRole('radio', { name: /Café/ })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled()
})

test('in your own room you pick the station, and it is remembered', async ({ page }) => {
  await mockSupabase(page, { profile: readyProfile })
  await signIn(page)
  await page.goto('/room/room-personal')
  await page.getByRole('radio', { name: /Brown noise/ }).click()
  await page.getByRole('button', { name: 'Play Brown noise' }).click()
  await expect(page.getByRole('button', { name: 'Pause Brown noise' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('radio', { name: /Brown noise/ })).toHaveAttribute('aria-checked', 'true')
  // Nothing plays until you tap (autoplay rules).
  await expect(page.getByRole('button', { name: 'Play Brown noise' })).toBeVisible()
})
