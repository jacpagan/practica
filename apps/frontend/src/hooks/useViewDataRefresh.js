import { useEffect } from 'react'

export const useViewDataRefresh = ({
  loadSessions,
  user,
  view,
}) => {
  useEffect(() => {
    if (!user) return
    if (view === 'calendar' || view === 'series') loadSessions()
  }, [
    loadSessions,
    user,
    view,
  ])
}
