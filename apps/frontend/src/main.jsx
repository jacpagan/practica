import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { reportClientError } from './utils'

if (typeof window !== 'undefined' && !window.__practicaErrorHandlersInstalled) {
  window.__practicaErrorHandlersInstalled = true

  window.addEventListener('error', (event) => {
    reportClientError({
      source: 'window.error',
      message: event?.message || 'Unhandled window error',
      stack: event?.error?.stack || '',
      extra: { filename: event?.filename || '', lineno: event?.lineno || 0, colno: event?.colno || 0 },
    })
  })

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event?.reason
    reportClientError({
      source: 'window.unhandledrejection',
      message: reason?.message || String(reason || 'Unhandled rejection'),
      stack: reason?.stack || '',
    })
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
