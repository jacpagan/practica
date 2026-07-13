const UNGROUPED_KEY = '__ungrouped__'

const sessionTimestamp = (session) => {
  const raw = session?.recorded_at || session?.created_at || ''
  const parsed = Date.parse(raw)
  return Number.isFinite(parsed) ? parsed : 0
}

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
      const proofDayCount = new Set(sorted.map((session) => toLocalDateKey(session?.recorded_at || session?.created_at)).filter(Boolean)).size
      return {
        skillKey,
        skillName: skillKey === UNGROUPED_KEY ? 'Ungrouped' : skillKey,
        isUngrouped: skillKey === UNGROUPED_KEY,
        proofCount: sorted.length,
        proofDayCount,
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

export const buildRecommendedNextSkill = (sessions = []) => {
  const sorted = (Array.isArray(sessions) ? sessions : [])
    .filter((session) => String(session?.practice_series || '').trim())
    .slice()
    .sort((left, right) => sessionTimestamp(right) - sessionTimestamp(left))

  const latest = sorted[0] || null
  if (!latest) return null

  const skillName = String(latest.practice_series || '').trim()
  const matching = sorted.filter((session) => String(session?.practice_series || '').trim().toLowerCase() === skillName.toLowerCase())
  const earliest = matching[matching.length - 1] || latest

  return {
    skillName,
    latest,
    earliest,
    proofCount: matching.length,
    proofDayCount: new Set(matching.map((session) => toLocalDateKey(session?.recorded_at || session?.created_at)).filter(Boolean)).size,
  }
}

export const buildLatestSkillComparison = (sessions = []) => {
  const sorted = (Array.isArray(sessions) ? sessions : [])
    .filter((session) => session?.id || session?.recorded_at || session?.created_at)
    .slice()
    .sort((left, right) => sessionTimestamp(right) - sessionTimestamp(left))
  const latest = sorted[0] || null
  const previous = sorted[1] || null
  const latestAt = sessionTimestamp(latest)
  const previousAt = sessionTimestamp(previous)
  const daysApart = latestAt && previousAt
    ? Math.max(0, Math.round((latestAt - previousAt) / 86400000))
    : null

  return {
    latest,
    previous,
    hasComparison: Boolean(latest && previous),
    daysApart,
  }
}

export const buildTodayLoopState = (sessions = [], today = new Date()) => {
  const sorted = (Array.isArray(sessions) ? sessions : [])
    .filter((session) => session?.id || session?.recorded_at || session?.created_at)
    .slice()
    .sort((left, right) => sessionTimestamp(right) - sessionTimestamp(left))

  const todayKey = toLocalDateKey(today)
  const todaySessions = sorted.filter((session) => toLocalDateKey(session?.recorded_at || session?.created_at) === todayKey)
  const proofDayCount = new Set(sorted.map((session) => toLocalDateKey(session?.recorded_at || session?.created_at)).filter(Boolean)).size
  const recommendedSkill = buildRecommendedNextSkill(sorted)

  return {
    status: sorted.length === 0 ? 'empty' : (todaySessions.length > 0 ? 'done_today' : 'ready_today'),
    proofRecordedToday: todaySessions.length > 0,
    todayProofCount: todaySessions.length,
    todayLatest: todaySessions[0] || null,
    latestSession: sorted[0] || null,
    recommendedSkill,
    nextSkillName: recommendedSkill?.skillName || '',
    totalProofCount: sorted.length,
    proofDayCount,
  }
}
