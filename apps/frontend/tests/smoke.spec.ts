import { test, expect } from '@playwright/test'

test.beforeAll(async ({ request }) => {
  // Ensure a fresh build is previewed by the webServer
})

test('Privacy page renders without API and shows content', async ({ page }) => {
  await page.goto('/privacy')
  await expect(page.getByRole('heading', { name: 'Your private proof archive' })).toBeVisible()
  await expect(page.locator('text=keep your proofs private by default').first()).toBeVisible()
})

test('Library route (signed-out) shows Auth form without crashing', async ({ page }) => {
  await page.goto('/library?date=2026-04-01')
  await expect(page.getByRole('button', { name: 'Log in' }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign up' }).first()).toBeVisible()
  // Legacy routes normalize to Today.
  await expect(page).toHaveURL(/\/today/)
  // Report link available and non-crashing
  await page.getByRole('button', { name: 'Report a problem' }).click()
  // No navigation expected.
  await expect(page).toHaveURL(/\/today/)
})

test('Progress view shows grouped proofs for signed-in members', async ({ page }) => {
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

  const todayRecordedAt = new Date()
  todayRecordedAt.setHours(9, 30, 0, 0)

  const sessions = [
    {
      id: 101,
      title: 'Kick pattern check',
      practice_series: 'Groove Lab',
      description: '',
      video_file: null,
      duration_seconds: 12,
      recorded_at: todayRecordedAt.toISOString(),
      created_at: todayRecordedAt.toISOString(),
      processing_status: 'ready',
      poster_image_url: '/media/processed/sessions/101/thumbs/poster.jpg',
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

  await page.route('**/api/sessions/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(sessions) })
  })
  await page.goto('/progress')

  await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible()
  await expect(page.getByText('Today’s practice')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Try it once more' })).toBeVisible()
  await expect(page.getByText("Today's proof").first()).toBeVisible()
  await expect(page.getByText('Activity & overview')).toHaveCount(0)
  await expect(page.getByText('Full archive')).toBeVisible()
  await expect(page.getByRole('button', { name: /Groove Lab 1 proof/ })).toBeVisible()
})

test('Progress is the default signed-in home without dashboard chrome', async ({ page }) => {
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
      id: 201,
      title: 'Daily groove check',
      practice_series: 'Groove Lab',
      description: '',
      video_file: null,
      duration_seconds: 12,
      recorded_at: '2099-01-03T00:00:00Z',
      created_at: '2099-01-03T00:00:00Z',
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
  await expect(page).toHaveURL(/\/today/)
  await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible()
  await expect(page.getByText('Recent skills')).toHaveCount(0)
  await expect(page.getByText('this week')).toHaveCount(0)
  await expect(page.getByText('XP', { exact: true })).toHaveCount(0)
  await expect(page.getByText(/streak/i)).toHaveCount(0)
  await expect(page.getByText(/level/i)).toHaveCount(0)
})

test('Upload view shows existing skills loaded from prior proofs', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('token', 'smoke-token')
    window.localStorage.setItem('practica.last_series.v1', 'Groove Lab')
  })

  await page.route('**/api/auth/me/', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 1, username: 'smoke_member', display_name: 'Smoke Member' }),
    })
  })

  await page.route('**/api/review-requests/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
  })

  const sessions = [
    {
      id: 301,
      title: 'Pocket check',
      practice_series: 'Groove Lab',
      description: '',
      video_file: null,
      duration_seconds: 18,
      recorded_at: '2099-01-05T00:00:00Z',
      created_at: '2099-01-05T00:00:00Z',
      processing_status: 'ready',
      can_edit: true,
      local_preview_url: '',
      video_feedback_count: 0,
    },
  ]

  await page.route('**/api/sessions/', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(sessions) })
  })

  await page.goto('/upload')
  await expect(page.getByRole('heading', { name: 'New proof' })).toBeVisible()
  await page.locator('input[type=file]').first().setInputFiles({
    name: 'smoke.mp4',
    mimeType: 'video/mp4',
    buffer: Buffer.from('smoke-video-bytes'),
  })
  await expect(page.getByPlaceholder('Choose a skill or create a new one')).toBeVisible()
  await page.getByPlaceholder('Choose a skill or create a new one').click()
  await expect(page.getByRole('button', { name: 'Groove Lab' }).first()).toBeVisible()
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
        label: 'Front Camera',
        groupId: 'group-video',
        toJSON() { return this },
      },
      {
        deviceId: 'video-device-2',
        kind: 'videoinput',
        label: 'Back Camera',
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
      const stream = canvas.captureStream(1)
      const requestedDeviceId = constraints?.video && typeof constraints.video === 'object'
        ? constraints.video?.deviceId?.exact
        : ''
      stream.getVideoTracks().forEach((track) => {
        track.getSettings = () => ({
          deviceId: requestedDeviceId || 'video-device-1',
          facingMode: requestedDeviceId === 'video-device-2' ? 'environment' : 'user',
        })
      })
      return stream
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
  await expect(page.getByRole('button', { name: 'Flip camera' })).toBeVisible()
  await page.locator('[aria-label="Double-tap preview to flip camera"]').dblclick({ position: { x: 100, y: 100 } })
  await expect(page.getByText('Camera flipped')).toBeVisible()
  await expect(page.getByRole('button', { name: /Options/i })).toBeVisible()
  await expect(page.locator('text=Camera input')).toHaveCount(0)
  await expect(page.locator('text=Microphone input')).toHaveCount(0)

  await page.getByRole('button', { name: /Options/i }).click()
  await expect(page.locator('text=Camera input').first()).toBeVisible()
  await expect(page.locator('text=Microphone input').first()).toBeVisible()
  const cameraSelect = page.locator('label:has-text("Camera input") + select').first()
  const micSelect = page.locator('label:has-text("Microphone input") + select').first()
  await expect(cameraSelect).toContainText('Front Camera')
  await expect(cameraSelect).toContainText('Back Camera')
  await expect(cameraSelect).toHaveValue('video-device-2')
  await expect(micSelect).toContainText('Built-in Microphone')
})

