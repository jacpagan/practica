import { test, expect } from '@playwright/test'

test.beforeAll(async ({ request }) => {
  // Ensure a fresh build is previewed by the webServer
})

test('Privacy page renders without API and shows content', async ({ page }) => {
  await page.goto('/privacy')
  await expect(page.getByRole('heading', { name: 'Your private practice mirror' })).toBeVisible()
  await expect(page.locator('text=keep your takes private by default').first()).toBeVisible()
})

test('Library route (signed-out) shows Auth form without crashing', async ({ page }) => {
  await page.goto('/library?date=2026-04-01')
  await expect(page.getByRole('button', { name: 'Log in' }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign up' }).first()).toBeVisible()
  // Query string should be preserved by route normalization
  await expect(page).toHaveURL(/\/?\?date=/)
  // Report link available and non-crashing
  await page.getByRole('button', { name: 'Report a problem' }).click()
  // No navigation expected.
  await expect(page).toHaveURL(/\/?\?date=/)
})

test('Threads home shows grouped videos for signed-in members', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('token', 'smoke-token')
  })

  await page.route('**/api/auth/me/', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 1, username: 'smoke_member', display_name: 'Smoke Member' }),
    })
  })

  const sessions = [
    {
      id: 101,
      title: 'Kick pattern check',
      practice_series: 'Groove Lab',
      description: '',
      video_file: null,
      duration_seconds: 12,
      recorded_at: '2099-01-01T00:00:00Z',
      created_at: '2099-01-01T00:00:00Z',
      processing_status: 'ready',
      can_edit: true,
      local_preview_url: '',
      video_feedback_count: 0,
    },
    {
      id: 102,
      title: 'Hands alone',
      practice_series: '',
      description: '',
      video_file: null,
      duration_seconds: 9,
      recorded_at: '2099-01-02T00:00:00Z',
      created_at: '2099-01-02T00:00:00Z',
      processing_status: 'ready',
      can_edit: true,
      local_preview_url: '',
      video_feedback_count: 0,
    },
  ]

  await page.route('**/api/sessions/', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(sessions) })
  })
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Threads' })).toBeVisible()
  await expect(page.getByText('Groove Lab')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add to thread' }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Change thread' }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Download backup' })).toBeVisible()
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

      if (url.includes('/api/sessions/')) {
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

    mediaDevices.getUserMedia = async (constraints) => {
      const wantsVideo = Boolean(constraints?.video)
      const wantsAudio = Boolean(constraints?.audio)

      if (wantsAudio && !wantsVideo) {
        const canvas = document.createElement('canvas')
        canvas.width = 1
        canvas.height = 1
        return canvas.captureStream(1)
      }

      const canvas = document.createElement('canvas')
      canvas.width = 640
      canvas.height = 360
      const context = canvas.getContext('2d')
      context.fillStyle = '#111827'
      context.fillRect(0, 0, canvas.width, canvas.height)
      return canvas.captureStream(1)
    }

    mediaDevices.getDisplayMedia = async () => {
      const error = new Error('No real display media in smoke test')
      error.name = 'NotAllowedError'
      throw error
    }
  })

  await page.goto('/record')

  await expect(page.getByRole('heading', { name: 'Record' })).toBeVisible()
  await expect(page.getByText('Camera ready')).toBeVisible({ timeout: 10000 })
  await expect(page.getByRole('button', { name: /Add screen \(optional\)|Switch to Screen \+ Cam/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Options/i })).toBeVisible()
  await expect(page.locator('text=Camera input')).toHaveCount(0)
  await expect(page.locator('text=Microphone input')).toHaveCount(0)

  await page.getByRole('button', { name: /Options/i }).click()
  await expect(page.locator('text=Camera input').first()).toBeVisible()
  await expect(page.locator('text=Microphone input').first()).toBeVisible()
  await expect(page.locator('select').nth(0)).toContainText('Built-in Camera')
  await expect(page.locator('select').nth(1)).toContainText('Built-in Microphone')
})

