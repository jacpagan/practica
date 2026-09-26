import { useCallback } from 'react'

export const usePrimaryNavigation = ({
  navigate,
}) => {
  const goProgress = useCallback(() => navigate({ view: 'progress', sessionId: null }), [navigate])
  const goArchive = useCallback(() => navigate({ view: 'archive', sessionId: null }), [navigate])
  const goPrivacy = useCallback(() => navigate({ view: 'privacy', sessionId: null }), [navigate])
  const goRecord = useCallback(() => navigate({ view: 'record', sessionId: null }), [navigate])

  const goSkill = useCallback((seriesName) => {
    navigate({ view: 'skill', sessionId: null, seriesName })
  }, [navigate])

  return {
    goProgress,
    goArchive,
    goPrivacy,
    goRecord,
    goSkill,
  }
}
