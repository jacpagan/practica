import React, { useState, useEffect, useMemo, useCallback, Component } from 'react'
import { AuthProvider, useAuth, authHeaders } from './auth'
import { ToastProvider, useToast } from './components/Toast'
import { ConfirmProvider } from './components/ConfirmDialog'
import AuthForm from './components/AuthForm'
import SessionUpload from './components/SessionUpload'
import SessionDetail from './components/SessionDetail'
import ConnectionsView from './components/ConnectionsView'
import QuickRecord from './components/QuickRecord'
import ScreenRecord from './components/ScreenRecord'
import TodayView from './components/TodayView'
import CoachDashboard from './components/CoachDashboard'
import { canUseScreenRecording, reportClientError } from './utils'

const parseRoute = (pathname) => {
  if (pathname === '/today') return { view: 'today', sessionId: null, spaceId: null }
  if (pathname === '/upload') return { view: 'upload', sessionId: null, spaceId: null }
  if (pathname === '/spaces') return { view: 'connections', sessionId: null, spaceId: null }
  if (pathname === '/record') return { view: 'quickRecord', sessionId: null, spaceId: null }
  if (pathname === '/record-screen') return { view: 'screenRecord', sessionId: null, spaceId: null }

  const dashboardMatch = pathname.match(/^\/spaces\/(\d+)\/dashboard$/)
  if (dashboardMatch) {
    return { view: 'coachDashboard', sessionId: null, spaceId: Number(dashboardMatch[1]) }
  }

  const sessionMatch = pathname.match(/^\/sessions\/(\d+)$/)
  if (sessionMatch) {
    return { view: 'detail', sessionId: Number(sessionMatch[1]), spaceId: null }
  }

  return { view: 'today', sessionId: null, spaceId: null }
}

const routePath = ({ view, sessionId, spaceId }) => {
  if (view === 'today') return '/today'
  if (view === 'upload') return '/upload'
  if (view === 'connections') return '/spaces'
  if (view === 'quickRecord') return '/record'
  if (view === 'screenRecord') return '/record-screen'
  if (view === 'coachDashboard' && spaceId) return `/spaces/${spaceId}/dashboard`
  if (view === 'detail' && sessionId) return `/sessions/${sessionId}`
  return '/today'
}

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error: error.message }
  }

  componentDidCatch(error, errorInfo) {
    reportClientError({
      source: 'react_error_boundary',
      message: error?.message || 'Unknown UI error',
      stack: `${error?.stack || ''}\n${errorInfo?.componentStack || ''}`,
    })
  }

  render() {
    if (this.state.error) {
      return (
        <div className="px-4 py-12 text-center">
          <p className="text-sm text-red-500 mb-2">Something went wrong</p>
          <p className="text-xs text-gray-400 mb-4">{this.state.error}</p>
          <button onClick={this.props.onBack} className="text-sm text-gray-500 underline">Go back</button>
        </div>
      )
    }
    return this.props.children
  }
}