test('Record route falls back when selected camera fails', async ({ browser }) => {
  const context = await browser.newContext()
  const page = await context.newPage()

  await context.addInitScript(() => {
    window.localStorage.setItem('token', 'smoke-token')
    window.localStorage.setItem('practica.recorder.videoInputId.v1', 'video-device-1')

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

    let selectedAttemptFailed = false
    mediaDevices.getUserMedia = async (constraints) => {
      const selectedCameraId = constraints?.video && typeof constraints.video === 'object'
        ? constraints.video?.deviceId?.exact
        : ''

      if (selectedCameraId === 'video-device-1' && !selectedAttemptFailed) {
        selectedAttemptFailed = true
        const error = new Error('Selected camera is busy')
        error.name = 'NotReadableError'
        throw error
      }

      const canvas = document.createElement('canvas')
      canvas.width = 640
      canvas.height = 360
      const context = canvas.getContext('2d')
      context.fillStyle = '#111827'
      context.fillRect(0, 0, canvas.width, canvas.height)
      return canvas.captureStream(1)
    }

    mediaDevices.getDisplayMedia = async () => new MediaStream()
  })

  await page.goto('/record')

  await expect(page.getByText('Camera ready')).toBeVisible({ timeout: 10000 })
  await expect(page.locator('text=Could not access camera. Please check your device.')).toHaveCount(0)

  await context.close()
})

test('Record route still opens preview when microphone fails', async ({ browser }) => {
  const context = await browser.newContext()
  const page = await context.newPage()

  await context.addInitScript(() => {
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

    mediaDevices.getUserMedia = async (constraints) => {
      const wantsVideo = Boolean(constraints?.video)
      const wantsAudio = Boolean(constraints?.audio)

      if (wantsAudio && !wantsVideo) {
        const error = new Error('Microphone is busy')
        error.name = 'NotReadableError'
        throw error
      }

      const canvas = document.createElement('canvas')
      canvas.width = 640
      canvas.height = 360
      const context2d = canvas.getContext('2d')
      context2d.fillStyle = '#111827'
      context2d.fillRect(0, 0, canvas.width, canvas.height)
      return canvas.captureStream(1)
    }
  })

  await page.goto('/record')

  await expect(page.getByText('Camera ready')).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('Microphone warning')).toBeVisible()

  await context.close()
})

test('Record route keeps Screen + Cam preview when screen audio is unavailable', async ({ browser }) => {
  const context = await browser.newContext()
  const page = await context.newPage()

  await context.addInitScript(() => {
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
      const canvas = document.createElement('canvas')
      canvas.width = 640
      canvas.height = 360
      const context2d = canvas.getContext('2d')
      context2d.fillStyle = '#111827'
      context2d.fillRect(0, 0, canvas.width, canvas.height)
      return canvas.captureStream(1)
    }

    mediaDevices.getDisplayMedia = async (constraints) => {
      const wantsAudio = Boolean(constraints?.audio)
      if (wantsAudio) {
        const error = new Error('Timed out waiting for screen capture')
        error.name = 'AbortError'
        throw error
      }
      const canvas = document.createElement('canvas')
      canvas.width = 1280
      canvas.height = 720
      const context2d = canvas.getContext('2d')
      context2d.fillStyle = '#1f2937'
      context2d.fillRect(0, 0, canvas.width, canvas.height)
      return canvas.captureStream(1)
    }
  })

  await page.goto('/record')
  await expect(page.getByText('Camera ready')).toBeVisible({ timeout: 10000 })
  await page.getByRole('button', { name: 'Add screen (optional)' }).click()

  await expect(page.getByRole('button', { name: 'Back to single-cam' })).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('Screen audio was unavailable, so this recording will use your mic audio only.')).toBeVisible()

  await context.close()
})

test('Record route shows timeout guidance when Screen + Cam cannot start', async ({ browser }) => {
  const context = await browser.newContext()
  const page = await context.newPage()

  await context.addInitScript(() => {
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
      const canvas = document.createElement('canvas')
      canvas.width = 640
      canvas.height = 360
      const context2d = canvas.getContext('2d')
      context2d.fillStyle = '#111827'
      context2d.fillRect(0, 0, canvas.width, canvas.height)
      return canvas.captureStream(1)
    }

    mediaDevices.getDisplayMedia = async () => {
      const error = new Error('Timed out waiting for screen capture')
      error.name = 'AbortError'
      throw error
    }
  })

  await page.goto('/record')
  await expect(page.getByText('Camera ready')).toBeVisible({ timeout: 10000 })
  await page.getByRole('button', { name: 'Add screen (optional)' }).click()

  await expect(page.getByText('Screen capture took too long to start. Try again, or switch to Single-cam first and then add screen.')).toBeVisible({ timeout: 10000 })
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()

  await context.close()
})

