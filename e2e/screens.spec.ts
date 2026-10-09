import { test } from '@playwright/test'
import {
  miaLive,
  mockSupabase,
  otherAvatar,
  readyProfile,
  sharedRoom,
  signIn,
  starterInventory,
} from './mock-supabase'

// Screenshot set for the studyroom-look §4 review. Off by default: SCREENSHOTS=1 pnpm test:e2e screens
test.skip(!process.env.SCREENSHOTS, 'set SCREENSHOTS=1 to capture review screenshots')
test.setTimeout(120_000)

const THEMES = ['lamplight', 'library', 'blossom', 'observatory'] as const
const crowd = [
  miaLive,
  {
    ...miaLive,
    user_id: 'u3',
    display_name: 'Leo',
    state: 'break',
    break_until: new Date(Date.now() + 240_000).toISOString(),
    avatar: { colors: { ...otherAvatar.colors, body: '#7FB2D9', top: '#6FA06B' } },
  },
  {
    ...miaLive,
    user_id: 'u4',
    display_name: 'Noor',
    kind: 'stopwatch',
    planned_seconds: null,
    status_line: 'TOK essay',
    avatar: {
      colors: { ...otherAvatar.colors, skin: '#8A5734', hair: '#2B2622', body: '#C7A6E0', top: '#F6EFE4' },
    },
  },
]

for (const theme of THEMES) {
  for (const mode of ['light', 'dark'] as const) {
    test(`screens ${theme} ${mode}`, async ({ page }, info) => {
      const shot = (name: string) =>
        page.screenshot({
          path: `test-results/screens/${info.project.name}-${theme}-${mode}-${name}.png`,
          fullPage: true,
        })
      await page.addInitScript(
        ([t, m]) => window.localStorage.setItem('studyroom.theme', JSON.stringify({ theme: t, mode: m })),
        [theme, mode] as const,
      )
      await page.clock.setFixedTime(new Date(2026, 9, 8, mode === 'dark' ? 23 : 14, 0, 0))
      await mockSupabase(page, {
        profile: readyProfile,
        balance: 340,
        inventory: [...starterInventory, { item_id: 'crate', qty: 1 }, { item_id: 'plant_tall', qty: 1 }],
        rooms: [
          sharedRoom(),
          sharedRoom({ id: 'room-2', name: 'Maths HL', studying_count: 0, studying: [], member_count: 5 }),
        ],
        live: crowd,
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
            started_at: new Date(2026, 9, 8, 9, 0).toISOString(),
            ended_at: new Date(2026, 9, 8, 9, 25).toISOString(),
            next_checkin_at: null,
            focus_seconds: 1500,
            note: 'finished Q3 data table',
            note_public: false,
          },
          {
            id: 'h2',
            user_id: readyProfile.id,
            room_id: 'room-chem',
            sitting_id: 't',
            kind: 'stopwatch',
            status: 'completed',
            status_line: null,
            planned_seconds: null,
            started_at: new Date(2026, 9, 6, 19, 0).toISOString(),
            ended_at: new Date(2026, 9, 6, 20, 10).toISOString(),
            next_checkin_at: null,
            focus_seconds: 4200,
            note: null,
            note_public: false,
          },
        ],
      })
      await signIn(page)
      await page.goto('/')
      await page.getByText('IB Chem').first().waitFor()
      await shot('home')
      await page.goto('/room/room-chem')
      await page.getByRole('button', { name: /^Mia, Focusing/ }).waitFor()
      await page.locator('[data-scene-ready]').waitFor()
      await page.waitForTimeout(800)
      await shot('room')
      await page.goto('/me')
      await page.locator('[data-scene-ready]').waitFor()
      await page.waitForTimeout(800)
      await shot('myroom')
      await page.goto('/shop')
      await page.locator('main img').first().waitFor()
      await page.waitForTimeout(600)
      await shot('shop')
      await page.goto('/me/decorate')
      await page.locator('[data-scene-ready]').waitFor()
      await page.getByRole('button', { name: /^Crate, 1$/ }).click()
      await page.waitForTimeout(800)
      await shot('decorate')
      if (theme === 'lamplight') {
        await page.goto('/profile')
        await page.getByText('Focus, last 7 days').waitFor()
        await shot('profile')
      }
    })
  }
}
