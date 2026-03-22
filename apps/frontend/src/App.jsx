import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { reportClientError } from './utils'
import { AuthProvider, useAuth } from './auth'
import { ToastProvider, useToast } from './components/Toast'
import { ConfirmProvider, useConfirm } from './components/ConfirmDialog'
import AuthForm from './components/AuthForm'
import ReviewPage from './components/ReviewPage'
import SessionUpload from './components/SessionUpload'
import SessionDetail from './components/SessionDetail'
import LibraryView from './components/LibraryView'
import SeriesView from './components/SeriesView'

const parseRoute = (pathname) => {
  if (pathname === '/' || pathname === '/library') {
    return { view: 'library', sessionId: null }
  }
  if (pathname === '/upload') return { view: 'upload', sessionId: null }
  const reviewMatch = pathname.match(/^\/r\/(.+)$/)
  if (reviewMatch) return { view: 'review', token: reviewMatch[1], sessionId: null }
  const seriesMatch = pathname.match(/^\/series\/(.+)$/)
  if (seriesMatch) return { view: 'series', sessionId: null, seriesName: decodeURIComponent(seriesMatch[1]) }
  const sessionMatch = pathname.match(/^\/sessions\/(\d+)$/)
  if (sessionMatch) return { view: 'detail', sessionId: Number(sessionMatch[1]) }
  return { view: 'library', sessionId: null }
}

const routePath = ({ view, sessionId, token, seriesName }) => {
  if (view === 'library') return '/library'
  if (view === 'upload') return '/upload'
  if (view === 'series' && seriesName) return `/series/${encodeURIComponent(seriesName)}`
  if (view === 'review' && token) return `/r/${token}`
  if (view === 'detail' && sessionId) return `/sessions/${sessionId}`
  return '/library'
}

