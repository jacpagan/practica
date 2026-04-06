import { test, expect } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const backendDir = path.resolve(__dirname, '../../backend')
const venvPython = path.resolve(__dirname, '../../../.venv/bin/python')
const pythonBin = process.env.PYTHON || (fs.existsSync(venvPython) ? venvPython : 'python3')
const databaseUrl = `sqlite:///${process.env.PRACTICA_E2E_DB_PATH || '/tmp/practica-e2e.sqlite3'}`
const baseEnv = {
  ...process.env,
  DATABASE_URL: databaseUrl,
  DJANGO_SETTINGS_MODULE: 'practica.settings',
  DJANGO_SECRET_KEY: 'practica-e2e-secret',
  ALLOWED_HOSTS: '127.0.0.1,localhost',
  DEBUG: '1',
}

const studentUsername = 'e2e_student'
const studentPassword = 'E2eStudentPass123!'
const teacherUsername = 'e2e_teacher'
const teacherPassword = 'E2eTeacherPass123!'

const tinyMp4Base64 =
  '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'

function runDjango(code: string) {
  execFileSync(pythonBin, ['manage.py', 'shell', '-c', code], {
    cwd: backendDir,
    env: baseEnv,
    stdio: 'pipe',
  })
}

function markSessionReady(sessionId: number) {
  runDjango(`
from videos.models import Session
session = Session.objects.get(pk=${sessionId})
session.processing_status = Session.STATUS_READY
session.processing_job_id = ''
session.processing_error = ''
session.save(update_fields=['processing_status', 'processing_job_id', 'processing_error', 'updated_at'])
  `)
}

function writeFixtureVideo(name: string) {
  const filePath = path.join(os.tmpdir(), name)
  const buffer = Buffer.from(tinyMp4Base64, 'base64')
  fs.writeFileSync(filePath, buffer)
  return filePath
}

async function apiToken(request, username: string, password: string) {
  const response = await request.post('/api/auth/login/', {
    data: { username, password },
  })
  expect(response.ok()).toBeTruthy()
  const body = await response.json()
  return body.token as string
}

async function waitForSessionReady(request, token: string, sessionId: number) {
  for (let index = 0; index < 30; index += 1) {
    const response = await request.get(`/api/sessions/${sessionId}/`, {
      headers: { Authorization: `Token ${token}` },
    })
    expect(response.ok()).toBeTruthy()
    const body = await response.json()
    if (body.processing_status === 'ready') return body
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`Session ${sessionId} did not become ready`)
}

test.beforeAll(() => {
  runDjango(`
from django.contrib.auth import get_user_model
from videos.models import Profile, ReviewerRosterMembership, Session, ReviewRequest
User = get_user_model()

for username in ['${studentUsername}', '${teacherUsername}']:
    user = User.objects.filter(username=username).first()
    if user:
        Session.objects.filter(user=user).delete()
        ReviewRequest.objects.filter(student=user).delete()
        ReviewRequest.objects.filter(reviewer=user).delete()

teacher, _ = User.objects.get_or_create(username='${teacherUsername}')
teacher.set_password('${teacherPassword}')
teacher.is_staff = False
teacher.is_superuser = False
teacher.is_active = True
teacher.save()
Profile.objects.update_or_create(user=teacher, defaults={'display_name': 'E2E Teacher'})

student, _ = User.objects.get_or_create(username='${studentUsername}')
student.set_password('${studentPassword}')
student.is_staff = False
student.is_superuser = False
student.is_active = True
student.save()
Profile.objects.update_or_create(user=student, defaults={'display_name': 'E2E Student'})

ReviewerRosterMembership.objects.update_or_create(
    reviewer=teacher,
    student=student,
    defaults={'is_active': True},
)
  `)
})

test('signed-in upload -> request -> feedback loop works', async ({ browser, request }) => {
  test.setTimeout(120000)
  const studentVideo = writeFixtureVideo('practica-e2e-student.mp4')
  const teacherVideo = writeFixtureVideo('practica-e2e-teacher.mp4')
  const studentToken = await apiToken(request, studentUsername, studentPassword)
  const teacherToken = await apiToken(request, teacherUsername, teacherPassword)
  const title = `E2E take ${Date.now()}`

  const studentContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  const teacherContext = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  await studentContext.addInitScript((token) => window.localStorage.setItem('token', token), studentToken)
  await teacherContext.addInitScript((token) => window.localStorage.setItem('token', token), teacherToken)
  const studentPage = await studentContext.newPage()
  const teacherPage = await teacherContext.newPage()

  await studentPage.goto('/upload')
  await expect(studentPage.getByRole('heading', { name: 'New take' })).toBeVisible({ timeout: 10000 })
  await studentPage.locator('[aria-label="Drop a video or browse files"] input[type=file]').first().setInputFiles(studentVideo)
  await studentPage.locator('input[type=text]').nth(0).fill(title)
  await studentPage.getByRole('button', { name: 'Save to library' }).click()
  await studentPage.waitForURL(/\/sessions\/\d+/, { timeout: 30000 })

  const sessionId = Number(studentPage.url().match(/\/sessions\/(\d+)/)?.[1])
  expect(sessionId).toBeTruthy()

  markSessionReady(sessionId)

  await waitForSessionReady(request, studentToken, sessionId)
  await studentPage.reload()
  await studentPage.getByRole('button', { name: 'Request feedback' }).click()
  await studentPage.getByRole('button', { name: /Send to E2E Teacher/i }).click()
  await expect(studentPage.getByText(/Waiting on/).first()).toBeVisible()

  await teacherPage.goto('/requests')
  await expect(teacherPage.getByText('Needs action', { exact: true })).toBeVisible()
  await teacherPage.getByRole('button', { name: 'Review now' }).click()
  await expect(teacherPage.getByText('Add your response')).toBeVisible()

  const chooser = teacherPage.waitForEvent('filechooser')
  await teacherPage.getByRole('button', { name: 'Upload response' }).click()
  const fileChooser = await chooser
  await fileChooser.setFiles(teacherVideo)
  await teacherPage.getByRole('button', { name: 'Send response' }).click()
  await expect(teacherPage.getByRole('button', { name: 'Edit' })).toBeVisible()

  await studentPage.goto(`/sessions/${sessionId}`)
  await expect(studentPage.getByRole('button', { name: 'Review feedback' })).toBeVisible()
  await expect(studentPage.getByText('E2E Teacher')).toBeVisible()

  await studentContext.close()
  await teacherContext.close()
})

