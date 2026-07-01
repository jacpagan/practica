import { multipartFingerprint } from './uploadIdentity.js'

const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:8000'
  : ''
const DIRECT_UPLOAD_THRESHOLD_BYTES = 1
const MAX_PART_RETRIES = 3
const MULTIPART_CONCURRENCY = 4
const RETRY_BASE_DELAY_MS = 500
const RETRY_MAX_DELAY_MS = 4000
const MULTIPART_RECOVERY_ATTEMPTS = 4
const MULTIPART_RECOVERY_DELAY_MS = 1500
const MULTIPART_RESUME_PREFIX = 'practica.multipart.resume.v1'
const SESSION_UPLOAD_ID_PREFIX = 'practica.session.upload_id.v1'
const CLIENT_TRACE_ID_KEY = 'practica.client_trace_id.v1'
export const MAX_RECORDER_DURATION_SECONDS = 300
export const MAX_VIDEO_UPLOAD_BYTES = 2147483648
const RECORDER_MIME_CANDIDATES = [
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
  'video/mp4',
]
const VIDEO_FILE_ACCEPT = '.mov,.mp4,.m4v,.webm,.avi,.mkv,.mpeg,.mpg,.wmv,.3gp,.3gpp,.3g2,video/*,video/quicktime,video/3gpp,video/3gpp2'
const KNOWN_VIDEO_EXTENSIONS = ['mov', 'mp4', 'm4v', 'webm', 'avi', 'mkv', 'mpeg', 'mpg', 'wmv', '3gp', '3gpp', '3g2']
const VIDEO_CONTENT_TYPE_ALIASES = ['application/mp4', 'application/x-mp4', 'audio/mp4', 'application/quicktime', 'application/3gpp', 'application/3gpp2', 'audio/3gpp', 'audio/3gpp2']

export const videoFileAccept = () => VIDEO_FILE_ACCEPT
export const uploadModeForFile = (file) => (
  file && Number(file.size || 0) >= DIRECT_UPLOAD_THRESHOLD_BYTES ? 'multipart' : 'single'
)

export const isLikelyVideoFile = (file) => {
  const name = String(file?.name || '').toLowerCase()
  const type = String(file?.type || '').toLowerCase()
  if (type.startsWith('video/')) return true
  if (VIDEO_CONTENT_TYPE_ALIASES.includes(type)) return true
  const extension = name.includes('.') ? name.split('.').pop() : ''
  return KNOWN_VIDEO_EXTENSIONS.includes(extension)
}

export const normalizedVideoContentType = (file) => {
  const type = String(file?.type || '').trim().toLowerCase()
  if (type.startsWith('video/')) return type
  if (['application/mp4', 'application/x-mp4', 'audio/mp4'].includes(type)) return 'video/mp4'
  if (type === 'application/quicktime') return 'video/quicktime'
  if (['application/3gpp', 'audio/3gpp'].includes(type)) return 'video/3gpp'
  if (['application/3gpp2', 'audio/3gpp2'].includes(type)) return 'video/3gpp2'

  const name = String(file?.name || '').toLowerCase()
  if (name.endsWith('.mov')) return 'video/quicktime'
  if (name.endsWith('.mp4') || name.endsWith('.m4v')) return 'video/mp4'
  if (name.endsWith('.webm')) return 'video/webm'
  if (name.endsWith('.avi')) return 'video/x-msvideo'
  if (name.endsWith('.mkv')) return 'video/x-matroska'
  if (name.endsWith('.mpeg') || name.endsWith('.mpg')) return 'video/mpeg'
  if (name.endsWith('.wmv')) return 'video/x-ms-wmv'
  if (name.endsWith('.3gp') || name.endsWith('.3gpp')) return 'video/3gpp'
  if (name.endsWith('.3g2')) return 'video/3gpp2'
  return type || 'application/octet-stream'
}

export const videoUrl = (path) => {
  if (!path) return null
  if (path.startsWith('s3://')) return path
  if (path.startsWith('http')) return path
  if (path.startsWith('/')) return `${API_BASE}${path}`
  if (path.includes('://')) return path
  if (path.startsWith('sessions/') || path.startsWith('feedback_videos/')) return `${API_BASE}/media/${path}`
  if (path.startsWith('/media/')) return `${API_BASE}${path}`
  return `${API_BASE}/${path.replace(/^\/+/, '')}`
}

