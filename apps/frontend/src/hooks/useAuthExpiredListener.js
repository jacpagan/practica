import { useEffect } from 'react'

import { currentLocationPath, rememberPostLoginRedirect } from '../authRedirect'

export const useAuthExpiredListener = ({ logout, navigate, toast }) => {
  useEffect(() => {
    const onAuthExpired = () => {
      try {
        rememberPostLoginRedirect(currentLocationPath())
      } catch {}
      try { toast.error('Session expired. Please sign in again.') } catch {}
      try { logout() } catch {}
      try { navigate({ view: 'threads', sessionId: null }, { replace: true }) } catch {}
    }
    window.addEventListener('practica:auth-expired', onAuthExpired, { once: true })
    return () => window.removeEventListener('practica:auth-expired', onAuthExpired)
  }, [logout, navigate, toast])
}
