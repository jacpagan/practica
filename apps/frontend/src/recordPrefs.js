export const LAST_SERIES_KEY = 'practica.last_series.v1'

export const readLastSeries = () => {
  try {
    return String(window.localStorage.getItem(LAST_SERIES_KEY) || '').trim()
  } catch {
    return ''
  }
}
