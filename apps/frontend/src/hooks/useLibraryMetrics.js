import { useMemo } from 'react'

export const useLibraryMetrics = ({
  sessions,
}) => {
  const skillOptions = useMemo(
    () => {
      const byCanonicalName = new Map()
      ;(sessions || []).forEach((item) => {
        const rawName = String(item?.practice_series || '').trim()
        if (!rawName) return
        const canonicalName = rawName.toLocaleLowerCase()
        if (byCanonicalName.has(canonicalName)) return
        byCanonicalName.set(canonicalName, rawName)
      })
      return Array.from(byCanonicalName.values()).sort((left, right) => left.localeCompare(right))
    },
    [sessions],
  )

  return {
    skillOptions,
  }
}
