import { expect, test } from '@playwright/test'
import { miaLive, mockSupabase, readyProfile, sharedRoom, signIn } from './mock-supabase'

test('create a room from Home and land in it', async ({ page }) => {
  const state = await mockSupabase(page, { profile: readyProfile })
  await signIn(page)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'No shared rooms yet' })).toBeVisible()
  await page.getByRole('button', { name: 'Create room' }).click()
  await page.getByLabel('Room name').fill('IB Chem crew')
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'IB Chem crew' })).toBeVisible()
  expect(state.calls.find((c) => c.name === 'create_room')?.body).toMatchObject({ p_name: 'IB Chem crew' })
})

test('the room-name field warns about unkind words before sending', async ({ page }) => {
  const state = await mockSupabase(page, { profile: readyProfile })
  await signIn(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Create room' }).click()
  await page.getByLabel('Room name').fill('sh1t room')
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText('Let’s keep it friendly. Try different words.')
  expect(state.calls.some((c) => c.name === 'create_room')).toBe(false)
})

test('room cards show who is studying', async ({ page }) => {
  await mockSupabase(page, { profile: readyProfile, rooms: [sharedRoom()] })
  await signIn(page)
  await page.goto('/')
  await expect(page.getByRole('link', { name: /IB Chem/ })).toContainText('1 studying now')
})

test('an invite link previews the room before sign-in, then joins after it', async ({ page }) => {
  const state = await mockSupabase(page)
  await page.goto('/j/AB3DK7M9')
  await expect(page.getByRole('heading', { name: 'Join IB Chem' })).toBeVisible()
  await expect(page.getByText('Mia', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Sign in to join' }).click()
  await expect(page).toHaveURL(/\/signin$/)

  // Signing in finishes the join.
  state.profile = readyProfile
  await signIn(page)
  await page.goto('/')
  await expect(page).toHaveURL(/\/room\/room-chem$/)
  expect(state.calls.some((c) => c.name === 'join_room' && c.body.p_code === 'AB3DK7M9')).toBe(true)
})

test('a dead invite link says so', async ({ page }) => {
  await mockSupabase(page)
  await page.goto('/j/ZZZZZZZZ')
  await expect(page.getByText('This invite link doesn’t work any more.')).toBeVisible()
})

test('a shared room shows live desks, leaderboard and members', async ({ page }) => {
  await mockSupabase(page, { profile: readyProfile, rooms: [sharedRoom()], live: [miaLive] })
  await signIn(page)
  await page.goto('/room/room-chem')
  await expect(page.getByRole('heading', { name: 'IB Chem' })).toBeVisible()
  const desk = page.getByRole('button', { name: /^Mia, Focusing/ })
  await expect(desk).toContainText('Kinetics')
  await expect(page.getByText('free desk').first()).toBeVisible()
  await expect(page.getByRole('list', { name: 'Week' })).toContainText('1h 30m')
  await page.getByRole('tab', { name: 'Lifetime' }).click()
  await expect(page.getByText('Every minute anywhere')).toBeVisible()
  await page.getByRole('tab', { name: 'Members' }).click()
  await expect(page.getByText('@mia')).toBeVisible()
  await desk.click()
  await expect(page.getByRole('dialog', { name: 'Mia' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Remove from room' })).toBeVisible()
})

test('alone in a room: the banner is proud, not lonely', async ({ page }) => {
  const me = { ...miaLive, user_id: readyProfile.id, display_name: 'Ana', sitting_seconds: 4320 }
  await mockSupabase(page, { profile: readyProfile, rooms: [sharedRoom()], live: [me] })
  await signIn(page)
  await page.clock.setFixedTime(new Date(2026, 9, 8, 15, 0, 0))
  await page.goto('/room/room-chem')
  await expect(page.getByText('You’ve got the room to yourself · 1h 12m')).toBeVisible()
})