test('Upload retries once after network interruption and reuses idempotency key', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('token', 'smoke-token')
  })

  const createdSession = {
    id: 777,
    title: 'Retry-safe take',
    practice_series: '',
    description: '',
    video_file: '/media/sessions/retry-safe.mp4',
    duration_seconds: null,
    recorded_at: '2099-01-01T00:00:00Z',
    created_at: '2099-01-01T00:00:00Z',
    updated_at: '2099-01-01T00:00:00Z',
    processing_status: 'ready',
    processing_job_id: '',
    processing_error: '',
    tag_names: [],
    assets: [],
    chapters: [],
    video_feedback: [],
    active_review_link: null,
    chapter_count: 0,
    video_feedback_count: 0,
    owner: { id: 1, display_name: 'Smoke Member' },
    can_edit: true,
  }

  let uploadPostAttempts = 0
  const uploadClientIds: string[] = []

  await page.route('**/api/auth/me/', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 1, username: 'smoke_member', display_name: 'Smoke Member' }),
    })
  })

  await page.route('**/api/review-requests/?role=reviewer', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
  })

  await page.route('**/api/review-requests/?role=owner', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
  })

  await page.route('**/api/review-requests/?session_id=777&role=student', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
  })

  await page.route('**/api/connections/?role=student', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
  })

  await page.route('**/api/reviewer-invites/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
  })

  await page.route('**/api/sessions/777/', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(createdSession) })
  })

  await page.route('**/api/sessions/', async (route) => {
    const method = route.request().method()
    if (method === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
      return
    }

    if (method === 'POST') {
      uploadPostAttempts += 1
      const rawBody = route.request().postData() || ''
      const match = rawBody.match(/name="client_upload_id"\r\n\r\n([^\r\n]+)/)
      uploadClientIds.push(match?.[1] || '')

      if (uploadPostAttempts === 1) {
        await route.abort('failed')
        return
      }

      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(createdSession) })
      return
    }

    await route.continue()
  })

  await page.goto('/upload')
  await expect(page.getByRole('heading', { name: 'New take' })).toBeVisible()

  await page.locator('[aria-label="Drop a video or browse files"] input[type=file]').first().setInputFiles({
    name: 'retry-safe.mp4',
    mimeType: 'video/mp4',
    buffer: Buffer.from('smoke-video-bytes'),
  })
  await page.locator('input[type=text]').first().fill('Retry-safe take')
  await page.getByRole('button', { name: 'Save to library' }).click()

  await page.waitForURL(/\/sessions\/777$/)
  expect(uploadPostAttempts).toBe(2)
  expect(uploadClientIds[0]).toBeTruthy()
  expect(uploadClientIds[0]).toBe(uploadClientIds[1])
})

test('Session detail shows basic thread controls', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('token', 'smoke-token')
  })

  const sessionPayload = {
    id: 123,
    title: 'Smoke session',
    practice_series: 'Groove Lab',
    description: '',
    video_file: '',
    duration_seconds: null,
    recorded_at: '2099-01-01T00:00:00Z',
    created_at: '2099-01-01T00:00:00Z',
    updated_at: '2099-01-01T00:00:00Z',
    processing_status: 'ready',
    processing_job_id: '',
    processing_error: '',
    tag_names: [],
    assets: [],
    chapters: [],
    video_feedback: [],
    chapter_count: 0,
    video_feedback_count: 0,
    owner: { id: 1, display_name: 'Smoke Member' },
    can_edit: true,
  }

  await page.route('**/api/auth/me/', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 1, username: 'smoke_member', display_name: 'Smoke Member' }),
    })
  })

  await page.route('**/api/sessions/123/', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(sessionPayload),
    })
  })

  await page.goto('/sessions/123')

  await expect(page.getByText('Smoke session')).toBeVisible()
  await expect(page.getByText('Groove Lab')).toBeVisible()
  await expect(page.getByText('Video details')).toBeVisible()
  await expect(page.getByText('More options')).toBeVisible()
  await page.getByText('More options').click()
  await expect(page.getByRole('button', { name: 'Edit video' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'View thread' })).toBeVisible()
})
