const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:8000'
  : ''
const MULTIPART_THRESHOLD_BYTES = 64 * 1024 * 1024
const MAX_PART_RETRIES = 3
const MULTIPART_CONCURRENCY = 4
const RETRY_BASE_DELAY_MS = 500
const RETRY_MAX_DELAY_MS = 4000
const MULTIPART_RESUME_PREFIX = 'practica.multipart.resume.v1'

export const videoUrl = (path) => {
  if (!path) return null
  if (path.startsWith('http')) return path
  if (path.startsWith('/media/')) return `${API_BASE}${path}`
  return path
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
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export const fmtDateLong = (d) =>
  new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

export const fmtDuration = (start, end) => {
  if (end == null) return null
  const d = end - start
  if (d <= 0) return null
  if (d < 60) return `${d}s`
  const m = Math.floor(d / 60)
  const s = d % 60
  return s > 0 ? `${m}m ${s}s` : `${m}m`
}

export const parseTimeInput = (str) => {
  if (!str || !str.trim()) return null
  const parts = str.split(':')
  if (parts.length === 2) return Math.max(0, parseInt(parts[0] || 0) * 60 + parseInt(parts[1] || 0))
  if (parts.length === 1) return Math.max(0, parseInt(parts[0] || 0))
  return null
}

const localStore = () => {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

const multipartFingerprint = ({ payload, videoFile }) => {
  const tags = Array.isArray(payload?.tags) ? [...payload.tags].map((t) => String(t)).sort().join(',') : ''
  return [
    videoFile?.name || '',
    videoFile?.size || 0,
    videoFile?.lastModified || 0,
    payload?.title || '',
    payload?.space || '',
    payload?.duration_seconds || '',
    tags,
  ].join('|')
}

const multipartResumeKey = (fingerprint) => `${MULTIPART_RESUME_PREFIX}:${fingerprint}`

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

export const uploadFormData = ({ url, formData, token, onProgress }) =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', url)
    if (token) xhr.setRequestHeader('Authorization', `Token ${token}`)

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

    xhr.onerror = () => reject(new Error('Network error during upload'))
    xhr.onabort = () => reject(new Error('Upload aborted'))
    xhr.send(formData)
  })
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

const authedJsonPost = async ({ url, token, body }) => {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Token ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })
  return parseJsonResponse(res)
}

const putBlobToSignedUrl = ({ signedUrl, blob, onProgress }) =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', signedUrl)
    xhr.upload.onprogress = (event) => {
      if (!onProgress) return
      if (event.lengthComputable) onProgress(event.loaded, event.total)
      else onProgress(event.loaded, null)
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const etag = (xhr.getResponseHeader('ETag') || '').trim()
        resolve({ etag })
        return
      }
      reject(new Error(`Upload part failed (${xhr.status})`))
    }
    xhr.onerror = () => reject(new Error('Network error during multipart upload'))
    xhr.onabort = () => reject(new Error('Multipart upload aborted'))
    xhr.send(blob)
  })

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const retry = async (fn, maxAttempts = MAX_PART_RETRIES) => {
  let lastErr = null
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (attempt >= maxAttempts) break
      const jitter = Math.floor(Math.random() * 250)
      const backoff = Math.min(RETRY_MAX_DELAY_MS, RETRY_BASE_DELAY_MS * (2 ** (attempt - 1)))
      await sleep(backoff + jitter)
    }
  }
  throw lastErr || new Error('Unknown retry failure')
}

