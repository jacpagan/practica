import { useEffect } from 'react'

import { parseRoute, routePath } from '../routing'

export const usePopStateUploadGuard = ({
  applyRoute,
  currentPathRef,
  requestAbortActiveUpload,
  uploadGuardRef,
}) => {
  useEffect(() => {
    const onPopState = () => {
      const route = parseRoute(window.location.pathname, window.location.search)
      const nextPath = routePath(route)
      if (uploadGuardRef.current.active && nextPath !== currentPathRef.current) {
        window.history.pushState(null, '', currentPathRef.current)
        const accepted = window.confirm('A video is still uploading. Leaving this page will abort the upload. Do you want to continue?')
        if (!accepted) return
        requestAbortActiveUpload()
        applyRoute(route)
        return
      }
      applyRoute(route, { replace: true })
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [applyRoute, currentPathRef, requestAbortActiveUpload, uploadGuardRef])
}
