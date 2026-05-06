import { useEffect } from 'react'

export const useRoutineRenamedListener = ({
  calendarMonthCacheRef,
  loadSessions,
  navigate,
  routeSeriesName,
  selectedSessionId,
  setSelectedSession,
  token,
  view,
}) => {
  useEffect(() => {
    const handler = async (event) => {
      if (!token) return
      calendarMonthCacheRef.current.clear()
      const oldSeriesName = String(event?.detail?.oldSeriesName || '').trim()
      const newSeriesName = String(event?.detail?.newSeriesName || '').trim()
      try {
        await loadSessions()
      } catch {}
      if (view === 'series' && oldSeriesName && routeSeriesName === oldSeriesName && newSeriesName) {
        navigate({ view: 'series', sessionId: null, seriesName: newSeriesName }, { replace: true })
      }
      if (selectedSessionId) {
        try {
          const res = await fetch(`/api/sessions/${selectedSessionId}/`, { headers: { Authorization: `Token ${token}` } })
          if (res.ok) {
            const data = await res.json()
            setSelectedSession(data)
          }
        } catch {}
      }
    }
    window.addEventListener('practica:routine-renamed', handler)
    return () => window.removeEventListener('practica:routine-renamed', handler)
  }, [
    calendarMonthCacheRef,
    loadSessions,
    navigate,
    routeSeriesName,
    selectedSessionId,
    setSelectedSession,
    token,
    view,
  ])
}
