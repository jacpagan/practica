export const LAST_SERIES_KEY = 'practica.last_series.v1'
export const RECENT_SERIES_KEY = 'practica.recent_series.v1'

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
