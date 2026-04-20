import { useEffect } from 'react'

export const useSessionUpdatedListener = ({
  calendarMonthCacheRef,
  setSelectedSession,
  setSessions,
  token,
}) => {
  useEffect(() => {
    const handler = async (event) => {
      const id = Number(event?.detail?.id || 0)
      if (!id || !token) return
      calendarMonthCacheRef.current.clear()
      try {
        const res = await fetch(`/api/sessions/${id}/`, { headers: { Authorization: `Token ${token}` } })
        if (!res.ok) return
        const data = await res.json()
        setSessions((current) => current.map((item) => (item.id === id ? { ...item, ...data } : item)))
        setSelectedSession((prev) => (prev && prev.id === id ? { ...prev, ...data } : prev))
      } catch {}
    }
    window.addEventListener('practica:session-updated', handler)
    return () => window.removeEventListener('practica:session-updated', handler)
  }, [calendarMonthCacheRef, setSelectedSession, setSessions, token])
}
