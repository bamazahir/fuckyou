// Renders public/icons/icon.svg to the PNG sizes the PWA manifest and iOS need.
// Usage: node scripts/assets/icons.mjs   (uses Playwright's Chromium)
import { chromium } from '@playwright/test'
import { readFile } from 'node:fs/promises'

const svg = await readFile(new URL('../../public/icons/icon.svg', import.meta.url), 'utf8')
const out = (name) => new URL(`../../public/icons/${name}`, import.meta.url).pathname

// Maskable icons need the art inside the central 80% safe zone.
const targets = [
  { name: 'icon-192.png', size: 192, pad: 0 },
  { name: 'icon-512.png', size: 512, pad: 0 },
  { name: 'apple-touch-icon.png', size: 180, pad: 0 },
  { name: 'icon-maskable-512.png', size: 512, pad: 0.1 },
]

const browser = await chromium.launch()
const page = await browser.newPage()
for (const t of targets) {
  const inner = Math.round(t.size * (1 - t.pad * 2))
  await page.setViewportSize({ width: t.size, height: t.size })
  await page.setContent(
    `<body style="margin:0;background:#2F3A5C;display:grid;place-items:center;height:100vh">
       <div style="width:${inner}px;height:${inner}px">${svg.replace('<svg ', '<svg width="100%" height="100%" ')}</div>
     </body>`,
  )
  await page.screenshot({ path: out(t.name) })
  console.log('wrote', t.name)
}
await browser.close()
