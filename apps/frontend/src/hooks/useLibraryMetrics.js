import { useMemo } from 'react'

export const useLibraryMetrics = ({
  ownerReviewRequests,
  sessions,
}) => {
  const activeOwnerRequestBySessionId = useMemo(() => {
    const bySessionId = new Map()
    const requests = [...ownerReviewRequests].sort((left, right) => new Date(right.created_at) - new Date(left.created_at))
    requests.forEach((item) => {
      const status = String(item?.status || '').trim().toLowerCase()
      if (['closed', 'revoked'].includes(status)) return
      const sessionId = Number(item?.session?.id || item?.session_id || 0)
      if (!sessionId || bySessionId.has(sessionId)) return
      bySessionId.set(sessionId, item)
    })
    return bySessionId
  }, [ownerReviewRequests])

  const ownReadySessionCount = useMemo(
    () => sessions.filter((item) => item?.can_edit && item?.processing_status === 'ready').length,
    [sessions],
  )

  const practiceThreadOptions = useMemo(
    () => Array.from(new Set(
      sessions
        .filter((item) => item?.can_edit)
        .map((item) => String(item?.practice_series || '').trim())
        .filter(Boolean),
    )).sort((left, right) => left.localeCompare(right)),
    [sessions],
  )

  return {
    activeOwnerRequestBySessionId,
    ownReadySessionCount,
    practiceThreadOptions,
  }
}
