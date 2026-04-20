import { useEffect } from 'react'

export const useReviewerWorkspacePolling = ({
  loadReviewerWorkspaceAvailability,
  reviewerPollRef,
  token,
}) => {
  useEffect(() => {
    if (!token) return () => {}
    const start = () => {
      if (reviewerPollRef.current) { try { clearInterval(reviewerPollRef.current) } catch {} }
      loadReviewerWorkspaceAvailability()
      reviewerPollRef.current = setInterval(() => {
        if (typeof document !== 'undefined' && document.hidden) return
        loadReviewerWorkspaceAvailability()
      }, 45000)
    }
    const stop = () => {
      if (reviewerPollRef.current) { try { clearInterval(reviewerPollRef.current) } catch {}; reviewerPollRef.current = null }
    }
    const onVisibility = () => {
      if (typeof document !== 'undefined' && document.hidden) stop()
      else start()
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibility)
      onVisibility()
      return () => { document.removeEventListener('visibilitychange', onVisibility); stop() }
    }
    start()
    return () => stop()
  }, [loadReviewerWorkspaceAvailability, reviewerPollRef, token])
}
