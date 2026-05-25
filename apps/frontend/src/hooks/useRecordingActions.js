import { useCallback } from 'react'

import { firstIncompleteSkill, loadDailyStack, resolveDefaultRecordSkill } from '../dailyStack'

export const useRecordingActions = ({
  currentReturnRoute,
  navigate,
  resolveUploadReturnRoute,
  sessions = [],
  setJustUploadedSessionId,
  setOpenRecorderOnUpload,
  setPendingPracticeSeries,
  setPendingUploadReturnRoute,
  setSelectedSession,
  skillOptions = [],
}) => {
  const startRecord = useCallback(({ skillName = '', fromTodayStack = false, returnRoute = null } = {}) => {
    setSelectedSession(null)
    setJustUploadedSessionId(null)
    setOpenRecorderOnUpload(false)
    setPendingPracticeSeries(String(skillName || '').trim())
    if (returnRoute) {
      setPendingUploadReturnRoute(returnRoute)
    } else if (fromTodayStack) {
      setPendingUploadReturnRoute({ view: 'progress', sessionId: null, seriesName: '', fromTodayStack: true })
    } else {
      setPendingUploadReturnRoute(resolveUploadReturnRoute({ practiceSeries: skillName }))
    }
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

  const recordForSkill = useCallback((skillName, { fromTodayStack = true, returnRoute = null } = {}) => {
    startRecord({ skillName, fromTodayStack, returnRoute })
  }, [startRecord])

  const openGlobalRecorder = useCallback(() => {
    const stack = loadDailyStack()
    const nextInStack = firstIncompleteSkill(stack, sessions)
    if (nextInStack) {
      startRecord({ skillName: nextInStack, fromTodayStack: true })
      return
    }
    startRecord({
      skillName: resolveDefaultRecordSkill({ stack, sessions, skillOptions }),
      fromTodayStack: false,
    })
  }, [sessions, skillOptions, startRecord])

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
    recordForSkill,
    startQuickRecord,
    startRecord,
  }
}
