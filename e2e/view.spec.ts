import { expect, test } from '@playwright/test'
import { miaLive, mockSupabase, readyProfile, sharedRoom, signIn, USER_ID } from './mock-supabase'

test('the room turns, zooms and resets', async ({ page }) => {
  await mockSupabase(page, { profile: readyProfile })
  await signIn(page)
  await page.goto('/me')
  const scene = page.locator('[data-scene-ready]').first()
  await expect(scene).toHaveAttribute('data-turn', '0')
  const view = page.getByRole('toolbar', { name: 'Room view' })
  await view.getByRole('button', { name: 'Turn the room right' }).click()
  await expect(scene).toHaveAttribute('data-turn', '1')
  await view.getByRole('button', { name: 'Turn the room left' }).click()
  await view.getByRole('button', { name: 'Turn the room left' }).click()
  await expect(scene).toHaveAttribute('data-turn', '3')
  await expect(view.getByRole('button', { name: 'Zoom out' })).toBeDisabled()
  await view.getByRole('button', { name: 'Zoom in' }).click()
  await expect(view.getByRole('button', { name: 'Zoom out' })).toBeEnabled()
  await view.getByRole('button', { name: 'Reset the view' }).click()
  await expect(scene).toHaveAttribute('data-turn', '0')
  await expect(view.getByRole('button', { name: 'Reset the view' })).toHaveCount(0)
  await expect(view.getByRole('button', { name: 'Zoom out' })).toBeDisabled()
})

test('you can move to another chair in your own room, and it is remembered', async ({ page }) => {
  await mockSupabase(page, { profile: readyProfile })
  await signIn(page)
  await page.goto('/me')
  await page.getByRole('button', { name: 'Move to the next free chair' }).click()
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem('studyroom.seat.personal')))
    .toBe('1')
  await page.reload()
  await page.getByRole('button', { name: 'Move to the next free chair' }).click()
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem('studyroom.seat.personal')))
    .toBe('0')
})

test('in a shared room your chair choice goes to the server', async ({ page }) => {
  const meLive = { ...miaLive, user_id: USER_ID, display_name: 'Sam', status_line: null }
  const state = await mockSupabase(page, {
    profile: readyProfile,
    rooms: [sharedRoom()],
    live: [{ ...miaLive, seat: 1 }, meLive],
  })
  await signIn(page)
  await page.goto('/room/room-chem')
  await page.getByRole('button', { name: 'Move to the next free chair' }).click()
  await expect.poll(() => state.calls.find((c) => c.name === 'choose_seat')?.body).toBeTruthy()
  // Mia is in chair 1, so the next free one after yours (0) is 2.
  expect(state.calls.find((c) => c.name === 'choose_seat')?.body).toEqual({
    p_room_id: 'room-chem',
    p_seat: 2,
  })
})

test('you need to be studying in a shared room to take a chair', async ({ page }) => {
  await mockSupabase(page, { profile: readyProfile, rooms: [sharedRoom()], live: [miaLive] })
  await signIn(page)
  await page.goto('/room/room-chem')
  await page.getByRole('button', { name: 'Move to the next free chair' }).click()
  await expect(page.getByText('Start your timer here to take a chair.')).toBeVisible()
})

test('a one-tap look sets the walls and floor together', async ({ page }) => {
  const state = await mockSupabase(page, { profile: readyProfile })
  await signIn(page)
  await page.goto('/me/decorate')
  await page.getByRole('button', { name: 'Lounge' }).click()
  const look = page.getByRole('button', { name: 'Studio' })
  await look.click()
  await expect(look).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('radio', { name: 'Charcoal' })).toBeChecked()
  await expect(page.getByRole('radio', { name: 'Ebony' })).toBeChecked()
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText('Room saved')).toBeVisible()
  expect(state.calls.find((c) => c.name === 'set_room_style')?.body).toMatchObject({
    p_wall: 'charcoal',
    p_floor: 'ebony',
  })
  expect(state.calls.find((c) => c.name === 'save_layout')?.body.p_layout).toContainEqual({
    item_id: 'beanbag',
    x: 4,
    z: 4,
    rot: 0,
  })
})
