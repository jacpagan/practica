import React, { useState, useEffect } from 'react'
import { AuthProvider, useAuth, authHeaders } from './auth'
import AuthForm from './components/AuthForm'
import SessionList from './components/SessionList'
import SessionUpload from './components/SessionUpload'
import SessionDetail from './components/SessionDetail'
import ProgressView from './components/ProgressView'

function AppContent() {
  const { user, token, loading, logout } = useAuth()
  const [sessions, setSessions] = useState([])
  const [exercises, setExercises] = useState([])
  const [view, setView] = useState('sessions')
  const [selectedSession, setSelectedSession] = useState(null)
  const [selectedExercise, setSelectedExercise] = useState(null)

  useEffect(() => {
    if (user) { fetchSessions(); fetchExercises() }
  }, [user])

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

  if (loading) return <div className="min-h-screen bg-white flex items-center justify-center"><p className="text-sm text-gray-400">Loading...</p></div>
  if (!user) return <AuthForm />

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-100 px-4 py-3 sm:px-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <button onClick={goHome} className="text-lg font-semibold text-gray-900 tracking-tight">
            Practica
          </button>
          <div className="flex items-center gap-4">
            {view === 'sessions' && (
              <button onClick={() => setView('upload')}
                className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
                + New session
              </button>
            )}
            {view !== 'sessions' && (
              <button onClick={goHome} className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
                Back
              </button>
            )}
            <div className="flex items-center gap-2 border-l border-gray-100 pl-4">
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

      <main className="max-w-5xl mx-auto">
        {view === 'sessions' && (
          <SessionList
            sessions={sessions} exercises={exercises}
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
      </main>
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App
