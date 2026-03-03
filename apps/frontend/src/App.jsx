import React, { useState, useEffect, useMemo, useCallback, Component } from 'react'
import { AuthProvider, useAuth, authHeaders } from './auth'
import { ToastProvider } from './components/Toast'
import { useToast } from './components/Toast'
import { ConfirmProvider } from './components/ConfirmDialog'
import AuthForm from './components/AuthForm'
import SessionList from './components/SessionList'
import SessionUpload from './components/SessionUpload'
import SessionDetail from './components/SessionDetail'
import ProgressView from './components/ProgressView'
import ConnectionsView from './components/ConnectionsView'
import QuickRecord from './components/QuickRecord'
import ScreenRecord from './components/ScreenRecord'
import CoachMetricsPanel from './components/CoachMetricsPanel'
import { canUseScreenRecording, reportClientError } from './utils'

const parseRoute = (pathname) => {
  if (pathname === '/upload') return { view: 'upload', sessionId: null, exerciseId: null }
  if (pathname === '/spaces') return { view: 'connections', sessionId: null, exerciseId: null }
  if (pathname === '/record') return { view: 'quickRecord', sessionId: null, exerciseId: null }
  if (pathname === '/record-screen') return { view: 'screenRecord', sessionId: null, exerciseId: null }

  const sessionMatch = pathname.match(/^\/sessions\/(\d+)$/)
  if (sessionMatch) {
    return { view: 'detail', sessionId: Number(sessionMatch[1]), exerciseId: null }
  }

  const exerciseMatch = pathname.match(/^\/exercises\/(\d+)$/)
  if (exerciseMatch) {
    return { view: 'progress', sessionId: null, exerciseId: Number(exerciseMatch[1]) }
  }

  return { view: 'sessions', sessionId: null, exerciseId: null }
}