function AppContent() {
  const { user, token, loading, logout, refreshUser } = useAuth()
  const toast = useToast()
  const [exercises, setExercises] = useState([])
  const [spaces, setSpaces] = useState([])
  const [exercisesLoading, setExercisesLoading] = useState(false)
  const [exercisesLoaded, setExercisesLoaded] = useState(false)
  const [exercisesNext, setExercisesNext] = useState(null)
  const initialRoute = useMemo(() => parseRoute(window.location.pathname), [])
  const [view, setView] = useState(initialRoute.view)
  const [routeSessionId, setRouteSessionId] = useState(initialRoute.sessionId)
  const [routeSpaceId, setRouteSpaceId] = useState(initialRoute.spaceId)
  const [selectedSession, setSelectedSession] = useState(null)

  const headers = useMemo(() => authHeaders(token), [token])
  const screenRecordSupported = canUseScreenRecording()
  const hasSpaces = spaces.length > 0 || Boolean(user?.has_spaces)

  const navigate = useCallback((nextRoute, { replace = false } = {}) => {
    setView(nextRoute.view)
    setRouteSessionId(nextRoute.sessionId ?? null)
    setRouteSpaceId(nextRoute.spaceId ?? null)
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
      setRouteSpaceId(route.spaceId)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const parseCollectionPayload = (data) => {
    if (Array.isArray(data)) return { items: data, next: null }
    if (data && Array.isArray(data.results)) return { items: data.results, next: data.next || null }
    return { items: [], next: null }
  }

  const fetchSpaces = useCallback(async () => {
    try {
      const res = await fetch('/api/spaces/', { headers })
      const data = await res.json()
      setSpaces(data.results || data)
    } catch {
      toast.error('Could not load spaces')
    }
  }, [headers, toast])

  const fetchExercises = useCallback(async ({ append = false, url = null } = {}) => {
    if (!append) setExercisesLoaded(false)
    setExercisesLoading(true)
    try {
      const res = await fetch(url || '/api/exercises/', { headers })
      if (!res.ok) throw new Error('exercises')
      const data = await res.json()
      const parsed = parseCollectionPayload(data)
      setExercises((prev) => (append ? [...prev, ...parsed.items] : parsed.items))
      setExercisesNext(parsed.next)
      setExercisesLoaded(true)
    } catch {
      if (!append) toast.error('Could not load exercises')
    } finally {
      setExercisesLoading(false)
    }
  }, [headers, toast])

  const openSessionById = useCallback(async (sessionId, { updateUrl = true } = {}) => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/`, { headers })
      if (!res.ok) throw new Error('session')
      const data = await res.json()
      setSelectedSession(data)
      if (updateUrl) navigate({ view: 'detail', sessionId: data.id, spaceId: null })
    } catch {
      toast.error('Could not load session')
      navigate({ view: 'today', sessionId: null, spaceId: null }, { replace: true })
    }
  }, [headers, navigate, toast])

  useEffect(() => {
    if (user) {
      fetchSpaces()
      fetchExercises()
    }
  }, [user, fetchSpaces, fetchExercises])

  useEffect(() => {
    const handler = () => refreshUser()
    window.addEventListener('user-updated', handler)
    return () => window.removeEventListener('user-updated', handler)
  }, [refreshUser])

  useEffect(() => {
    const handler = () => fetchSpaces()
    window.addEventListener('space-updated', handler)
    return () => window.removeEventListener('space-updated', handler)
  }, [fetchSpaces])

  useEffect(() => {
    if (!user) return
    if (view === 'detail' && routeSessionId && selectedSession?.id !== routeSessionId) {
      openSessionById(routeSessionId, { updateUrl: false })
    }
  }, [user, view, routeSessionId, selectedSession?.id, openSessionById])

  useEffect(() => {
    if (!user) return
    if (view !== 'screenRecord') return
    if (screenRecordSupported) return
    toast.error('Screen recording is not supported on this browser')
    navigate({ view: 'today', sessionId: null, spaceId: null }, { replace: true })
  }, [user, view, screenRecordSupported, navigate, toast])

  const loadMoreExercises = async () => {
    if (!exercisesNext || exercisesLoading) return
    await fetchExercises({ append: true, url: exercisesNext })
  }

  const openSession = (session) => {
    setSelectedSession(session)
    navigate({ view: 'detail', sessionId: session.id, spaceId: null })
  }

  const goHome = useCallback(() => {
    navigate({ view: 'today', sessionId: null, spaceId: null })
    setSelectedSession(null)
    fetchSpaces()
  }, [navigate, fetchSpaces])

  const openToday = () => navigate({ view: 'today', sessionId: null, spaceId: null })
  const openCoachDashboard = (spaceId) => navigate({ view: 'coachDashboard', sessionId: null, spaceId })

  const handleProofSessionComplete = (session) => {
    fetchExercises()
    fetchSpaces()
    setSelectedSession(session)
    navigate({ view: 'detail', sessionId: session.id, spaceId: null })
  }

  if (loading) {
    return <div className="min-h-screen bg-white flex items-center justify-center"><p className="text-sm text-gray-400">Loading...</p></div>
  }
  if (!user) return <AuthForm />

  if (view === 'quickRecord') {
    return (
      <QuickRecord
        token={token}
        exercises={exercises}
        spaces={spaces}
        onComplete={handleProofSessionComplete}
        onCancel={goHome}
      />
    )
  }

  if (view === 'screenRecord') {
    return (
      <ScreenRecord
        token={token}
        spaces={spaces}
        onComplete={handleProofSessionComplete}
        onCancel={goHome}
      />
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-100 px-4 py-3 sm:px-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <button onClick={goHome} className="text-lg font-semibold text-gray-900 tracking-tight">
            Practica
          </button>
          <div className="flex items-center gap-3">
            {hasSpaces && view !== 'today' && (
              <button onClick={openToday} className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
                Today
              </button>
            )}
            {view !== 'connections' && (
              <button
                onClick={() => navigate({ view: 'connections', sessionId: null, spaceId: null })}
                className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
              >
                Spaces
              </button>
            )}
            {view !== 'today' && (
              <button onClick={goHome} className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
                Back
              </button>
            )}
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
        {view === 'today' && (
          <TodayView
            token={token}
            user={user}
            spaces={spaces}
            initialSpaceId={routeSpaceId}
            onOpenDashboard={openCoachDashboard}
            onOpenSession={openSession}
            onUploadProof={(spaceId) => navigate({ view: 'upload', sessionId: null, spaceId: spaceId || null })}
            onQuickRecordProof={(spaceId) => navigate({ view: 'quickRecord', sessionId: null, spaceId: spaceId || null })}
            onScreenRecordProof={screenRecordSupported ? (spaceId) => navigate({ view: 'screenRecord', sessionId: null, spaceId: spaceId || null }) : null}
          />
        )}

        {view === 'upload' && (
          <SessionUpload
            token={token}
            spaces={spaces}
            activeSpace={routeSpaceId}
            onComplete={handleProofSessionComplete}
            onCancel={goHome}
          />
        )}

        {view === 'detail' && selectedSession && (
          <SessionDetail
            session={selectedSession}
            exercises={exercises}
            spaces={spaces}
            token={token}
            user={user}
            onBack={goHome}
            onSessionUpdate={(sessionData) => {
              setSelectedSession(sessionData)
              fetchExercises()
              fetchSpaces()
            }}
            onOpenCompare={null}
          />
        )}

        {view === 'connections' && (
          <ConnectionsView spaces={spaces} token={token} onSpacesChange={fetchSpaces} />
        )}

        {view === 'coachDashboard' && routeSpaceId && (
          <ErrorBoundary onBack={goHome}>
            <CoachDashboard
              token={token}
              spaces={spaces}
              spaceId={routeSpaceId}
              exercises={exercises}
              exercisesLoading={exercisesLoading}
              exercisesLoaded={exercisesLoaded}
              exercisesHasMore={Boolean(exercisesNext)}
              onLoadMoreExercises={loadMoreExercises}
              onOpenSpaceDashboard={openCoachDashboard}
            />
          </ErrorBoundary>
        )}
      </main>
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <ConfirmProvider>
          <AppContent />
        </ConfirmProvider>
      </ToastProvider>
    </AuthProvider>
  )
}

export default App
