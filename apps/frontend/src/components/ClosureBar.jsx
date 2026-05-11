import React from 'react'

export default function ClosureBar({
  canClose = false,
  canRetry = false,
  onClose = () => {},
  onRetry = () => {},
  subtleText = '',
  retryLabel = 'Continue loop',
  closeLabel = 'Close routine',
  primaryAction = 'close',
}) {
  if (!canClose && !canRetry) return null
  const showRetryPrimary = canRetry && primaryAction === 'retry'
  const retryClassName = showRetryPrimary
    ? 'text-xs font-medium text-white bg-gray-900 rounded-full px-4 py-1.5 hover:bg-gray-800 transition-colors'
    : 'text-xs text-gray-700 border border-gray-200 rounded-full px-3 py-1.5 hover:bg-gray-50 transition-colors'
  const closeClassName = !showRetryPrimary
    ? 'text-xs font-medium text-white bg-gray-900 rounded-full px-4 py-1.5 hover:bg-gray-800 transition-colors'
    : 'text-xs text-gray-700 border border-gray-200 rounded-full px-3 py-1.5 hover:bg-gray-50 transition-colors'

  return (
    <div className="sticky bottom-4 z-10">
      <div className="mx-auto max-w-3xl rounded-full shadow-lg bg-white border border-gray-200 px-2 py-1.5 flex items-center justify-between gap-2">
        <div className="text-xs text-gray-600 px-2 truncate">{subtleText || 'Finish this loop when you’re ready.'}</div>
        <div className="flex items-center gap-1">
          {canRetry ? (
            <button type="button" onClick={onRetry} className={retryClassName}>
              {retryLabel}
            </button>
          ) : null}
          {canClose ? (
            <button type="button" onClick={onClose} className={closeClassName}>
              {closeLabel}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
