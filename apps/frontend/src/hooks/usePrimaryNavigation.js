import { useCallback } from 'react'

export const usePrimaryNavigation = ({
  navigate,
}) => {
  const goHome = useCallback(() => navigate({ view: 'threads', sessionId: null }), [navigate])
  const goPrivacy = useCallback(() => navigate({ view: 'privacy', sessionId: null }), [navigate])
  const goRequests = useCallback(() => navigate({ view: 'requests', sessionId: null }), [navigate])
  const goRecord = useCallback(() => navigate({ view: 'record', sessionId: null }), [navigate])

  const goSeries = useCallback((seriesName) => {
    navigate({ view: 'series', sessionId: null, seriesName })
  }, [navigate])

  const goReviewByToken = useCallback((token) => {
    if (!token) return
    navigate({ view: 'review', token, sessionId: null })
  }, [navigate])

  return {
    goHome,
    goPrivacy,
    goRecord,
    goRequests,
    goReviewByToken,
    goSeries,
  }
}
