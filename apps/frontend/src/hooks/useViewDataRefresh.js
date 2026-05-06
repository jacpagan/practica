import { useEffect } from 'react'

export const useViewDataRefresh = ({
  loadSessions,
  user,
  view,
}) => {
  useEffect(() => {
    if (!user) return
    if (view === 'evidence' || view === 'series') loadSessions()
  }, [
    loadSessions,
    user,
    view,
  ])
}
