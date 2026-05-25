export const DAILY_STACK_KEY = 'practica.daily_stack.v1'
export const LAST_SERIES_KEY = 'practica.last_series.v1'

const normalizeSkillName = (value) => String(value || '').trim().toLocaleLowerCase()

export const toLocalDateKey = (value) => {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const loadDailyStack = () => {
  try {
    const raw = window.localStorage.getItem(DAILY_STACK_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const seen = new Set()
    return parsed
      .map((item) => String(item || '').trim())
      .filter((item) => {
        if (!item) return false
        const key = normalizeSkillName(item)
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
  } catch {
    return []
  }
}

export const saveDailyStack = (names = []) => {
  const seen = new Set()
  const next = (Array.isArray(names) ? names : [])
    .map((item) => String(item || '').trim())
    .filter((item) => {
      if (!item) return false
      const key = normalizeSkillName(item)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  try {
    window.localStorage.setItem(DAILY_STACK_KEY, JSON.stringify(next))
  } catch {}
  return next
}

export const readLastSeries = () => {
  try {
    return String(window.localStorage.getItem(LAST_SERIES_KEY) || '').trim()
  } catch {
    return ''
  }
}

export const hasProofTodayForSkill = (sessions = [], skillName = '', todayKey = toLocalDateKey(new Date())) => {
  const target = normalizeSkillName(skillName)
  if (!target || !todayKey) return false
  return (Array.isArray(sessions) ? sessions : []).some((session) => {
    if (normalizeSkillName(session?.practice_series) !== target) return false
    return toLocalDateKey(session?.recorded_at || session?.created_at) === todayKey
  })
}

export const latestProofTodayForSkill = (sessions = [], skillName = '', todayKey = toLocalDateKey(new Date())) => {
  const target = normalizeSkillName(skillName)
  if (!target || !todayKey) return null
  return (Array.isArray(sessions) ? sessions : [])
    .filter((session) => {
      if (normalizeSkillName(session?.practice_series) !== target) return false
      return toLocalDateKey(session?.recorded_at || session?.created_at) === todayKey
    })
    .sort((left, right) => new Date(right.recorded_at || right.created_at) - new Date(left.recorded_at || left.created_at))[0] || null
}

export const firstIncompleteSkill = (stack = [], sessions = [], todayKey = toLocalDateKey(new Date())) => {
  return (Array.isArray(stack) ? stack : []).find((skill) => !hasProofTodayForSkill(sessions, skill, todayKey)) || ''
}

export const countCompletedToday = (stack = [], sessions = [], todayKey = toLocalDateKey(new Date())) => {
  const names = Array.isArray(stack) ? stack : []
  return names.filter((skill) => hasProofTodayForSkill(sessions, skill, todayKey)).length
}

export const resolveDefaultRecordSkill = ({ stack = [], sessions = [], skillOptions = [] } = {}) => {
  const fromStack = firstIncompleteSkill(stack, sessions)
  if (fromStack) return fromStack
  const last = readLastSeries()
  if (last) return last
  return String(skillOptions?.[0] || '').trim()
}
