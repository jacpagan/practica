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

test('Session detail separates access from request flow', async ({ page }) => {
  // Keep the lightweight private-link access path separate from the structured feedback request flow.
  await page.addInitScript(() => {
    window.localStorage.setItem('token', 'smoke-token')
  })

  const sessionPayload = {
    id: 123,
    title: 'Smoke session',
    practice_series: '',
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
    active_review_link: null,
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

  await page.route('**/api/review-requests/?session_id=123&role=student', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    })
  })

  await page.route('**/api/review-requests/?role=reviewer', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    })
  })

  await page.route('**/api/review-requests/?role=owner', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    })
  })

  await page.route('**/api/connections/?role=student', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    })
  })

  await page.route('**/api/reviewer-invites/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    })
  })

  await page.goto('/sessions/123')

  await expect(page.locator('text=Feedback').first()).toBeVisible()
  await expect(page.locator('text=Ask one trusted person for feedback. If they are new, Practica creates the invite for you.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Ask for feedback' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Manage invites' })).toBeVisible()
  await page.getByRole('button', { name: 'Manage invites' }).click()
  await expect(page.locator('text=No reviewer invites yet.')).toBeVisible()
})

test('Session detail shows turn-off action for active outgoing request', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('token', 'smoke-token')
  })

  const sessionPayload = {
    id: 124,
    title: 'Smoke request session',
    practice_series: '',
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
    active_review_link: null,
    chapter_count: 0,
    video_feedback_count: 0,
    owner: { id: 1, display_name: 'Smoke Member' },
    can_edit: true,
  }

  const reviewRequests = [
    {
      id: 401,
      session_id: 124,
      session: { id: 124 },
      status: 'requested',
      created_at: '2099-01-01T00:00:00Z',
      updated_at: '2099-01-01T00:00:00Z',
      reviewer: { id: 2, username: 'rym', display_name: 'RyM' },
    },
  ]

  await page.route('**/api/auth/me/', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 1, username: 'smoke_member', display_name: 'Smoke Member' }),
    })
  })

  await page.route('**/api/sessions/124/', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(sessionPayload),
    })
  })

  await page.route('**/api/review-requests/?session_id=124&role=student', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(reviewRequests),
    })
  })

  await page.route('**/api/review-requests/?role=owner', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(reviewRequests),
    })
  })

  await page.route('**/api/review-requests/?role=reviewer', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    })
  })

  await page.route('**/api/connections/?role=student', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    })
  })

  await page.goto('/sessions/124')

  await expect(page.getByRole('button', { name: 'Turn off' }).first()).toBeVisible()
})

test('Ask for feedback starts with no reviewer selected on a fresh request', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('token', 'smoke-token')
  })

  const sessionPayload = {
    id: 125,
    title: 'Fresh feedback session',
    practice_series: '',
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
    active_review_link: null,
    chapter_count: 0,
    video_feedback_count: 0,
    owner: { id: 1, display_name: 'Smoke Member' },
    can_edit: true,
  }

  const reviewers = [
    { id: 1, reviewer: { id: 11, username: 'ryan', display_name: 'Ryan' }, student: { id: 1 }, pending_review_count: 0, total_review_count: 2, created_at: '2099-01-01T00:00:00Z' },
    { id: 2, reviewer: { id: 12, username: 'casey', display_name: 'Casey' }, student: { id: 1 }, pending_review_count: 0, total_review_count: 1, created_at: '2099-01-02T00:00:00Z' },
  ]

  await page.route('**/api/auth/me/', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 1, username: 'smoke_member', display_name: 'Smoke Member' }),
    })
  })

  await page.route('**/api/sessions/125/', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(sessionPayload) })
  })

  await page.route('**/api/review-requests/?session_id=125&role=student', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
  })

  await page.route('**/api/review-requests/?role=reviewer', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
  })

  await page.route('**/api/review-requests/?role=owner', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
  })

  await page.route('**/api/connections/?role=student', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(reviewers) })
  })

  await page.route('**/api/reviewer-invites/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
  })

  await page.goto('/sessions/125')
  await page.getByRole('button', { name: 'Ask for feedback' }).click()

  await expect(page.getByText('Who is this for?')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Change' })).toHaveCount(0)
  await expect(page.getByText('This will ask Ryan for private feedback.')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Copy invite link' })).toBeVisible()
})

