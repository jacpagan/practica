import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { AuthProvider, useAuth } from './auth'
import AppErrorBoundary from './components/AppErrorBoundary'
import { useAuthExpiredListener } from './hooks/useAuthExpiredListener'
import { useBeforeUnloadGuard } from './hooks/useBeforeUnloadGuard'
import { useCalendarMonthLoader } from './hooks/useCalendarMonthLoader'
import { useCurrentRoutePath } from './hooks/useCurrentRoutePath'
import { useDetailRouteHydration } from './hooks/useDetailRouteHydration'
import { useInitialRouteNormalization } from './hooks/useInitialRouteNormalization'
import { useLibraryMetrics } from './hooks/useLibraryMetrics'
import { useNavigationActions } from './hooks/useNavigationActions'
import { useOfflineStatus } from './hooks/useOfflineStatus'
import { useOpenHomeworkItem } from './hooks/useOpenHomeworkItem'
import { useOpenSessionById } from './hooks/useOpenSessionById'
import { useOwnerReviewRequestsLoader } from './hooks/useOwnerReviewRequestsLoader'
import { usePaginatedFetch } from './hooks/usePaginatedFetch'
import { usePopStateUploadGuard } from './hooks/usePopStateUploadGuard'
import { usePostLoginRedirect } from './hooks/usePostLoginRedirect'
import { usePrimaryNavigation } from './hooks/usePrimaryNavigation'
import { useQuickRecordBootstrap } from './hooks/useQuickRecordBootstrap'
import { useRecordingActions } from './hooks/useRecordingActions'
import { useReviewerWorkspaceAvailability } from './hooks/useReviewerWorkspaceAvailability'
import { useReviewerWorkspacePolling } from './hooks/useReviewerWorkspacePolling'
import { useSessionUpdatedListener } from './hooks/useSessionUpdatedListener'
import { useSessionDetailActions } from './hooks/useSessionDetailActions'
import { useSessionsLoader } from './hooks/useSessionsLoader'
import { useSessionViewCallbacks } from './hooks/useSessionViewCallbacks'
import { useThreadRenamedListener } from './hooks/useThreadRenamedListener'
import { useUploadReturnRouting } from './hooks/useUploadReturnRouting'
import { useUserMenuActions } from './hooks/useUserMenuActions'
import { useViewDataRefresh } from './hooks/useViewDataRefresh'
import { parseRoute, routePath } from './routing'
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

  useInitialRouteNormalization({
    route: {
      view,
      sessionId: routeSessionId,
      token: reviewToken,
      claim: reviewClaim,
      seriesName: routeSeriesName,
      date: routeDate,
    },
  })

  const {
    applyRoute,
    confirmAbortActiveUpload,
    navigate,
    requestAbortActiveUpload,
    setUploadNavigationGuard,
  } = useNavigationActions({
    confirm,
    currentPathRef,
    setReviewClaim,
    setReviewToken,
    setRouteDate,
    setRouteSeriesName,
    setRouteSessionId,
    setView,
    uploadGuardRef,
  })

  const {
    currentReturnRoute,
    resolveUploadReturnRoute,
  } = useUploadReturnRouting({
    routeClaim: reviewClaim,
    routeDate,
    routeSeriesName,
    routeSessionId,
    reviewToken,
    view,
  })

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

  useQuickRecordBootstrap(autoQuickRecordCheckedRef)

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
  } = useUserMenuActions({
    confirmAbortActiveUpload,
    logout,
    requestAbortActiveUpload,
    uploadGuardRef,
  })

  const {
    goHome,
    goPrivacy,
    goRequests,
    goSeries,
  } = usePrimaryNavigation({ navigate })

  const {
    onDetailSessionDelete,
    onDetailSessionUpdate,
    openReviewRequestToken,
  } = useSessionViewCallbacks({
    navigate,
    setSelectedSession,
    setSessions,
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
            <button onClick={goHome} className="text-lg font-semibold text-gray-900 tracking-tight">
              Practica
            </button>
            {hasReviewerWorkspace ? (
              <nav className="hidden sm:flex items-center gap-2 rounded-full border border-gray-200 p-1">
                <button
                  onClick={goHome}
                  className={`text-sm px-3 py-1.5 rounded-full transition-colors ${view === 'calendar' || view === 'detail' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900'}`}
                >
                  Home
                </button>
                <button
                  onClick={goRequests}
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
                onOpenPrivacy={goPrivacy}
                onOpenReviewRequest={openReviewRequestToken}
              />
              <button onClick={goPrivacy} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
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
                onClick={goHome}
                className={`text-sm px-3 py-2.5 rounded-xl transition-colors ${view === 'calendar' || view === 'detail' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'}`}
              >
                Home
              </button>
              <button
                onClick={goRequests}
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
            onOpenSeries={goSeries}
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
          <PrivacyPage signedIn onBack={goHome} />
        )}

        {view === 'series' && (
          <SeriesView
            seriesName={routeSeriesName}
            sessions={sessions}
            sessionsLoading={sessionsLoading}
            reviewRequests={ownerReviewRequests}
            token={token}
            onBack={goHome}
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
            <RequestsView token={token} onOpenReviewRequest={openReviewRequestToken} />
          ) : (
            <div className="px-4 sm:px-6 py-6">
              <div className="max-w-3xl mx-auto">
                <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center">
                  <p className="text-sm font-semibold text-gray-900">No trusted feedback inbox yet</p>
                  <p className="text-xs text-gray-500 mt-1">Structured requests appear here when someone brings you into their practice loop.</p>
                  <div className="mt-4">
              <button type="button" onClick={goHome} className="text-xs rounded-lg bg-gray-900 text-white px-3 py-1.5 hover:bg-gray-800">Back to Home</button>
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
            onCancel={goHome}
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
            onOpenReviewRequest={openReviewRequestToken}
            justUploaded={selectedSession.id === justUploadedSessionId}
            onRecordAnother={(draft = null) => handleRecordAnother(draft || { practiceSeries: selectedSession.practice_series || '' })}
            onOpenSeries={goSeries}
            onSessionUpdate={onDetailSessionUpdate}
            onSessionDelete={onDetailSessionDelete}
          />
        )}
        </React.Suspense>
      </main>
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <ConfirmProvider>
          <AppErrorBoundary>
            <AppContent />
          </AppErrorBoundary>
        </ConfirmProvider>
      </ToastProvider>
    </AuthProvider>
  )
}

export default App
