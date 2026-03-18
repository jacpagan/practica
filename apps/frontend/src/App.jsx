import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { reportClientError } from './utils'
import { AuthProvider, useAuth } from './auth'
import { ToastProvider, useToast } from './components/Toast'
import { ConfirmProvider } from './components/ConfirmDialog'
import AuthForm from './components/AuthForm'
import ReviewPage from './components/ReviewPage'
import SessionLibrary from './components/SessionLibrary'
import TeacherQueue from './components/TeacherQueue'
import TeacherActivation from './components/TeacherActivation'
import UpdatesFeed from './components/UpdatesFeed'
import SessionUpload from './components/SessionUpload'
import SessionDetail from './components/SessionDetail'

const parseRoute = (pathname) => {
  if (pathname === '/activate') return { view: 'activate', sessionId: null }
  if (pathname === '/' || pathname === '/upload') return { view: 'upload', sessionId: null }
  if (pathname === '/library') return { view: 'library', sessionId: null }
  if (pathname === '/review') return { view: 'reviewQueue', sessionId: null }
  if (pathname === '/updates') return { view: 'updates', sessionId: null }
  const reviewMatch = pathname.match(/^\/r\/(.+)$/)
  if (reviewMatch) return { view: 'review', token: reviewMatch[1] }
  const sessionMatch = pathname.match(/^\/sessions\/(\d+)$/)
  if (sessionMatch) return { view: 'detail', sessionId: Number(sessionMatch[1]) }
  return { view: 'upload', sessionId: null }
}

const routePath = ({ view, sessionId, token }) => {
  if (view === 'activate') return '/activate'
  if (view === 'upload') return '/upload'
  if (view === 'library') return '/library'
  if (view === 'reviewQueue') return '/review'
  if (view === 'updates') return '/updates'
  if (view === 'review' && token) return `/r/${token}`
  if (view === 'detail' && sessionId) return `/sessions/${sessionId}`
  return '/upload'
}

