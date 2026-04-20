import { useCallback } from 'react'

export const useSessionsLoader = ({
  fetchPaginated,
  setSessions,
  setSessionsLoading,
  toast,
  token,
}) => {
  return useCallback(async () => {
    if (!token) return
    setSessionsLoading(true)
    try {
      const items = await fetchPaginated('/api/sessions/')
      setSessions(items)
    } catch {
      setSessions([])
      toast.error('Could not load your library')
    } finally {
      setSessionsLoading(false)
    }
  }, [fetchPaginated, setSessions, setSessionsLoading, toast, token])
}
