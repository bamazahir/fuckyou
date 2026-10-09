import { defineConfig, devices } from '@playwright/test'

const PORT = 4173

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    // Software WebGL so the isometric scene renders in headless runs (CI has no GPU).
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
  },
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    // Built against a fake Supabase origin that every spec intercepts (e2e/mock-supabase.ts).
    command: `pnpm build && pnpm preview --port ${PORT} --strictPort`,
    env: {
      VITE_SUPABASE_URL: 'http://supabase.test',
      VITE_SUPABASE_ANON_KEY: 'e2e-anon-key',
      // A throwaway public key: push subscribe is stubbed in e2e/push.spec.ts.
      VITE_VAPID_PUBLIC_KEY:
        'BBOPQwJRHm_3e2N2nzGknTYXP67uPp9y8r5o9PUer20BcPM2aPXbsiWubU53bX8UC86Dmx7URGHTAZ-jj09CmYs',
    },
    port: PORT,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
