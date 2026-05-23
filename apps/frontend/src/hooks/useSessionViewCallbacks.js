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

  const onDetailSessionDelete = useCallback((sessionId) => {
    setSessions((current) => current.filter((item) => item.id !== sessionId))
    setSelectedSession(null)
    navigate({ view: 'progress', sessionId: null }, { replace: true })
  }, [navigate, setSelectedSession, setSessions])

  return {
    onDetailSessionDelete,
    onDetailSessionUpdate,
  }
}