function AppContent() {
  const { user, token, loading, logout } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const initialRoute = useMemo(() => parseRoute(window.location.pathname), [])
  const [view, setView] = useState(initialRoute.view)
  const [routeSessionId, setRouteSessionId] = useState(initialRoute.sessionId)
  const [routeSeriesName, setRouteSeriesName] = useState(initialRoute.seriesName || '')
  const [reviewToken, setReviewToken] = useState(initialRoute.token || '')
  const [selectedSession, setSelectedSession] = useState(null)
  const [sessions, setSessions] = useState([])
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [detailReturnRoute, setDetailReturnRoute] = useState({ view: 'library', sessionId: null, seriesName: '' })
  const [openRecorderOnUpload, setOpenRecorderOnUpload] = useState(false)
  const [justUploadedSessionId, setJustUploadedSessionId] = useState(null)
  const [pendingFollowUpRequestDraft, setPendingFollowUpRequestDraft] = useState(null)
  const [pendingPracticeSeries, setPendingPracticeSeries] = useState(initialRoute.seriesName || '')
  const uploadGuardRef = useRef({ active: false, abort: null })
  const currentPathRef = useRef(routePath(initialRoute))

  const applyRoute = useCallback((nextRoute, { replace = false } = {}) => {
    setView(nextRoute.view)
    setRouteSessionId(nextRoute.sessionId ?? null)
    setRouteSeriesName(nextRoute.seriesName || '')
    setReviewToken(nextRoute.token || '')
    const path = routePath(nextRoute)
    if (path !== window.location.pathname) {
      if (replace) window.history.replaceState(null, '', path)
      else window.history.pushState(null, '', path)
    }
  }, [])

  const requestAbortActiveUpload = useCallback(() => {
    try { uploadGuardRef.current.abort?.() } catch {}
  }, [])

  const confirmAbortActiveUpload = useCallback(async (nextAction = 'leave this page') => {
    if (!uploadGuardRef.current.active) return true
    return confirm({
      title: 'Abort upload?',
      message: `A video is still uploading. If you ${nextAction}, the upload will be aborted and you will need to start again.`,
      confirmLabel: 'Abort upload',
      cancelLabel: 'Keep uploading',
      tone: 'danger',
    })
  }, [confirm])

  const navigate = useCallback(async (nextRoute, { replace = false, bypassUploadGuard = false } = {}) => {
    const nextPath = routePath(nextRoute)
    if (!bypassUploadGuard && uploadGuardRef.current.active && nextPath !== currentPathRef.current) {
      const accepted = await confirmAbortActiveUpload('leave this page')
      if (!accepted) return false
      requestAbortActiveUpload()
    }
    applyRoute(nextRoute, { replace })
    return true
  }, [applyRoute, confirmAbortActiveUpload, requestAbortActiveUpload])

  const setUploadNavigationGuard = useCallback(({ active = false, abort = null } = {}) => {
    uploadGuardRef.current = {
      active: Boolean(active),
      abort: typeof abort === 'function' ? abort : null,
    }
  }, [])

  useEffect(() => {
    currentPathRef.current = routePath({ view, sessionId: routeSessionId, token: reviewToken, seriesName: routeSeriesName })
  }, [reviewToken, routeSessionId, routeSeriesName, view])

  useEffect(() => {
    const onPopState = () => {
      const route = parseRoute(window.location.pathname)
      const nextPath = routePath(route)
      if (uploadGuardRef.current.active && nextPath !== currentPathRef.current) {
        window.history.pushState(null, '', currentPathRef.current)
        const accepted = window.confirm('A video is still uploading. Leaving this page will abort the upload. Do you want to continue?')
        if (!accepted) return
        requestAbortActiveUpload()
        applyRoute(route)
        return
      }
      applyRoute(route, { replace: true })
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [applyRoute, requestAbortActiveUpload])

  useEffect(() => {
    const onBeforeUnload = (event) => {
      if (!uploadGuardRef.current.active) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  const loadSessions = useCallback(async () => {
    if (!token) return
    setSessionsLoading(true)
    try {
      const res = await fetch('/api/sessions/', {
        headers: { Authorization: `Token ${token}` },
      })
      if (!res.ok) throw new Error('sessions')
      const data = await res.json()
      setSessions(Array.isArray(data) ? data : data.results || [])
    } catch {
      setSessions([])
      toast.error('Could not load your library')
    } finally {
      setSessionsLoading(false)
    }
  }, [token, toast])

  const openSessionById = useCallback(async (sessionId, { updateUrl = true } = {}) => {
    if (!token) return
    try {
      const res = await fetch(`/api/sessions/${sessionId}/`, {
        headers: { Authorization: `Token ${token}` },
      })
      if (!res.ok) throw new Error('session')
      const data = await res.json()
      setSelectedSession(data)
      if (updateUrl) navigate({ view: 'detail', sessionId: data.id })
    } catch {
      toast.error('Could not load video')
      navigate({ view: 'library', sessionId: null }, { replace: true })
    }
  }, [navigate, token, toast])

  const openSession = useCallback((session, returnRoute = { view, sessionId: null, seriesName: routeSeriesName }) => {
    if (!session?.id) return
    setDetailReturnRoute(returnRoute)
    setOpenRecorderOnUpload(false)
    openSessionById(session.id)
  }, [openSessionById, routeSeriesName, view])

  const goBack = useCallback(() => {
    navigate(detailReturnRoute?.view ? detailReturnRoute : { view: 'library', sessionId: null, seriesName: '' })
    setSelectedSession(null)
    setJustUploadedSessionId(null)
  }, [detailReturnRoute, navigate])

  const handleUploadComplete = useCallback((session) => {
    setSessions((current) => [session, ...current.filter((item) => item.id !== session.id)])
    setSelectedSession(session)
    setJustUploadedSessionId(session.id)
    setOpenRecorderOnUpload(false)
    setPendingPracticeSeries('')
    navigate({ view: 'detail', sessionId: session.id })
  }, [navigate])

  const handleRecordAnother = useCallback((draft = null) => {
    setSelectedSession(null)
    setJustUploadedSessionId(null)
    setOpenRecorderOnUpload(true)
    setPendingFollowUpRequestDraft(draft || null)
    setPendingPracticeSeries(String(draft?.practiceSeries || '').trim())
    navigate({ view: 'upload', sessionId: null })
  }, [navigate])

  useEffect(() => {
    if (!user) return
    if (view === 'library' || view === 'series') loadSessions()
  }, [user, view, loadSessions])

  useEffect(() => {
    if (!user) return
    if (view === 'detail' && routeSessionId && selectedSession?.id !== routeSessionId) {
      openSessionById(routeSessionId, { updateUrl: false })
    }
  }, [user, view, routeSessionId, selectedSession?.id, openSessionById])

  if (loading) {
    return <div className="min-h-screen bg-white flex items-center justify-center"><p className="text-sm text-gray-400">Loading...</p></div>
  }

  if (!user) {
    return <AuthForm />
  }

  const handleLogout = async () => {
    const accepted = await confirmAbortActiveUpload('log out')
    if (!accepted) return
    if (uploadGuardRef.current.active) requestAbortActiveUpload()
    logout()
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-100 bg-white px-4 py-4 sm:px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-4 min-w-0">
            <button onClick={() => navigate({ view: 'library', sessionId: null })} className="text-lg font-semibold text-gray-900 tracking-tight">
              Practica
            </button>
            <nav className="hidden sm:flex items-center gap-2 rounded-full border border-gray-200 p-1">
              <button
                onClick={() => navigate({ view: 'library', sessionId: null })}
                className={`text-sm px-3 py-1.5 rounded-full transition-colors ${view === 'library' || view === 'detail' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900'}`}
              >
                Library
              </button>
            </nav>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => navigate({ view: 'upload', sessionId: null })}
              className="hidden sm:inline-flex rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
            >
              New video
            </button>
            <div className="flex items-center gap-2 sm:border-l sm:border-gray-100 sm:pl-3">
              <span className="hidden sm:inline text-xs text-gray-400">{user.display_name}</span>
              <button onClick={handleLogout} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
                Log out
              </button>
            </div>
          </div>
        </div>
        <div className="max-w-4xl mx-auto mt-3 space-y-2 sm:hidden">
          <nav className="grid grid-cols-1 gap-2">
            <button
              onClick={() => navigate({ view: 'library', sessionId: null })}
              className={`text-sm px-3 py-2.5 rounded-xl transition-colors ${view === 'library' || view === 'detail' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'}`}
            >
              Library
            </button>
          </nav>
          <button
            onClick={() => navigate({ view: 'upload', sessionId: null })}
            className="w-full rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
          >
            New video
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto pb-24">
        {view === 'library' && (
          <LibraryView
            sessions={sessions}
            sessionsLoading={sessionsLoading}
            token={token}
            onOpenSession={openSession}
            onOpenSeries={(seriesName) => navigate({ view: 'series', sessionId: null, seriesName })}
            onCreateVideo={() => navigate({ view: 'upload', sessionId: null })}
          />
        )}

        {view === 'series' && (
          <SeriesView
            seriesName={routeSeriesName}
            sessions={sessions}
            onBack={() => navigate({ view: 'library', sessionId: null })}
            onOpenSession={openSession}
            onCreateVideo={() => {
              setPendingPracticeSeries(routeSeriesName)
              navigate({ view: 'upload', sessionId: null })
            }}
          />
        )}

        {view === 'upload' && (
          <SessionUpload
            token={token}
            onComplete={handleUploadComplete}
            onCancel={({ bypassUploadGuard = false } = {}) => navigate(
              pendingPracticeSeries
                ? { view: 'series', sessionId: null, seriesName: pendingPracticeSeries }
                : { view: 'library', sessionId: null },
              { bypassUploadGuard },
            )}
            initialRecorderOpen={openRecorderOnUpload}
            initialPracticeSeries={pendingPracticeSeries}
            onPracticeSeriesHandled={() => setPendingPracticeSeries('')}
            onRecorderOpenHandled={() => setOpenRecorderOnUpload(false)}
            onUploadGuardChange={setUploadNavigationGuard}
          />
        )}

        {view === 'review' && (
          <ReviewPage reviewToken={reviewToken} />
        )}

        {view === 'detail' && selectedSession && (
          <SessionDetail
            session={selectedSession}
            token={token}
            onBack={goBack}
            initialReviewRequestDraft={pendingFollowUpRequestDraft}
            onReviewRequestDraftCleared={() => setPendingFollowUpRequestDraft(null)}
            onOpenReviewRequest={(requestItem) => {
              if (!requestItem?.review_link?.token) return
              navigate({ view: 'review', token: requestItem.review_link.token, sessionId: null })
            }}
            justUploaded={selectedSession.id === justUploadedSessionId}
            onRecordAnother={() => handleRecordAnother({ practiceSeries: selectedSession.practice_series || '' })}
            onOpenSeries={(seriesName) => navigate({ view: 'series', sessionId: null, seriesName })}
            onSessionUpdate={(sessionData) => {
              setSelectedSession(sessionData)
              setSessions((current) => current.map((item) => (
                item.id === sessionData.id ? { ...item, ...sessionData } : item
              )))
            }}
            onSessionDelete={(sessionId) => {
              setSessions((current) => current.filter((item) => item.id !== sessionId))
              setSelectedSession(null)
              navigate({ view: 'library', sessionId: null }, { replace: true })
            }}
          />
        )}
      </main>
    </div>
  )
}

class ErrorBoundary extends React.Component {
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
