import { test, expect } from '@playwright/test'

test('metronome plays audible ticks before camera access and stops', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('token', 'metronome-test')
    const original = AudioContext.prototype.createOscillator
    ;(window as any).ticks = 0
    AudioContext.prototype.createOscillator = function () {
      ;(window as any).ticks++
      return original.call(this)
    }
  })
  await page.route('**/api/**', route => route.fulfill({
    json: route.request().url().includes('/auth/me') ? { id: 1, username: 'member' } : [],
  }))
  await page.goto('/record')
  await page.getByRole('button', { name: /Listen to metronome/ }).click()
  await expect.poll(() => page.evaluate(() => (window as any).ticks)).toBeGreaterThan(2)
  await page.getByRole('button', { name: /Stop metronome/ }).click()
  await page.waitForTimeout(200)
  const stopped = await page.evaluate(() => (window as any).ticks)
  await page.waitForTimeout(900)
  expect(await page.evaluate(() => (window as any).ticks)).toBe(stopped)
})
