import { useCallback } from 'react'

export const useRecordingActions = ({
  currentReturnRoute,
  navigate,
  resolveUploadReturnRoute,
  setJustUploadedSessionId,
  setOpenRecorderOnUpload,
  setPendingPracticeSeries,
  setPendingUploadReturnRoute,
  setSelectedSession,
}) => {
  const startRecord = useCallback(({ skillName = '', returnRoute = null } = {}) => {
    setSelectedSession(null)
    setJustUploadedSessionId(null)
    setOpenRecorderOnUpload(false)
    setPendingPracticeSeries(String(skillName || '').trim())
    setPendingUploadReturnRoute(returnRoute || resolveUploadReturnRoute({ practiceSeries: skillName }))
    navigate({ view: 'record', sessionId: null })
  }, [
    navigate,
    resolveUploadReturnRoute,
    setJustUploadedSessionId,
    setOpenRecorderOnUpload,
    setPendingPracticeSeries,
    setPendingUploadReturnRoute,
    setSelectedSession,
  ])

  const openGlobalRecorder = useCallback(() => {
    startRecord({ skillName: '' })
  }, [startRecord])

  const handleRecordAnother = useCallback((draft = null) => {
    const skillName = String(draft?.practiceSeries || '').trim()
    startRecord({
      skillName,
      returnRoute: resolveUploadReturnRoute(draft),
    })
  }, [resolveUploadReturnRoute, startRecord])

  const startQuickRecord = useCallback(() => {
    setSelectedSession(null)
    setJustUploadedSessionId(null)
    setPendingPracticeSeries('')
    setPendingUploadReturnRoute(currentReturnRoute)
    setOpenRecorderOnUpload(false)
    navigate({ view: 'record', sessionId: null })
  }, [
    currentReturnRoute,
    navigate,
    setJustUploadedSessionId,
    setOpenRecorderOnUpload,
    setPendingPracticeSeries,
    setPendingUploadReturnRoute,
    setSelectedSession,
  ])

  return {
    handleRecordAnother,
    openGlobalRecorder,
    startQuickRecord,
    startRecord,
  }
}
