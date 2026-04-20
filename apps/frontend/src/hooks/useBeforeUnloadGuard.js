import { useEffect } from 'react'

export const useBeforeUnloadGuard = (uploadGuardRef) => {
  useEffect(() => {
    const onBeforeUnload = (event) => {
      if (!uploadGuardRef.current.active) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [uploadGuardRef])
}
