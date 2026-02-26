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

function SessionList({ sessions, exercises, user, spaces, activeSpace, onSessionSelect, onExerciseSelect, onUploadClick, onDeleteSession }) {
  const isTeacher = user?.role === 'teacher'
  const [tab, setTab] = useState('sessions')
  const [filterTag, setFilterTag] = useState(null)

  const allTags = [...new Set(sessions.flatMap(s => s.tag_names || []))].sort()
  const filteredSessions = filterTag
    ? sessions.filter(s => (s.tag_names || []).includes(filterTag))
    : sessions

  const groupedSessions = useMemo(() => {
    const groups = []
    let currentKey = null
    for (const session of filteredSessions) {
      const key = dateKey(session.recorded_at || session.created_at)
      if (key !== currentKey) {
        currentKey = key
        groups.push({
          key,
          label: dateLabel(session.recorded_at || session.created_at),
          sessions: [],
        })
      }
      groups[groups.length - 1].sessions.push(session)
    }
    return groups
  }, [filteredSessions])

  return (
    <div className="px-4 sm:px-6 py-4">
      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-gray-100">
        <button
          onClick={() => setTab('sessions')}
          className={`px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            tab === 'sessions' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >Sessions</button>
        <button
          onClick={() => setTab('exercises')}
          className={`px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            tab === 'exercises' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          Exercises
          {exercises.length > 0 && <span className="ml-1.5 text-xs text-gray-400">{exercises.length}</span>}
        </button>
      </div>

      {/* Sessions tab */}
      {tab === 'sessions' && (
        <>
          {/* Tag filter pills */}
          {allTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              <button
                onClick={() => setFilterTag(null)}
                className={`text-xs px-2.5 py-1 rounded-md transition-colors ${
                  !filterTag ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >All</button>
              {allTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => setFilterTag(filterTag === tag ? null : tag)}
                  className={`text-xs px-2.5 py-1 rounded-md transition-colors ${
                    filterTag === tag ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >{tag}</button>
              ))}
            </div>
          )}

          {filteredSessions.length === 0 && filterTag ? (
            <div className="text-center py-12">
              <p className="text-gray-400 text-sm mb-3">No sessions tagged "{filterTag}"</p>
              <button onClick={() => setFilterTag(null)} className="text-sm text-gray-500 underline">Show all</button>
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-gray-400 text-sm mb-6">No sessions yet</p>
              <button
                onClick={onUploadClick}
                className="text-sm font-medium text-gray-900 border border-gray-200 rounded-lg px-5 py-2.5 hover:border-gray-400 transition-colors"
              >Upload your first session</button>
            </div>
          ) : (
            <div className="space-y-6">
              {groupedSessions.map(group => (
                <div key={group.key}>
                  {/* Date header */}
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">{group.label}</h3>
                    <div className="flex-1 h-px bg-gray-100" />
                    <span className="text-xs text-gray-400">{group.sessions.length}</span>
                  </div>

                  {/* Sessions for this day */}
                  <div className="space-y-1">
                    {group.sessions.map(session => (
                      <div
                        key={session.id}
                        onClick={() => onSessionSelect(session)}
                        className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer group"
                      >
                        <div className="w-16 h-11 sm:w-24 sm:h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                          <video
                            src={videoUrl(session.video_file)}
                            className="w-full h-full object-cover"
                            muted preload="metadata"
                            onLoadedMetadata={(e) => { e.target.currentTime = 1 }}
                          />
                        </div>
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
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs text-gray-400">{timeLabel(session.recorded_at || session.created_at)}</span>
                            {session.chapter_count > 0 && (
                              <span className="text-xs text-gray-400">{session.chapter_count} chapters</span>
                            )}
                            {session.comment_count > 0 && (
                              <span className={`text-xs ${session.has_unread ? 'text-blue-500 font-medium' : 'text-gray-400'}`}>
                                {session.comment_count} feedback
                              </span>
                            )}
                            {isTeacher && session.owner_name && (
                              <span className="text-xs text-gray-400">{session.owner_name}</span>
                            )}
                          </div>
                          {(session.space_name || (session.tag_names || []).length > 0) && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {session.space_name && !activeSpace && (
                                <span className="text-[10px] bg-gray-200 text-gray-600 font-medium px-1.5 py-0.5 rounded">
                                  {session.space_name}
                                </span>
                              )}
                              {(session.tag_names || []).map(tag => (
                                <span key={tag} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
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
