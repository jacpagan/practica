import { useCallback } from 'react'

export const useSessionViewCallbacks = ({
  navigate,
  setSelectedSession,
  setSessions,
}) => {
  const onDetailSessionUpdate = useCallback((sessionData) => {
    setSelectedSession(sessionData)
    setSessions((current) => current.map((item) => (
      item.id === sessionData.id ? { ...item, ...sessionData } : item
    )))
  }, [setSelectedSession, setSessions])

  const onDetailSessionDelete = useCallback((sessionId, returnRoute = null) => {
    setSessions((current) => current.filter((item) => item.id !== sessionId))
    setSelectedSession(null)
    const route = returnRoute?.view ? returnRoute : { view: 'progress', sessionId: null }
    navigate(route, { replace: true })
    if (route.view === 'progress' && Number.isFinite(Number(route.scrollY))) {
      window.setTimeout(() => {
        try { window.scrollTo({ top: Number(route.scrollY), behavior: 'auto' }) } catch {}
      }, 0)
    }
  }, [navigate, setSelectedSession, setSessions])

  return {
    onDetailSessionDelete,
    onDetailSessionUpdate,
  }
}
