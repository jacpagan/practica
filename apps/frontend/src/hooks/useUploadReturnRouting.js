import { useCallback, useMemo } from 'react'

import { resolveUploadReturnRouteDraft } from '../routing'

export const useUploadReturnRouting = ({
  routeDate,
  routeSeriesName,
  routeSessionId,
  view,
}) => {
  const currentReturnRoute = useMemo(() => ({
    view,
    sessionId: routeSessionId,
    seriesName: routeSeriesName,
    date: routeDate,
  }), [routeDate, routeSessionId, routeSeriesName, view])

  const resolveUploadReturnRoute = useCallback((draft = null) => resolveUploadReturnRouteDraft(draft, routeDate), [routeDate])

  return {
    currentReturnRoute,
    resolveUploadReturnRoute,
  }
}
