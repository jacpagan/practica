import { readRecentSeriesList } from './recordPrefs.js'

const sessionTimestamp = (session) => {
  const raw = session?.recorded_at || session?.created_at || ''
  const parsed = Date.parse(raw)
  return Number.isFinite(parsed) ? parsed : 0
}

export function buildRecentSkills({ sessions = [], limit = 5 } = {}) {
  const seen = new Set()
  const merged = []

  const pushName = (name) => {
    const normalized = String(name || '').trim()
    if (!normalized) return
    const key = normalized.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    merged.push(normalized)
  }

  readRecentSeriesList().forEach(pushName)

  const sortedSessions = [...(sessions || [])].sort((left, right) => sessionTimestamp(right) - sessionTimestamp(left))
  sortedSessions.forEach((session) => {
    pushName(session?.practice_series)
  })

  return merged.slice(0, Math.max(1, Number(limit) || 5))
}
