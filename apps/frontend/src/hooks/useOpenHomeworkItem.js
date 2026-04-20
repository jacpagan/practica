import { useCallback } from 'react'

export const useOpenHomeworkItem = ({
  activeOwnerRequestBySessionId,
  navigate,
  openSession,
  setDetailReturnRoute,
  setOpenRecorderOnUpload,
  setSelectedSession,
}) => {
  return useCallback((session, returnRoute = { view: 'calendar', sessionId: null, seriesName: '' }) => {
    if (!session?.id) return
    const activeRequest = activeOwnerRequestBySessionId.get(Number(session.id))
    const tokenValue = activeRequest?.feedback_link?.token || activeRequest?.review_link?.token || ''
    if (tokenValue) {
      setDetailReturnRoute(returnRoute)
      setSelectedSession(null)
      setOpenRecorderOnUpload(false)
      navigate({ view: 'review', token: tokenValue, sessionId: null })
      return
    }
    openSession(session, returnRoute)
  }, [
    activeOwnerRequestBySessionId,
    navigate,
    openSession,
    setDetailReturnRoute,
    setOpenRecorderOnUpload,
    setSelectedSession,
  ])
}