test('Recording starts and saves a take when the metronome is on', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('token', 'smoke-token')
    window.localStorage.setItem('practica.recent_series.v1', JSON.stringify(['Drumming']))

    const originalFetch = window.fetch.bind(window)
    window.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input)
      if (url.includes('/api/auth/me/')) {
        return new Response(JSON.stringify({ id: 1, username: 'smoke_member', display_name: 'Smoke Member' }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      if (url.includes('/api/sessions/') || url.includes('/api/review-requests/')) {
        return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      return originalFetch(input, init)
    }

    const mediaDevices = navigator.mediaDevices
    if (!mediaDevices) return
    mediaDevices.enumerateDevices = async () => ([
      { deviceId: 'video-device-1', kind: 'videoinput', label: 'Built-in Camera', groupId: 'g1', toJSON() { return this } },
      { deviceId: 'audio-device-1', kind: 'audioinput', label: 'Built-in Microphone', groupId: 'g2', toJSON() { return this } },
    ])
    mediaDevices.getUserMedia = async () => {
      const canvas = document.createElement('canvas')
      canvas.width = 640
      canvas.height = 360
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#111827'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      return canvas.captureStream(15)
    }

  })

  await page.goto('/record')
  await expect(page.getByText('Camera ready')).toBeVisible({ timeout: 10000 })

  await page.getByRole('button', { name: /Options/i }).click()
  await page.getByRole('button', { name: /Turn on/i }).click()
  await expect(page.getByText(/On · \d+ BPM/)).toBeVisible()

  // Set a fast BPM so the count-in finishes quickly (4 beats at 200 BPM = 1.2s)
  const bpmInput = page.locator('input[inputmode="numeric"][pattern="[0-9]*"]').first()
  await bpmInput.fill('200')
  await bpmInput.press('Enter')

  await page.getByRole('button', { name: /Options/i }).click()

  // Tap the big red record button
  await page.getByRole('button', { name: 'Start recording' }).click()

  await expect(page.getByText(/^Starting in \d+$/)).toBeVisible({ timeout: 2000 })

  // RECORDING state begins. This is the assertion that catches the original
  // bug: when startActualRecording threw a ReferenceError (setTimingLiveStats
  // referenced after its state was removed), the count-in finished but the
  // recorder.start() call never executed and the timer chip never appeared.
  await expect(page.getByText(/Recording · 0:0/)).toBeVisible({ timeout: 5000 })

  // Record a couple of seconds, confirm timer advances (proves the recording
  // loop is actually running, not just a one-shot state flip).
  await expect(page.getByText(/Recording · 0:02/)).toBeVisible({ timeout: 4000 })

  await page.getByRole('button', { name: 'Stop recording' }).click()
  await expect(page.getByText('Label this take (optional)')).toBeVisible({ timeout: 5000 })
  const skillInput = page.getByPlaceholder('Breathing, Drumming, Guitar…')
  await skillInput.fill('Chinese')
  await expect(skillInput).toHaveValue('Chinese')
  await expect(skillInput).toHaveCSS('color', 'rgb(17, 24, 39)')
  await page.getByText('Create “Chinese”').click()
  await page.getByRole('button', { name: 'Save proof' }).click()
  await expect(page.getByText('Saving your proof…')).toBeVisible({ timeout: 5000 })

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

  await page.route('**/api/sessions/multipart/initiate/', async (route) => {
    await route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({
        error: 'Direct uploads are not configured',
        code: 'direct_uploads_not_configured',
      }),
    })
  })

  await page.goto('/upload')
  await expect(page.getByRole('heading', { name: 'New proof' })).toBeVisible()

  await page.locator('[aria-label="Drop a video or browse files"] input[type=file]').first().setInputFiles({
    name: 'retry-safe.mp4',
    mimeType: 'video/mp4',
    buffer: Buffer.from('smoke-video-bytes'),
  })
  await page.locator('input[type=text]').first().fill('Retry-safe take')
  await page.getByRole('button', { name: 'Save proof' }).click()

  await page.waitForURL(/\/today$/, { timeout: 30000 })
  await expect(page.getByText('Proof saved. You showed up today.')).toBeVisible({ timeout: 10000 })
  expect(uploadPostAttempts).toBe(2)
  expect(uploadClientIds[0]).toBeTruthy()
  expect(uploadClientIds[0]).toBe(uploadClientIds[1])
})

test('Session detail shows basic skill controls', async ({ page }) => {
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

  await page.route('**/api/sessions/', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    })
  })

  await page.goto('/sessions/123')

  await expect(page.getByText('Smoke session').first()).toBeVisible()
  await page.getByRole('button', { name: 'Open proof details' }).click()
  await expect(page.getByRole('heading', { name: 'Smoke session' })).toBeVisible()
  await expect(page.getByText('Groove Lab →')).toBeVisible()
  await expect(page.getByText('Manage proof')).toBeVisible()
  await page.getByText('Manage proof').click()
  await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible()
})
