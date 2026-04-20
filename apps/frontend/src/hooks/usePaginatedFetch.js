import { useCallback } from 'react'

import { fetchPaginatedWithToken } from '../pagination'

export const usePaginatedFetch = (token) => {
  return useCallback((path) => fetchPaginatedWithToken(path, token), [token])
}
