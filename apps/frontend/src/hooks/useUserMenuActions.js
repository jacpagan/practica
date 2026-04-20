import { useCallback } from 'react'

import { reportClientError } from '../utils'

export const useUserMenuActions = ({
  confirmAbortActiveUpload,
  logout,
  requestAbortActiveUpload,
  toast,
  uploadGuardRef,
}) => {
  const reportProblem = useCallback(() => {
    try {
      const path = (window.location && (window.location.pathname + (window.location.search || ''))) || '/'
      reportClientError({ source: 'UserReport', message: 'user_report', extra: { note: 'User pressed report', path } })
      toast.success('Thanks for the report')
    } catch {}
  }, [toast])

  const handleLogout = useCallback(async () => {
    const accepted = await confirmAbortActiveUpload('log out')
    if (!accepted) return
    if (uploadGuardRef.current.active) requestAbortActiveUpload()
    logout()
  }, [confirmAbortActiveUpload, logout, requestAbortActiveUpload, uploadGuardRef])

  return {
    handleLogout,
    reportProblem,
  }
}
