import { useCallback } from 'react'

export const useRecordingActions = ({
  currentReturnRoute,
  navigate,
  resolveUploadReturnRoute,
  setJustUploadedSessionId,
  setOpenRecorderOnUpload,
  setPendingFollowUpRequestDraft,
  setPendingPracticeSeries,
  setPendingUploadReturnRoute,
  setSelectedSession,
}) => {
  const openGlobalRecorder = useCallback(() => {
    navigate({ view: 'record', sessionId: null })
  }, [navigate])

  const handleRecordAnother = useCallback((draft = null) => {
    setSelectedSession(null)
    setJustUploadedSessionId(null)
    setOpenRecorderOnUpload(false)
    setPendingFollowUpRequestDraft(draft || null)
    setPendingPracticeSeries(String(draft?.practiceSeries || '').trim())
    setPendingUploadReturnRoute(resolveUploadReturnRoute(draft))
    navigate({ view: 'record', sessionId: null })
  }, [
    navigate,
    resolveUploadReturnRoute,
    setJustUploadedSessionId,
    setOpenRecorderOnUpload,
    setPendingFollowUpRequestDraft,
    setPendingPracticeSeries,
    setPendingUploadReturnRoute,
    setSelectedSession,
  ])

  const startQuickRecord = useCallback(() => {
    setSelectedSession(null)
    setJustUploadedSessionId(null)
    setPendingFollowUpRequestDraft(null)
    setPendingPracticeSeries('')
    setPendingUploadReturnRoute(currentReturnRoute)
    setOpenRecorderOnUpload(false)
    navigate({ view: 'record', sessionId: null })
  }, [
    currentReturnRoute,
    navigate,
    setJustUploadedSessionId,
    setOpenRecorderOnUpload,
    setPendingFollowUpRequestDraft,
    setPendingPracticeSeries,
    setPendingUploadReturnRoute,
    setSelectedSession,
  ])

  return {
    handleRecordAnother,
    openGlobalRecorder,
    startQuickRecord,
  }
}
