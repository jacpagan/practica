import { useEffect, useState } from 'react'

export const useOfflineStatus = () => {
  const [offline, setOffline] = useState(typeof navigator !== 'undefined' ? !navigator.onLine : false)

  useEffect(() => {
    const updateOnline = () => setOffline(typeof navigator !== 'undefined' ? !navigator.onLine : false)
    try {
      window.addEventListener('online', updateOnline)
      window.addEventListener('offline', updateOnline)
      updateOnline()
    } catch {}
    return () => {
      try {
        window.removeEventListener('online', updateOnline)
        window.removeEventListener('offline', updateOnline)
      } catch {}
    }
  }, [])

  return offline
}
