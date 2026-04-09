import { test, expect } from '@playwright/test'

test.beforeAll(async ({ request }) => {
  // Ensure a fresh build is previewed by the webServer
})

test('Privacy page renders without API and shows content', async ({ page }) => {
  await page.goto('/privacy')
  await expect(page.getByRole('heading', { name: 'Your private practice mirror' })).toBeVisible()
  await expect(page.locator('text=private self-review first').first()).toBeVisible()
})

test('Library route (signed-out) shows Auth form without crashing', async ({ page }) => {
  await page.goto('/library?date=2026-04-01')
  await expect(page.getByRole('button', { name: 'Log in' }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign up' }).first()).toBeVisible()
  // Query string should be preserved by route normalization
  await expect(page).toHaveURL(/\/?\?date=/)
  // Report link available and non-crashing
  await page.getByRole('button', { name: 'Report a problem' }).click()
  // No navigation expected, still focused day on calendar
  await expect(page).toHaveURL(/\/?\?date=/)
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

test('Record route shows camera and microphone selectors for signed-in members', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('token', 'smoke-token')

    const originalFetch = window.fetch.bind(window)
    window.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input)

      if (url.includes('/api/auth/me/')) {
        return new Response(JSON.stringify({ id: 1, username: 'smoke_member', display_name: 'Smoke Member' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      if (url.includes('/api/review-requests/')) {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      return originalFetch(input, init)
    }

    const mediaDevices = navigator.mediaDevices
    if (!mediaDevices) return

    mediaDevices.enumerateDevices = async () => ([
      {
        deviceId: 'video-device-1',
        kind: 'videoinput',
        label: 'Built-in Camera',
        groupId: 'group-video',
        toJSON() { return this },
      },
      {
        deviceId: 'audio-device-1',
        kind: 'audioinput',
        label: 'Built-in Microphone',
        groupId: 'group-audio',
        toJSON() { return this },
      },
    ])

    mediaDevices.getUserMedia = async () => {
      const error = new Error('No real media in smoke test')
      error.name = 'NotAllowedError'
      throw error
    }

    mediaDevices.getDisplayMedia = async () => {
      const error = new Error('No real display media in smoke test')
      error.name = 'NotAllowedError'
      throw error
    }
  })

  await page.goto('/record')

  await expect(page.getByRole('heading', { name: 'Record' })).toBeVisible()
  await expect(page.locator('text=Camera input').first()).toBeVisible()
  await expect(page.locator('text=Microphone input').first()).toBeVisible()
  await expect(page.locator('select').nth(0)).toContainText('Built-in Camera')
  await expect(page.locator('select').nth(1)).toContainText('Built-in Microphone')
})
