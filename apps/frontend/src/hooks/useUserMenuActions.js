import { useCallback } from 'react'

export const useUserMenuActions = ({
  confirmAbortActiveUpload,
  logout,
  requestAbortActiveUpload,
  uploadGuardRef,
}) => {
  const handleLogout = useCallback(async () => {
    const accepted = await confirmAbortActiveUpload('log out')
    if (!accepted) return
    if (uploadGuardRef.current.active) requestAbortActiveUpload()
    logout()
  }, [confirmAbortActiveUpload, logout, requestAbortActiveUpload, uploadGuardRef])

  return {
    handleLogout,
  }
}
