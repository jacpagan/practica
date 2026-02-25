import React, { useState, useRef, useEffect } from 'react'

const fmtTime = (s) => {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

const videoUrl = (path) => path?.startsWith('/media/') ? `http://localhost:8000${path}` : path

function SessionDetail({ session: initialSession, exercises, onBack, onSessionUpdate }) {
  const [session, setSession] = useState(initialSession)
  const [currentTime, setCurrentTime] = useState(0)
  const [showAddChapter, setShowAddChapter] = useState(false)
  const [chapterExercise, setChapterExercise] = useState('')
  const [chapterNotes, setChapterNotes] = useState('')
  const [chapterTimestamp, setChapterTimestamp] = useState(0)
  const [suggestions, setSuggestions] = useState([])
  const videoRef = useRef(null)

  const refreshSession = async () => {
    try {
      const res = await fetch(`/api/sessions/${session.id}/`)
      if (res.ok) {
        const data = await res.json()
        setSession(data)
        onSessionUpdate(data)
      }
    } catch (e) { console.error(e) }
  }

  const handleTimeUpdate = () => {
    if (videoRef.current) setCurrentTime(videoRef.current.currentTime)
  }

  const seekTo = (seconds) => {
    if (videoRef.current) {
      videoRef.current.currentTime = seconds
      videoRef.current.play()
    }
  }

  const openAddChapter = () => {
    if (videoRef.current) videoRef.current.pause()
    setChapterTimestamp(Math.floor(currentTime))
    setChapterExercise('')
    setChapterNotes('')
    setShowAddChapter(true)
  }

  const handleExerciseInput = (value) => {
    setChapterExercise(value)
    if (value.length > 0) {
      const matches = exercises.filter(e =>
        e.name.toLowerCase().includes(value.toLowerCase())
      )
      setSuggestions(matches)
    } else {
      setSuggestions([])
    }
  }

  const addChapter = async () => {
    if (!chapterExercise.trim()) return alert('Please enter an exercise name.')
    try {
      const res = await fetch(`/api/sessions/${session.id}/add_chapter/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exercise_name: chapterExercise.trim(),
          timestamp_seconds: chapterTimestamp,
          notes: chapterNotes.trim(),
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setSession(data)
        onSessionUpdate(data)
        setShowAddChapter(false)
        setChapterExercise('')
        setChapterNotes('')
        setSuggestions([])
      }
    } catch { alert('Error adding chapter.') }
  }

  const removeChapter = async (chapterId) => {
    if (!confirm('Remove this chapter?')) return
    try {
      const res = await fetch(`/api/sessions/${session.id}/chapters/${chapterId}/`, { method: 'DELETE' })
      if (res.ok) {
        const data = await res.json()
        setSession(data)
        onSessionUpdate(data)
      }
    } catch { alert('Error removing chapter.') }
  }

  const chapters = session.chapters || []
  const activeChapter = [...chapters].reverse().find(c => currentTime >= c.timestamp_seconds)

  return (
    <div className="px-4 sm:px-6 py-4">
      {/* Title */}
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-gray-900">{session.title}</h1>
        {session.description && <p className="text-sm text-gray-500 mt-0.5">{session.description}</p>}
      </div>

      {/* Video player */}
      <div className="relative mb-4">
        <div className="aspect-video bg-black rounded-lg overflow-hidden">
          <video
            ref={videoRef}
            src={videoUrl(session.video_file)}
            controls
            className="w-full h-full"
            onTimeUpdate={handleTimeUpdate}
          />
        </div>

        {/* Chapter scrubber bar */}
        {chapters.length > 0 && videoRef.current?.duration > 0 && (
          <div className="mt-1 h-1 bg-gray-100 rounded-full relative overflow-hidden">
            {chapters.map(ch => {
              const left = (ch.timestamp_seconds / videoRef.current.duration) * 100
              const width = ch.end_seconds
                ? ((ch.end_seconds - ch.timestamp_seconds) / videoRef.current.duration) * 100
                : 2
              return (
                <div
                  key={ch.id}
                  onClick={() => seekTo(ch.timestamp_seconds)}
                  className="absolute top-0 h-full bg-gray-400 hover:bg-gray-600 cursor-pointer rounded-full transition-colors"
                  style={{ left: `${left}%`, width: `${Math.max(width, 1)}%` }}
                  title={ch.exercise_name || ch.title}
                />
              )
            })}
          </div>
        )}
      </div>

      {/* Add chapter button */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-gray-900">
          Chapters
          {chapters.length > 0 && <span className="text-gray-400 font-normal ml-1">({chapters.length})</span>}
        </h2>
        <button
          onClick={openAddChapter}
          className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
        >
          + Add at {fmtTime(currentTime)}
        </button>
      </div>

      {/* Add chapter form */}
      {showAddChapter && (
        <div className="mb-4 p-4 bg-gray-50 rounded-xl space-y-3">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>Chapter at {fmtTime(chapterTimestamp)}</span>
            <button
              onClick={() => { if (videoRef.current) setChapterTimestamp(Math.floor(videoRef.current.currentTime)) }}
              className="text-gray-900 underline"
            >
              use current time
            </button>
          </div>

          <div className="relative">
            <label className="block text-xs text-gray-500 mb-1">Exercise</label>
            <input
              type="text"
              value={chapterExercise}
              onChange={(e) => handleExerciseInput(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 bg-white"
              placeholder="e.g. Single Stroke Rolls"
              autoFocus
            />
            {suggestions.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                {suggestions.map(ex => (
                  <button
                    key={ex.id}
                    onClick={() => { setChapterExercise(ex.name); setSuggestions([]) }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors"
                  >
                    {ex.name}
                    <span className="text-xs text-gray-400 ml-2">{ex.chapter_count} entries</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Notes</label>
            <input
              type="text"
              value={chapterNotes}
              onChange={(e) => setChapterNotes(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 bg-white"
              placeholder="How did it go?"
            />
          </div>

          <div className="flex gap-2">
            <button onClick={() => setShowAddChapter(false)}
              className="flex-1 text-sm text-gray-600 border border-gray-200 rounded-lg py-2 hover:bg-white transition-colors">Cancel</button>
            <button onClick={addChapter}
              className="flex-1 text-sm font-medium text-white bg-gray-900 rounded-lg py-2 hover:bg-gray-800 transition-colors">Save chapter</button>
          </div>
        </div>
      )}

      {/* Chapter list */}
      <div className="space-y-1">
        {chapters.map(chapter => {
          const isActive = activeChapter?.id === chapter.id
          return (
            <div
              key={chapter.id}
              onClick={() => seekTo(chapter.timestamp_seconds)}
              className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all group ${
                isActive ? 'bg-gray-100' : 'hover:bg-gray-50'
              }`}
            >
              <span className="text-xs text-gray-400 font-mono w-10 flex-shrink-0">
                {fmtTime(chapter.timestamp_seconds)}
              </span>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-gray-900 truncate">
                  {chapter.exercise_name || chapter.title || 'Untitled'}
                </h4>
                {chapter.notes && (
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{chapter.notes}</p>
                )}
              </div>
              {chapter.end_seconds && (
                <span className="text-xs text-gray-300 flex-shrink-0">
                  {fmtTime(chapter.end_seconds - chapter.timestamp_seconds)}
                </span>
              )}
              {isActive && <span className="w-1.5 h-1.5 bg-gray-900 rounded-full flex-shrink-0" />}
              <button
                onClick={(e) => { e.stopPropagation(); removeChapter(chapter.id) }}
                className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-red-400 transition-all flex-shrink-0"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )
        })}
      </div>

      {chapters.length === 0 && !showAddChapter && (
        <div className="text-center py-10">
          <p className="text-sm text-gray-400 mb-3">No chapters yet</p>
          <p className="text-xs text-gray-400">Play the video and tap "+ Add" to mark exercises</p>
        </div>
      )}
    </div>
  )
}

export default SessionDetail
