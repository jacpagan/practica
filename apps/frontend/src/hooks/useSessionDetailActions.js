import { useCallback } from 'react'

import { reportClientEvent } from '../utils'
import { saveProgressScrollRestore } from '../progressReturnState'

export const useSessionDetailActions = ({
  calendarMonthCacheRef,
  detailReturnRoute,
  navigate,
  openSessionById,
  routeSeriesName,
  setDetailReturnRoute,
  setJustUploadedSession,
  setJustUploadedSessionId,
  setOpenRecorderOnUpload,
  setPendingPracticeSeries,
  setPendingUploadReturnRoute,
  setSelectedSession,
  setSessions,
  view,
}) => {
  const buildProofReturnRoute = useCallback(() => (
    { view: 'progress', sessionId: null, seriesName: '' }
  ), [])

  const openSession = useCallback((session, returnRoute = { view, sessionId: null, seriesName: routeSeriesName }) => {
    if (!session?.id) return
    setDetailReturnRoute(returnRoute)
    setOpenRecorderOnUpload(false)
    setJustUploadedSessionId(null)
    setJustUploadedSession?.(null)
    openSessionById(session.id)
  }, [openSessionById, routeSeriesName, setDetailReturnRoute, setJustUploadedSession, setJustUploadedSessionId, setOpenRecorderOnUpload, view])

  const goBack = useCallback(() => {
    const fallback = { view: 'progress', sessionId: null, seriesName: '' }
    const route = detailReturnRoute?.view
      ? detailReturnRoute
      : fallback
    saveProgressScrollRestore(route)
    navigate(route)
    setSelectedSession(null)
    setJustUploadedSessionId(null)
    setJustUploadedSession?.(null)
  }, [detailReturnRoute, navigate, setJustUploadedSession, setJustUploadedSessionId, setSelectedSession])

  const handleUploadComplete = useCallback((session) => {
    calendarMonthCacheRef.current.clear()
    const nextReturnRoute = buildProofReturnRoute()
    setSessions((current) => [session, ...current.filter((item) => item.id !== session.id)])
    setSelectedSession(null)
    setDetailReturnRoute(nextReturnRoute)
    setJustUploadedSessionId(session.id)
    setJustUploadedSession?.(session)
    setOpenRecorderOnUpload(false)
    setPendingPracticeSeries('')
    setPendingUploadReturnRoute(nextReturnRoute)
    reportClientEvent('loop_save_landed_today', {
      action: 'loop_save_landed_today',
      session_id: session.id,
    })
    navigate(nextReturnRoute)
  }, [
    buildProofReturnRoute,
    calendarMonthCacheRef,
    navigate,
    setDetailReturnRoute,
    setJustUploadedSession,
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