export const assetUrl = (asset) => {
  if (!asset) return null
  const raw = asset.url || asset.object_key || ''
  if (!raw) return null
  return videoUrl(raw)
}

export const assetByType = (session, assetType) => {
  const assets = Array.isArray(session?.assets) ? session.assets : []
  return assets.find((asset) => asset.asset_type === assetType) || null
}

export const sessionPosterUrl = (session) => {
  const explicitPoster = videoUrl(session?.poster_image_url)
  if (explicitPoster) return explicitPoster
  return assetUrl(assetByType(session, 'thumb_sprite'))
}

export const preferredSessionVideoUrl = (session) => {
  const proxy = assetByType(session, 'proxy_mp4')
  return assetUrl(proxy) || videoUrl(session?.video_file)
}

export const sessionVideoSources = (session, localPreviewUrl = '') => {
  const sources = [
    videoUrl(localPreviewUrl),
    assetUrl(assetByType(session, 'proxy_mp4')),
    videoUrl(session?.video_file),
  ].filter(Boolean)

  return Array.from(new Set(sources))
}

export const fmtTime = (s) => {
  const sec = Math.floor(s)
  const m = Math.floor(sec / 60)
  const ss = sec % 60
  return `${m}:${ss.toString().padStart(2, '0')}`
}

export const fmtTimer = (s) => {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export const fmtDate = (d) => {
  const date = new Date(d)
  const now = new Date()
  const diff = now - date
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  // Use viewer's locale (undefined) for month/day
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

const toLocalDayNumber = (value) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000)
}

export const toLocalDateKey = (value) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const calculatePracticeProgress = (sessions = []) => {
  const sorted = Array.isArray(sessions)
    ? sessions
      .filter(Boolean)
      .slice()
      .sort((left, right) => new Date(right.recorded_at || right.created_at || 0) - new Date(left.recorded_at || left.created_at || 0))
    : []

  const proofDays = new Set()
  const skillCounts = new Map()
  const recentProofs = sorted.slice(0, 6)
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
  sevenDaysAgo.setHours(0, 0, 0, 0)

  sorted.forEach((session) => {
    const dateValue = session?.recorded_at || session?.created_at
    const dayNumber = toLocalDayNumber(dateValue)
    if (dayNumber !== null) {
      proofDays.add(toLocalDateKey(dateValue))
    }

    const skill = String(session?.practice_series || '').trim()
    if (skill) {
      skillCounts.set(skill, (skillCounts.get(skill) || 0) + 1)
    }
  })

  const activeSkill = sorted.find((session) => String(session?.practice_series || '').trim())?.practice_series?.trim() || 'Your skill'
  const uniqueDays = Array.from(proofDays).filter(Boolean)
  const proofCount = sorted.length
  const todayKey = toLocalDateKey(new Date())
  const proofRecordedToday = Boolean(todayKey && uniqueDays.includes(todayKey))
  const proofsLast7Days = sorted.filter((session) => {
    const date = new Date(session?.recorded_at || session?.created_at || '')
    return !Number.isNaN(date.getTime()) && date >= sevenDaysAgo
  }).length
  const skillProofCounts = Array.from(skillCounts.entries())
    .map(([skillName, count]) => ({ skillName, count }))
    .sort((left, right) => right.count - left.count || left.skillName.localeCompare(right.skillName))

  return {
    activeSkill,
    proofCount,
    uniqueDayCount: uniqueDays.length,
    skillCount: Array.from(skillCounts.keys()).length,
    skillProofCounts,
    proofsLast7Days,
    recentProofs,
    proofDays: uniqueDays,
    proofRecordedToday,
    latestProofAt: sorted[0]?.recorded_at || sorted[0]?.created_at || '',
  }
}

