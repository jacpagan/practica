import { useCallback } from 'react'
import { useAuth } from '../auth'

const cache = new Map()

async function fetchSession(id, token) {
  const key = String(id)
  if (cache.has(key)) return cache.get(key)
  const promise = fetch(`/api/sessions/${id}/`, token ? { headers: { Authorization: `Token ${token}` } } : {})
    .then((r) => r.ok ? r.json() : null)
    .catch(() => null)
  cache.set(key, promise)
  return promise
}

export default function usePrefetchSession() {
  const { token } = useAuth()
  return useCallback((id) => {
    try {
      // Desktop only: prefer fine pointer devices
      if (typeof window !== 'undefined') {
        const isDesktop = window.matchMedia && window.matchMedia('(pointer: fine)').matches
        if (!isDesktop) return
      }
      fetchSession(id, token)
    } catch {}
  }, [token])
}