const asApiError = (res) => {
  const err = new Error(res?.data?.error || `Request failed (${res?.status || 'unknown'})`)
  err.apiResponse = res
  return err
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

const createSessionViaMultipart = async ({ token, payload, videoFile, onProgress }) => {
  const fingerprint = multipartFingerprint({ payload, videoFile })
  const storageKey = multipartResumeKey(fingerprint)

  let uploadId = null
  let partSize = null
  let totalParts = null
  let uploadedParts = []

  const resumeRecord = readResumeRecord(storageKey)
  if (resumeRecord?.upload_id && Number(resumeRecord?.size_bytes) === Number(videoFile.size)) {
    const statusRes = await authedJsonPost({
      url: '/api/sessions/multipart/status/',
      token,
      body: { multipart_upload_id: resumeRecord.upload_id },
    })
    if (statusRes.ok && statusRes.data?.status === 'initiated') {
      uploadId = statusRes.data?.multipart_upload_id
      partSize = statusRes.data?.part_size
      totalParts = statusRes.data?.total_parts
      uploadedParts = statusRes.data?.uploaded_parts || []
    } else if (statusRes.ok || [400, 404, 410].includes(statusRes.status)) {
      clearResumeRecord(storageKey)
    } else {
      return statusRes
    }
  }

  if (!uploadId) {
    const initRes = await authedJsonPost({
      url: '/api/sessions/multipart/initiate/',
      token,
      body: {
        ...payload,
        filename: videoFile.name,
        content_type: videoFile.type,
        size_bytes: videoFile.size,
      },
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
    onProgress(percent, done, videoFile.size)
  }
  reportProgress()

  const missingParts = []
  for (let partNumber = 1; partNumber <= totalParts; partNumber += 1) {
    if (!partsByNumber.has(partNumber)) missingParts.push(partNumber)
  }

  const uploadOnePart = async (partNumber) => {
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
      }))
      if (!signRes.ok || !signRes.data?.signed_url) throw asApiError(signRes)

      const partResult = await retry(async () => {
        const result = await putBlobToSignedUrl({
          signedUrl: signRes.data.signed_url,
          blob: chunk,
          onProgress: (loaded) => {
            inflightLoaded.set(partNumber, loaded)
            reportProgress()
          },
        })
        if (!result.etag) throw new Error('S3 did not return an ETag for uploaded part')
        return result
      })

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

  const completeRes = await authedJsonPost({
    url: '/api/sessions/multipart/complete/',
    token,
    body: {
      multipart_upload_id: uploadId,
      parts: buildPartsPayload(partsByNumber),
    },
  })

  if (completeRes.ok) {
    clearResumeRecord(storageKey)
    if (onProgress) onProgress(100, videoFile.size, videoFile.size)
    return completeRes
  }

  if ([400, 404, 410].includes(completeRes.status)) clearResumeRecord(storageKey)
  return completeRes
}

export const createSessionUpload = async ({ token, payload, videoFile, onProgress }) => {
  try {
    if (videoFile && videoFile.size >= MULTIPART_THRESHOLD_BYTES) {
      const multipartRes = await createSessionViaMultipart({ token, payload, videoFile, onProgress })
      if (multipartRes.ok || ![400, 404, 405].includes(multipartRes.status)) return multipartRes
    }

    const fd = new FormData()
    fd.append('title', payload.title || '')
    fd.append('description', payload.description || '')
    fd.append('video_file', videoFile)
    if (payload.duration_seconds !== undefined && payload.duration_seconds !== null && payload.duration_seconds !== '') {
      fd.append('duration_seconds', payload.duration_seconds)
    }
    if (payload.space) fd.append('space', payload.space)
    if (payload.tags?.length) fd.append('tags', payload.tags.join(','))
    return uploadFormData({ url: '/api/sessions/', formData: fd, token, onProgress })
  } catch {
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
  if (res.status === 0) return 'Network interrupted during upload. Please retry.'
  if (res.status === 410) return 'Upload session expired. Please retry.'
  if (res.status === 413) return 'File too large for server limits. Current max is 2GB.'
  if (res.status === 408 || res.status === 499 || res.status === 504) {
    return 'Upload timed out. Please retry on a stable connection.'
  }
  if (String(res?.data?.error || '').toLowerCase().includes('expired')) {
    return 'Upload session expired. Please retry.'
  }
  if (typeof res.data === 'string' && res.data.trim()) return res.data
  return res.data?.error || `Upload failed (${res.status})`
}
