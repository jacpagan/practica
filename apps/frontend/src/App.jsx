import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { reportClientError } from './utils'
import { AuthProvider, useAuth } from './auth'
import { ToastProvider, useToast } from './components/Toast'
import NotificationsBell from './components/NotificationsBell'
import { ConfirmProvider, useConfirm } from './components/ConfirmDialog'
import AuthForm from './components/AuthForm'
import ReviewPage from './components/ReviewPage'
import SessionUpload from './components/SessionUpload'
import SessionDetail from './components/SessionDetail'
import LibraryView from './components/LibraryView'
import SeriesView from './components/SeriesView'
import RequestsView from './components/TeachingView'
import PrivacyPage from './components/PrivacyPage'
import CalendarView from './components/CalendarView'

const parseRoute = (pathname) => {
  if (pathname === '/') {
    return { view: 'calendar', sessionId: null }
  }
  if (pathname === '/privacy') return { view: 'privacy', sessionId: null }
  if (pathname === '/archive') return { view: 'archive', sessionId: null }
  if (pathname === '/calendar') return { view: 'calendar', sessionId: null }
  if (pathname === '/library') return { view: 'library', sessionId: null }
  if (pathname === '/upload') return { view: 'upload', sessionId: null }
  if (pathname === '/requests') return { view: 'requests', sessionId: null }
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
  if (view === 'privacy') return '/privacy'
  if (view === 'archive') return '/archive'
  if (view === 'calendar') return '/'
  if (view === 'upload') return '/upload'
  if (view === 'requests') return '/requests'
  if (view === 'series' && seriesName) return `/series/${encodeURIComponent(seriesName)}`
  if (view === 'review' && token) return `/r/${token}`
  if (view === 'detail' && sessionId) return `/sessions/${sessionId}`
  return '/'
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
  const [studentReviewRequests, setStudentReviewRequests] = useState([])
  const [studentReviewRequestsLoading, setStudentReviewRequestsLoading] = useState(false)
  const [hasTeacherWorkspace, setHasTeacherWorkspace] = useState(false)
  const [teacherPendingCount, setTeacherPendingCount] = useState(0)
  const teacherPollRef = useRef(null)
  const [detailReturnRoute, setDetailReturnRoute] = useState({ view: 'library', sessionId: null, seriesName: '' })
  const [openRecorderOnUpload, setOpenRecorderOnUpload] = useState(false)
  const [justUploadedSessionId, setJustUploadedSessionId] = useState(null)
  const [pendingFollowUpRequestDraft, setPendingFollowUpRequestDraft] = useState(null)
  const [pendingPracticeSeries, setPendingPracticeSeries] = useState(initialRoute.seriesName || '')
  const uploadGuardRef = useRef({ active: false, abort: null })
  const currentPathRef = useRef(routePath(initialRoute))
  const autoQuickRecordCheckedRef = useRef(false)

  const fetchPaginated = useCallback(async (path) => {
    if (!token) return []
    let nextUrl = path
    let items = []

    while (nextUrl) {
      const res = await fetch(nextUrl, {
        headers: { Authorization: `Token ${token}` },
      })
      if (!res.ok) throw new Error('paginated-fetch')
      const data = await res.json()
      if (Array.isArray(data)) {
        items = items.concat(data)
        break
      }
      items = items.concat(Array.isArray(data?.results) ? data.results : [])
      const rawNext = String(data?.next || '').trim()
      if (!rawNext) break
      try {
        const parsed = new URL(rawNext, window.location.origin)
        nextUrl = `${parsed.pathname}${parsed.search}`
      } catch {
        nextUrl = rawNext
      }
    }

    return items
  }, [token])

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

  // Normalize URL on initial mount (e.g., convert /calendar to /)
  useEffect(() => {
    const desired = routePath({ view, sessionId: routeSessionId, token: reviewToken, seriesName: routeSeriesName })
    if (desired !== window.location.pathname) {
      try { window.history.replaceState(null, '', desired) } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      const items = await fetchPaginated('/api/sessions/')
      setSessions(items)
    } catch {
      setSessions([])
      toast.error('Could not load your library')
    } finally {
      setSessionsLoading(false)
    }
  }, [fetchPaginated, token, toast])

  const loadStudentReviewRequests = useCallback(async () => {
    if (!token) return
    setStudentReviewRequestsLoading(true)
    try {
      const items = await fetchPaginated('/api/review-requests/?role=owner')
      setStudentReviewRequests(items)
    } catch {
      setStudentReviewRequests([])
    } finally {
      setStudentReviewRequestsLoading(false)
    }
  }, [fetchPaginated, token])

  const loadTeacherWorkspaceAvailability = useCallback(async () => {
    if (!token) return
    try {
      const requests = await fetchPaginated('/api/review-requests/?role=reviewer')
      setHasTeacherWorkspace(requests.length > 0)
      const pending = requests.filter((r) => ['requested', 'opened'].includes(String(r?.status || '').trim().toLowerCase())).length
      setTeacherPendingCount(pending)
    } catch {
      setHasTeacherWorkspace(false)
      setTeacherPendingCount(0)
    }
  }, [fetchPaginated, token])

  // Poll the teacher pending count periodically; pause when tab is hidden
  useEffect(() => {
    if (!token) return () => {}
    const start = () => {
      if (teacherPollRef.current) { try { clearInterval(teacherPollRef.current) } catch {} }
      loadTeacherWorkspaceAvailability()
      teacherPollRef.current = setInterval(() => {
        if (typeof document !== 'undefined' && document.hidden) return
        loadTeacherWorkspaceAvailability()
      }, 45000)
    }
    const stop = () => {
      if (teacherPollRef.current) { try { clearInterval(teacherPollRef.current) } catch {}; teacherPollRef.current = null }
    }
    const onVisibility = () => {
      if (typeof document !== 'undefined' && document.hidden) stop()
      else start()
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibility)
      onVisibility()
      return () => { document.removeEventListener('visibilitychange', onVisibility); stop() }
    }
    start()
    return () => stop()
  }, [loadTeacherWorkspaceAvailability, token])

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
      navigate({ view: 'calendar', sessionId: null }, { replace: true })
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

  const hasActiveStudentLoop = useMemo(
    () => studentReviewRequests.some((item) => !['closed', 'revoked'].includes(String(item?.status || '').trim().toLowerCase())),
    [studentReviewRequests],
  )
  const activeStudentRequestBySessionId = useMemo(() => {
    const bySessionId = new Map()
    const requests = [...studentReviewRequests].sort((left, right) => new Date(right.created_at) - new Date(left.created_at))
    requests.forEach((item) => {
      const status = String(item?.status || '').trim().toLowerCase()
      if (['closed', 'revoked'].includes(status)) return
      const sessionId = Number(item?.session?.id || item?.session_id || 0)
      if (!sessionId || bySessionId.has(sessionId)) return
      bySessionId.set(sessionId, item)
    })
    return bySessionId
  }, [studentReviewRequests])
  const ownReadySessionCount = useMemo(
    () => sessions.filter((item) => item?.can_edit && item?.processing_status === 'ready').length,
    [sessions],
  )
  const practiceThreadOptions = useMemo(
    () => Array.from(new Set(
      sessions
        .filter((item) => item?.can_edit)
        .map((item) => String(item?.practice_series || '').trim())
        .filter(Boolean),
    )).sort((left, right) => left.localeCompare(right)),
    [sessions],
  )

  const handleRecordAnother = useCallback((draft = null) => {
    setSelectedSession(null)
    setJustUploadedSessionId(null)
    setOpenRecorderOnUpload(true)
    setPendingFollowUpRequestDraft(draft || null)
    setPendingPracticeSeries(String(draft?.practiceSeries || '').trim())
    navigate({ view: 'upload', sessionId: null })
  }, [navigate])

  const startQuickRecord = useCallback(() => {
    setSelectedSession(null)
    setJustUploadedSessionId(null)
    setPendingFollowUpRequestDraft(null)
    setPendingPracticeSeries('')
    setOpenRecorderOnUpload(true)
    navigate({ view: 'upload', sessionId: null })
  }, [navigate])

  const openHomeWorkItem = useCallback((session, returnRoute = { view: 'library', sessionId: null, seriesName: '' }) => {
    if (!session?.id) return
    const activeRequest = activeStudentRequestBySessionId.get(Number(session.id))
    const tokenValue = activeRequest?.feedback_link?.token || activeRequest?.review_link?.token || ''
    if (tokenValue) {
      setDetailReturnRoute(returnRoute)
      setSelectedSession(null)
      setOpenRecorderOnUpload(false)
      navigate({ view: 'review', token: tokenValue, sessionId: null })
      return
    }
    openSession(session, returnRoute)
  }, [activeStudentRequestBySessionId, navigate, openSession])

  useEffect(() => {
    if (!user) return
    if (view === 'library' || view === 'archive' || view === 'series' || view === 'calendar') loadSessions()
    if (view === 'library' || view === 'archive') loadStudentReviewRequests()
    loadTeacherWorkspaceAvailability()
  }, [user, view, loadSessions, loadStudentReviewRequests, loadTeacherWorkspaceAvailability])

  useEffect(() => {
    if (autoQuickRecordCheckedRef.current) return
    if (!user || view !== 'library') return
    if (sessionsLoading || studentReviewRequestsLoading) return

    autoQuickRecordCheckedRef.current = true
    if (!hasActiveStudentLoop && ownReadySessionCount === 0) {
      startQuickRecord()
    }
  }, [hasActiveStudentLoop, ownReadySessionCount, sessionsLoading, startQuickRecord, studentReviewRequestsLoading, user, view])

  useEffect(() => {
    if (view === 'requests' && !hasTeacherWorkspace) {
      navigate({ view: 'calendar', sessionId: null }, { replace: true })
    }
  }, [hasTeacherWorkspace, navigate, view])

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
    if (view === 'privacy') {
      return <PrivacyPage signedIn={false} />
    }
    if (view === 'review') {
      return <ReviewPage reviewToken={reviewToken} />
    }
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
            <button onClick={() => navigate({ view: 'calendar', sessionId: null })} className="text-lg font-semibold text-gray-900 tracking-tight">
              Practica
            </button>
            {hasTeacherWorkspace ? (
              <nav className="hidden sm:flex items-center gap-2 rounded-full border border-gray-200 p-1">
                <button
                  onClick={() => navigate({ view: 'calendar', sessionId: null })}
                  className={`text-sm px-3 py-1.5 rounded-full transition-colors ${view === 'calendar' || view === 'detail' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900'}`}
                >
                  Home
                </button>
                <button
                  onClick={() => navigate({ view: 'archive', sessionId: null })}
                  className={`text-sm px-3 py-1.5 rounded-full transition-colors ${view === 'archive' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900'}`}
                >
                  Archive
                </button>
                <button
                  onClick={() => navigate({ view: 'requests', sessionId: null })}
                  className={`text-sm px-3 py-1.5 rounded-full transition-colors ${view === 'requests' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900'}`}
                >
                  Requests{teacherPendingCount > 0 ? ` (${teacherPendingCount})` : ''}
                </button>
              </nav>
            ) : null}
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={startQuickRecord}
              className="hidden sm:inline-flex rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
            >
              Record
            </button>
            <div className="flex items-center gap-2 sm:border-l sm:border-gray-100 sm:pl-3">
              <NotificationsBell
                token={token}
                onOpenPrivacy={() => navigate({ view: 'privacy', sessionId: null })}
                onOpenReviewRequest={(requestItem) => {
                  const requestLink = requestItem?.feedback_link || requestItem?.review_link
                  if (!requestLink?.token) return
                  navigate({ view: 'review', token: requestLink.token, sessionId: null })
                }}
              />
              <button onClick={() => navigate({ view: 'privacy', sessionId: null })} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
                Privacy
              </button>
              <span className="hidden sm:inline text-xs text-gray-400">{user.display_name}</span>
              <button onClick={handleLogout} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
                Log out
              </button>
            </div>
          </div>
        </div>
        <div className="max-w-4xl mx-auto mt-3 space-y-2 sm:hidden">
          {hasTeacherWorkspace ? (
            <nav className="grid grid-cols-2 gap-2">
              <button
                onClick={() => navigate({ view: 'calendar', sessionId: null })}
                className={`text-sm px-3 py-2.5 rounded-xl transition-colors ${view === 'calendar' || view === 'detail' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'}`}
              >
                Home
              </button>
              <button
                onClick={() => navigate({ view: 'archive', sessionId: null })}
                className={`text-sm px-3 py-2.5 rounded-xl transition-colors ${view === 'archive' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'}`}
              >
                Archive
              </button>
              <button
                onClick={() => navigate({ view: 'requests', sessionId: null })}
                className={`text-sm px-3 py-2.5 rounded-xl transition-colors ${view === 'requests' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'}`}
              >
                Requests{teacherPendingCount > 0 ? ` (${teacherPendingCount})` : ''}
              </button>
            </nav>
          ) : null}
          <button
            onClick={startQuickRecord}
            className="w-full rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
          >
            Record
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto pb-24">
        {view === 'library' && (
          <LibraryView
            sessions={sessions}
            sessionsLoading={sessionsLoading}
            reviewRequests={studentReviewRequests}
            reviewRequestsLoading={studentReviewRequestsLoading}
            hasReviewerWorkspace={hasTeacherWorkspace}
            mode="home"
            token={token}
            onOpenSession={openHomeWorkItem}
            onOpenSeries={(seriesName) => navigate({ view: 'series', sessionId: null, seriesName })}
            onCreateVideo={startQuickRecord}
            onOpenRequests={() => navigate({ view: 'requests', sessionId: null })}
            onOpenReviewRequest={(requestItem) => {
              const requestLink = requestItem?.feedback_link || requestItem?.review_link
              if (!requestLink?.token) return
              navigate({ view: 'review', token: requestLink.token, sessionId: null })
            }}
            onRecordFollowUp={(draft) => handleRecordAnother(draft)}
          />
        )}

        {view === 'archive' && (
          <LibraryView
            sessions={sessions}
            sessionsLoading={sessionsLoading}
            reviewRequests={studentReviewRequests}
            reviewRequestsLoading={studentReviewRequestsLoading}
            hasReviewerWorkspace={hasTeacherWorkspace}
            mode="archive"
            token={token}
            onOpenSession={openSession}
            onOpenSeries={(seriesName) => navigate({ view: 'series', sessionId: null, seriesName })}
            onCreateVideo={startQuickRecord}
            onOpenRequests={() => navigate({ view: 'requests', sessionId: null })}
            onOpenReviewRequest={(requestItem) => {
              const requestLink = requestItem?.feedback_link || requestItem?.review_link
              if (!requestLink?.token) return
              navigate({ view: 'review', token: requestLink.token, sessionId: null })
            }}
            onRecordFollowUp={(draft) => handleRecordAnother(draft)}
          />
        )}

        {view === 'calendar' && (
          <CalendarView
            sessions={sessions}
            sessionsLoading={sessionsLoading}
            onOpenSession={(session) => navigate({ view: 'detail', sessionId: session.id })}
            onOpenSeries={(seriesName) => navigate({ view: 'series', sessionId: null, seriesName })}
            onMonthChange={(monthDate) => {
              // Compute month bounds and load only that range
              const y = monthDate.getFullYear()
              const m = monthDate.getMonth()
              const start = new Date(y, m, 1)
              const end = new Date(y, m + 1, 0)
              const toISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
              ;(async () => {
                try {
                  setSessionsLoading(true)
                  const items = await fetchPaginated(`/api/sessions/?start_date=${toISO(start)}&end_date=${toISO(end)}`)
                  setSessions(items)
                } catch {
                  setSessions([])
                } finally {
                  setSessionsLoading(false)
                }
              })()
            }}
          />
        )}

        {view === 'privacy' && (
          <PrivacyPage signedIn onBack={() => navigate({ view: 'calendar', sessionId: null })} />
        )}

        {view === 'series' && (
          <SeriesView
            seriesName={routeSeriesName}
            sessions={sessions}
            reviewRequests={studentReviewRequests}
            onBack={() => navigate({ view: 'calendar', sessionId: null })}
            onOpenSession={openSession}
            onCreateVideo={() => {
              setPendingPracticeSeries(routeSeriesName)
              navigate({ view: 'upload', sessionId: null })
            }}
          />
        )}

        {view === 'requests' && hasTeacherWorkspace && (
          <RequestsView token={token} onOpenReviewRequest={(requestItem) => {
            const requestLink = requestItem?.feedback_link || requestItem?.review_link
            if (!requestLink?.token) return
            navigate({ view: 'review', token: requestLink.token, sessionId: null })
          }} />
        )}

        {view === 'upload' && (
          <SessionUpload
            token={token}
            practiceThreadOptions={practiceThreadOptions}
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
            practiceThreadOptions={practiceThreadOptions}
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
              navigate({ view: 'calendar', sessionId: null }, { replace: true })
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
