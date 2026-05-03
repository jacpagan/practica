import { useCallback } from 'react'

export const useOpenSessionById = ({
  navigate,
  setSelectedSession,
  token,
  toast,
}) => {
  return useCallback(async (sessionId, { updateUrl = true } = {}) => {
    if (!token) return
    try {
      let res
      let attempt = 0
      while (true) {
        try {
          res = await fetch(`/api/sessions/${sessionId}/`, { headers: { Authorization: `Token ${token}` } })
          if (res.ok || res.status < 500 || attempt >= 2) break
        } catch (error) {
          if (attempt >= 2) throw error
        }
        await new Promise((resolve) => setTimeout(resolve, 400 * Math.pow(2, attempt)))
        attempt += 1
      }
      if (!res.ok) throw new Error('session')
      const data = await res.json()
      setSelectedSession(data)
      if (updateUrl) navigate({ view: 'detail', sessionId: data.id })
    } catch {
      toast.error('Could not load video')
      navigate({ view: 'threads', sessionId: null }, { replace: true })
    }
  }, [navigate, setSelectedSession, token, toast])
}
