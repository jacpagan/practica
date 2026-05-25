import { useCallback } from 'react'

export const useSessionDetailActions = ({
  calendarMonthCacheRef,
  detailReturnRoute,
  navigate,
  openSessionById,
  pendingUploadReturnRoute,
  routeSeriesName,
  setDetailReturnRoute,
  setJustUploadedSessionId,
  setOpenRecorderOnUpload,
  setPendingPracticeSeries,
  setPendingUploadReturnRoute,
  setSelectedSession,
  setSessions,
  toast,
  view,
}) => {
  const buildProofReturnRoute = useCallback((session) => {
    const practiceSeries = String(session?.practice_series || '').trim()
    if (practiceSeries) {
      return { view: 'skill', sessionId: null, seriesName: practiceSeries }
    }
    return { view: 'progress', sessionId: null, seriesName: '' }
  }, [])

  const openSession = useCallback((session, returnRoute = { view, sessionId: null, seriesName: routeSeriesName }) => {
    if (!session?.id) return
    setDetailReturnRoute(returnRoute)
    setOpenRecorderOnUpload(false)
    openSessionById(session.id)
  }, [openSessionById, routeSeriesName, setDetailReturnRoute, setOpenRecorderOnUpload, view])

  const goBack = useCallback(() => {
    const fallback = { view: 'progress', sessionId: null, seriesName: '' }
    const route = detailReturnRoute?.view
      ? detailReturnRoute
      : fallback
    navigate(route)
    setSelectedSession(null)
    setJustUploadedSessionId(null)
  }, [detailReturnRoute, navigate, setJustUploadedSessionId, setSelectedSession])

  const handleUploadComplete = useCallback((session) => {
    calendarMonthCacheRef.current.clear()
    const fromTodayStack = Boolean(pendingUploadReturnRoute?.fromTodayStack)
    const nextReturnRoute = fromTodayStack
      ? { view: 'progress', sessionId: null, seriesName: '' }
      : buildProofReturnRoute(session)
    setSessions((current) => [session, ...current.filter((item) => item.id !== session.id)])
    setOpenRecorderOnUpload(false)
    setPendingPracticeSeries('')
    setPendingUploadReturnRoute(nextReturnRoute)
    if (fromTodayStack) {
      setSelectedSession(null)
      setDetailReturnRoute(nextReturnRoute)
      setJustUploadedSessionId(null)
      const skillLabel = String(session?.practice_series || '').trim()
      toast?.success(skillLabel ? `Saved — ${skillLabel}` : 'Saved to your private archive')
      navigate(nextReturnRoute)
      return
    }
    setSelectedSession(session)
    setDetailReturnRoute(nextReturnRoute)
    setJustUploadedSessionId(session.id)
    navigate({ view: 'detail', sessionId: session.id })
  }, [
    buildProofReturnRoute,
    calendarMonthCacheRef,
    navigate,
    pendingUploadReturnRoute,
    setDetailReturnRoute,
    setJustUploadedSessionId,
    setOpenRecorderOnUpload,
    setPendingPracticeSeries,
    setPendingUploadReturnRoute,
    setSelectedSession,
    setSessions,
    toast,
  ])

  return {
    goBack,
    handleUploadComplete,
    openSession,
  }
}
