import { useEffect } from 'react'

export const useViewDataRefresh = ({
  loadOwnerReviewRequests,
  loadReviewerWorkspaceAvailability,
  loadSessions,
  user,
  view,
}) => {
  useEffect(() => {
    if (!user) return
    if (view === 'series') loadSessions()
    if (view === 'calendar') loadOwnerReviewRequests()
    loadReviewerWorkspaceAvailability()
  }, [
    loadOwnerReviewRequests,
    loadReviewerWorkspaceAvailability,
    loadSessions,
    user,
    view,
  ])
}
