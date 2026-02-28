import React, { useState, useMemo } from 'react'
import { fmtDateLong, videoUrl } from '../utils'

const dateKey = (dateStr) => {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const dateLabel = (dateStr) => {
  const d = new Date(dateStr)
  const now = new Date()
  const today = dateKey(now.toISOString())
  const yesterday = dateKey(new Date(now - 86400000).toISOString())
  const key = dateKey(dateStr)
  if (key === today) return 'Today'
  if (key === yesterday) return 'Yesterday'
  const diff = Math.floor((now - d) / 86400000)
  if (diff < 7) return d.toLocaleDateString('en-US', { weekday: 'long' })
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}

const timeLabel = (dateStr) => {
  const d = new Date(dateStr)
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function Thumbnail({ src, className = '' }) {
  const [failed, setFailed] = useState(false)
  return (
    <div className={`bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 ${className}`}>
      {src && !failed ? (
        <video
          src={videoUrl(src)}
          className="w-full h-full object-cover"
          muted preload="metadata"
          onLoadedMetadata={(e) => { e.target.currentTime = 1 }}
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </div>
      )}
    </div>
  )
}

function SessionList({ sessions, exercises, user, spaces, activeSpace, onSessionSelect, onExerciseSelect, onUploadClick, onDeleteSession }) {
  
  const [tab, setTab] = useState('sessions')

  const groupedSessions = useMemo(() => {
    const groups = []
    let currentKey = null
    for (const session of sessions) {
      const key = dateKey(session.recorded_at || session.created_at)
      if (key !== currentKey) {
        currentKey = key
        groups.push({ key, label: dateLabel(session.recorded_at || session.created_at), sessions: [] })
      }
      groups[groups.length - 1].sessions.push(session)
    }
    return groups
  }, [sessions])

  return (
    <div className="px-4 sm:px-6 py-4">
      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-gray-100">
        <button onClick={() => setTab('sessions')}
          className={`px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            tab === 'sessions' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}>Sessions</button>
        <button onClick={() => setTab('exercises')}
          className={`px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            tab === 'exercises' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}>
          Exercises
          {exercises.length > 0 && <span className="ml-1.5 text-xs text-gray-400">{exercises.length}</span>}
        </button>
      </div>

      {/* ── Sessions tab ── */}
      {tab === 'sessions' && (
        <>
          {sessions.length === 0 ? (
            <div className="text-center py-16">
              <svg className="w-10 h-10 text-gray-200 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <p className="text-gray-400 text-sm mb-1">
                {activeSpace ? 'No sessions in this space yet' : 'No sessions yet'}
              </p>
              <p className="text-xs text-gray-300 mb-5">Record a practice or upload a video to get started</p>
              <button onClick={onUploadClick}
                className="text-sm font-medium text-gray-900 border border-gray-200 rounded-lg px-5 py-2.5 hover:border-gray-400 transition-colors">
                Upload session
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {groupedSessions.map(group => (
                <div key={group.key}>
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">{group.label}</h3>
                    <div className="flex-1 h-px bg-gray-100" />
                    <span className="text-xs text-gray-300">{group.sessions.length}</span>
                  </div>

                  <div className="space-y-1">
                    {group.sessions.map(session => (
                      <div key={session.id} onClick={() => onSessionSelect(session)}
                        className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer group">

                        <Thumbnail src={session.video_file} className="w-16 h-11 sm:w-24 sm:h-16" />

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h3 className="text-sm font-medium text-gray-900 truncate">{session.title}</h3>
                            {session.has_unread && (
                              <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" title="New feedback" />
                            )}
                          </div>
                          {session.description && (
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{session.description}</p>
                          )}
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-xs text-gray-400">{timeLabel(session.recorded_at || session.created_at)}</span>
                            {session.chapter_count > 0 && (
                              <span className="text-xs text-gray-400">{session.chapter_count} ch</span>
                            )}
                            {session.comment_count > 0 && (
                              <span className={`text-xs ${session.has_unread ? 'text-blue-500 font-medium' : 'text-gray-400'}`}>
                                {session.comment_count} fb
                              </span>
                            )}
                            {session.owner_name && (
                              <span className="text-xs text-gray-400">{session.owner_name}</span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {session.space_name && !activeSpace ? (
                              <span className="text-[10px] bg-gray-200 text-gray-600 font-medium px-1.5 py-0.5 rounded">
                                {session.space_name}
                              </span>
                            ) : !session.space_name && !activeSpace && spaces?.length > 0 ? (
                              <span className="text-[10px] bg-amber-50 text-amber-500 px-1.5 py-0.5 rounded">
                                No space
                              </span>
                            ) : null}
                            {(session.tag_names || []).map(tag => (
                              <span key={tag} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>

                        {session.owner_id === user?.id && (
                          <button
                            onClick={(e) => { e.stopPropagation(); if (confirm(`Delete "${session.title}"?`)) onDeleteSession(session.id) }}
                            className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-300 hover:text-red-400 transition-all flex-shrink-0"
                            aria-label="Delete session"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Exercises tab ── */}
      {tab === 'exercises' && (
        <>
          {exercises.length === 0 ? (
            <div className="text-center py-16">
              <svg className="w-10 h-10 text-gray-200 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              <p className="text-gray-400 text-sm mb-1">No exercises yet</p>
              <p className="text-xs text-gray-300">Exercises appear as you add chapters to your sessions</p>
            </div>
          ) : (
            <div className="space-y-1">
              {exercises.map(exercise => (
                <div key={exercise.id} onClick={() => onExerciseSelect(exercise)}
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer group">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-gray-400">{exercise.chapter_count}</span>
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-medium text-gray-900 truncate">{exercise.name}</h3>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {exercise.chapter_count === 1 ? '1 entry' : `${exercise.chapter_count} entries`}
                        {exercise.category && ` · ${exercise.category}`}
                      </p>
                    </div>
                  </div>
                  <svg className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                  </svg>
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
