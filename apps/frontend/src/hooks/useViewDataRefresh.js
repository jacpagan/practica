import { useEffect } from 'react'

export const useViewDataRefresh = ({
  loadSessions,
  user,
  view,
}) => {
  useEffect(() => {
    if (!user) return
    if (view === 'threads' || view === 'series') loadSessions()
  }, [
    loadSessions,
    user,
    view,
  ])
}
