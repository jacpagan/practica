import { useCallback } from 'react'

import { saveProgressScrollRestore } from '../progressReturnState'

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

  const onDetailSessionDelete = useCallback(async (sessionId, returnRoute = null) => {
    setSessions((current) => current.filter((item) => item.id !== sessionId))
    setSelectedSession(null)
    const route = returnRoute?.view ? returnRoute : { view: 'progress', sessionId: null }
    saveProgressScrollRestore(route)
    await navigate(route, { replace: true })
  }, [navigate, setSelectedSession, setSessions])

  return {
    onDetailSessionDelete,
    onDetailSessionUpdate,
  }
}
