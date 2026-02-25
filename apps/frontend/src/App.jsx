import React, { useState, useEffect } from 'react'
import SessionList from './components/SessionList'
import SessionUpload from './components/SessionUpload'
import SessionDetail from './components/SessionDetail'
import ProgressView from './components/ProgressView'

function App() {
  const [sessions, setSessions] = useState([])
  const [exercises, setExercises] = useState([])
  const [view, setView] = useState('sessions') // sessions | upload | detail | progress
  const [selectedSession, setSelectedSession] = useState(null)
  const [selectedExercise, setSelectedExercise] = useState(null)

  useEffect(() => { fetchSessions(); fetchExercises() }, [])

  const fetchSessions = async () => {
    try {
      const res = await fetch('/api/sessions/')
      const data = await res.json()
      setSessions(data.results || data)
    } catch (e) { console.error(e) }
  }

  const fetchExercises = async () => {
    try {
      const res = await fetch('/api/exercises/')
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

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-100 px-4 py-3 sm:px-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <button onClick={goHome} className="text-lg font-semibold text-gray-900 tracking-tight">
            Practica
          </button>
          <div className="flex items-center gap-4">
            {view === 'sessions' && (
              <>
                <button
                  onClick={() => setView('upload')}
                  className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                >
                  + New session
                </button>
              </>
            )}
            {view !== 'sessions' && (
              <button onClick={goHome} className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
                Back
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto">
        {view === 'sessions' && (
          <SessionList
            sessions={sessions}
            exercises={exercises}
            onSessionSelect={openSession}
            onExerciseSelect={openProgress}
            onUploadClick={() => setView('upload')}
            onDeleteSession={async (id) => {
              await fetch(`/api/sessions/${id}/`, { method: 'DELETE' })
              fetchSessions()
            }}
          />
        )}

        {view === 'upload' && (
          <SessionUpload
            onComplete={() => { fetchSessions(); setView('sessions') }}
            onCancel={() => setView('sessions')}
          />
        )}

        {view === 'detail' && selectedSession && (
          <SessionDetail
            session={selectedSession}
            exercises={exercises}
            onBack={goHome}
            onSessionUpdate={(updated) => { setSelectedSession(updated); fetchExercises() }}
          />
        )}

        {view === 'progress' && selectedExercise && (
          <ProgressView
            exercise={selectedExercise}
            onBack={goHome}
          />
        )}
      </main>
    </div>
  )
}

export default App
