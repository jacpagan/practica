import { useCallback } from 'react'

export const useRecordingActions = ({
  currentReturnRoute,
  navigate,
  resolveUploadReturnRoute,
  setJustUploadedSession,
  setJustUploadedSessionId,
  setOpenRecorderOnUpload,
  setPendingPracticeSeries,
  setPendingPracticePrompt,
  setPendingUploadReturnRoute,
  setSelectedSession,
}) => {
  const startRecord = useCallback(({ skillName = '', practicePrompt = '', returnRoute = null } = {}) => {
    setSelectedSession(null)
    setJustUploadedSessionId(null)
    setJustUploadedSession?.(null)
    setOpenRecorderOnUpload(false)
    setPendingPracticeSeries(String(skillName || '').trim())
    setPendingPracticePrompt(String(practicePrompt || '').trim())
    setPendingUploadReturnRoute(returnRoute || resolveUploadReturnRoute({ practiceSeries: skillName }))
    navigate({ view: 'record', sessionId: null, seriesName: String(skillName || '').trim() })
  }, [
    navigate,
    resolveUploadReturnRoute,
    setJustUploadedSession,
    setJustUploadedSessionId,
    setOpenRecorderOnUpload,
    setPendingPracticeSeries,
    setPendingPracticePrompt,
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
    setJustUploadedSession?.(null)
    setPendingPracticeSeries('')
    setPendingPracticePrompt('')
    setPendingUploadReturnRoute(currentReturnRoute)
    setOpenRecorderOnUpload(false)
    navigate({ view: 'record', sessionId: null })
  }, [
    currentReturnRoute,
    navigate,
    setJustUploadedSession,
    setJustUploadedSessionId,
    setOpenRecorderOnUpload,
    setPendingPracticeSeries,
    setPendingPracticePrompt,
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
