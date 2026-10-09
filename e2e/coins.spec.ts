import { expect, test } from '@playwright/test'
import {
  miaLive,
  mockSupabase,
  noSync,
  readyProfile,
  sharedRoom,
  signIn,
  starterInventory,
} from './mock-supabase'

test('saving a note pays coins', async ({ page }) => {
  const state = await mockSupabase(page, { profile: readyProfile })
  await signIn(page)
  await page.goto('/room/room-personal')
  await page.getByRole('button', { name: 'Start' }).click()
  await page.getByRole('button', { name: 'End early' }).click()
  const dialog = page.getByRole('dialog', { name: 'Nice work' })
  await expect(dialog).toContainText('Save a note to earn 1 coin')
  await dialog.getByLabel('What did you get done?').fill('flashcards')
  await dialog.getByRole('button', { name: 'Save note' }).click()
  await expect(page.getByText('+1 coin', { exact: true })).toBeVisible()
  expect(state.balance).toBe(1)
})

test('the shop spends coins and shows what you own', async ({ page }) => {
  const state = await mockSupabase(page, { profile: readyProfile, balance: 100 })
  await signIn(page)
  await page.goto('/me')
  await expect(page.getByTestId('balance')).toHaveText('100 coins')
  await page.getByRole('link', { name: 'Shop' }).click()
  await page.getByRole('button', { name: 'Buy Crate, 30' }).click()
  await expect(page.getByText('Crate is yours')).toBeVisible()
  await expect(page.getByTestId('funds')).toHaveText('70 coins')
  expect(state.calls.find((c) => c.name === 'buy_item')?.body).toMatchObject({ p_item_id: 'crate' })
  // Too expensive things can't be bought.
  await page.getByRole('tab', { name: 'Accessories' }).click()
  await expect(page.getByRole('button', { name: 'Buy Cat ears, 400' })).toBeDisabled()
})

test('decorating places a thing from your tray and saves the layout', async ({ page }) => {
  const state = await mockSupabase(page, {
    profile: readyProfile,
    inventory: [...starterInventory, { item_id: 'crate', qty: 1 }],
  })
  await signIn(page)
  await page.goto('/me')
  await page.getByRole('link', { name: 'Decorate' }).click()
  await expect(page.getByRole('heading', { name: 'Decorate' })).toBeVisible()
  await expect(page.locator('canvas').first()).toBeVisible()
  await page.getByRole('button', { name: 'Crate, 1' }).click()
  await page.getByRole('button', { name: 'Place', exact: true }).click()
  await expect(page.getByText('Everything is placed. Buy more in the shop.')).toBeVisible()
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText('Room saved')).toBeVisible()
  await expect(page).toHaveURL(/\/me$/)
  const saved = state.calls.find((c) => c.name === 'save_layout')?.body
  expect(saved).toMatchObject({ p_room_id: 'room-personal' })
  expect(saved?.p_layout).toContainEqual({ item_id: 'crate', x: 4, z: 4, rot: 0 })
  expect(saved?.p_layout).toHaveLength(7)
})

test('anyone in a room can give coins to its bank', async ({ page }) => {
  const state = await mockSupabase(page, {
    profile: readyProfile,
    rooms: [sharedRoom({ role: 'member' })],
    balance: 80,
  })
  await signIn(page)
  await page.goto('/room/room-chem')
  await page.getByRole('button', { name: 'Room menu' }).click()
  await expect(page.getByTestId('room-bank')).toHaveText('Room bank: 0 coins')
  await page.getByRole('button', { name: 'Give coins to the room' }).click()
  await page.getByLabel('How many coins?').fill('30')
  await page.getByRole('button', { name: 'Give', exact: true }).click()
  await expect(page.getByText('You gave 30 coins')).toBeVisible()
  expect(state.calls.find((c) => c.name === 'donate')?.body).toEqual({ p_room_id: 'room-chem', p_amount: 30 })
  expect(state.balance).toBe(50)
})

test('owners spend the room bank in the room shop', async ({ page }) => {
  const state = await mockSupabase(page, {
    profile: readyProfile,
    rooms: [sharedRoom()],
    roomInfo: { ...noSync, bank_coins: 50 },
  })
  await signIn(page)
  await page.goto('/room/room-chem')
  await page.getByRole('button', { name: 'Room menu' }).click()
  await page.getByRole('link', { name: 'Room shop' }).click()
  await expect(page.getByRole('heading', { name: 'Shop for IB Chem' })).toBeVisible()
  await expect(page.getByTestId('funds')).toHaveText('Room bank: 50 coins')
  await page.getByRole('button', { name: 'Buy Crate, 30' }).click()
  await expect(page.getByText('Crate added to the room')).toBeVisible()
  await expect(page.getByTestId('funds')).toHaveText('Room bank: 20 coins')
  expect(state.calls.find((c) => c.name === 'room_buy_item')?.body).toMatchObject({
    p_room_id: 'room-chem',
    p_item_id: 'crate',
  })
})

test('you can visit a roommate’s room from their card', async ({ page }) => {
  await mockSupabase(page, { profile: readyProfile, rooms: [sharedRoom()], live: [miaLive] })
  await signIn(page)
  await page.goto('/room/room-chem')
  await page.getByRole('button', { name: /^Mia, Focusing/ }).click()
  await page.getByRole('dialog', { name: 'Mia' }).getByRole('link', { name: 'Visit room' }).click()
  await expect(page.getByRole('heading', { name: 'Mia’s room' })).toBeVisible()
  await expect(page.locator('canvas').first()).toBeVisible()
})

test('things can be placed with the keyboard too', async ({ page }) => {
  const state = await mockSupabase(page, {
    profile: readyProfile,
    inventory: [...starterInventory, { item_id: 'crate', qty: 1 }],
  })
  await signIn(page)
  await page.goto('/me/decorate')
  await page.getByRole('button', { name: 'Crate, 1' }).click()
  const scene = page.getByRole('group', { name: /arrow keys move it/ })
  await scene.focus()
  await page.keyboard.press('ArrowLeft')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText('Room saved')).toBeVisible()
  expect(state.calls.find((c) => c.name === 'save_layout')?.body.p_layout).toContainEqual({
    item_id: 'crate',
    x: 3,
    z: 5,
    rot: 0,
  })
})
