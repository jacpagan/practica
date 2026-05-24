import { useCallback } from 'react'

export const useSessionDetailActions = ({
  calendarMonthCacheRef,
  detailReturnRoute,
  navigate,
  openSessionById,
  routeSeriesName,
  setDetailReturnRoute,
  setJustUploadedSessionId,
  setOpenRecorderOnUpload,
  setPendingPracticeSeries,
  setPendingUploadReturnRoute,
  setSelectedSession,
  setSessions,
  view,
}) => {
  const buildProofReturnRoute = useCallback((session) => {
    const practiceSeries = String(session?.practice_series || '').trim()
    if (practiceSeries) {
      return { view: 'skill', sessionId: null, seriesName: practiceSeries }
    }
    return { view: 'today', sessionId: null, seriesName: '' }
  }, [])

  const openSession = useCallback((session, returnRoute = { view, sessionId: null, seriesName: routeSeriesName }) => {
    if (!session?.id) return
    setDetailReturnRoute(returnRoute)
    setOpenRecorderOnUpload(false)
    openSessionById(session.id)
  }, [openSessionById, routeSeriesName, setDetailReturnRoute, setOpenRecorderOnUpload, view])

  const goBack = useCallback(() => {
    const fallback = { view: 'today', sessionId: null, seriesName: '' }
    const route = detailReturnRoute?.view
      ? detailReturnRoute
      : fallback
    navigate(route)
    setSelectedSession(null)
    setJustUploadedSessionId(null)
  }, [detailReturnRoute, navigate, setJustUploadedSessionId, setSelectedSession])

  const handleUploadComplete = useCallback((session) => {
    calendarMonthCacheRef.current.clear()
    const nextReturnRoute = buildProofReturnRoute(session)
    setSessions((current) => [session, ...current.filter((item) => item.id !== session.id)])
    setSelectedSession(session)
    setDetailReturnRoute(nextReturnRoute)
    setJustUploadedSessionId(session.id)
    setOpenRecorderOnUpload(false)
    setPendingPracticeSeries('')
    setPendingUploadReturnRoute(nextReturnRoute)
    navigate({ view: 'detail', sessionId: session.id })
  }, [
    buildProofReturnRoute,
    calendarMonthCacheRef,
    navigate,
    setDetailReturnRoute,
    setJustUploadedSessionId,
    setOpenRecorderOnUpload,
    setPendingPracticeSeries,
    setPendingUploadReturnRoute,
    setSelectedSession,
    setSessions,
  ])

  return {
    goBack,
    handleUploadComplete,
    openSession,
  }
}