function AppContent() {
  const { user, token, loading, logout, refreshUser } = useAuth()
  const toast = useToast()
  const initialRoute = useMemo(() => parseRoute(window.location.pathname), [])
  const [view, setView] = useState(initialRoute.view)
  const [routeSessionId, setRouteSessionId] = useState(initialRoute.sessionId)
  const [selectedSession, setSelectedSession] = useState(null)
  const [reviewToken, setReviewToken] = useState(initialRoute.token || '')
  const [sessions, setSessions] = useState([])
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [sessionsLoadingMore, setSessionsLoadingMore] = useState(false)
  const [sessionsNextUrl, setSessionsNextUrl] = useState(null)
  const [detailReturnView, setDetailReturnView] = useState('upload')
  const [openRecorderOnUpload, setOpenRecorderOnUpload] = useState(false)
  const [justUploadedSessionId, setJustUploadedSessionId] = useState(null)

  const hasOwnedSpaces = useMemo(
    () => Array.isArray(user?.spaces) && user.spaces.some((space) => space.role === 'owner'),
    [user?.spaces],
  )
  const hasJoinedGroups = useMemo(() => (user?.joined_spaces_count || 0) > 0, [user?.joined_spaces_count])
  const libraryUnreadCount = useMemo(
    () => sessions.filter((session) => session.can_edit && session.has_unread).length,
    [sessions],
  )
  const reviewQueueCount = useMemo(
    () => sessions.filter((session) => session.can_review_feedback && !session.can_edit && (session.needs_review || session.has_unread)).length,
    [sessions],
  )
  const updates = useMemo(() => {
    const feedbackItems = sessions
      .filter((session) => session.can_edit && session.has_unread)
      .map((session) => ({
        kind: 'feedback',
        session,
        title: `New feedback on “${session.title}”`,
        subtitle: `${session.review_feedback_count || 0} feedback comment${session.review_feedback_count === 1 ? '' : 's'} waiting for you.`,
        badge: 'Feedback',
      }))

    const reviewItems = sessions
      .filter((session) => session.can_review_feedback && !session.can_edit && (session.needs_review || session.has_unread))
      .map((session) => ({
        kind: 'review',
        session,
        title: session.needs_review ? `Review ${session.owner_name || 'student'}’s clip` : `${session.owner_name || 'Student'} updated “${session.title}”`,
        subtitle: session.needs_review
          ? 'This student clip is waiting for your coaching.'
          : 'There is new activity on this student clip.',
        badge: session.needs_review ? 'Needs review' : 'New activity',
      }))

    return [...feedbackItems, ...reviewItems].sort(
      (left, right) => new Date(right.session.recorded_at || right.session.created_at) - new Date(left.session.recorded_at || left.session.created_at),
    )
  }, [sessions])
  const updatesCount = updates.length
  const roleLabel = useMemo(() => {
    const labels = Array.isArray(user?.role_labels) ? user.role_labels : []
    return labels.join(' + ')
  }, [user?.role_labels])
  const primaryRole = user?.primary_role || 'new'
  const showLibraryNav = sessions.length > 0 || view === 'library'

  const defaultHomeView = useMemo(() => {
    if (!hasOwnedSpaces && !hasJoinedGroups) return 'activate'
    if (hasOwnedSpaces) return 'reviewQueue'
    return 'upload'
  }, [hasJoinedGroups, hasOwnedSpaces])


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
      const res = await fetch(`/api/sessions/${sessionId}/`, { headers: token ? { Authorization: `Token ${token}` } : {} })
      if (!res.ok) throw new Error('session')
      const data = await res.json()
      setSelectedSession(data)
      if (token) {
        fetch(`/api/sessions/${sessionId}/mark_seen/`, {
          method: 'POST',
          headers: { Authorization: `Token ${token}` },
        }).catch(() => {})
        setSessions((current) => current.map((item) => item.id === sessionId ? { ...item, has_unread: false } : item))
      }
      if (updateUrl) navigate({ view: 'detail', sessionId: data.id })
    } catch {
      toast.error('Could not load session')
      navigate({ view: 'upload', sessionId: null }, { replace: true })
    }
  }, [token, navigate, toast])

  useEffect(() => {
    const handler = () => refreshUser()
    window.addEventListener('user-updated', handler)
    return () => window.removeEventListener('user-updated', handler)
  }, [refreshUser])

  // Ensure we always land users on the upload screen after login
  useEffect(() => {
    if (user && view !== 'detail' && view !== 'library' && view !== 'reviewQueue' && view !== 'updates' && view !== 'review' && view !== 'activate') {
      navigate({ view: defaultHomeView, sessionId: null }, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, defaultHomeView])

  useEffect(() => {
    if (!user) return
    if (view === 'detail' && routeSessionId && selectedSession?.id !== routeSessionId) {
      openSessionById(routeSessionId, { updateUrl: false })
    }
  }, [user, view, routeSessionId, selectedSession?.id, openSessionById])

  const loadSessions = useCallback(async ({ url = '/api/sessions/', append = false } = {}) => {
    if (!token) return
    if (append) setSessionsLoadingMore(true)
    else setSessionsLoading(true)
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Token ${token}` },
      })
      if (!res.ok) throw new Error('sessions')
      const data = await res.json()
      const items = Array.isArray(data) ? data : data.results || []
      setSessions((current) => {
        if (!append) return items
        const byId = new Map(current.map((item) => [item.id, item]))
        for (const item of items) byId.set(item.id, item)
        return Array.from(byId.values())
      })
      setSessionsNextUrl(Array.isArray(data) ? null : data.next || null)
    } catch {
      if (!append) setSessions([])
      setSessionsNextUrl(null)
    } finally {
      if (append) setSessionsLoadingMore(false)
      else setSessionsLoading(false)
    }
  }, [token])

  const openSession = useCallback((session, returnView = view) => {
    if (!session?.id) return
    setDetailReturnView(returnView)
    setOpenRecorderOnUpload(false)
    openSessionById(session.id)
  }, [openSessionById, view])

  const goHome = useCallback(() => {
    navigate({ view: detailReturnView || defaultHomeView, sessionId: null })
    setSelectedSession(null)
    setJustUploadedSessionId(null)
  }, [navigate, detailReturnView, defaultHomeView])

  const handleUploadComplete = (session) => {
    setSessions((current) => [session, ...current.filter((item) => item.id !== session.id)])
    setSelectedSession(session)
    setJustUploadedSessionId(session.id)
    setOpenRecorderOnUpload(false)
    refreshUser()
    navigate({ view: 'detail', sessionId: session.id })
  }

  const handleRecordAnother = useCallback(() => {
    setSelectedSession(null)
    setJustUploadedSessionId(null)
    setOpenRecorderOnUpload(true)
    navigate({ view: 'upload', sessionId: null })
  }, [navigate])

  useEffect(() => {
    if (!user || (view !== 'upload' && view !== 'library' && view !== 'reviewQueue' && view !== 'updates')) return
    loadSessions({ url: '/api/sessions/', append: false })
  }, [user, view, loadSessions])

  if (loading) {
    return <div className="min-h-screen bg-white flex items-center justify-center"><p className="text-sm text-gray-400">Loading...</p></div>
  }
  if (!user) {
    if (view === 'review') return <ReviewPage />
    return <AuthForm />
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-30 border-b border-gray-100 bg-white/95 backdrop-blur px-4 py-3 sm:px-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <button onClick={goHome} className="text-lg font-semibold text-gray-900 tracking-tight">
            Practica
          </button>
          <div className="flex items-center gap-3">
            <nav className="hidden sm:flex items-center gap-2">
              {defaultHomeView === 'activate' ? (
                <button onClick={() => navigate({ view: 'activate', sessionId: null })} className={`text-sm px-3 py-2 rounded-lg transition-colors ${view === 'activate' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`}>
                  Start
                </button>
              ) : null}
              {(primaryRole === 'student' || primaryRole === 'new') ? (
                <button onClick={() => navigate({ view: 'upload', sessionId: null })} className={`text-sm px-3 py-2 rounded-lg transition-colors ${view === 'upload' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`}>
                  Practice{updatesCount ? ` • ${updatesCount}` : ''}
                </button>
              ) : null}
              {(primaryRole === 'teacher' || primaryRole === 'teacher_student') ? (
                <button onClick={() => navigate({ view: 'reviewQueue', sessionId: null })} className={`text-sm px-3 py-2 rounded-lg transition-colors ${view === 'reviewQueue' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`}>
                  Review{reviewQueueCount ? ` • ${reviewQueueCount}` : ''}
                </button>
              ) : null}
              {primaryRole === 'teacher_student' ? (
                <button onClick={() => navigate({ view: 'upload', sessionId: null })} className={`text-sm px-3 py-2 rounded-lg transition-colors ${view === 'upload' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`}>
                  Practice{updatesCount ? ` • ${updatesCount}` : ''}
                </button>
              ) : null}
              {showLibraryNav ? (
                <button onClick={() => navigate({ view: 'library', sessionId: null })} className={`text-sm px-3 py-2 rounded-lg transition-colors ${view === 'library' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`}>
                  Library{libraryUnreadCount ? ` • ${libraryUnreadCount}` : ''}
                </button>
              ) : null}
            </nav>
            <div className="flex items-center gap-2 sm:border-l sm:border-gray-100 sm:pl-3">
              {roleLabel ? <span className="hidden sm:inline-flex text-[11px] uppercase tracking-wide bg-gray-100 text-gray-600 px-2 py-1 rounded-full">{roleLabel}</span> : null}
              <span className="text-xs text-gray-400">{user.display_name}</span>
              <button onClick={logout} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
                Log out
              </button>
            </div>
          </div>
        </div>
        <div className="max-w-5xl mx-auto mt-3 sm:hidden">
          <nav className="grid grid-cols-2 gap-2">
            {defaultHomeView === 'activate' ? (
              <button
                onClick={() => navigate({ view: 'activate', sessionId: null })}
                className={`text-sm px-3 py-2.5 rounded-xl transition-colors ${view === 'activate' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'} col-span-2`}
              >
                Start
              </button>
            ) : null}
            {(primaryRole === 'student' || primaryRole === 'new') ? (
              <button
                onClick={() => navigate({ view: 'upload', sessionId: null })}
                className={`text-sm px-3 py-2.5 rounded-xl transition-colors ${view === 'upload' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'}`}
              >
                Practice{updatesCount ? ` • ${updatesCount}` : ''}
              </button>
            ) : null}
            {(primaryRole === 'teacher' || primaryRole === 'teacher_student') ? (
              <button
                onClick={() => navigate({ view: 'reviewQueue', sessionId: null })}
                className={`text-sm px-3 py-2.5 rounded-xl transition-colors ${view === 'reviewQueue' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'}`}
              >
                Review{reviewQueueCount ? ` • ${reviewQueueCount}` : ''}
              </button>
            ) : null}
            {primaryRole === 'teacher_student' ? (
              <button
                onClick={() => navigate({ view: 'upload', sessionId: null })}
                className={`text-sm px-3 py-2.5 rounded-xl transition-colors ${view === 'upload' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'}`}
              >
                Practice{updatesCount ? ` • ${updatesCount}` : ''}
              </button>
            ) : null}
            {showLibraryNav ? (
              <button
                onClick={() => navigate({ view: 'library', sessionId: null })}
                className={`text-sm px-3 py-2.5 rounded-xl transition-colors ${(view === 'library' || view === 'updates') ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'} ${primaryRole === 'teacher' && !defaultHomeView.includes('activate') ? 'col-span-2' : ''}`}
              >
                Library{libraryUnreadCount ? ` • ${libraryUnreadCount}` : ''}
              </button>
            ) : null}
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto pb-24">
        {view === 'review' && (
          <ReviewPage />
        )}
        {view === 'activate' && (
          <TeacherActivation
            token={token}
            primaryRole={user?.primary_role || 'new'}
            onActivated={async () => {
              await refreshUser()
              navigate({ view: 'reviewQueue', sessionId: null }, { replace: true })
            }}
          />
        )}
        {view === 'upload' && (
          <SessionUpload
            token={token}
            onComplete={handleUploadComplete}
            onCancel={goHome}
            primaryRole={user?.primary_role || 'new'}
            updatesCount={updatesCount}
            onOpenUpdates={() => navigate({ view: 'updates', sessionId: null })}
            initialRecorderOpen={openRecorderOnUpload}
            onRecorderOpenHandled={() => setOpenRecorderOnUpload(false)}
          />
        )}

        {view === 'library' && (
          <SessionLibrary
            sessions={sessions}
            sessionsLoading={sessionsLoading}
            sessionsLoadingMore={sessionsLoadingMore}
            hasMoreSessions={Boolean(sessionsNextUrl)}
            onLoadMoreSessions={() => sessionsNextUrl ? loadSessions({ url: sessionsNextUrl, append: true }) : null}
            onOpenSession={openSession}
            onDeleteSession={async (session) => {
              if (!session?.id || !token || !session?.can_edit) return
              const res = await fetch(`/api/sessions/${session.id}/`, {
                method: 'DELETE',
                headers: { Authorization: `Token ${token}` },
              })
              if (res.ok) {
                setSessions((current) => current.filter((item) => item.id !== session.id))
                if (selectedSession?.id === session.id) setSelectedSession(null)
              }
            }}
          />
        )}

        {view === 'reviewQueue' && (
          <TeacherQueue
            primaryRole={user?.primary_role || 'teacher'}
            sessions={sessions}
            sessionsLoading={sessionsLoading}
            onOpenSession={openSession}
          />
        )}

        {view === 'updates' && (
          <UpdatesFeed
            items={updates}
            onOpenSession={openSession}
          />
        )}

        {view === 'detail' && selectedSession && (
          <SessionDetail
            session={selectedSession}
            token={token}
            onBack={goHome}
            justUploaded={selectedSession.id === justUploadedSessionId}
            onRecordAnother={handleRecordAnother}
            onSessionUpdate={(sessionData) => {
              setSelectedSession(sessionData)
              setSessions((current) => current.map((item) => (
                item.id === sessionData.id ? { ...item, ...sessionData } : item
              )))
            }}
            onSessionDelete={(sessionId) => {
              setSessions((current) => current.filter((item) => item.id !== sessionId))
              setSelectedSession(null)
              navigate({ view: 'upload', sessionId: null }, { replace: true })
            }}
            onOpenCompare={null}
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
