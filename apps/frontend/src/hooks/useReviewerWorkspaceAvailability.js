import { useCallback } from 'react'

export const useReviewerWorkspaceAvailability = ({
  fetchPaginated,
  setHasReviewerWorkspace,
  setReviewerPendingCount,
  token,
}) => {
  return useCallback(async () => {
    if (!token) return
    try {
      const requests = await fetchPaginated('/api/review-requests/?role=reviewer')
      setHasReviewerWorkspace(requests.length > 0)
      const pending = requests.filter((item) => ['requested', 'opened'].includes(String(item?.status || '').trim().toLowerCase())).length
      setReviewerPendingCount(pending)
    } catch {
      setHasReviewerWorkspace(false)
      setReviewerPendingCount(0)
    }
  }, [fetchPaginated, setHasReviewerWorkspace, setReviewerPendingCount, token])
}