export const feedbackCategoryOptions = () => ([
  { value: '', label: 'Uncategorized' },
  { value: 'timing', label: 'Timing' },
  { value: 'groove', label: 'Groove' },
  { value: 'dynamics', label: 'Dynamics' },
  { value: 'technique', label: 'Technique' },
  { value: 'posture', label: 'Posture' },
  { value: 'tone', label: 'Tone' },
])

const FEEDBACK_CATEGORY_LABELS = Object.fromEntries(feedbackCategoryOptions().map((item) => [item.value, item.label]))
const FEEDBACK_CATEGORY_TONES = {
  timing: 'bg-amber-100 text-amber-800',
  groove: 'bg-violet-100 text-violet-800',
  dynamics: 'bg-emerald-100 text-emerald-800',
  technique: 'bg-blue-100 text-blue-800',
  posture: 'bg-rose-100 text-rose-800',
  tone: 'bg-cyan-100 text-cyan-800',
}

export const feedbackCategoryLabel = (value = '') => FEEDBACK_CATEGORY_LABELS[String(value || '').trim().toLowerCase()] || 'Uncategorized'
export const feedbackCategoryTone = (value = '') => FEEDBACK_CATEGORY_TONES[String(value || '').trim().toLowerCase()] || 'bg-gray-100 text-gray-700'

export const pickRecorderMimeType = (preferred = []) => {
  if (typeof window === 'undefined' || typeof window.MediaRecorder === 'undefined') return ''
  if (typeof window.MediaRecorder.isTypeSupported !== 'function') return ''
  const seen = new Set()
  for (const candidate of [...preferred, ...RECORDER_MIME_CANDIDATES]) {
    if (!candidate || seen.has(candidate)) continue
    seen.add(candidate)
    if (window.MediaRecorder.isTypeSupported(candidate)) return candidate
  }
  return ''
}

const localStore = () => {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

const trimLogValue = (value, maxChars) => String(value || '').slice(0, maxChars)

export const reportClientError = ({ message = '', stack = '', source = 'ui', extra = {} } = {}) => {
  if (typeof window === 'undefined') return
  try {
    let traceId = ''
    try {
      const store = window.sessionStorage
      traceId = store.getItem(CLIENT_TRACE_ID_KEY)
      if (!traceId) {
        traceId = Math.random().toString(36).slice(2) + Date.now().toString(36)
        store.setItem(CLIENT_TRACE_ID_KEY, traceId)
      }
    } catch {}
    let buildSha = ''
    try {
      buildSha = String(window.__DEPLOYED_GIT_SHA || document.querySelector('meta[name="practica:sha"]')?.content || '').trim()
    } catch {}
    const hasToken = (() => {
      try { return !!(window.localStorage && window.localStorage.getItem('token')) } catch { return false }
    })()

    const payload = {
      message: trimLogValue(message, 300),
      stack: stack ? 'present' : '',
      source: trimLogValue(source, 64),
      path: trimLogValue(window.location.pathname, 512),
      extra: extra && typeof extra === 'object'
        ? { ...extra, client_trace_id: traceId, build_sha: buildSha, auth_state: hasToken ? 'token_present' : 'no_token' }
        : { client_trace_id: traceId, build_sha: buildSha, auth_state: hasToken ? 'token_present' : 'no_token' },
    }
    const body = JSON.stringify(payload)
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' })
      navigator.sendBeacon('/api/client-errors/', blob)
      return
    }
    fetch('/api/client-errors/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {})
  } catch {
    // Ignore telemetry transport failures.
  }
}

export const reportClientEvent = (eventName = '', extra = {}) => {
  const normalizedName = String(eventName || '').trim()
  if (!normalizedName) return
  reportClientError({
    source: 'ProductEvent',
    message: normalizedName,
    extra,
  })
}

const multipartResumeKey = (fingerprint) => `${MULTIPART_RESUME_PREFIX}:${fingerprint}`
const sessionUploadIdKey = (fingerprint) => `${SESSION_UPLOAD_ID_PREFIX}:${fingerprint}`

const createClientUploadId = () => {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
  } catch {
    // Fall through to timestamp-random id.
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

const readStoredUploadId = (storageKey) => {
  const store = localStore()
  if (!store) return ''
  try {
    return String(store.getItem(storageKey) || '').trim().slice(0, 64)
  } catch {
    return ''
  }
}

const writeStoredUploadId = (storageKey, uploadId) => {
  const store = localStore()
  if (!store) return
  try {
    store.setItem(storageKey, String(uploadId || '').slice(0, 64))
  } catch {
    // Ignore storage errors.
  }
}

const clearStoredUploadId = (storageKey) => {
  const store = localStore()
  if (!store) return
  try {
    store.removeItem(storageKey)
  } catch {
    // Ignore storage errors.
  }
}

const readResumeRecord = (storageKey) => {
  const store = localStore()
  if (!store) return null
  try {
    const raw = store.getItem(storageKey)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return parsed
  } catch {
    return null
  }
}

const writeResumeRecord = (storageKey, record) => {
  const store = localStore()
  if (!store) return
  try {
    store.setItem(storageKey, JSON.stringify(record))
  } catch {
    // Ignore quota/storage errors; upload can continue without persistence.
  }
}

const clearResumeRecord = (storageKey) => {
  const store = localStore()
  if (!store) return
  try {
    store.removeItem(storageKey)
  } catch {
    // Ignore storage errors.
  }
}

const createAbortError = (message = 'Upload aborted') => {
  const error = new Error(message)
  error.name = 'AbortError'
  return error
}

const isAbortError = (error) => error?.name === 'AbortError'

const throwIfAborted = (signal) => {
  if (signal?.aborted) throw createAbortError()
}

const abortableSleep = (ms, signal) =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(createAbortError())
      return
    }

    let timeoutId = null
    const onAbort = () => {
      if (timeoutId !== null) clearTimeout(timeoutId)
      signal?.removeEventListener('abort', onAbort)
      reject(createAbortError())
    }

    timeoutId = window.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)

    signal?.addEventListener('abort', onAbort, { once: true })
  })

