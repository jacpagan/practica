import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { reportClientError } from './utils'
import { AuthProvider, useAuth } from './auth'
import { useAuthExpiredListener } from './hooks/useAuthExpiredListener'
import { useBeforeUnloadGuard } from './hooks/useBeforeUnloadGuard'
import { useCalendarMonthLoader } from './hooks/useCalendarMonthLoader'
import { useCurrentRoutePath } from './hooks/useCurrentRoutePath'
import { useDetailRouteHydration } from './hooks/useDetailRouteHydration'
import { useLibraryMetrics } from './hooks/useLibraryMetrics'
import { useOfflineStatus } from './hooks/useOfflineStatus'
import { useOpenHomeworkItem } from './hooks/useOpenHomeworkItem'
import { useOpenSessionById } from './hooks/useOpenSessionById'
import { useOwnerReviewRequestsLoader } from './hooks/useOwnerReviewRequestsLoader'
import { usePaginatedFetch } from './hooks/usePaginatedFetch'
import { usePopStateUploadGuard } from './hooks/usePopStateUploadGuard'
import { usePostLoginRedirect } from './hooks/usePostLoginRedirect'
import { useRecordingActions } from './hooks/useRecordingActions'
import { useReviewerWorkspaceAvailability } from './hooks/useReviewerWorkspaceAvailability'
import { useReviewerWorkspacePolling } from './hooks/useReviewerWorkspacePolling'
import { useSessionUpdatedListener } from './hooks/useSessionUpdatedListener'
import { useSessionDetailActions } from './hooks/useSessionDetailActions'
import { useSessionsLoader } from './hooks/useSessionsLoader'
import { useThreadRenamedListener } from './hooks/useThreadRenamedListener'
import { useUserMenuActions } from './hooks/useUserMenuActions'
import { useViewDataRefresh } from './hooks/useViewDataRefresh'
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

  const loadSessions = useSessionsLoader({
    fetchPaginated,
    setSessions,
    setSessionsLoading,
    toast,
    token,
  })

  useThreadRenamedListener({
    calendarMonthCacheRef,
    loadSessions,
    navigate,
    routeSeriesName,
    selectedSessionId: selectedSession?.id,
    setSelectedSession,
    token,
    view,
  })

  const loadCalendarMonth = useCalendarMonthLoader({
    calendarMonthCacheRef,
    calendarMonthRequestRef,
    fetchPaginated,
    setSessions,
    setSessionsLoading,
    token,
  })

  const loadOwnerReviewRequests = useOwnerReviewRequestsLoader({
    fetchPaginated,
    setOwnerReviewRequests,
    token,
  })

  const loadReviewerWorkspaceAvailability = useReviewerWorkspaceAvailability({
    fetchPaginated,
    setHasReviewerWorkspace,
    setReviewerPendingCount,
    token,
  })

  useReviewerWorkspacePolling({
    loadReviewerWorkspaceAvailability,
    reviewerPollRef,
    token,
  })

  const openSessionById = useOpenSessionById({
    navigate,
    setSelectedSession,
    token,
    toast,
  })

  const {
    goBack,
    handleUploadComplete,
    openSession,
  } = useSessionDetailActions({
    calendarMonthCacheRef,
    detailReturnRoute,
    navigate,
    openSessionById,
    routeSeriesName,
    setDetailReturnRoute,
    setJustUploadedSessionId,
    setOpenRecorderOnUpload,
    setPendingPracticeSeries,
    setPendingUploadReturnRoute,
    setSelectedSession,
    setSessions,
    view,
  })

  const {
    activeOwnerRequestBySessionId,
    ownReadySessionCount,
    practiceThreadOptions,
  } = useLibraryMetrics({ ownerReviewRequests, sessions })

  // Global modal recorder
  const [showRecorderModal, setShowRecorderModal] = useState(false)

  // no dropdown menu state

  const {
    handleRecordAnother,
    openGlobalRecorder,
    startQuickRecord,
  } = useRecordingActions({
    currentReturnRoute,
    navigate,
    resolveUploadReturnRoute,
    setJustUploadedSessionId,
    setOpenRecorderOnUpload,
    setPendingFollowUpRequestDraft,
    setPendingPracticeSeries,
    setPendingUploadReturnRoute,
    setSelectedSession,
  })

  const openHomeWorkItem = useOpenHomeworkItem({
    activeOwnerRequestBySessionId,
    navigate,
    openSession,
    setDetailReturnRoute,
    setOpenRecorderOnUpload,
    setSelectedSession,
  })

  useViewDataRefresh({
    loadOwnerReviewRequests,
    loadReviewerWorkspaceAvailability,
    loadSessions,
    user,
    view,
  })

  useEffect(() => {
    if (autoQuickRecordCheckedRef.current) return
    autoQuickRecordCheckedRef.current = true
  }, [])

  // Keep Requests route accessible; show graceful empty state when no reviewer workspace

  useDetailRouteHydration({
    openSessionById,
    routeSessionId,
    selectedSessionId: selectedSession?.id,
    user,
    view,
  })

  const {
    handleLogout,
    reportProblem,
  } = useUserMenuActions({
    confirmAbortActiveUpload,
    logout,
    requestAbortActiveUpload,
    toast,
    uploadGuardRef,
  })

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
