import { test, expect } from '@playwright/test'

test('private video library needs no routine or activity', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('token', 'video-test'))
  await page.route('**/api/auth/me/', route => route.fulfill({ json: { id: 1, username: 'member' } }))
  await page.route('**/api/sessions/**', route => route.fulfill({ json: [] }))
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Your videos' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Start with one video' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Journal', exact: true })).toHaveCount(0)
  await expect(page.getByText('Choose what matters today')).toHaveCount(0)
  await page.getByRole('button', { name: 'Record', exact: true }).first().click()
  await expect(page).toHaveURL(/\/record/)
})
