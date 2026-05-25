export const LAST_SERIES_KEY = 'practica.last_series.v1'
export const RECENT_SERIES_KEY = 'practica.recent_series.v1'
export const VIDEO_FIT_KEY = 'practica.video.fit.v1'

export const readVideoFitMode = () => {
  try {
    const raw = String(window.localStorage.getItem(VIDEO_FIT_KEY) || '').trim()
    if (raw === 'fill' || raw === 'fit') return raw
  } catch {}
  if (typeof window !== 'undefined' && window.matchMedia?.('(min-width: 640px)')?.matches) {
    return 'fit'
  }
  return 'fill'
}

export const saveVideoFitMode = (mode) => {
  const normalized = mode === 'fit' ? 'fit' : 'fill'
  try {
    window.localStorage.setItem(VIDEO_FIT_KEY, normalized)
  } catch {}
  return normalized
}

export const readLastSeries = () => {
  try {
    return String(window.localStorage.getItem(LAST_SERIES_KEY) || '').trim()
  } catch {
    return ''
  }
}

export const readRecentSeriesList = () => {
  try {
    const raw = window.localStorage.getItem(RECENT_SERIES_KEY)
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map((item) => String(item || '').trim()).filter(Boolean)
  } catch {
    return []
  }
}

export const recordRecentSeries = (name) => {
  const normalized = String(name || '').trim()
  if (!normalized) return
  const existing = readRecentSeriesList().filter((item) => item.toLowerCase() !== normalized.toLowerCase())
  const next = [normalized, ...existing].slice(0, 8)
  try {
    window.localStorage.setItem(RECENT_SERIES_KEY, JSON.stringify(next))
  } catch {}
  try {
    window.localStorage.setItem(LAST_SERIES_KEY, normalized)
  } catch {}
}
