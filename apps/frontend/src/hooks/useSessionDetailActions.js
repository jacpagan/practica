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
  const openSession = useCallback((session, returnRoute = { view, sessionId: null, seriesName: routeSeriesName }) => {
    if (!session?.id) return
    setDetailReturnRoute(returnRoute)
    setOpenRecorderOnUpload(false)
    openSessionById(session.id)
  }, [openSessionById, routeSeriesName, setDetailReturnRoute, setOpenRecorderOnUpload, view])

  const goBack = useCallback(() => {
    navigate(detailReturnRoute?.view ? detailReturnRoute : { view: 'threads', sessionId: null, seriesName: '' })
    setSelectedSession(null)
    setJustUploadedSessionId(null)
  }, [detailReturnRoute, navigate, setJustUploadedSessionId, setSelectedSession])

  const handleUploadComplete = useCallback((session) => {
    calendarMonthCacheRef.current.clear()
    setSessions((current) => [session, ...current.filter((item) => item.id !== session.id)])
    setSelectedSession(session)
    setJustUploadedSessionId(session.id)
    setOpenRecorderOnUpload(false)
    setPendingPracticeSeries('')
    setPendingUploadReturnRoute({ view: 'threads', sessionId: null })
    navigate({ view: 'detail', sessionId: session.id })
  }, [
    calendarMonthCacheRef,
    navigate,
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