test('Calendar day view shows review state per video', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('token', 'smoke-token')
  })

  const sessions = [
    {
      id: 201,
      title: 'Take awaiting review',
      practice_series: '',
      description: '',
      video_file: '',
      duration_seconds: null,
      recorded_at: '2026-04-09T09:00:00Z',
      created_at: '2026-04-09T09:00:00Z',
      updated_at: '2026-04-09T09:00:00Z',
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
    },
    {
      id: 202,
      title: 'Take without request',
      practice_series: '',
      description: '',
      video_file: '',
      duration_seconds: null,
      recorded_at: '2026-04-09T13:00:00Z',
      created_at: '2026-04-09T13:00:00Z',
      updated_at: '2026-04-09T13:00:00Z',
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
    },
  ]

  const reviewRequests = [
    {
      id: 301,
      session_id: 201,
      session: { id: 201 },
      status: 'requested',
      created_at: '2026-04-09T10:00:00Z',
      updated_at: '2026-04-09T10:00:00Z',
    },
  ]

  await page.route('**/api/auth/me/', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 1, username: 'smoke_member', display_name: 'Smoke Member' }),
    })
  })

  await page.route('**/api/review-requests/?role=owner', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(reviewRequests),
    })
  })

  await page.route('**/api/review-requests/?role=reviewer', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    })
  })

  await page.route(/.*\/api\/sessions\/\?start_date=2026-04-01&end_date=2026-04-30.*/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(sessions),
    })
  })

  await page.goto('/?date=2026-04-09')

  await expect(page.locator('span').filter({ hasText: 'Unthreaded' })).toHaveCount(1)
  await expect(page.locator('text=1 thread')).toHaveCount(0)
  const awaitingRow = page.getByRole('button').filter({ hasText: 'Take awaiting review' })
  const plainRow = page.getByRole('button').filter({ hasText: 'Take without request' })
  await expect(awaitingRow.locator('span').filter({ hasText: 'Awaiting review' })).toHaveCount(1)
  await expect(plainRow.locator('span').filter({ hasText: 'Awaiting review' })).toHaveCount(0)
  await expect(awaitingRow.locator('video')).toHaveCount(0)
  await expect(page.locator('text=1 awaiting review')).toHaveCount(0)
})

test('Signed-in claimed reviewer sees a clear review-join confirmation', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('token', 'smoke-token')
  })

  const reviewInfo = {
    session: {
      id: 501,
      title: 'Claimed invite take',
      practice_series: '',
      description: 'A short take for claimed reviewer confirmation.',
      video_file: '',
      duration_seconds: 120,
      recorded_at: '2099-01-01T00:00:00Z',
      assets: [],
      processing_status: 'ready',
      processing_job_id: '',
      processing_error: '',
    },
    link: {
      token: 'CLAIMTOKEN',
      expires_at: '2099-01-08T00:00:00Z',
      is_active: true,
      allow_video_feedback: true,
      url: 'https://practica.jpagan.com/r/CLAIMTOKEN',
    },
    auth_required: true,
    review_request: null,
    feedback_request: null,
    reviewer_invite: {
      id: 91,
      status: 'claimed',
      intent: 'lightweight_review',
      claim_code: 'CLAIM123',
      invite_url: 'https://practica.jpagan.com/r/CLAIMTOKEN?claim=CLAIM123',
    },
  }

  await page.route('**/api/auth/me/', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 2, username: 'claimed_reviewer', display_name: 'Claimed Reviewer' }),
    })
  })

  await page.route('**/api/review/CLAIMTOKEN/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(reviewInfo),
    })
  })

  await page.route('**/api/review/CLAIMTOKEN/feedback/', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    })
  })

  await page.route('**/api/review-requests/?role=reviewer', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    })
  })

  await page.route('**/api/review-requests/?role=owner', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    })
  })

  await page.route('**/api/feedback-templates/', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    })
  })

  await page.goto('/r/CLAIMTOKEN?claim=CLAIM123')

  await expect(page.getByText('You’re in')).toBeVisible()
  await expect(page.getByText('You can review this take privately now, and this learner can ask you again later without sending a brand-new invite.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Dismiss' })).toBeVisible()
})
