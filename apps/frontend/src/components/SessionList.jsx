import React, { useState } from 'react'

const formatDate = (d) => {
  const date = new Date(d)
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function SessionList({ sessions, exercises, user, onSessionSelect, onExerciseSelect, onUploadClick, onDeleteSession }) {
  const isTeacher = user?.role === 'teacher'
  const [tab, setTab] = useState('sessions') // sessions | exercises

  return (
    <div className="px-4 sm:px-6 py-4">
      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-gray-100">
        <button
          onClick={() => setTab('sessions')}
          className={`px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            tab === 'sessions' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          Sessions
        </button>
        <button
          onClick={() => setTab('exercises')}
          className={`px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            tab === 'exercises' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          Exercises
          {exercises.length > 0 && (
            <span className="ml-1.5 text-xs text-gray-400">{exercises.length}</span>
          )}
        </button>
      </div>

      {/* Sessions tab */}
      {tab === 'sessions' && (
        <>
          {sessions.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-gray-400 text-sm mb-6">No sessions yet</p>
              <button
                onClick={onUploadClick}
                className="text-sm font-medium text-gray-900 border border-gray-200 rounded-lg px-5 py-2.5 hover:border-gray-400 transition-colors"
              >
                Upload your first session
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {sessions.map(session => (
                <div
                  key={session.id}
                  onClick={() => onSessionSelect(session)}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer group"
                >
                  <div className="w-16 h-11 sm:w-24 sm:h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                    <video
                      src={session.video_file?.startsWith('/media/') ? `http://localhost:8000${session.video_file}` : session.video_file}
                      className="w-full h-full object-cover"
                      muted preload="metadata"
                      onLoadedMetadata={(e) => { e.target.currentTime = 1 }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-gray-900 truncate">{session.title}</h3>
                    {session.description && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{session.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-gray-400">{formatDate(session.recorded_at || session.created_at)}</span>
                      {session.chapter_count > 0 && (
                        <span className="text-xs text-gray-400">{session.chapter_count} chapters</span>
                      )}
                      {isTeacher && session.owner_name && (
                        <span className="text-xs text-blue-500">{session.owner_name}</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); if (confirm(`Delete "${session.title}"?`)) onDeleteSession(session.id) }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-300 hover:text-red-400 transition-all flex-shrink-0"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Exercises tab */}
      {tab === 'exercises' && (
        <>
          {exercises.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-gray-400 text-sm">Exercises appear here as you add chapters to sessions</p>
            </div>
          ) : (
            <div className="space-y-1">
              {exercises.map(exercise => (
                <div
                  key={exercise.id}
                  onClick={() => onExerciseSelect(exercise)}
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <div>
                    <h3 className="text-sm font-medium text-gray-900">{exercise.name}</h3>
                    {exercise.category && (
                      <p className="text-xs text-gray-400 mt-0.5">{exercise.category}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">{exercise.chapter_count} entries</span>
                    <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default SessionList
