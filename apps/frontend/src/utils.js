const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:8000'
  : ''

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