export const uploadMultipartRequest = ({ url, method = 'POST', formData, token, onProgress, signal }) =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(createAbortError())
      return
    }

    const xhr = new XMLHttpRequest()
    xhr.open(method, url)
    if (token) xhr.setRequestHeader('Authorization', `Token ${token}`)

    const handleAbort = () => xhr.abort()
    const cleanup = () => signal?.removeEventListener('abort', handleAbort)
    signal?.addEventListener('abort', handleAbort, { once: true })

    xhr.upload.onprogress = (event) => {
      if (!onProgress) return
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100)
        onProgress(percent, event.loaded, event.total)
      } else {
        onProgress(null, event.loaded, event.total)
      }
    }

    xhr.onload = () => {
      cleanup()
      const text = xhr.responseText || ''
      let data = null
      if (text) {
        try { data = JSON.parse(text) } catch { data = text }
      }
      resolve({
        ok: xhr.status >= 200 && xhr.status < 300,
        status: xhr.status,
        data,
        text,
      })
    }

    xhr.onerror = () => {
      cleanup()
      reject(new Error('Network error during upload'))
    }
    xhr.onabort = () => {
      cleanup()
      reject(createAbortError())
    }
    xhr.send(formData)
  })

export const uploadFormData = ({ url, formData, token, onProgress, signal }) =>
  uploadMultipartRequest({ url, method: 'POST', formData, token, onProgress, signal })

const parseJsonResponse = async (res) => {
  const text = await res.text()
  let data = null
  if (text) {
    try { data = JSON.parse(text) } catch { data = text }
  }
  return {
    ok: res.ok,
    status: res.status,
    data,
    text,
  }
}

