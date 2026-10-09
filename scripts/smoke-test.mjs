// Run with MYOPIA_PLAYWRIGHT set to a Playwright package's index.mjs.
// The browser tests do not touch a user's browser profile.
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const { chromium } = await import(pathToFileURL(process.env.MYOPIA_PLAYWRIGHT).href)
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ko-KR' })
const page = await context.newPage()
const errors = []
const externalRequests = []
page.on('pageerror', error => errors.push(error.message))
page.on('request', request => { if (!request.url().startsWith('http://127.0.0.1:4173')) externalRequests.push(request.url()) })
await mkdir('artifacts/qa', { recursive: true })
try {
  await page.goto('http://127.0.0.1:4173', { waitUntil: 'networkidle' })
  assert.equal(await page.getByRole('button', { name: '각막 시뮬레이터' }).count(), 0)
  await page.screenshot({ path: 'artifacts/qa/mobile-input.png', fullPage: true })
  await page.getByRole('button', { name: '예시', exact: true }).click()
  await page.locator('.result-hero').waitFor({ state: 'visible' })
  assert.match(await page.locator('.big-reading').innerText(), /-2.25/)
  assert.match(await page.locator('.metric').nth(1).innerText(), /-2.00/)
  assert.match(await page.locator('.metric').nth(2).innerText(), /-2.13/)
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 })
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)
    assert.equal(overflow, false, `Horizontal overflow at ${width}px`)
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: 'artifacts/qa/mobile-result.png', fullPage: true })
  await page.getByRole('button', { name: '검사값 입력', exact: true }).click()
  assert.equal(await page.getByLabel('구면 SPH (D)', { exact: true }).first().inputValue(), '-2.00')
  await page.getByLabel('구면 SPH (D)', { exact: true }).first().fill('-6.00')
  await page.getByLabel('난시 CYL (D)', { exact: true }).first().fill('0')
  await page.getByRole('button', { name: '분석 결과 보기', exact: true }).click()
  assert.match(await page.locator('.result-hero').innerText(), /고도 근시/)
  assert.match(await page.locator('.notice.warning').first().innerText(), /고도 근시/)
  await context.setOffline(true)
  await page.getByRole('button', { name: '검사값 입력', exact: true }).click()
  await page.getByRole('button', { name: '새 환자', exact: true }).click()
  assert.equal(await page.getByLabel('구면 SPH (D)', { exact: true }).first().inputValue(), '')
  await page.getByRole('button', { name: '예시', exact: true }).click()
  assert.match(await page.locator('.big-reading').innerText(), /-2.25/)
  assert.deepEqual(errors, [])
  assert.deepEqual(externalRequests, [])
  console.log('PASS: mobile/desktop layout, SE, classification, navigation, reset, offline calculation, zero external requests, zero runtime errors')
} finally {
  await browser.close()
}
