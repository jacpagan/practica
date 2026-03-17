import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { reportClientError } from './utils'
import { AuthProvider, useAuth } from './auth'
import { ToastProvider, useToast } from './components/Toast'
import { ConfirmProvider } from './components/ConfirmDialog'
import AuthForm from './components/AuthForm'
import ReviewPage from './components/ReviewPage'
import SessionUpload from './components/SessionUpload'
import SessionDetail from './components/SessionDetail'
import Dashboard from './components/Dashboard'
import ProgressPage from './components/ProgressPage'
import SettingsPage from './components/SettingsPage'

const parseRoute = (pathname) => {
  if (pathname === '/' || pathname === '/dashboard') return { view: 'dashboard', sessionId: null }
  if (pathname === '/upload') return { view: 'upload', sessionId: null }
  if (pathname === '/progress') return { view: 'progress', sessionId: null }
  if (pathname === '/settings') return { view: 'settings', sessionId: null }
  const reviewMatch = pathname.match(/^\/r\/(.+)$/)
  if (reviewMatch) return { view: 'review', token: reviewMatch[1] }
  const sessionMatch = pathname.match(/^\/sessions\/(\d+)$/)
  if (sessionMatch) return { view: 'detail', sessionId: Number(sessionMatch[1]) }
  return { view: 'dashboard', sessionId: null }
}

const routePath = ({ view, sessionId, token }) => {
  if (view === 'dashboard') return '/dashboard'
  if (view === 'upload') return '/upload'
  if (view === 'progress') return '/progress'
  if (view === 'settings') return '/settings'
  if (view === 'review' && token) return `/r/${token}`
  if (view === 'detail' && sessionId) return `/sessions/${sessionId}`
  return '/dashboard'
}

function AppContent() {
  const { user, token, loading, logout, refreshUser } = useAuth()
  const toast = useToast()
  const initialRoute = useMemo(() => parseRoute(window.location.pathname), [])
  const [view, setView] = useState(initialRoute.view)
  const [routeSessionId, setRouteSessionId] = useState(initialRoute.sessionId)
  const [selectedSession, setSelectedSession] = useState(null)
  const [reviewToken, setReviewToken] = useState(initialRoute.token || '')


  const navigate = useCallback((nextRoute, { replace = false } = {}) => {
    setView(nextRoute.view)
    setRouteSessionId(nextRoute.sessionId ?? null)
    setReviewToken(nextRoute.token || '')
    const path = routePath(nextRoute)
    if (path !== window.location.pathname) {
      if (replace) window.history.replaceState(null, '', path)
      else window.history.pushState(null, '', path)
    }
  }, [])

  useEffect(() => {
    const onPopState = () => {
      const route = parseRoute(window.location.pathname)
      setView(route.view)
      setRouteSessionId(route.sessionId)
      setReviewToken(route.token || '')
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const openSessionById = useCallback(async (sessionId, { updateUrl = true } = {}) => {
    try {
      const res = await fetch(`/api/v1/sessions/${sessionId}`, { headers: token ? { Authorization: `Token ${token}` } : {} })
      if (!res.ok) throw new Error('session')
      const data = await res.json()
      setSelectedSession(data)
      if (updateUrl) navigate({ view: 'detail', sessionId: data.id })
    } catch {
      toast.error('Could not load session')
      navigate({ view: 'dashboard', sessionId: null }, { replace: true })
    }
  }, [token, navigate, toast])

  useEffect(() => {
    const handler = () => refreshUser()
    window.addEventListener('user-updated', handler)
    return () => window.removeEventListener('user-updated', handler)
  }, [refreshUser])

  useEffect(() => {
    if (!user) return
    if (view === 'detail' && routeSessionId && selectedSession?.id !== routeSessionId) {
      openSessionById(routeSessionId, { updateUrl: false })
    }
  }, [user, view, routeSessionId, selectedSession?.id, openSessionById])

  const openSession = (session) => {
    setSelectedSession(session)
    navigate({ view: 'detail', sessionId: session.id })
  }

  const goHome = useCallback(() => {
    navigate({ view: 'dashboard', sessionId: null })
    setSelectedSession(null)
  }, [navigate])

  const handleUploadComplete = (session) => {
    setSelectedSession(session)
    navigate({ view: 'detail', sessionId: session.id })
  }

  if (loading) {
    return <div className="min-h-screen bg-white flex items-center justify-center"><p className="text-sm text-gray-400">Loading...</p></div>
  }
  if (!user) {
    if (view === 'review') return <ReviewPage />
    return <AuthForm />
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-100 px-4 py-3 sm:px-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <button onClick={goHome} className="text-lg font-semibold text-gray-900 tracking-tight">
            Practica
          </button>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate({ view: 'dashboard' })} className={`text-xs px-2 py-1 rounded ${view === 'dashboard' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>Dashboard</button>
            <button onClick={() => navigate({ view: 'upload' })} className={`text-xs px-2 py-1 rounded ${view === 'upload' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>Upload</button>
            <button onClick={() => navigate({ view: 'progress' })} className={`text-xs px-2 py-1 rounded ${view === 'progress' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>Progress</button>
            <button onClick={() => navigate({ view: 'settings' })} className={`text-xs px-2 py-1 rounded ${view === 'settings' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>Settings</button>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 border-l border-gray-100 pl-3">
              <span className="text-xs text-gray-400">{user.display_name}</span>
              <button onClick={logout} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
                Log out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto pb-24">
        {view === 'review' && (
          <ReviewPage />
        )}
        {view === 'dashboard' && (
          <Dashboard token={token} onOpenSession={openSession} onNewUpload={() => navigate({ view: 'upload' })} />
        )}
        {view === 'upload' && (
          <SessionUpload
            token={token}
            onComplete={handleUploadComplete}
            onCancel={goHome}
          />
        )}

        {view === 'detail' && selectedSession && (
          <SessionDetail
            session={selectedSession}
            currentUser={user}
            token={token}
            onBack={goHome}
            onSessionUpdate={(sessionData) => {
              setSelectedSession(sessionData)
            }}
            onOpenCompare={null}
          />
        )}
        {view === 'progress' && <ProgressPage token={token} />}
        {view === 'settings' && <SettingsPage user={user} />}
      </main>
    </div>
  )
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() { return { hasError: true } }
  componentDidCatch(err) {
    try { console.error(err) } catch {}
    try {
      reportClientError({ source: 'ErrorBoundary', message: err?.message || 'render error', stack: err?.stack || '' })
    } catch {}
    try {
      if (typeof window !== 'undefined') {
        const key = 'practica.errorboundary.reloaded'
        const once = window.sessionStorage?.getItem(key)
        if (!once) {
          window.sessionStorage?.setItem(key, '1')
          setTimeout(() => { try { window.location.reload() } catch {} }, 250)
        }
      }
    } catch {}
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-white flex items-center justify-center px-4">
          <div className="text-center">
            <p className="text-sm text-gray-600">Something went wrong. Reloading…</p>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <ConfirmProvider>
          <ErrorBoundary>
            <AppContent />
          </ErrorBoundary>
        </ConfirmProvider>
      </ToastProvider>
    </AuthProvider>
  )
}

export default App
