import { useCallback } from 'react'

import { routePath } from '../routing'

export const useNavigationActions = ({
  confirm,
  currentPathRef,
  setReviewClaim,
  setReviewToken,
  setRouteDate,
  setRouteSeriesName,
  setRouteSessionId,
  setView,
  uploadGuardRef,
}) => {
  const applyRoute = useCallback((nextRoute, { replace = false } = {}) => {
    setView(nextRoute.view)
    setRouteSessionId(nextRoute.sessionId ?? null)
    setRouteSeriesName(nextRoute.seriesName || '')
    setReviewToken(nextRoute.token || '')
    setReviewClaim(nextRoute.claim || '')
    setRouteDate(nextRoute.date || '')
    const path = routePath(nextRoute)
    const current = window.location.pathname + (window.location.search || '')
    if (path !== current) {
      if (replace) window.history.replaceState(null, '', path)
      else window.history.pushState(null, '', path)
    }
  }, [setReviewClaim, setReviewToken, setRouteDate, setRouteSeriesName, setRouteSessionId, setView])

  const requestAbortActiveUpload = useCallback(() => {
    try { uploadGuardRef.current.abort?.() } catch {}
  }, [uploadGuardRef])

  const confirmAbortActiveUpload = useCallback(async (nextAction = 'leave this page') => {
    if (!uploadGuardRef.current.active) return true
    return confirm({
      title: 'Abort upload?',
      message: `A video is still uploading. If you ${nextAction}, the upload will be aborted and you will need to start again.`,
      confirmLabel: 'Abort upload',
      cancelLabel: 'Keep uploading',
      tone: 'danger',
    })
  }, [confirm, uploadGuardRef])

  const navigate = useCallback(async (nextRoute, { replace = false, bypassUploadGuard = false } = {}) => {
    const nextPath = routePath(nextRoute)
    if (!bypassUploadGuard && uploadGuardRef.current.active && nextPath !== currentPathRef.current) {
      const accepted = await confirmAbortActiveUpload('leave this page')
      if (!accepted) return false
      requestAbortActiveUpload()
    }
    applyRoute(nextRoute, { replace })
    return true
  }, [applyRoute, confirmAbortActiveUpload, currentPathRef, requestAbortActiveUpload, uploadGuardRef])

  const setUploadNavigationGuard = useCallback(({ active = false, abort = null } = {}) => {
    uploadGuardRef.current = {
      active: Boolean(active),
      abort: typeof abort === 'function' ? abort : null,
    }
  }, [uploadGuardRef])

  return {
    applyRoute,
    confirmAbortActiveUpload,
    navigate,
    requestAbortActiveUpload,
    setUploadNavigationGuard,
  }
}
