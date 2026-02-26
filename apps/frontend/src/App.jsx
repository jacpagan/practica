import React, { useState, useEffect, Component } from 'react'

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(error) { return { error: error.message } }
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
import { AuthProvider, useAuth, authHeaders } from './auth'
import { ToastProvider } from './components/Toast'
import { useToast } from './components/Toast'
import AuthForm from './components/AuthForm'
import SessionList from './components/SessionList'
import SessionUpload from './components/SessionUpload'
import SessionDetail from './components/SessionDetail'
import ProgressView from './components/ProgressView'
import ConnectionsView from './components/ConnectionsView'
import QuickRecord from './components/QuickRecord'
import ScreenRecord from './components/ScreenRecord'

function AppContent() {
  const { user, token, loading, logout, refreshUser } = useAuth()
  const toast = useToast()
  const [sessions, setSessions] = useState([])
  const [exercises, setExercises] = useState([])
  const [spaces, setSpaces] = useState([])
  const [activeSpace, setActiveSpace] = useState(null) // null = all
  const [view, setView] = useState('sessions')
  const [selectedSession, setSelectedSession] = useState(null)
  const [selectedExercise, setSelectedExercise] = useState(null)
  const [showCreateSpace, setShowCreateSpace] = useState(false)
  const [newSpaceName, setNewSpaceName] = useState('')

  useEffect(() => {
    if (user) { fetchSpaces(); fetchSessions(); fetchExercises() }
  }, [user])

  useEffect(() => { fetchSessions() }, [activeSpace])

  useEffect(() => {
    const handler = () => refreshUser()
    window.addEventListener('user-updated', handler)
    return () => window.removeEventListener('user-updated', handler)
  }, [refreshUser])

  const headers = authHeaders(token)

  const fetchSpaces = async () => {
    try {
      const res = await fetch('/api/spaces/', { headers })
      const data = await res.json()
      setSpaces(data.results || data)
    } catch (e) { console.error(e) }
  }

  const fetchSessions = async () => {
    try {
      const url = activeSpace ? `/api/sessions/?space=${activeSpace}` : '/api/sessions/'
      const res = await fetch(url, { headers })
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

  const createSpace = async () => {
    if (!newSpaceName.trim()) return
    try {
      const res = await fetch('/api/spaces/', {
        method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newSpaceName.trim() }),
      })
      if (res.ok) {
        setNewSpaceName('')
        setShowCreateSpace(false)
        fetchSpaces()
        toast.success(`Space "${newSpaceName.trim()}" created`)
      }
    } catch { toast.error('Error creating space') }
  }

  const openSession = (session) => { setSelectedSession(session); setView('detail') }
  const openProgress = (exercise) => { setSelectedExercise(exercise); setView('progress') }

  const goHome = () => {
    setView('sessions')
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
    setView('detail')
  }

  if (loading) return <div className="min-h-screen bg-white flex items-center justify-center"><p className="text-sm text-gray-400">Loading...</p></div>
  if (!user) return <AuthForm />

  const isTeacher = user.role === 'teacher'

  if (view === 'quickRecord') {
    return (
      <QuickRecord
        token={token} exercises={exercises} spaces={spaces}
        onComplete={handleQuickRecordComplete} onCancel={goHome}
      />
    )
  }

  if (view === 'screenRecord') {
    return (
      <ScreenRecord
        token={token} spaces={spaces}
        onComplete={handleQuickRecordComplete} onCancel={goHome}
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
                  className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
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
        {/* Space selector — shown on sessions view */}
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
              {!isTeacher && (
                <button
                  onClick={() => setShowCreateSpace(true)}
                  className="text-xs px-2 py-1.5 text-gray-400 hover:text-gray-600 transition-colors whitespace-nowrap"
                >+</button>
              )}
            </div>
          </div>
        )}

        {/* Create space inline form */}
        {showCreateSpace && (
          <div className="px-4 sm:px-6 pt-2 pb-1">
            <div className="flex gap-2">
              <input
                type="text" value={newSpaceName} onChange={(e) => setNewSpaceName(e.target.value)}
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

        {/* Prompt to create first space */}
        {view === 'sessions' && spaces.length === 0 && !isTeacher && !showCreateSpace && (
          <div className="px-4 sm:px-6 pt-4">
            <button
              onClick={() => setShowCreateSpace(true)}
              className="w-full text-left p-3 rounded-xl border border-dashed border-gray-200 hover:border-gray-400 transition-colors"
            >
              <p className="text-sm font-medium text-gray-700">Create your first Space</p>
              <p className="text-xs text-gray-400 mt-0.5">Spaces organize your practice — Drumming, Production, Qigong, etc.</p>
            </button>
          </div>
        )}

        {view === 'sessions' && (
          <SessionList
            sessions={sessions} exercises={exercises} user={user} spaces={spaces} activeSpace={activeSpace}
            onSessionSelect={openSession} onExerciseSelect={openProgress}
            onUploadClick={() => setView('upload')}
            onDeleteSession={async (id) => {
              await fetch(`/api/sessions/${id}/`, { method: 'DELETE', headers })
              fetchSessions()
            }}
          />
        )}
        {view === 'upload' && (
          <SessionUpload token={token} spaces={spaces}
            activeSpace={activeSpace}
            onComplete={() => { fetchSessions(); fetchSpaces(); setView('sessions') }}
            onCancel={() => setView('sessions')} />
        )}
        {view === 'detail' && selectedSession && (
          <SessionDetail session={selectedSession} exercises={exercises} spaces={spaces} token={token} user={user}
            onBack={goHome} onSessionUpdate={(s) => { setSelectedSession(s); fetchExercises(); fetchSpaces() }} />
        )}
        {view === 'progress' && selectedExercise && (
          <ErrorBoundary onBack={goHome}>
            <ProgressView exercise={selectedExercise} token={token} onBack={goHome} />
          </ErrorBoundary>
        )}
        {view === 'connections' && (
          <ConnectionsView spaces={spaces} token={token} onBack={goHome} onSpacesChange={fetchSpaces} />
        )}
      </main>

      {view === 'sessions' && !isTeacher && (
        <div className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 z-40 flex flex-col items-center gap-3">
          {/* Screen record button — desktop only */}
          <button
            onClick={() => setView('screenRecord')}
            className="w-10 h-10 rounded-full bg-gray-800 hover:bg-gray-700 shadow-lg flex items-center justify-center transition-all active:scale-90 hover:scale-105 hidden sm:flex"
            title="Record screen"
          >
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
            </svg>
          </button>
          {/* Camera record button */}
          <button
            onClick={() => setView('quickRecord')}
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
        <AppContent />
      </ToastProvider>
    </AuthProvider>
  )
}

export default App
