const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:8000'
  : ''
const MULTIPART_THRESHOLD_BYTES = 64 * 1024 * 1024
const MAX_PART_RETRIES = 3

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

const retry = async (fn, maxAttempts = MAX_PART_RETRIES) => {
  let lastErr = null
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try { return await fn() } catch (err) { lastErr = err }
  }
  throw lastErr || new Error('Unknown retry failure')
}

const createSessionViaMultipart = async ({ token, payload, videoFile, onProgress }) => {
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

  const uploadId = initRes.data?.multipart_upload_id
  const partSize = initRes.data?.part_size
  const totalParts = initRes.data?.total_parts
  if (!uploadId || !partSize || !totalParts) {
    return { ok: false, status: 500, data: { error: 'Invalid multipart init response' } }
  }

  const parts = []
  let uploadedBytes = 0
  try {
    for (let partNumber = 1; partNumber <= totalParts; partNumber += 1) {
      const start = (partNumber - 1) * partSize
      const end = Math.min(start + partSize, videoFile.size)
      const chunk = videoFile.slice(start, end)

      const signRes = await retry(() => authedJsonPost({
        url: '/api/sessions/multipart/sign-part/',
        token,
        body: { multipart_upload_id: uploadId, part_number: partNumber },
      }))
      if (!signRes.ok || !signRes.data?.signed_url) return signRes

      const partResult = await retry(() => putBlobToSignedUrl({
        signedUrl: signRes.data.signed_url,
        blob: chunk,
        onProgress: (loaded) => {
          if (!onProgress) return
          const done = uploadedBytes + loaded
          const percent = Math.max(1, Math.min(99, Math.round((done / videoFile.size) * 100)))
          onProgress(percent, done, videoFile.size)
        },
      }))

      uploadedBytes += chunk.size
      parts.push({ part_number: partNumber, etag: partResult.etag })
      if (onProgress) {
        const percent = Math.max(1, Math.min(99, Math.round((uploadedBytes / videoFile.size) * 100)))
        onProgress(percent, uploadedBytes, videoFile.size)
      }
    }

    const completeRes = await authedJsonPost({
      url: '/api/sessions/multipart/complete/',
      token,
      body: {
        multipart_upload_id: uploadId,
        parts,
      },
    })
    if (completeRes.ok && onProgress) onProgress(100, videoFile.size, videoFile.size)
    return completeRes
  } catch (err) {
    await authedJsonPost({
      url: '/api/sessions/multipart/abort/',
      token,
      body: { multipart_upload_id: uploadId },
    }).catch(() => {})
    throw err
  }
}

export const createSessionUpload = async ({ token, payload, videoFile, onProgress }) => {
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
}
export const uploadErrorMessage = (res) => {
  if (!res) return 'Upload failed'
  if (res.status === 0) return 'Network interrupted during upload. Please retry.'
  if (res.status === 413) return 'File too large for server limits. Current max is 2GB.'
  if (res.status === 408 || res.status === 499 || res.status === 504) {
    return 'Upload timed out. Please retry on a stable connection.'
  }
  if (typeof res.data === 'string' && res.data.trim()) return res.data
  return res.data?.error || `Upload failed (${res.status})`
}
