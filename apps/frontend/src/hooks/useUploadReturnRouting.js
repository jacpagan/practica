import { useCallback, useMemo } from 'react'

import { resolveUploadReturnRouteDraft } from '../routing'

export const useUploadReturnRouting = ({
  routeClaim,
  routeDate,
  routeSeriesName,
  routeSessionId,
  reviewToken,
  view,
}) => {
  const currentReturnRoute = useMemo(() => ({
    view,
    sessionId: routeSessionId,
    token: reviewToken,
    claim: routeClaim,
    seriesName: routeSeriesName,
    date: routeDate,
  }), [routeClaim, reviewToken, routeDate, routeSessionId, routeSeriesName, view])

  const resolveUploadReturnRoute = useCallback((draft = null) => resolveUploadReturnRouteDraft(draft, routeDate), [routeDate])

  return {
    currentReturnRoute,
    resolveUploadReturnRoute,
  }
}