test('continue loop creates a follow-up take and follow-up request', async ({ browser, request }) => {
  test.setTimeout(150000)
  const firstTakeVideo = writeFixtureVideo('practica-e2e-followup-start.mp4')
  const teacherVideo = writeFixtureVideo('practica-e2e-followup-teacher.mp4')
  const secondTakeVideo = writeFixtureVideo('practica-e2e-followup-next.mp4')
  const studentToken = await apiToken(request, studentUsername, studentPassword)
  const teacherToken = await apiToken(request, teacherUsername, teacherPassword)
  const initialTitle = `E2E follow-up start ${Date.now()}`
  const followupTitle = `E2E follow-up next ${Date.now()}`

  const studentContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  const teacherContext = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  await studentContext.addInitScript((token) => window.localStorage.setItem('token', token), studentToken)
  await teacherContext.addInitScript((token) => window.localStorage.setItem('token', token), teacherToken)
  const studentPage = await studentContext.newPage()
  const teacherPage = await teacherContext.newPage()

  await studentPage.goto('/upload')
  await expect(studentPage.getByRole('heading', { name: 'New take' })).toBeVisible({ timeout: 10000 })
  await studentPage.locator('[aria-label="Drop a video or browse files"] input[type=file]').first().setInputFiles(firstTakeVideo)
  await studentPage.locator('input[type=text]').nth(0).fill(initialTitle)
  await studentPage.getByRole('button', { name: 'Save to library' }).click()
  await studentPage.waitForURL(/\/sessions\/\d+/, { timeout: 30000 })

  const initialSessionId = Number(studentPage.url().match(/\/sessions\/(\d+)/)?.[1])
  expect(initialSessionId).toBeTruthy()
  markSessionReady(initialSessionId)
  await waitForSessionReady(request, studentToken, initialSessionId)
  await studentPage.reload()

  await studentPage.getByRole('button', { name: 'Request feedback' }).click()
  await studentPage.getByRole('button', { name: /Send to E2E Teacher/i }).click()
  await expect(studentPage.getByText(/Waiting on/).first()).toBeVisible()

  await teacherPage.goto('/requests')
  await teacherPage.getByRole('button', { name: 'Review now' }).click()
  const chooser = teacherPage.waitForEvent('filechooser')
  await teacherPage.getByRole('button', { name: 'Upload response' }).click()
  const fileChooser = await chooser
  await fileChooser.setFiles(teacherVideo)
  await teacherPage.getByRole('button', { name: 'Send response' }).click()
  await expect(teacherPage.getByRole('button', { name: 'Edit' })).toBeVisible()

  await studentPage.goto(`/sessions/${initialSessionId}`)
  await studentPage.getByRole('button', { name: 'Review feedback' }).click()
  await expect(studentPage.getByRole('button', { name: 'Continue loop' })).toBeVisible()
  await studentPage.getByRole('button', { name: 'Continue loop' }).click()
  await expect(studentPage).toHaveURL(/\/upload$/)
  await expect(studentPage.getByRole('heading', { name: 'New take' })).toBeVisible()

  await studentPage.locator('[aria-label="Drop a video or browse files"] input[type=file]').first().setInputFiles(secondTakeVideo)
  await studentPage.locator('input[type=text]').nth(0).fill(followupTitle)
  await studentPage.getByRole('button', { name: 'Save to library' }).click()
  await studentPage.waitForURL(/\/sessions\/\d+/, { timeout: 30000 })

  const followupSessionId = Number(studentPage.url().match(/\/sessions\/(\d+)/)?.[1])
  expect(followupSessionId).toBeTruthy()
  expect(followupSessionId).not.toBe(initialSessionId)
  markSessionReady(followupSessionId)
  await waitForSessionReady(request, studentToken, followupSessionId)

  const sendPrefilled = studentPage.getByRole('button', { name: /Send to E2E Teacher/i })
  if (await sendPrefilled.count()) {
    if (!(await sendPrefilled.isEnabled())) {
      const refreshButton = studentPage.getByRole('button', { name: 'Refresh' })
      if (await refreshButton.count()) {
        await refreshButton.click()
      }
      await expect(sendPrefilled).toBeEnabled({ timeout: 10000 })
    }
    await sendPrefilled.click()
  } else {
    await studentPage.getByRole('button', { name: 'Request feedback' }).click()
    await studentPage.getByRole('button', { name: /Send to E2E Teacher/i }).click()
  }
  await expect(studentPage.getByText('Follow-up').first()).toBeVisible({ timeout: 10000 })

  await teacherPage.goto('/requests')
  await expect(teacherPage.getByText('Follow-up').first()).toBeVisible({ timeout: 10000 })

  await studentContext.close()
  await teacherContext.close()
})
