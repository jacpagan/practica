import React from 'react'

import { reportClientError } from '../utils'

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(err) {
    try { console.error(err) } catch {}
    try {
      reportClientError({ source: 'ErrorBoundary', message: err?.message || 'render error', stack: err?.stack || '' })
    } catch {}
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-white flex items-center justify-center px-4">
          <div className="text-center space-y-3">
            <p className="text-sm text-gray-900 font-medium">Something went wrong.</p>
            <p className="text-xs text-gray-500">Try reloading or return home.</p>
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => { try { window.location.reload() } catch {} }}
                className="rounded-lg bg-gray-900 text-white px-3 py-1.5 text-xs hover:bg-gray-800"
              >
                Reload
              </button>
              <button
                type="button"
                onClick={() => { try { window.history.pushState(null, '', '/'); window.location.reload() } catch {} }}
                className="rounded-lg border border-gray-200 bg-white text-gray-900 px-3 py-1.5 text-xs hover:bg-gray-50"
              >
                Go home
              </button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export default AppErrorBoundary
