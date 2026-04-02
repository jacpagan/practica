import { test, expect } from '@playwright/test'

test.beforeAll(async ({ request }) => {
  // Ensure a fresh build is previewed by the webServer
})

test('Privacy page renders without API and shows content', async ({ page }) => {
  await page.goto('/privacy')
  await expect(page.getByRole('heading', { name: 'Private by default' })).toBeVisible()
})

test('Library route (signed-out) shows Auth form without crashing', async ({ page }) => {
  await page.goto('/library?date=2026-04-01')
  await expect(page.getByRole('button', { name: 'Log in' }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign up' }).first()).toBeVisible()
})

test('Requests route (signed-out) shows Auth form', async ({ page }) => {
  await page.goto('/requests')
  await expect(page.getByRole('button', { name: 'Log in' }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign up' }).first()).toBeVisible()
})

test('Review route handles missing backend gracefully', async ({ page }) => {
  await page.goto('/r/TESTTOKEN')
  // Should show the private feedback header or a friendly error, not a crash
  await expect(page.locator('text=Private feedback link').first()).toBeVisible()
})
