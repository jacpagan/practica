import { useEffect } from 'react'

import { clearPostLoginRedirect, readPostLoginRedirect } from '../authRedirect'
import { parseRoute } from '../routing'

export const usePostLoginRedirect = ({ user, applyRoute }) => {
  useEffect(() => {
    if (!user) return
    let stored = ''
    try { stored = readPostLoginRedirect() } catch {}
    if (!stored) return
    try {
      clearPostLoginRedirect()
      const url = new URL(stored, window.location.origin)
      const route = parseRoute(url.pathname, url.search)
      applyRoute(route, { replace: true })
    } catch {}
  }, [applyRoute, user])
}
