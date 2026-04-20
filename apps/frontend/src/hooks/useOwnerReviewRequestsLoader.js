import { useCallback } from 'react'

export const useOwnerReviewRequestsLoader = ({
  fetchPaginated,
  setOwnerReviewRequests,
  token,
}) => {
  return useCallback(async () => {
    if (!token) return
    try {
      const items = await fetchPaginated('/api/review-requests/?role=owner')
      setOwnerReviewRequests(items)
    } catch {
      setOwnerReviewRequests([])
    }
  }, [fetchPaginated, setOwnerReviewRequests, token])
}
