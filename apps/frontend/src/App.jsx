import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { reportClientError } from './utils'
import { AuthProvider, useAuth } from './auth'
import { monthCacheKeyForDate, sessionsMonthQueryPath } from './calendar'
import { useAuthExpiredListener } from './hooks/useAuthExpiredListener'
import { useBeforeUnloadGuard } from './hooks/useBeforeUnloadGuard'
import { useCurrentRoutePath } from './hooks/useCurrentRoutePath'
import { useOfflineStatus } from './hooks/useOfflineStatus'
import { usePaginatedFetch } from './hooks/usePaginatedFetch'
import { usePopStateUploadGuard } from './hooks/usePopStateUploadGuard'
import { usePostLoginRedirect } from './hooks/usePostLoginRedirect'
import { useSessionUpdatedListener } from './hooks/useSessionUpdatedListener'
import { parseRoute, resolveUploadReturnRouteDraft, routePath } from './routing'
import { ToastProvider, useToast } from './components/Toast'
import NotificationsBell from './components/NotificationsBell'
import { ConfirmProvider, useConfirm } from './components/ConfirmDialog'
import AuthForm from './components/AuthForm'
const ReviewPage = React.lazy(() => import('./components/ReviewPage'))
import SessionUpload from './components/SessionUpload'
// Inline header create buttons to avoid any chance of circular init
const SessionDetail = React.lazy(() => import('./components/SessionDetail'))
const SeriesView = React.lazy(() => import('./components/SeriesView'))
const RequestsView = React.lazy(() => import('./components/TeachingView'))
import PrivacyPage from './components/PrivacyPage'
const CalendarView = React.lazy(() => import('./components/CalendarView'))
import RecorderModal from './components/RecorderModal'
const RecorderPage = React.lazy(() => import('./components/RecorderPage'))

