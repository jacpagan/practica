import { useCallback } from 'react'

export const usePrimaryNavigation = ({
  navigate,
}) => {
  const goToday = useCallback(() => navigate({ view: 'today', sessionId: null }), [navigate])
  const goProgress = useCallback(() => navigate({ view: 'progress', sessionId: null }), [navigate])
  const goPrivacy = useCallback(() => navigate({ view: 'privacy', sessionId: null }), [navigate])
  const goRecord = useCallback(() => navigate({ view: 'record', sessionId: null }), [navigate])

  const goSkill = useCallback((seriesName) => {
    navigate({ view: 'skill', sessionId: null, seriesName })
  }, [navigate])

  return {
    goToday,
    goProgress,
    goPrivacy,
    goRecord,
    goSkill,
  }
}
