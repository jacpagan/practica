export const monthCacheKeyForDate = (monthDate) => {
  const year = monthDate.getFullYear()
  const month = String(monthDate.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

const toISODate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

export const sessionsMonthQueryPath = (monthDate) => {
  const year = monthDate.getFullYear()
  const month = monthDate.getMonth()
  const start = new Date(year, month, 1)
  const end = new Date(year, month + 1, 0)
  return `/api/sessions/?start_date=${toISODate(start)}&end_date=${toISODate(end)}`
}
