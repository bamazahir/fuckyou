import { expect, test } from '@playwright/test'
import { mockSupabase, readyProfile, sharedRoom, signIn } from './mock-supabase'

test('Rooms holds all your rooms, and Discover joins a listed one', async ({ page }) => {
  const state = await mockSupabase(page, {
    profile: readyProfile,
    rooms: [sharedRoom()],
    discover: [
      { id: 'room-maths', name: 'Maths HL', member_count: 6, studying_count: 2, sync_pomodoro: false },
    ],
  })
  await signIn(page)
  await page.goto('/')
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Rooms' }).click()
  await expect(page.getByRole('heading', { name: 'Rooms', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: /IB Chem/ })).toBeVisible()
  await page.getByRole('tab', { name: 'Discover' }).click()
  await expect(page.getByText('Maths HL')).toBeVisible()
  await expect(page.getByText('2 studying now')).toBeVisible()
  await page.getByRole('button', { name: 'Join Maths HL' }).click()
  await expect(page).toHaveURL(/\/room\/room-maths$/)
  expect(state.calls.some((c) => c.name === 'join_listed_room' && c.body.p_room_id === 'room-maths')).toBe(
    true,
  )
})

test('owners can list a room in Discover from its settings', async ({ page }) => {
  const state = await mockSupabase(page, { profile: readyProfile, rooms: [sharedRoom()] })
  await signIn(page)
  await page.goto('/room/room-chem')
  await page.getByRole('button', { name: 'Room menu' }).click()
  await page.getByRole('button', { name: 'Room settings' }).click()
  await page.getByLabel(/List in Discover/).check()
  await expect
    .poll(() => state.calls.find((c) => c.name === 'set_room_listed')?.body)
    .toEqual({
      p_room_id: 'room-chem',
      p_listed: true,
    })
})

test('Stats shows all-time totals and graphs', async ({ page }) => {
  await mockSupabase(page, {
    profile: readyProfile,
    sessions: [
      {
        id: 'h1',
        user_id: readyProfile.id,
        room_id: 'room-personal',
        sitting_id: 's',
        kind: 'pomodoro',
        status: 'completed',
        status_line: null,
        planned_seconds: 1500,
        started_at: new Date(Date.now() - 3_600_000).toISOString(),
        ended_at: new Date(Date.now() - 2_100_000).toISOString(),
        next_checkin_at: null,
        focus_seconds: 1500,
        note: 'IA draft',
        note_public: false,
      },
    ],
  })
  await signIn(page)
  await page.goto('/stats')
  await expect(page.getByRole('heading', { name: 'Stats', exact: true })).toBeVisible()
  await expect(page.getByText('Total focus')).toBeVisible()
  await expect(page.getByText('25m').first()).toBeVisible()
  for (const chart of [
    'Last 30 days',
    'Your year',
    'Time of day',
    'Day of the week',
    'Last 12 months',
    'Where you study',
  ])
    await expect(page.locator('figcaption', { hasText: chart })).toBeVisible()
  await expect(page.getByText('IA draft')).toBeVisible()
})

test('a running session can move to the room you are looking at', async ({ page }) => {
  const state = await mockSupabase(page, {
    profile: readyProfile,
    rooms: [sharedRoom({ sync_pomodoro: false })],
  })
  await signIn(page)
  await page.goto('/room/room-personal')
  await page.getByRole('radio', { name: 'Stopwatch' }).click()
  await page.getByRole('button', { name: 'Start' }).click()
  await page.goto('/room/room-chem')
  await expect(page.getByText('You’re studying in My Room.')).toBeVisible()
  await page.getByRole('button', { name: 'Move here' }).click()
  await expect(page.getByText('You’re studying in My Room.')).toBeHidden()
  expect(state.calls.find((c) => c.name === 'move_session')?.body).toEqual({ p_room_id: 'room-chem' })
})

test('the editor offers ready-made layouts and wall/floor finishes', async ({ page }) => {
  const state = await mockSupabase(page, { profile: readyProfile })
  await signIn(page)
  await page.goto('/me/decorate')
  await page.getByRole('button', { name: 'Reading nook' }).click()
  await page.getByText('Sage', { exact: true }).click()
  await page.getByText('Walnut', { exact: true }).click()
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText('Room saved')).toBeVisible()
  const saved = state.calls.find((c) => c.name === 'save_layout')?.body.p_layout as {
    item_id: string
    x: number
  }[]
  expect(saved).toContainEqual({ item_id: 'rug_stripe', x: 3, z: 3, rot: 0 })
  expect(state.calls.find((c) => c.name === 'set_room_style')?.body).toMatchObject({
    p_wall: 'sage',
    p_floor: 'walnut',
  })
})

test('an app newer than its database says so instead of failing quietly', async ({ page }) => {
  await mockSupabase(page, { profile: readyProfile })
  await page.route('**/rest/v1/rpc/my_wallet', (route) =>
    route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 'PGRST202',
        message: 'Could not find the function public.my_wallet without parameters',
      }),
    }),
  )
  await signIn(page)
  await page.goto('/shop')
  await expect(page.getByRole('alert')).toContainText('needs a database update')
})
