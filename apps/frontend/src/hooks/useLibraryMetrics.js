import { useMemo } from 'react'

export const useLibraryMetrics = ({
  sessions,
}) => {
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
    practiceThreadOptions,
  }
}