const authedJsonPost = async ({ url, token, body, signal }) => {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Token ${token}` } : {}),
    },
    body: JSON.stringify(body),
    signal,
  })
  return parseJsonResponse(res)
}

const putBlobToSignedUrl = ({ signedUrl, blob, onProgress, signal }) =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(createAbortError())
      return
    }

    const xhr = new XMLHttpRequest()
    xhr.open('PUT', signedUrl)
    const handleAbort = () => xhr.abort()
    const cleanup = () => signal?.removeEventListener('abort', handleAbort)
    signal?.addEventListener('abort', handleAbort, { once: true })

    xhr.upload.onprogress = (event) => {
      if (!onProgress) return
      if (event.lengthComputable) onProgress(event.loaded, event.total)
      else onProgress(event.loaded, null)
    }
    xhr.onload = () => {
      cleanup()
      if (xhr.status >= 200 && xhr.status < 300) {
        const etag = (xhr.getResponseHeader('ETag') || '').trim()
        resolve({ etag })
        return
      }
      reject(new Error(`Upload part failed (${xhr.status})`))
    }
    xhr.onerror = () => {
      cleanup()
      reject(new Error('Network error during multipart upload'))
    }
    xhr.onabort = () => {
      cleanup()
      reject(createAbortError('Multipart upload aborted'))
    }
    xhr.send(blob)
  })

const retry = async (fn, maxAttempts = MAX_PART_RETRIES, signal) => {
  let lastErr = null
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      throwIfAborted(signal)
      return await fn()
    } catch (err) {
      lastErr = err
      if (isAbortError(err)) break
      if (attempt >= maxAttempts) break
      const jitter = Math.floor(Math.random() * 250)
      const backoff = Math.min(RETRY_MAX_DELAY_MS, RETRY_BASE_DELAY_MS * (2 ** (attempt - 1)))
      await abortableSleep(backoff + jitter, signal)
    }
  }
  throw lastErr || new Error('Unknown retry failure')
}

const asApiError = (res) => {
  const err = new Error(res?.data?.error || `Request failed (${res?.status || 'unknown'})`)
  err.apiResponse = res
  return err
}

const isRetriableApiResponse = (res) => {
  const status = Number(res?.status || 0)
  if (!status) return true
  return status === 408 || status === 425 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504
}

const shouldRetryMultipartResult = (res) => {
  if (!res || res.ok) return false
  if (res?.data?.code === 'upload_aborted') return false
  return isRetriableApiResponse(res)
}

const retryJsonPost = async ({ url, token, body, signal, maxAttempts = MAX_PART_RETRIES }) => {
  return retry(async () => {
    const res = await authedJsonPost({ url, token, body, signal })
    if (!res.ok && isRetriableApiResponse(res)) throw asApiError(res)
    return res
  }, maxAttempts, signal)
}

const parseUploadedParts = (rawParts, totalParts) => {
  const partsByNumber = new Map()
  if (!Array.isArray(rawParts)) return partsByNumber
  for (const part of rawParts) {
    const partNumber = parseInt(part?.part_number, 10)
    const etag = String(part?.etag || '').trim()
    if (!partNumber || partNumber < 1 || partNumber > totalParts) continue
    if (!etag || partsByNumber.has(partNumber)) continue
    partsByNumber.set(partNumber, etag)
  }
  return partsByNumber
}

const partByteLength = (partNumber, partSize, totalBytes) => {
  const start = (partNumber - 1) * partSize
  return Math.max(0, Math.min(partSize, totalBytes - start))
}

const buildPartsPayload = (partsByNumber) =>
  Array.from(partsByNumber.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([partNumber, etag]) => ({ part_number: partNumber, etag }))

const createSessionViaMultipartAttempt = async ({ token, payload, videoFile, onProgress, onStatusChange, signal, clientUploadId }) => {
  const normalizedContentType = normalizedVideoContentType(videoFile)
  const fingerprint = multipartFingerprint({ payload, videoFile })
  const storageKey = multipartResumeKey(fingerprint)

  let uploadId = null
  let partSize = null
  let totalParts = null
  let uploadedParts = []
  try {
    throwIfAborted(signal)

    const resumeRecord = readResumeRecord(storageKey)
    if (resumeRecord?.upload_id && Number(resumeRecord?.size_bytes) === Number(videoFile.size)) {
      const statusRes = await retryJsonPost({
        url: '/api/sessions/multipart/status/',
        token,
        body: { multipart_upload_id: resumeRecord.upload_id },
        signal,
      })
      if (statusRes.ok && statusRes.data?.status === 'initiated') {
        uploadId = statusRes.data?.multipart_upload_id
        partSize = statusRes.data?.part_size
        totalParts = statusRes.data?.total_parts
        uploadedParts = statusRes.data?.uploaded_parts || []
      } else if (statusRes.ok && statusRes.data?.status === 'completed' && statusRes.data?.session) {
        clearResumeRecord(storageKey)
        if (onProgress) onProgress(100, videoFile.size, videoFile.size)
        return { ok: true, status: 200, data: statusRes.data.session, text: '' }
      } else if (statusRes.ok || [400, 404, 410].includes(statusRes.status)) {
        clearResumeRecord(storageKey)
      } else {
        return statusRes
      }
    }

    if (!uploadId) {
      const initRes = await retryJsonPost({
        url: '/api/sessions/multipart/initiate/',
        token,
        body: {
          ...payload,
          filename: videoFile.name,
          content_type: normalizedContentType,
          size_bytes: videoFile.size,
          client_upload_id: clientUploadId,
        },
        signal,
      })
      if (!initRes.ok) return initRes

      uploadId = initRes.data?.multipart_upload_id
      partSize = initRes.data?.part_size
      totalParts = initRes.data?.total_parts
      uploadedParts = []
    }

    if (!uploadId || !partSize || !totalParts) {
      clearResumeRecord(storageKey)
      return { ok: false, status: 500, data: { error: 'Invalid multipart upload state' } }
    }

    writeResumeRecord(storageKey, {
      upload_id: uploadId,
      size_bytes: videoFile.size,
      filename: videoFile.name,
      last_modified: videoFile.lastModified || 0,
    })

    const partsByNumber = parseUploadedParts(uploadedParts, totalParts)
    let completedBytes = 0
    for (const partNumber of partsByNumber.keys()) {
      completedBytes += partByteLength(partNumber, partSize, videoFile.size)
    }

  const inflightLoaded = new Map()
  const reportProgress = () => {
    if (!onProgress) return
    let inFlightBytes = 0
    for (const loaded of inflightLoaded.values()) {
      inFlightBytes += Math.max(0, Number(loaded || 0))
    }
    const done = Math.min(videoFile.size, completedBytes + inFlightBytes)
    let percent = Math.round((done / videoFile.size) * 100)
    if (done > 0 && done < videoFile.size) percent = Math.max(1, Math.min(99, percent))
    onStatusChange?.('saving')
    onProgress(percent, done, videoFile.size)
  }
  reportProgress()

  const missingParts = []
  for (let partNumber = 1; partNumber <= totalParts; partNumber += 1) {
    if (!partsByNumber.has(partNumber)) missingParts.push(partNumber)
  }

    const uploadOnePart = async (partNumber) => {
      throwIfAborted(signal)
      const start = (partNumber - 1) * partSize
      const end = Math.min(start + partSize, videoFile.size)
      const chunk = videoFile.slice(start, end)
    inflightLoaded.set(partNumber, 0)
    reportProgress()

    try {
      const signRes = await retry(() => authedJsonPost({
        url: '/api/sessions/multipart/sign-part/',
        token,
        body: { multipart_upload_id: uploadId, part_number: partNumber },
        signal,
      }), MAX_PART_RETRIES, signal)
      if (!signRes.ok || !signRes.data?.signed_url) throw asApiError(signRes)

      const partResult = await retry(async () => {
        const result = await putBlobToSignedUrl({
          signedUrl: signRes.data.signed_url,
          blob: chunk,
          onProgress: (loaded) => {
            onStatusChange?.('saving')
            inflightLoaded.set(partNumber, loaded)
            reportProgress()
          },
          signal,
        })
        if (!result.etag) throw new Error('S3 did not return an ETag for uploaded part')
        return result
      }, MAX_PART_RETRIES, signal)

      partsByNumber.set(partNumber, partResult.etag)
      completedBytes += chunk.size
    } finally {
      inflightLoaded.delete(partNumber)
      reportProgress()
    }
    }

    if (missingParts.length) {
      let cursor = 0
      const worker = async () => {
        while (true) {
          throwIfAborted(signal)
          const index = cursor
          cursor += 1
          if (index >= missingParts.length) return
          await uploadOnePart(missingParts[index])
        }
      }
      const workerCount = Math.min(MULTIPART_CONCURRENCY, missingParts.length)
      try {
        await Promise.all(Array.from({ length: workerCount }, () => worker()))
      } catch (err) {
        if (err?.apiResponse) return err.apiResponse
        throw err
      }
    }

    onStatusChange?.('saving')
    const completeRes = await retryJsonPost({
      url: '/api/sessions/multipart/complete/',
      token,
      body: {
        multipart_upload_id: uploadId,
        parts: buildPartsPayload(partsByNumber),
      },
      signal,
    })

    if (completeRes.ok) {
      clearResumeRecord(storageKey)
      if (onProgress) onProgress(100, videoFile.size, videoFile.size)
      return completeRes
    }

    if ([400, 404, 410].includes(completeRes.status)) clearResumeRecord(storageKey)
    return completeRes
  } catch (error) {
    if (isAbortError(error)) {
      return {
        ok: false,
        status: 499,
        data: { error: 'Upload paused', code: 'upload_paused' },
        text: '',
      }
    }
    throw error
  }
}

const createSessionViaMultipart = async ({ token, payload, videoFile, onProgress, onStatusChange, signal, clientUploadId }) => {
  let lastResult = null
  let lastError = null

  for (let attempt = 1; attempt <= MULTIPART_RECOVERY_ATTEMPTS; attempt += 1) {
    throwIfAborted(signal)

    try {
      const result = await createSessionViaMultipartAttempt({ token, payload, videoFile, onProgress, onStatusChange, signal, clientUploadId })
      if (!shouldRetryMultipartResult(result)) return result
      lastResult = result
    } catch (error) {
      if (isAbortError(error)) {
        return {
          ok: false,
          status: 499,
          data: { error: 'Upload paused', code: 'upload_paused' },
          text: '',
        }
      }
      lastError = error
    }

    if (attempt >= MULTIPART_RECOVERY_ATTEMPTS) break

    onStatusChange?.('resuming')
    if (onProgress) {
      onProgress(null, null, videoFile.size)
    }

    await abortableSleep(MULTIPART_RECOVERY_DELAY_MS * attempt, signal)
  }

  if (lastResult) return lastResult
  throw lastError || new Error('Multipart upload failed')
}

const createSessionViaSingleUpload = async ({ token, payload, videoFile, onProgress, onStatusChange, signal, clientUploadId }) => {
  const fd = new FormData()
  fd.append('title', payload.title || '')
  fd.append('practice_series', payload.practice_series || '')
  fd.append('description', payload.description || '')
  fd.append('reference_title', payload.reference_title || '')
  fd.append('reference_url', payload.reference_url || '')
  fd.append('video_file', videoFile)
  fd.append('client_upload_id', clientUploadId)
  if (payload.duration_seconds !== undefined && payload.duration_seconds !== null && payload.duration_seconds !== '') {
    fd.append('duration_seconds', payload.duration_seconds)
  }
  if (payload.tags?.length) fd.append('tags', payload.tags.join(','))
  if (payload.timing_metadata) {
    fd.append('timing_metadata', typeof payload.timing_metadata === 'string'
      ? payload.timing_metadata
      : JSON.stringify(payload.timing_metadata))
  }

  let attempt = 0
  let lastResponse = null
  while (attempt < 2) {
    attempt += 1
    throwIfAborted(signal)
    let response = null
    try {
      response = await uploadFormData({ url: '/api/sessions/', formData: fd, token, onProgress, signal })
    } catch (error) {
      if (isAbortError(error)) throw error
      response = {
        ok: false,
        status: 0,
        data: { error: 'Network interrupted during upload. Please retry.' },
        text: '',
      }
    }
    if (response.ok || response.status !== 0 || attempt >= 2) {
      return response
    }

    lastResponse = response
    onStatusChange?.('resuming')
    if (onProgress) onProgress(null, null, videoFile.size)
    await abortableSleep(800 * attempt, signal)
  }
  return lastResponse || {
    ok: false,
    status: 0,
    data: { error: 'Network interrupted during upload. Please retry.' },
    text: '',
  }
}

export const createSessionUpload = async ({ token, payload, videoFile, onProgress, onStatusChange, signal }) => {
  const fingerprint = multipartFingerprint({ payload, videoFile })
  const uploadIdStorageKey = sessionUploadIdKey(fingerprint)
  let clientUploadId = readStoredUploadId(uploadIdStorageKey)
  if (!clientUploadId) {
    clientUploadId = createClientUploadId()
    writeStoredUploadId(uploadIdStorageKey, clientUploadId)
  }

  try {
    if (uploadModeForFile(videoFile) === 'multipart') {
      const multipartRes = await createSessionViaMultipart({
        token,
        payload,
        videoFile,
        onProgress,
        onStatusChange,
        signal,
        clientUploadId,
      })
      if (multipartRes.ok || ![400, 404, 405].includes(multipartRes.status)) {
        const multipartCode = String(multipartRes?.data?.code || '').trim().toLowerCase()
        if (
          multipartRes.ok
          || multipartCode === 'upload_expired'
          || multipartCode === 'upload_restart_required'
        ) {
          clearStoredUploadId(uploadIdStorageKey)
        }
        return multipartRes
      }
    }

    const res = await createSessionViaSingleUpload({
      token,
      payload,
      videoFile,
      onProgress,
      onStatusChange,
      signal,
      clientUploadId,
    })
    if (res.ok || res?.data?.code === 'upload_aborted') clearStoredUploadId(uploadIdStorageKey)
    return res
  } catch (error) {
    if (isAbortError(error)) {
      return {
        ok: false,
        status: 499,
        data: { error: 'Upload paused', code: 'upload_paused' },
        text: '',
      }
    }
    return {
      ok: false,
      status: 0,
      data: { error: 'Network interrupted during upload. Please retry.' },
      text: '',
    }
  }
}

export const uploadErrorMessage = (res) => {
  if (!res) return 'Upload failed'
  const code = String(res?.data?.code || '').trim().toLowerCase()
  if (code === 'upload_aborted') return 'Upload aborted.'
  if (code === 'upload_paused') return 'Upload paused. Choose the same video again to resume.'
  if (code === 'upload_restart_required') return 'Previous upload can’t resume. Please restart the upload.'
  if (code === 'upload_expired') return 'Upload session expired. Please restart the upload.'
  if (code === 'upload_not_open') return 'Upload session is no longer open. Please restart the upload.'
  if (code === 'upload_invalid_video_type') return 'Only video files are allowed. Please choose a video and retry.'
  if (code === 'upload_size_exceeded') return 'File exceeds the 2GB limit. Choose a smaller video and retry.'
  if (code === 'upload_invalid_file_size') return 'Invalid file size. Please choose the file again and retry.'
  if (code === 'upload_finalize_failed') return 'Could not finalize upload. Retry; if it keeps failing, restart upload.'
  if (code === 'upload_status_unavailable') return 'Could not check upload status. Retry in a moment.'
  if (code === 'upload_sign_part_failed' || code === 'upload_initiate_failed') {
    return 'Upload service is temporarily unavailable. Retry in a moment.'
  }
  if (code === 'direct_uploads_not_configured') return 'Upload service is unavailable right now. Please try again later.'
  if (res.status === 0) return 'Network interrupted during upload. Please retry.'
  if (res.status === 410) return 'Upload session expired. Please retry.'
  if (res.status === 413) return 'File too large for server limits. Current max is 2GB.'
  if (res.status === 408 || res.status === 499 || res.status === 504) {
    return 'Upload timed out. Please retry on a stable connection.'
  }
  const details = res?.data?.details
  if (details && typeof details === 'object') {
    const firstField = Object.keys(details)[0]
    const fieldErrors = details[firstField]
    const firstFieldError = Array.isArray(fieldErrors) ? fieldErrors[0] : fieldErrors
    if (firstFieldError) return `${String(firstFieldError)} Please fix and retry.`
  }
  if (String(res?.data?.error || '').toLowerCase().includes('expired')) {
    return 'Upload session expired. Please retry.'
  }
  if (typeof res.data === 'string' && res.data.trim()) return res.data
  return res.data?.error || `Upload failed (${res.status})`
}
