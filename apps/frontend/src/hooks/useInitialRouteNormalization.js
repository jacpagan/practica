import { useEffect } from 'react'

import { routePath } from '../routing'

export const useInitialRouteNormalization = ({
  route,
}) => {
  useEffect(() => {
    const desired = routePath(route)
    const current = window.location.pathname + (window.location.search || '')
    if (desired !== current) {
      try { window.history.replaceState(null, '', desired) } catch {}
    }
  }, [])
}
