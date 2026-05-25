import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { AuthProvider, useAuth } from './auth'
import AppErrorBoundary from './components/AppErrorBoundary'
import { useAuthExpiredListener } from './hooks/useAuthExpiredListener'
import { useBeforeUnloadGuard } from './hooks/useBeforeUnloadGuard'
import { useCurrentRoutePath } from './hooks/useCurrentRoutePath'
import { useDetailRouteHydration } from './hooks/useDetailRouteHydration'
import { useInitialRouteNormalization } from './hooks/useInitialRouteNormalization'
import { useLibraryMetrics } from './hooks/useLibraryMetrics'
import { useNavigationActions } from './hooks/useNavigationActions'
import { useOfflineStatus } from './hooks/useOfflineStatus'
import { useOpenSessionById } from './hooks/useOpenSessionById'
import { usePaginatedFetch } from './hooks/usePaginatedFetch'
import { usePopStateUploadGuard } from './hooks/usePopStateUploadGuard'
import { usePostLoginRedirect } from './hooks/usePostLoginRedirect'
import { usePrimaryNavigation } from './hooks/usePrimaryNavigation'
import { useQuickRecordBootstrap } from './hooks/useQuickRecordBootstrap'
import { useRecordingActions } from './hooks/useRecordingActions'
import { useSessionUpdatedListener } from './hooks/useSessionUpdatedListener'
import { useSessionDetailActions } from './hooks/useSessionDetailActions'
import { useSessionsLoader } from './hooks/useSessionsLoader'
import { useSessionViewCallbacks } from './hooks/useSessionViewCallbacks'
import { useRoutineRenamedListener } from './hooks/useRoutineRenamedListener'
import { useUploadReturnRouting } from './hooks/useUploadReturnRouting'
import { useUserMenuActions } from './hooks/useUserMenuActions'
import { useViewDataRefresh } from './hooks/useViewDataRefresh'
import { parseRoute, routePath } from './routing'
import { ToastProvider, useToast } from './components/Toast'
import { ConfirmProvider, useConfirm } from './components/ConfirmDialog'
import AuthForm from './components/AuthForm'
import SessionUpload from './components/SessionUpload'
// Inline header create buttons to avoid any chance of circular init
const SessionDetail = React.lazy(() => import('./components/SessionDetail'))
const ProgressView = React.lazy(() => import('./components/ProgressView'))
const SkillView = React.lazy(() => import('./components/SkillView'))
import PrivacyPage from './components/PrivacyPage'
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
  const [selectedSession, setSelectedSession] = useState(null)
  const [sessions, setSessions] = useState([])
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [detailReturnRoute, setDetailReturnRoute] = useState({ view: 'progress', sessionId: null, seriesName: '' })
  const [openRecorderOnUpload, setOpenRecorderOnUpload] = useState(false)
  const [justUploadedSessionId, setJustUploadedSessionId] = useState(null)
  const [pendingPracticeSeries, setPendingPracticeSeries] = useState(initialRoute.seriesName || '')
  const [pendingUploadReturnRoute, setPendingUploadReturnRoute] = useState({
    view: initialRoute.view === 'skill' && initialRoute.seriesName ? 'skill' : 'progress',
    sessionId: null,
    seriesName: initialRoute.view === 'skill' ? (initialRoute.seriesName || '') : '',
    date: initialRoute.view === 'progress' ? (initialRoute.date || '') : '',
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
    routeDate,
    routeSeriesName,
    routeSessionId,
    view,
  })

  useCurrentRoutePath({
    currentPathRef,
    route: {
      view,
      sessionId: routeSessionId,
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

  useRoutineRenamedListener({
    calendarMonthCacheRef,
    loadSessions,
    navigate,
    routeSeriesName,
    selectedSessionId: selectedSession?.id,
    setSelectedSession,
    token,
    view,
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
    skillOptions,
  } = useLibraryMetrics({ sessions })

  const {
    handleRecordAnother,
    openGlobalRecorder,
    startRecord,
  } = useRecordingActions({
    currentReturnRoute,
    navigate,
    resolveUploadReturnRoute,
    setJustUploadedSessionId,
    setOpenRecorderOnUpload,
    setPendingPracticeSeries,
    setPendingUploadReturnRoute,
    setSelectedSession,
  })

  useViewDataRefresh({
    loadSessions,
    user,
    view,
  })

  useQuickRecordBootstrap(autoQuickRecordCheckedRef)

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
    goProgress,
    goPrivacy,
    goSkill,
  } = usePrimaryNavigation({ navigate })

  const progressNavActive = view === 'progress' || view === 'skill' || view === 'detail'

  const {
    onDetailSessionDelete,
    onDetailSessionUpdate,
  } = useSessionViewCallbacks({
    navigate,
    setSelectedSession,
    setSessions,
  })
  const isImmersiveMobileView = view === 'record' || view === 'detail'

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
    return <AuthForm />
  }

  return (
    <div className="min-h-screen bg-white">
      {offline ? (
        <div className="w-full bg-amber-50 border-b border-amber-200 text-amber-900 text-xs py-2 px-4 text-center">
          You are offline. We will retry actions when back online.
        </div>
      ) : null}
      <header className={`${view === 'detail' ? 'hidden' : isImmersiveMobileView ? 'hidden sm:block' : ''} border-b border-gray-100 bg-white px-4 py-4 sm:px-6`}>
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-4 min-w-0">
            <button onClick={goProgress} className="text-lg font-semibold text-gray-900 tracking-tight">
              Practica
            </button>
            <button
              onClick={goProgress}
              className={`hidden sm:inline-flex text-sm px-3 py-1.5 rounded-full border transition-colors ${progressNavActive ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-500 hover:text-gray-900'}`}
            >
              Progress
            </button>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={openGlobalRecorder}
              className="inline-flex rounded-full bg-gray-900 px-3 py-2 text-xs font-medium text-white hover:bg-gray-800 transition-colors sm:px-4 sm:text-sm"
            >
              Record
            </button>
            <div className="flex items-center gap-2 sm:border-l sm:border-gray-100 sm:pl-3">
              <button onClick={goPrivacy} className="hidden text-xs text-gray-400 hover:text-gray-600 transition-colors sm:inline">
                Privacy
              </button>
              <span className="hidden sm:inline text-xs text-gray-400">{user.display_name || user.username}</span>
              <button onClick={handleLogout} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
                Log out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className={view === 'detail' ? 'w-full' : isImmersiveMobileView ? 'w-full sm:max-w-4xl sm:mx-auto sm:pb-24' : 'max-w-4xl mx-auto pb-24'}>
        <React.Suspense fallback={
          <div className="px-4 sm:px-6 py-6 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-gray-300 animate-pulse" />
              <span>Loading</span>
            </div>
          </div>
        }>

        {view === 'privacy' && (
          <PrivacyPage signedIn onBack={goProgress} />
        )}

        {view === 'progress' && (
          <ProgressView
            sessions={sessions}
            sessionsLoading={sessionsLoading}
            token={token}
            onOpenSession={openSession}
            onOpenSkill={goSkill}
            onSessionUpdate={onDetailSessionUpdate}
            onRecordProof={openGlobalRecorder}
          />
        )}

        {view === 'skill' && (
          <SkillView
            skillName={routeSeriesName}
            sessions={sessions}
            sessionsLoading={sessionsLoading}
            token={token}
            onBack={goProgress}
            onOpenSession={openSession}
            onRecordProof={() => startRecord({
              skillName: routeSeriesName,
              returnRoute: { view: 'skill', sessionId: null, seriesName: routeSeriesName },
            })}
          />
        )}

        {view === 'upload' && (
          <SessionUpload
            token={token}
            skillOptions={skillOptions}
            onComplete={handleUploadComplete}
            onCancel={({ bypassUploadGuard = false } = {}) => {
              const nextRoute = pendingUploadReturnRoute?.view
                ? pendingUploadReturnRoute
                : (pendingPracticeSeries
                    ? { view: 'skill', sessionId: null, seriesName: pendingPracticeSeries }
                    : { view: 'progress', sessionId: null })
              setPendingUploadReturnRoute({ view: 'progress', sessionId: null })
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
            practiceSeries={pendingPracticeSeries}
            skillOptions={skillOptions}
            sessions={sessions}
            onCancel={() => {
              setPendingPracticeSeries('')
              setPendingUploadReturnRoute({ view: 'progress', sessionId: null, seriesName: '' })
              goProgress()
            }}
            onComplete={handleUploadComplete}
          />
        )}

        {view === 'detail' && selectedSession && (
          <SessionDetail
            session={selectedSession}
            sessions={sessions}
            token={token}
            skillOptions={skillOptions}
            onBack={goBack}
            onOpenProgress={goProgress}
            returnRoute={detailReturnRoute}
            justUploaded={selectedSession.id === justUploadedSessionId}
            onRecordAnother={(draft = null) => handleRecordAnother(draft || { practiceSeries: selectedSession.practice_series || '' })}
            onOpenSession={openSession}
            onOpenSeries={goSkill}
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
