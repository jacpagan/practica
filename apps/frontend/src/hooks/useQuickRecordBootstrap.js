import { useEffect } from 'react'

export const useQuickRecordBootstrap = (autoQuickRecordCheckedRef) => {
  useEffect(() => {
    if (autoQuickRecordCheckedRef.current) return
    autoQuickRecordCheckedRef.current = true
  }, [autoQuickRecordCheckedRef])
}
