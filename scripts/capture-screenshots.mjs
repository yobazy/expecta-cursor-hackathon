import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import process from 'node:process'
import { chromium } from 'playwright'

const baseUrl = 'http://127.0.0.1:4173'
const outputDir = new URL('../docs/screenshots/', import.meta.url)

async function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(baseUrl)
      if (response.ok) return
    } catch {
      // Vite is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  throw new Error(`Timed out waiting for ${baseUrl}`)
}

await mkdir(outputDir, { recursive: true })

const server = spawn(
  'npm',
  ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '4173'],
  { detached: true, stdio: 'ignore' },
)

let browser
try {
  await waitForServer()
  browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--no-proxy-server'],
  })
  const page = await browser.newPage({
    viewport: { width: 1440, height: 960 },
    deviceScaleFactor: 1,
  })

  await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.abort())
  await page.goto(baseUrl, { waitUntil: 'commit' })
  await page.getByRole('heading', { name: 'What can we check together?' }).waitFor()
  await page.screenshot({ path: new URL('home.png', outputDir).pathname })

  await page.getByRole('button', { name: /Renewal Night Serum/ }).click()
  await page.screenshot({ path: new URL('result.png', outputDir).pathname })
} finally {
  await browser?.close()
  if (server.pid) {
    try {
      process.kill(-server.pid, 'SIGTERM')
    } catch {
      // The development server already exited.
    }
  }
}