function AppContent() {
  const { user, token, loading, logout } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const initialRoute = useMemo(() => parseRoute(window.location.pathname, window.location.search), [])
  const [view, setView] = useState(initialRoute.view)
  const [routeSessionId, setRouteSessionId] = useState(initialRoute.sessionId)
  const [routeSeriesName, setRouteSeriesName] = useState(initialRoute.seriesName || '')
  const [routeDate, setRouteDate] = useState(initialRoute.date || '')
  const [reviewToken, setReviewToken] = useState(initialRoute.token || '')
  const [reviewClaim, setReviewClaim] = useState(initialRoute.claim || '')
  const [selectedSession, setSelectedSession] = useState(null)
  const [sessions, setSessions] = useState([])
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [ownerReviewRequests, setOwnerReviewRequests] = useState([])
  const [hasReviewerWorkspace, setHasReviewerWorkspace] = useState(false)
  const [reviewerPendingCount, setReviewerPendingCount] = useState(0)
  const reviewerPollRef = useRef(null)
  const [detailReturnRoute, setDetailReturnRoute] = useState({ view: 'calendar', sessionId: null, seriesName: '' })
  const [openRecorderOnUpload, setOpenRecorderOnUpload] = useState(false)
  const [justUploadedSessionId, setJustUploadedSessionId] = useState(null)
  const [pendingFollowUpRequestDraft, setPendingFollowUpRequestDraft] = useState(null)
  const [pendingPracticeSeries, setPendingPracticeSeries] = useState(initialRoute.seriesName || '')
  const [pendingUploadReturnRoute, setPendingUploadReturnRoute] = useState({
    view: initialRoute.view === 'series' && initialRoute.seriesName ? 'series' : 'calendar',
    sessionId: null,
    seriesName: initialRoute.view === 'series' ? (initialRoute.seriesName || '') : '',
    date: initialRoute.view === 'calendar' ? (initialRoute.date || '') : '',
  })
  const calendarMonthCacheRef = useRef(new Map())
  const calendarMonthRequestRef = useRef('')
  const uploadGuardRef = useRef({ active: false, abort: null })
  const currentPathRef = useRef(routePath(initialRoute))
  const autoQuickRecordCheckedRef = useRef(false)
  const offline = useOfflineStatus()

  const fetchPaginated = usePaginatedFetch(token)

  const applyRoute = useCallback((nextRoute, { replace = false } = {}) => {
    setView(nextRoute.view)
    setRouteSessionId(nextRoute.sessionId ?? null)
    setRouteSeriesName(nextRoute.seriesName || '')
    setReviewToken(nextRoute.token || '')
    setReviewClaim(nextRoute.claim || '')
    setRouteDate(nextRoute.date || '')
    const path = routePath(nextRoute)
    const current = window.location.pathname + (window.location.search || '')
    if (path !== current) {
      if (replace) window.history.replaceState(null, '', path)
      else window.history.pushState(null, '', path)
    }
  }, [])

  // Normalize URL on initial mount (e.g., convert /calendar to /), preserving query date if present
  useEffect(() => {
    const desired = routePath({ view, sessionId: routeSessionId, token: reviewToken, claim: reviewClaim, seriesName: routeSeriesName, date: routeDate })
    const current = window.location.pathname + (window.location.search || '')
    if (desired !== current) {
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

  const currentReturnRoute = useMemo(() => ({
    view,
    sessionId: routeSessionId,
    token: reviewToken,
    claim: reviewClaim,
    seriesName: routeSeriesName,
    date: routeDate,
  }), [reviewClaim, reviewToken, routeDate, routeSessionId, routeSeriesName, view])

  const resolveUploadReturnRoute = useCallback((draft = null) => resolveUploadReturnRouteDraft(draft, routeDate), [routeDate])

  useCurrentRoutePath({
    currentPathRef,
    route: {
      view,
      sessionId: routeSessionId,
      token: reviewToken,
      claim: reviewClaim,
      seriesName: routeSeriesName,
      date: routeDate,
    },
  })

  useAuthExpiredListener({ logout, navigate, toast })
  usePostLoginRedirect({ user, applyRoute })
  useBeforeUnloadGuard(uploadGuardRef)
  usePopStateUploadGuard({
    applyRoute,
    currentPathRef,
    requestAbortActiveUpload,
    uploadGuardRef,
  })
  useSessionUpdatedListener({
    calendarMonthCacheRef,
    setSelectedSession,
    setSessions,
    token,
  })

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

  const monthCacheKey = useCallback((monthDate) => monthCacheKeyForDate(monthDate), [])

  const loadCalendarMonth = useCallback(async (monthDate, { preferCache = true } = {}) => {
    if (!token) return
    const cacheKey = monthCacheKey(monthDate)
    const cached = calendarMonthCacheRef.current.get(cacheKey)
    if (preferCache && cached) {
      setSessions(cached)
      setSessionsLoading(false)
      return
    }

    const requestKey = `${cacheKey}:${Date.now()}`
    calendarMonthRequestRef.current = requestKey
    setSessionsLoading(true)
    try {
      const items = await fetchPaginated(sessionsMonthQueryPath(monthDate))
      calendarMonthCacheRef.current.set(cacheKey, items)
      if (calendarMonthRequestRef.current !== requestKey) return
      setSessions(items)
    } catch {
      if (calendarMonthRequestRef.current !== requestKey) return
      setSessions([])
    } finally {
      if (calendarMonthRequestRef.current === requestKey) setSessionsLoading(false)
    }
  }, [fetchPaginated, monthCacheKey, token])

  const loadOwnerReviewRequests = useCallback(async () => {
    if (!token) return
    try {
      const items = await fetchPaginated('/api/review-requests/?role=owner')
      setOwnerReviewRequests(items)
    } catch {
      setOwnerReviewRequests([])
    }
  }, [fetchPaginated, token])

  useEffect(() => {
    const handler = async (event) => {
      if (!token) return
      calendarMonthCacheRef.current.clear()
      const oldSeriesName = String(event?.detail?.oldSeriesName || '').trim()
      const newSeriesName = String(event?.detail?.newSeriesName || '').trim()
      try {
        await loadSessions()
      } catch {}
      if (view === 'series' && oldSeriesName && routeSeriesName === oldSeriesName && newSeriesName) {
        navigate({ view: 'series', sessionId: null, seriesName: newSeriesName }, { replace: true })
      }
      if (selectedSession?.id) {
        try {
          const res = await fetch(`/api/sessions/${selectedSession.id}/`, { headers: { Authorization: `Token ${token}` } })
          if (res.ok) {
            const data = await res.json()
            setSelectedSession(data)
          }
        } catch {}
      }
    }
    window.addEventListener('practica:thread-renamed', handler)
    return () => window.removeEventListener('practica:thread-renamed', handler)
  }, [loadSessions, navigate, routeSeriesName, selectedSession?.id, token, view])

  const loadReviewerWorkspaceAvailability = useCallback(async () => {
    if (!token) return
    try {
      const requests = await fetchPaginated('/api/review-requests/?role=reviewer')
      setHasReviewerWorkspace(requests.length > 0)
      const pending = requests.filter((r) => ['requested', 'opened'].includes(String(r?.status || '').trim().toLowerCase())).length
      setReviewerPendingCount(pending)
    } catch {
      setHasReviewerWorkspace(false)
      setReviewerPendingCount(0)
    }
  }, [fetchPaginated, token])

  // Poll the reviewer pending count periodically; pause when tab is hidden
  useEffect(() => {
    if (!token) return () => {}
    const start = () => {
      if (reviewerPollRef.current) { try { clearInterval(reviewerPollRef.current) } catch {} }
      loadReviewerWorkspaceAvailability()
      reviewerPollRef.current = setInterval(() => {
        if (typeof document !== 'undefined' && document.hidden) return
        loadReviewerWorkspaceAvailability()
      }, 45000)
    }
    const stop = () => {
      if (reviewerPollRef.current) { try { clearInterval(reviewerPollRef.current) } catch {}; reviewerPollRef.current = null }
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
  }, [loadReviewerWorkspaceAvailability, token])

  const openSessionById = useCallback(async (sessionId, { updateUrl = true } = {}) => {
    if (!token) return
    try {
      let res
      let attempt = 0
      while (true) {
        try {
          res = await fetch(`/api/sessions/${sessionId}/`, { headers: { Authorization: `Token ${token}` } })
          if (res.ok || res.status < 500 || attempt >= 2) break
        } catch (e) {
          if (attempt >= 2) throw e
        }
        await new Promise((r) => setTimeout(r, 400 * Math.pow(2, attempt)))
        attempt += 1
      }
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
    navigate(detailReturnRoute?.view ? detailReturnRoute : { view: 'calendar', sessionId: null, seriesName: '' })
    setSelectedSession(null)
    setJustUploadedSessionId(null)
  }, [detailReturnRoute, navigate])

  const handleUploadComplete = useCallback((session) => {
    calendarMonthCacheRef.current.clear()
    setSessions((current) => [session, ...current.filter((item) => item.id !== session.id)])
    setSelectedSession(session)
    setJustUploadedSessionId(session.id)
    setOpenRecorderOnUpload(false)
    setPendingPracticeSeries('')
    setPendingUploadReturnRoute({ view: 'calendar', sessionId: null })
    navigate({ view: 'detail', sessionId: session.id })
  }, [navigate])

  const activeOwnerRequestBySessionId = useMemo(() => {
    const bySessionId = new Map()
    const requests = [...ownerReviewRequests].sort((left, right) => new Date(right.created_at) - new Date(left.created_at))
    requests.forEach((item) => {
      const status = String(item?.status || '').trim().toLowerCase()
      if (['closed', 'revoked'].includes(status)) return
      const sessionId = Number(item?.session?.id || item?.session_id || 0)
      if (!sessionId || bySessionId.has(sessionId)) return
      bySessionId.set(sessionId, item)
    })
    return bySessionId
  }, [ownerReviewRequests])
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

  // Global modal recorder
  const [showRecorderModal, setShowRecorderModal] = useState(false)
  const openGlobalRecorder = useCallback(() => {
    navigate({ view: 'record', sessionId: null })
  }, [navigate])

  // no dropdown menu state

  const handleRecordAnother = useCallback((draft = null) => {
    setSelectedSession(null)
    setJustUploadedSessionId(null)
    setOpenRecorderOnUpload(false)
    setPendingFollowUpRequestDraft(draft || null)
    setPendingPracticeSeries(String(draft?.practiceSeries || '').trim())
    setPendingUploadReturnRoute(resolveUploadReturnRoute(draft))
    navigate({ view: 'record', sessionId: null })
  }, [navigate, resolveUploadReturnRoute])

  const startQuickRecord = useCallback(() => {
    setSelectedSession(null)
    setJustUploadedSessionId(null)
    setPendingFollowUpRequestDraft(null)
    setPendingPracticeSeries('')
    setPendingUploadReturnRoute(currentReturnRoute)
    setOpenRecorderOnUpload(false)
    navigate({ view: 'record', sessionId: null })
  }, [currentReturnRoute, navigate])

  const openHomeWorkItem = useCallback((session, returnRoute = { view: 'calendar', sessionId: null, seriesName: '' }) => {
    if (!session?.id) return
    const activeRequest = activeOwnerRequestBySessionId.get(Number(session.id))
    const tokenValue = activeRequest?.feedback_link?.token || activeRequest?.review_link?.token || ''
    if (tokenValue) {
      setDetailReturnRoute(returnRoute)
      setSelectedSession(null)
      setOpenRecorderOnUpload(false)
      navigate({ view: 'review', token: tokenValue, sessionId: null })
      return
    }
    openSession(session, returnRoute)
  }, [activeOwnerRequestBySessionId, navigate, openSession])

  useEffect(() => {
    if (!user) return
    if (view === 'series') loadSessions()
    if (view === 'calendar') loadOwnerReviewRequests()
    loadReviewerWorkspaceAvailability()
  }, [user, view, loadSessions, loadOwnerReviewRequests, loadReviewerWorkspaceAvailability])

  useEffect(() => {
    if (autoQuickRecordCheckedRef.current) return
    autoQuickRecordCheckedRef.current = true
  }, [])

  // Keep Requests route accessible; show graceful empty state when no reviewer workspace

  useEffect(() => {
    if (!user) return
    if (view === 'detail' && routeSessionId && selectedSession?.id !== routeSessionId) {
      openSessionById(routeSessionId, { updateUrl: false })
    }
  }, [user, view, routeSessionId, selectedSession?.id, openSessionById])

  const reportProblem = useCallback(() => {
    try {
      const path = (window.location && (window.location.pathname + (window.location.search || ''))) || '/'
      reportClientError({ source: 'UserReport', message: 'user_report', extra: { note: 'User pressed report', path } })
      toast.success('Thanks for the report')
    } catch {}
  }, [toast])

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-gray-300 animate-pulse" />
          <span>Loading</span>
        </div>
      </div>
    )
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
      {offline ? (
        <div className="w-full bg-amber-50 border-b border-amber-200 text-amber-900 text-xs py-2 px-4 text-center">
          You are offline. We will retry actions when back online.
        </div>
      ) : null}
      <header className="border-b border-gray-100 bg-white px-4 py-4 sm:px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-4 min-w-0">
            <button onClick={() => navigate({ view: 'calendar', sessionId: null })} className="text-lg font-semibold text-gray-900 tracking-tight">
              Practica
            </button>
            {hasReviewerWorkspace ? (
              <nav className="hidden sm:flex items-center gap-2 rounded-full border border-gray-200 p-1">
                <button
                  onClick={() => navigate({ view: 'calendar', sessionId: null })}
                  className={`text-sm px-3 py-1.5 rounded-full transition-colors ${view === 'calendar' || view === 'detail' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900'}`}
                >
                  Home
                </button>
                <button
                  onClick={() => navigate({ view: 'requests', sessionId: null })}
                  className={`text-sm px-3 py-1.5 rounded-full transition-colors ${view === 'requests' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900'}`}
                >
                  Requests{reviewerPendingCount > 0 ? ` (${reviewerPendingCount})` : ''}
                </button>
              </nav>
            ) : null}
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={openGlobalRecorder}
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
              <span className="hidden sm:inline text-xs text-gray-400">{user.display_name || user.username}</span>
              <button onClick={handleLogout} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
                Log out
              </button>
            </div>
          </div>
        </div>
        <div className="max-w-4xl mx-auto mt-3 space-y-2 sm:hidden">
          {hasReviewerWorkspace ? (
            <nav className="grid grid-cols-2 gap-2">
              <button
                onClick={() => navigate({ view: 'calendar', sessionId: null })}
                className={`text-sm px-3 py-2.5 rounded-xl transition-colors ${view === 'calendar' || view === 'detail' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'}`}
              >
                Home
              </button>
              <button
                onClick={() => navigate({ view: 'requests', sessionId: null })}
                className={`text-sm px-3 py-2.5 rounded-xl transition-colors ${view === 'requests' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'}`}
              >
                Requests{reviewerPendingCount > 0 ? ` (${reviewerPendingCount})` : ''}
              </button>
            </nav>
          ) : null}
          <div className="grid grid-cols-1 gap-2">
            <button
              onClick={openGlobalRecorder}
              className="w-full rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
            >
              Record
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto pb-24">
        <React.Suspense fallback={
          <div className="px-4 sm:px-6 py-6 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-gray-300 animate-pulse" />
              <span>Loading</span>
            </div>
          </div>
        }>
        {/* List view removed. Calendar is primary. */}

        {/* Archive view removed. */}

        {view === 'calendar' && (
          <CalendarView
            sessions={sessions}
            sessionsLoading={sessionsLoading}
            routeDateKey={routeDate}
            reviewRequests={ownerReviewRequests}
            onOpenSession={(session, returnRoute) => openSession(session, returnRoute || { view: 'calendar', sessionId: null, seriesName: '' })}
            onOpenSeries={(seriesName) => navigate({ view: 'series', sessionId: null, seriesName })}
            onQuickRecord={(dateKey) => handleRecordAnother({
              returnRoute: { view: 'calendar', sessionId: null, date: String(dateKey || '') },
            })}
            onOpenListDate={(dateKey) => {
              try { window.localStorage.setItem('practica.filter.date.v1', String(dateKey || '')) } catch {}
              navigate({ view: 'calendar', sessionId: null, date: String(dateKey || '') })
            }}
            onMonthChange={(monthDate) => {
              loadCalendarMonth(monthDate)
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
            sessionsLoading={sessionsLoading}
            reviewRequests={ownerReviewRequests}
            token={token}
            onBack={() => navigate({ view: 'calendar', sessionId: null })}
            onOpenSession={openSession}
            onCreateVideo={() => {
              setPendingPracticeSeries(routeSeriesName)
              setPendingUploadReturnRoute({ view: 'series', sessionId: null, seriesName: routeSeriesName })
              navigate({ view: 'record', sessionId: null })
            }}
          />
        )}

        {view === 'requests' && (
          hasReviewerWorkspace ? (
            <RequestsView token={token} onOpenReviewRequest={(requestItem) => {
              const requestLink = requestItem?.feedback_link || requestItem?.review_link
              if (!requestLink?.token) return
              navigate({ view: 'review', token: requestLink.token, sessionId: null })
            }} />
          ) : (
            <div className="px-4 sm:px-6 py-6">
              <div className="max-w-3xl mx-auto">
                <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center">
                  <p className="text-sm font-semibold text-gray-900">No trusted feedback inbox yet</p>
                  <p className="text-xs text-gray-500 mt-1">Structured requests appear here when someone brings you into their practice loop.</p>
                  <div className="mt-4">
              <button type="button" onClick={() => navigate({ view: 'calendar', sessionId: null })} className="text-xs rounded-lg bg-gray-900 text-white px-3 py-1.5 hover:bg-gray-800">Back to Home</button>
                  </div>
                </div>
              </div>
            </div>
          )
        )}

        {view === 'upload' && (
          <SessionUpload
            token={token}
            practiceThreadOptions={practiceThreadOptions}
            onComplete={handleUploadComplete}
            onCancel={({ bypassUploadGuard = false } = {}) => {
              const nextRoute = pendingUploadReturnRoute?.view
                ? pendingUploadReturnRoute
                : (pendingPracticeSeries
                    ? { view: 'series', sessionId: null, seriesName: pendingPracticeSeries }
                    : { view: 'calendar', sessionId: null })
              setPendingUploadReturnRoute({ view: 'calendar', sessionId: null })
              navigate(nextRoute, { bypassUploadGuard })
            }}
            initialRecorderOpen={openRecorderOnUpload}
            initialPracticeSeries={pendingPracticeSeries}
            onPracticeSeriesHandled={() => setPendingPracticeSeries('')}
            onRecorderOpenHandled={() => setOpenRecorderOnUpload(false)}
            onUploadGuardChange={setUploadNavigationGuard}
          />
        )}

        {view === 'record' && (
          <RecorderPage
            onCancel={() => navigate({ view: 'calendar', sessionId: null })}
            onComplete={handleUploadComplete}
          />
        )}

        {view === 'review' && (
          <ReviewPage
            reviewToken={reviewToken}
            onContinueLoop={(draft) => handleRecordAnother(draft)}
          />
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
            onRecordAnother={(draft = null) => handleRecordAnother(draft || { practiceSeries: selectedSession.practice_series || '' })}
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
        </React.Suspense>
      </main>
      {showRecorderModal ? (
        <RecorderModal
          onClose={() => setShowRecorderModal(false)}
          onRecorded={() => {
            setPendingUploadReturnRoute(currentReturnRoute)
            setOpenRecorderOnUpload(false)
            navigate({ view: 'record', sessionId: null })
          }}
        />
      ) : null}
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
    // Do not auto-reload; let user choose to retry to avoid loops when a bad bundle is cached
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
                onClick={() => { try { window.history.pushState(null, '', '/') ; window.location.reload() } catch {} }}
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
