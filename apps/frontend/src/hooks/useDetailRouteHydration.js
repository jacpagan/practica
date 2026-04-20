import { useEffect } from 'react'

export const useDetailRouteHydration = ({
  openSessionById,
  routeSessionId,
  selectedSessionId,
  user,
  view,
}) => {
  useEffect(() => {
    if (!user) return
    if (view === 'detail' && routeSessionId && selectedSessionId !== routeSessionId) {
      openSessionById(routeSessionId, { updateUrl: false })
    }
  }, [openSessionById, routeSessionId, selectedSessionId, user, view])
}
