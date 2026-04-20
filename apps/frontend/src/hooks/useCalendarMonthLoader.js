import { useCallback } from 'react'

import { monthCacheKeyForDate, sessionsMonthQueryPath } from '../calendar'

export const useCalendarMonthLoader = ({
  calendarMonthCacheRef,
  calendarMonthRequestRef,
  fetchPaginated,
  setSessions,
  setSessionsLoading,
  token,
}) => {
  return useCallback(async (monthDate, { preferCache = true } = {}) => {
    if (!token) return
    const cacheKey = monthCacheKeyForDate(monthDate)
    const cached = calendarMonthCacheRef.current.get(cacheKey)
    if (preferCache && cached) {
      setSessions(cached)
      setSessionsLoading(false)
      return
    }

    const requestKey = `${cacheKey}:${Date.now()}`
    calendarMonthRequestRef.current = requestKey
    setSessionsLoading(true)
    try {
      const items = await fetchPaginated(sessionsMonthQueryPath(monthDate))
      calendarMonthCacheRef.current.set(cacheKey, items)
      if (calendarMonthRequestRef.current !== requestKey) return
      setSessions(items)
    } catch {
      if (calendarMonthRequestRef.current !== requestKey) return
      setSessions([])
    } finally {
      if (calendarMonthRequestRef.current === requestKey) setSessionsLoading(false)
    }
  }, [calendarMonthCacheRef, calendarMonthRequestRef, fetchPaginated, setSessions, setSessionsLoading, token])
}
