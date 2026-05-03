import { useEffect } from 'react'

import { routePath } from '../routing'

export const useCurrentRoutePath = ({
  currentPathRef,
  route,
}) => {
  useEffect(() => {
    currentPathRef.current = routePath(route)
  }, [
    currentPathRef,
    route.date,
    route.seriesName,
    route.sessionId,
    route.view,
  ])
}
