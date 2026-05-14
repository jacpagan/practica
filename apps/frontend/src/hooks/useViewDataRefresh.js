import { useEffect } from 'react'

export const useViewDataRefresh = ({
  loadSessions,
  user,
  view,
}) => {
  useEffect(() => {
    if (!user) return
    if (view === 'privacy') return
    loadSessions()
  }, [
    loadSessions,
    user,
    view,
  ])
}