const routePath = ({ view, sessionId, exerciseId }) => {
  if (view === 'upload') return '/upload'
  if (view === 'connections') return '/spaces'
  if (view === 'quickRecord') return '/record'
  if (view === 'screenRecord') return '/record-screen'
  if (view === 'detail' && sessionId) return `/sessions/${sessionId}`
  if (view === 'progress' && exerciseId) return `/exercises/${exerciseId}`
  return '/'
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
  const [sessions, setSessions] = useState([])
  const [exercises, setExercises] = useState([])
  const [spaces, setSpaces] = useState([])
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [exercisesLoading, setExercisesLoading] = useState(false)
  const [sessionsLoaded, setSessionsLoaded] = useState(false)
  const [exercisesLoaded, setExercisesLoaded] = useState(false)
  const [sessionsNext, setSessionsNext] = useState(null)
  const [exercisesNext, setExercisesNext] = useState(null)
  const [activeSpace, setActiveSpace] = useState(null) // null = all
  const initialRoute = useMemo(() => parseRoute(window.location.pathname), [])
  const [view, setView] = useState(initialRoute.view)
  const [routeSessionId, setRouteSessionId] = useState(initialRoute.sessionId)
  const [routeExerciseId, setRouteExerciseId] = useState(initialRoute.exerciseId)
  const [selectedSession, setSelectedSession] = useState(null)
  const [selectedExercise, setSelectedExercise] = useState(null)
  const [showCreateSpace, setShowCreateSpace] = useState(false)
  const [newSpaceName, setNewSpaceName] = useState('')

  const headers = useMemo(() => authHeaders(token), [token])
  const screenRecordSupported = canUseScreenRecording()

  const navigate = useCallback((nextRoute, { replace = false } = {}) => {
    setView(nextRoute.view)
    setRouteSessionId(nextRoute.sessionId ?? null)
    setRouteExerciseId(nextRoute.exerciseId ?? null)
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
      setRouteExerciseId(route.exerciseId)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    if (view !== 'detail') setSelectedSession(null)
    if (view !== 'progress') setSelectedExercise(null)
  }, [view])

  const normalizeApiUrl = (url) => {
    if (!url) return null
    try {
      const parsed = new URL(url, window.location.origin)
      return `${parsed.pathname}${parsed.search}`
    } catch {
      return url
    }
  }

  const parseCollectionPayload = (data) => {
    if (Array.isArray(data)) {
      return { items: data, next: null }
    }
    if (data && Array.isArray(data.results)) {
      return { items: data.results, next: normalizeApiUrl(data.next) }
    }
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

  const fetchSessions = useCallback(async ({ append = false, url = null } = {}) => {
    if (!append) setSessionsLoaded(false)
    setSessionsLoading(true)
    try {
      const targetUrl = url || (activeSpace ? `/api/sessions/?space=${activeSpace}` : '/api/sessions/')
      const res = await fetch(targetUrl, { headers })
      if (!res.ok) throw new Error('sessions')
      const data = await res.json()
      const parsed = parseCollectionPayload(data)
      setSessions(prev => (append ? [...prev, ...parsed.items] : parsed.items))
      setSessionsNext(parsed.next)
      setSessionsLoaded(true)
    } catch {
      if (!append) toast.error('Could not load sessions')
    } finally {
      setSessionsLoading(false)
    }
  }, [activeSpace, headers, toast])

  const fetchExercises = useCallback(async ({ append = false, url = null } = {}) => {
    if (!append) setExercisesLoaded(false)
    setExercisesLoading(true)
    try {
      const res = await fetch(url || '/api/exercises/', { headers })
      if (!res.ok) throw new Error('exercises')
      const data = await res.json()
      const parsed = parseCollectionPayload(data)
      setExercises(prev => (append ? [...prev, ...parsed.items] : parsed.items))
      setExercisesNext(parsed.next)
      setExercisesLoaded(true)
    } catch {
      if (!append) toast.error('Could not load exercises')
    } finally {
      setExercisesLoading(false)
    }
  }, [headers, toast])

  useEffect(() => {
    if (user) {
      fetchSpaces()
      fetchExercises()
    }
  }, [user, fetchSpaces, fetchExercises])

  useEffect(() => {
    if (user) fetchSessions()
  }, [user, activeSpace, fetchSessions])

  useEffect(() => {
    const handler = () => refreshUser()
    window.addEventListener('user-updated', handler)
    return () => window.removeEventListener('user-updated', handler)
  }, [refreshUser])

  const openSessionById = useCallback(async (sessionId, { updateUrl = true } = {}) => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/`, { headers })
      if (!res.ok) return toast.error('Could not load session')
      const data = await res.json()
      setSelectedSession(data)
      if (updateUrl) navigate({ view: 'detail', sessionId: data.id, exerciseId: null })
      else {
        setView('detail')
        setRouteSessionId(data.id)
      }
    } catch {
      toast.error('Could not load session')
    }
  }, [headers, navigate, toast])

  useEffect(() => {
    if (!user) return
    if (view === 'detail' && routeSessionId && selectedSession?.id !== routeSessionId) {
      openSessionById(routeSessionId, { updateUrl: false })
    }
    if (view === 'progress' && routeExerciseId && selectedExercise?.id !== routeExerciseId) {
      const found = exercises.find((exercise) => exercise.id === routeExerciseId)
      setSelectedExercise(found || { id: routeExerciseId, name: 'Exercise' })
    }
  }, [
    user,
    view,
    routeSessionId,
    routeExerciseId,
    selectedSession?.id,
    selectedExercise?.id,
    exercises,
    openSessionById,
  ])

  useEffect(() => {
    if (!user) return
    if (view !== 'screenRecord') return
    if (screenRecordSupported) return
    toast.error('Screen recording is not supported on this browser')
    navigate({ view: 'sessions', sessionId: null, exerciseId: null }, { replace: true })
  }, [user, view, screenRecordSupported, navigate, toast])

  const loadMoreSessions = async () => {
    if (!sessionsNext || sessionsLoading) return
    await fetchSessions({ append: true, url: sessionsNext })
  }

  const loadMoreExercises = async () => {
    if (!exercisesNext || exercisesLoading) return
    await fetchExercises({ append: true, url: exercisesNext })
  }

  const createSpace = async () => {
    if (!newSpaceName.trim()) return
    try {
      const trimmedName = newSpaceName.trim()
      const res = await fetch('/api/spaces/', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmedName }),
      })
      if (!res.ok) throw new Error('create-space')
      setNewSpaceName('')
      setShowCreateSpace(false)
      fetchSpaces()
      window.dispatchEvent(new CustomEvent('user-updated'))
      toast.success(`Space "${trimmedName}" created`)
    } catch {
      toast.error('Error creating space')
    }
  }

  const openSession = (session) => {
    setSelectedSession(session)
    navigate({ view: 'detail', sessionId: session.id, exerciseId: null })
  }

  const openProgress = (exercise) => {
    setSelectedExercise(exercise)
    navigate({ view: 'progress', sessionId: null, exerciseId: exercise.id })
  }

  const goHome = () => {
    navigate({ view: 'sessions', sessionId: null, exerciseId: null })
    setSelectedSession(null)
    setSelectedExercise(null)
    fetchSessions()
    fetchExercises()
    fetchSpaces()
  }

  const handleQuickRecordComplete = (session) => {
    fetchSessions()
    fetchExercises()
    setSelectedSession(session)
    navigate({ view: 'detail', sessionId: session.id, exerciseId: null })
  }

  const hasSpaces = spaces.length > 0 || Boolean(user?.has_spaces)
  const joinedSpacesCount = Number.isFinite(user?.joined_spaces_count) ? user.joined_spaces_count : 0

  if (loading) return <div className="min-h-screen bg-white flex items-center justify-center"><p className="text-sm text-gray-400">Loading...</p></div>
  if (!user) return <AuthForm />

  if (view === 'quickRecord') {
    return (
      <QuickRecord
        token={token}
        exercises={exercises}
        spaces={spaces}
        onComplete={handleQuickRecordComplete}
        onCancel={goHome}
      />
    )
  }

  if (view === 'screenRecord') {
    return (
      <ScreenRecord
        token={token}
        spaces={spaces}
        onComplete={handleQuickRecordComplete}
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
            {view === 'sessions' && (
              <>
                <button
                  onClick={() => navigate({ view: 'upload', sessionId: null, exerciseId: null })}
                  className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors hidden sm:block"
                >
                  + Upload
                </button>
                <button
                  onClick={() => navigate({ view: 'connections', sessionId: null, exerciseId: null })}
                  className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
                >
                  Spaces
                </button>
              </>
            )}
            {view !== 'sessions' && (
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
        {view === 'sessions' && spaces.length > 0 && (
          <div className="px-4 sm:px-6 pt-3">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              <button
                onClick={() => setActiveSpace(null)}
                className={`text-xs px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                  !activeSpace ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >All</button>
              {spaces.map(space => (
                <button
                  key={space.id}
                  onClick={() => setActiveSpace(activeSpace === space.id ? null : space.id)}
                  className={`text-xs px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                    activeSpace === space.id ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {space.name}
                  {space.session_count > 0 && <span className="ml-1 opacity-60">{space.session_count}</span>}
                </button>
              ))}
              <button
                onClick={() => setShowCreateSpace(true)}
                className="text-xs px-2 py-1.5 text-gray-400 hover:text-gray-600 transition-colors whitespace-nowrap"
              >+</button>
            </div>
          </div>
        )}

        {showCreateSpace && (
          <div className="px-4 sm:px-6 pt-2 pb-1">
            <div className="flex gap-2">
              <input
                type="text"
                value={newSpaceName}
                onChange={(e) => setNewSpaceName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && createSpace()}
                placeholder="e.g. Drumming, Production, Qigong"
                className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
                autoFocus
              />
              <button onClick={createSpace} className="text-xs font-medium text-white bg-gray-900 px-3 py-1.5 rounded-lg">Create</button>
              <button onClick={() => { setShowCreateSpace(false); setNewSpaceName('') }} className="text-xs text-gray-400 px-2">Cancel</button>
            </div>
          </div>
        )}

        {view === 'sessions' && !hasSpaces && !showCreateSpace && (
          <div className="px-4 sm:px-6 pt-4">
            <div className="w-full p-4 rounded-xl border border-dashed border-gray-200">
              <p className="text-sm font-medium text-gray-700">Set up your first space</p>
              <p className="text-xs text-gray-400 mt-1">Create your own space or join a coach space with an invite code.</p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => setShowCreateSpace(true)}
                  className="text-xs font-medium text-white bg-gray-900 px-3 py-1.5 rounded-md hover:bg-gray-800"
                >
                  Create space
                </button>
                <button
                  onClick={() => navigate({ view: 'connections', sessionId: null, exerciseId: null })}
                  className="text-xs text-gray-600 border border-gray-200 px-3 py-1.5 rounded-md hover:bg-gray-50"
                >
                  Join with code
                </button>
              </div>
            </div>
            {joinedSpacesCount > 0 && (
              <p className="text-xs text-gray-400 mt-2">
                You are currently a member in {joinedSpacesCount} joined {joinedSpacesCount === 1 ? 'space' : 'spaces'}.
              </p>
            )}
          </div>
        )}

        {view === 'sessions' && (
          <>
            <CoachMetricsPanel token={token} />
            <SessionList
              sessions={sessions}
              exercises={exercises}
              user={user}
              spaces={spaces}
              activeSpace={activeSpace}
              sessionsLoading={sessionsLoading}
              exercisesLoading={exercisesLoading}
              sessionsLoaded={sessionsLoaded}
              exercisesLoaded={exercisesLoaded}
              sessionsHasMore={Boolean(sessionsNext)}
              exercisesHasMore={Boolean(exercisesNext)}
              onLoadMoreSessions={loadMoreSessions}
              onLoadMoreExercises={loadMoreExercises}
              onSessionSelect={openSession}
              onExerciseSelect={openProgress}
              onUploadClick={() => navigate({ view: 'upload', sessionId: null, exerciseId: null })}
              onRefreshSessions={() => fetchSessions()}
              onDeleteSession={async (id) => {
                const res = await fetch(`/api/sessions/${id}/`, { method: 'DELETE', headers })
                if (res.ok) fetchSessions()
                else {
                  const data = await res.json().catch(() => ({}))
                  toast.error(data.error || 'You do not have permission to delete this session')
                }
              }}
            />
          </>
        )}
        {view === 'upload' && (
          <SessionUpload
            token={token}
            spaces={spaces}
            activeSpace={activeSpace}
            onComplete={() => {
              fetchSessions()
              fetchSpaces()
              navigate({ view: 'sessions', sessionId: null, exerciseId: null })
            }}
            onCancel={() => navigate({ view: 'sessions', sessionId: null, exerciseId: null })}
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
          />
        )}
        {view === 'progress' && selectedExercise && (
          <ErrorBoundary onBack={goHome}>
            <ProgressView exercise={selectedExercise} token={token} onBack={goHome} />
          </ErrorBoundary>
        )}
        {view === 'connections' && (
          <ConnectionsView spaces={spaces} token={token} onSpacesChange={fetchSpaces} />
        )}
      </main>

      {view === 'sessions' && (
        <div className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 z-40 flex flex-col items-center gap-3">
          {screenRecordSupported && (
            <button
              onClick={() => navigate({ view: 'screenRecord', sessionId: null, exerciseId: null })}
              className="w-10 h-10 rounded-full bg-gray-800 hover:bg-gray-700 shadow-lg flex items-center justify-center transition-all active:scale-90 hover:scale-105 hidden sm:flex"
              title="Record screen"
            >
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
              </svg>
            </button>
          )}
          <button
            onClick={() => navigate({ view: 'quickRecord', sessionId: null, exerciseId: null })}
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/30 flex items-center justify-center transition-all active:scale-90 hover:scale-105"
          >
            <div className="w-5 h-5 sm:w-6 sm:h-6 border-2 border-white rounded-full" />
          </button>
          <p className="text-[10px] text-gray-400 text-center">Record</p>
        </div>
      )}
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
