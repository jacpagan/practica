import React, { useState, useEffect } from 'react'
import { AuthProvider, useAuth, authHeaders } from './auth'
import { ToastProvider } from './components/Toast'
import AuthForm from './components/AuthForm'
import SessionList from './components/SessionList'
import SessionUpload from './components/SessionUpload'
import SessionDetail from './components/SessionDetail'
import ProgressView from './components/ProgressView'
import ConnectionsView from './components/ConnectionsView'
import QuickRecord from './components/QuickRecord'

function AppContent() {
  const { user, token, loading, logout, refreshUser } = useAuth()
  const [sessions, setSessions] = useState([])
  const [exercises, setExercises] = useState([])
  const [view, setView] = useState('sessions')
  const [selectedSession, setSelectedSession] = useState(null)
  const [selectedExercise, setSelectedExercise] = useState(null)

  useEffect(() => {
    if (user) { fetchSessions(); fetchExercises() }
  }, [user])

  useEffect(() => {
    const handler = () => refreshUser()
    window.addEventListener('user-updated', handler)
    return () => window.removeEventListener('user-updated', handler)
  }, [refreshUser])

  const headers = authHeaders(token)

  const fetchSessions = async () => {
    try {
      const res = await fetch('/api/sessions/', { headers })
      const data = await res.json()
      setSessions(data.results || data)
    } catch (e) { console.error(e) }
  }

  const fetchExercises = async () => {
    try {
      const res = await fetch('/api/exercises/', { headers })
      const data = await res.json()
      setExercises(data.results || data)
    } catch (e) { console.error(e) }
  }

  const openSession = (session) => { setSelectedSession(session); setView('detail') }
  const openProgress = (exercise) => { setSelectedExercise(exercise); setView('progress') }

  const goHome = () => {
    setView('sessions')
    setSelectedSession(null)
    setSelectedExercise(null)
    fetchSessions()
    fetchExercises()
  }

  const handleQuickRecordComplete = (session) => {
    fetchSessions()
    fetchExercises()
    setSelectedSession(session)
    setView('detail')
  }

  if (loading) return <div className="min-h-screen bg-white flex items-center justify-center"><p className="text-sm text-gray-400">Loading...</p></div>
  if (!user) return <AuthForm />

  const isTeacher = user.role === 'teacher'
  const linked = isTeacher ? (user.linked_students || []) : (user.linked_teachers || [])
  const hasConnections = linked.length > 0

  // QuickRecord is full-screen overlay — renders on top of everything
  if (view === 'quickRecord') {
    return (
      <QuickRecord
        token={token}
        exercises={exercises}
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
                {!isTeacher && (
                  <button onClick={() => setView('upload')}
                    className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors hidden sm:block">
                    + Upload
                  </button>
                )}
                <button onClick={() => setView('connections')}
                  className="relative text-sm text-gray-500 hover:text-gray-900 transition-colors">
                  Connections
                  {!hasConnections && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-400 rounded-full" />
                  )}
                </button>
              </>
            )}
            {view !== 'sessions' && (
              <button onClick={goHome} className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
                Back
              </button>
            )}
            <div className="flex items-center gap-2 border-l border-gray-100 pl-3">
              <span className="text-xs text-gray-400">
                {user.display_name}
                <span className="ml-1 text-gray-300">({user.role})</span>
              </span>
              <button onClick={logout} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
                Log out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto pb-24">
        {view === 'sessions' && (
          <SessionList
            sessions={sessions} exercises={exercises} user={user}
            onSessionSelect={openSession} onExerciseSelect={openProgress}
            onUploadClick={() => setView('upload')}
            onDeleteSession={async (id) => {
              await fetch(`/api/sessions/${id}/`, { method: 'DELETE', headers })
              fetchSessions()
            }}
          />
        )}
        {view === 'upload' && (
          <SessionUpload token={token}
            onComplete={() => { fetchSessions(); setView('sessions') }}
            onCancel={() => setView('sessions')} />
        )}
        {view === 'detail' && selectedSession && (
          <SessionDetail session={selectedSession} exercises={exercises} token={token} user={user}
            onBack={goHome} onSessionUpdate={(s) => { setSelectedSession(s); fetchExercises() }} />
        )}
        {view === 'progress' && selectedExercise && (
          <ProgressView exercise={selectedExercise} token={token} onBack={goHome} />
        )}
        {view === 'connections' && (
          <ConnectionsView onBack={goHome} />
        )}
      </main>

      {/* Floating record button — students only, on home screen */}
      {view === 'sessions' && !isTeacher && (
        <div className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 z-40">
          <button
            onClick={() => setView('quickRecord')}
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/30 flex items-center justify-center transition-all active:scale-90 hover:scale-105"
          >
            <div className="w-5 h-5 sm:w-6 sm:h-6 border-2 border-white rounded-full" />
          </button>
          <p className="text-[10px] text-gray-400 text-center mt-1.5">Record</p>
        </div>
      )}
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </AuthProvider>
  )
}

export default App
