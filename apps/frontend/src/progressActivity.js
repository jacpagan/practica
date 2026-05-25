const UNGROUPED_KEY = '__ungrouped__'

export const toLocalDateKey = (value) => {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const buildProofCountByDay = (sessions = []) => {
  const counts = new Map()
  ;(Array.isArray(sessions) ? sessions : []).forEach((session) => {
    const key = toLocalDateKey(session?.recorded_at || session?.created_at)
    if (!key) return
    counts.set(key, (counts.get(key) || 0) + 1)
  })
  return counts
}

export const buildActivityWeeks = (sessions = [], weekCount = 26) => {
  const counts = buildProofCountByDay(sessions)
  const today = new Date()
  today.setHours(12, 0, 0, 0)
  const currentWeekSunday = new Date(today)
  currentWeekSunday.setDate(currentWeekSunday.getDate() - currentWeekSunday.getDay())

  const weeks = []
  for (let weekIndex = 0; weekIndex < weekCount; weekIndex += 1) {
    const weekStart = new Date(currentWeekSunday)
    weekStart.setDate(weekStart.getDate() - (weekCount - 1 - weekIndex) * 7)
    const week = []
    for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
      const date = new Date(weekStart)
      date.setDate(date.getDate() + dayIndex)
      const dateKey = toLocalDateKey(date)
      const isFuture = date > today
      week.push({
        dateKey,
        count: isFuture ? 0 : (counts.get(dateKey) || 0),
        isFuture,
        date,
      })
    }
    weeks.push(week)
  }
  return weeks
}

export const buildSkillSummaries = (sessions = []) => {
  const grouped = new Map()
  ;(Array.isArray(sessions) ? sessions : []).forEach((session) => {
    const key = String(session?.practice_series || '').trim() || UNGROUPED_KEY
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key).push(session)
  })

  return Array.from(grouped.entries())
    .map(([skillKey, items]) => {
      const sorted = items
        .slice()
        .sort((left, right) => new Date(right.recorded_at || right.created_at) - new Date(left.recorded_at || left.created_at))
      const latest = sorted[0] || null
      const earliest = sorted[sorted.length - 1] || null
      return {
        skillKey,
        skillName: skillKey === UNGROUPED_KEY ? 'Ungrouped' : skillKey,
        isUngrouped: skillKey === UNGROUPED_KEY,
        proofCount: sorted.length,
        latest,
        earliest,
        items: sorted,
      }
    })
    .sort((left, right) => {
      if (left.isUngrouped) return 1
      if (right.isUngrouped) return -1
      const leftTime = new Date(left.latest?.recorded_at || left.latest?.created_at || 0).getTime() || 0
      const rightTime = new Date(right.latest?.recorded_at || right.latest?.created_at || 0).getTime() || 0
      return rightTime - leftTime
    })
}
