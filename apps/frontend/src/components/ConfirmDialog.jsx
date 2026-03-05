import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'

const ConfirmContext = createContext(null)

export function ConfirmProvider({ children }) {
  const [dialog, setDialog] = useState(null)

  const confirm = useCallback((options = {}) => (
    new Promise((resolve) => {
      const {
        title = 'Confirm action',
        message = 'Are you sure?',
        confirmLabel = 'Confirm',
        cancelLabel = 'Cancel',
        tone = 'default',
      } = options
      setDialog({ title, message, confirmLabel, cancelLabel, tone, resolve })
    })
  ), [])

  const closeDialog = useCallback((result) => {
    if (!dialog) return
    dialog.resolve(Boolean(result))
    setDialog(null)
  }, [dialog])

  useEffect(() => {
    if (!dialog) return undefined
    const onKeyDown = (event) => {
      if (event.key === 'Escape') closeDialog(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [dialog, closeDialog])

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {dialog && (
        <div
          className="fixed inset-0 z-[120] bg-black/45 px-4 flex items-center justify-center"
          onClick={() => closeDialog(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-sm rounded-2xl bg-white shadow-xl p-4"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-sm font-semibold text-gray-900">{dialog.title}</h3>
            <p className="text-sm text-gray-600 mt-2">{dialog.message}</p>
            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                onClick={() => closeDialog(false)}
                className="text-xs text-gray-500 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                {dialog.cancelLabel}
              </button>
              <button
                onClick={() => closeDialog(true)}
                className={`text-xs font-medium text-white px-3 py-2 rounded-lg transition-colors ${
                  dialog.tone === 'danger'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-gray-900 hover:bg-gray-800'
                }`}
              >
                {dialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}

export const useConfirm = () => useContext(ConfirmContext)
