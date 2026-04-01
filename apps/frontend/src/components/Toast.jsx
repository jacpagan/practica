import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'

const ToastContext = createContext(null)

let toastId = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((message, type = 'info', duration = 3000, action = null) => {
    const id = ++toastId
    setToasts(prev => [...prev, { id, message, type, exiting: false, action }])
    const startExit = () => setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t))
    const remove = () => setToasts(prev => prev.filter(t => t.id !== id))
    const exitTimer = setTimeout(() => {
      startExit()
      setTimeout(remove, 200)
    }, duration)
    return {
      id,
      dismiss: () => { clearTimeout(exitTimer); startExit(); setTimeout(remove, 200) },
    }
  }, [])

  const toast = useCallback((message, duration) => addToast(message, 'info', duration), [addToast])
  toast.success = useCallback((msg, dur) => addToast(msg, 'success', dur), [addToast])
  toast.error = useCallback((msg, dur) => addToast(msg, 'error', dur ?? 4000), [addToast])
  // Action toasts (e.g., Undo)
  toast.action = useCallback((msg, action, dur) => addToast(msg, 'info', dur ?? 3500, action), [addToast])
  toast.successAction = useCallback((msg, action, dur) => addToast(msg, 'success', dur ?? 3500, action), [addToast])

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* Toast container */}
      <div
        className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 z-[100] flex flex-col gap-2 pointer-events-none"
        role="region"
        aria-label="Notifications"
      >
        {toasts.map(t => (
          <div
            key={t.id}
            role={t.type === 'error' ? 'alert' : 'status'}
            aria-live={t.type === 'error' ? 'assertive' : 'polite'}
            className={`pointer-events-auto px-4 py-3 rounded-xl shadow-lg text-sm font-medium transition-all duration-200 ${
              t.exiting ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'
            } ${
              t.type === 'success' ? 'bg-gray-900 text-white' :
              t.type === 'error' ? 'bg-red-600 text-white' :
              'bg-gray-800 text-white'
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                {t.type === 'success' && (
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {t.type === 'error' && (
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                )}
                <span className="truncate">{t.message}</span>
              </div>
              {t.action ? (
                <button
                  type="button"
                  onClick={() => {
                    try { t.action.onClick?.() } catch {}
                    // Dismiss this toast immediately
                    t.exiting = true
                    // trigger state update to remove
                    setToasts(prev => prev.map(x => x.id === t.id ? { ...x, exiting: true } : x))
                    setTimeout(() => setToasts(prev => prev.filter(x => x.id !== t.id)), 200)
                  }}
                  className={`shrink-0 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors ${
                    t.type === 'error' ? 'bg-white/10 border-white/20 text-white hover:bg-white/20' : 'bg-white text-gray-900 border-white/0 hover:bg-gray-100'
                  }`}
                >
                  {t.action.label || 'Action'}
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
