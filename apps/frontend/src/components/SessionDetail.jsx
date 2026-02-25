import React, { useState, useRef, useEffect } from 'react'

const fmtTime = (s) => {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

const fmtDate = (d) => {
  const date = new Date(d)
  const now = new Date()
  const diff = now - date
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const videoUrl = (path) => path?.startsWith('/media/') ? `http://localhost:8000${path}` : path

function SessionDetail({ session: initialSession, exercises, token, user, onBack, onSessionUpdate }) {
  const [session, setSession] = useState(initialSession)
  const [currentTime, setCurrentTime] = useState(0)

  // Chapter state
  const [showAddChapter, setShowAddChapter] = useState(false)
  const [chapterExercise, setChapterExercise] = useState('')
  const [chapterNotes, setChapterNotes] = useState('')
  const [chapterTimestamp, setChapterTimestamp] = useState(0)
  const [suggestions, setSuggestions] = useState([])

  // Comment state
  const [commentText, setCommentText] = useState('')
  const [commentAtTimestamp, setCommentAtTimestamp] = useState(false)
  const [commentVideoFile, setCommentVideoFile] = useState(null)
  const [submittingComment, setSubmittingComment] = useState(false)

  // Tab state
  const [tab, setTab] = useState('chapters') // chapters | comments

  const videoRef = useRef(null)

  const authHeaders = token ? { 'Authorization': `Token ${token}` } : {}

  const refreshSession = async () => {
    try {
      const res = await fetch(`/api/sessions/${initialSession.id}/`, { headers: authHeaders })
      if (res.ok) {
        const data = await res.json()
        setSession(data)
        onSessionUpdate(data)
      }
    } catch (e) { console.error(e) }
  }

  useEffect(() => { refreshSession() }, [initialSession.id])

  const handleTimeUpdate = () => {
    if (videoRef.current) setCurrentTime(videoRef.current.currentTime)
  }

  const seekTo = (seconds) => {
    if (videoRef.current) { videoRef.current.currentTime = seconds; videoRef.current.play() }
  }

  // ── Chapter actions ──

  const openAddChapter = () => {
    if (videoRef.current) videoRef.current.pause()
    setChapterTimestamp(Math.floor(currentTime))
    setChapterExercise('')
    setChapterNotes('')
    setShowAddChapter(true)
  }

  const handleExerciseInput = (value) => {
    setChapterExercise(value)
    setSuggestions(value.length > 0
      ? exercises.filter(e => e.name.toLowerCase().includes(value.toLowerCase()))
      : []
    )
  }

  const addChapter = async () => {
    if (!chapterExercise.trim()) return alert('Please enter an exercise name.')
    try {
      const res = await fetch(`/api/sessions/${session.id}/add_chapter/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          exercise_name: chapterExercise.trim(),
          timestamp_seconds: chapterTimestamp,
          notes: chapterNotes.trim(),
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setSession(data); onSessionUpdate(data)
        setShowAddChapter(false)
        setSuggestions([])
      }
    } catch { alert('Error adding chapter.') }
  }

  const removeChapter = async (chapterId) => {
    if (!confirm('Remove this chapter?')) return
    try {
      const res = await fetch(`/api/sessions/${session.id}/chapters/${chapterId}/`, {
        method: 'DELETE', headers: authHeaders
      })
      if (res.ok) { const d = await res.json(); setSession(d); onSessionUpdate(d) }
    } catch { alert('Error removing chapter.') }
  }

  // ── Comment actions ──

  const addComment = async () => {
    if (!commentText.trim()) return
    setSubmittingComment(true)
    try {
      const fd = new FormData()
      fd.append('text', commentText.trim())
      if (commentAtTimestamp) fd.append('timestamp_seconds', Math.floor(currentTime))
      if (commentVideoFile) fd.append('video_reply', commentVideoFile)

      const res = await fetch(`/api/sessions/${session.id}/add_comment/`, {
        method: 'POST', body: fd,
        headers: authHeaders,
      })
      if (res.ok) {
        const data = await res.json()
        setSession(data); onSessionUpdate(data)
        setCommentText('')
        setCommentAtTimestamp(false)
        setCommentVideoFile(null)
      } else {
        const err = await res.json()
        alert(err.error || 'Failed to add comment')
      }
    } catch { alert('Error adding comment.') }
    finally { setSubmittingComment(false) }
  }

  const removeComment = async (commentId) => {
    if (!confirm('Delete this comment?')) return
    try {
      const res = await fetch(`/api/sessions/${session.id}/comments/${commentId}/`, {
        method: 'DELETE', headers: authHeaders
      })
      if (res.ok) { const d = await res.json(); setSession(d); onSessionUpdate(d) }
    } catch { alert('Error deleting comment.') }
  }

  const chapters = session.chapters || []
  const comments = session.comments || []
  const activeChapter = [...chapters].reverse().find(c => currentTime >= c.timestamp_seconds)

  return (
    <div className="px-4 sm:px-6 py-4">
      {/* Title */}
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-gray-900">{session.title}</h1>
        {session.description && <p className="text-sm text-gray-500 mt-0.5">{session.description}</p>}
        {session.owner && (
          <p className="text-xs text-gray-400 mt-1">by {session.owner.display_name}</p>
        )}
      </div>

      {/* Video player */}
      <div className="mb-4">
        <div className="aspect-video bg-black rounded-lg overflow-hidden">
          <video ref={videoRef} src={videoUrl(session.video_file)} controls className="w-full h-full"
            onTimeUpdate={handleTimeUpdate} />
        </div>
        {chapters.length > 0 && videoRef.current?.duration > 0 && (
          <div className="mt-1 h-1 bg-gray-100 rounded-full relative overflow-hidden">
            {chapters.map(ch => {
              const left = (ch.timestamp_seconds / videoRef.current.duration) * 100
              const width = ch.end_seconds ? ((ch.end_seconds - ch.timestamp_seconds) / videoRef.current.duration) * 100 : 2
              return <div key={ch.id} onClick={() => seekTo(ch.timestamp_seconds)}
                className="absolute top-0 h-full bg-gray-400 hover:bg-gray-600 cursor-pointer rounded-full transition-colors"
                style={{ left: `${left}%`, width: `${Math.max(width, 1)}%` }}
                title={ch.exercise_name || ch.title} />
            })}
          </div>
        )}
      </div>

      {/* Tabs: Chapters | Comments */}
      <div className="flex gap-1 mb-4 border-b border-gray-100">
        <button onClick={() => setTab('chapters')}
          className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === 'chapters' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}>
          Chapters{chapters.length > 0 && <span className="ml-1 text-gray-400 font-normal">{chapters.length}</span>}
        </button>
        <button onClick={() => setTab('comments')}
          className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === 'comments' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}>
          Feedback{comments.length > 0 && <span className="ml-1 text-gray-400 font-normal">{comments.length}</span>}
        </button>
      </div>

      {/* ── CHAPTERS TAB ── */}
      {tab === 'chapters' && (
        <>
          <div className="flex items-center justify-between mb-3">
            <span />
            <button onClick={openAddChapter}
              className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
              + Add at {fmtTime(currentTime)}
            </button>
          </div>

          {showAddChapter && (
            <div className="mb-4 p-4 bg-gray-50 rounded-xl space-y-3">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>Chapter at {fmtTime(chapterTimestamp)}</span>
                <button onClick={() => { if (videoRef.current) setChapterTimestamp(Math.floor(videoRef.current.currentTime)) }}
                  className="text-gray-900 underline">use current time</button>
              </div>
              <div className="relative">
                <label className="block text-xs text-gray-500 mb-1">Exercise</label>
                <input type="text" value={chapterExercise} onChange={(e) => handleExerciseInput(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 bg-white"
                  placeholder="e.g. Single Stroke Rolls" autoFocus />
                {suggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                    {suggestions.map(ex => (
                      <button key={ex.id} onClick={() => { setChapterExercise(ex.name); setSuggestions([]) }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors">
                        {ex.name}<span className="text-xs text-gray-400 ml-2">{ex.chapter_count} entries</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Notes</label>
                <input type="text" value={chapterNotes} onChange={(e) => setChapterNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 bg-white"
                  placeholder="How did it go?" />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowAddChapter(false)}
                  className="flex-1 text-sm text-gray-600 border border-gray-200 rounded-lg py-2 hover:bg-white transition-colors">Cancel</button>
                <button onClick={addChapter}
                  className="flex-1 text-sm font-medium text-white bg-gray-900 rounded-lg py-2 hover:bg-gray-800 transition-colors">Save chapter</button>
              </div>
            </div>
          )}

          <div className="space-y-1">
            {chapters.map(chapter => {
              const isActive = activeChapter?.id === chapter.id
              return (
                <div key={chapter.id} onClick={() => seekTo(chapter.timestamp_seconds)}
                  className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all group ${isActive ? 'bg-gray-100' : 'hover:bg-gray-50'}`}>
                  <span className="text-xs text-gray-400 font-mono w-10 flex-shrink-0">{fmtTime(chapter.timestamp_seconds)}</span>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-gray-900 truncate">{chapter.exercise_name || chapter.title || 'Untitled'}</h4>
                    {chapter.notes && <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{chapter.notes}</p>}
                  </div>
                  {chapter.end_seconds && <span className="text-xs text-gray-300 flex-shrink-0">{fmtTime(chapter.end_seconds - chapter.timestamp_seconds)}</span>}
                  {isActive && <span className="w-1.5 h-1.5 bg-gray-900 rounded-full flex-shrink-0" />}
                  <button onClick={(e) => { e.stopPropagation(); removeChapter(chapter.id) }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-red-400 transition-all flex-shrink-0">
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
        </>
      )}

      {/* ── COMMENTS / FEEDBACK TAB ── */}
      {tab === 'comments' && (
        <>
          {/* Add comment form */}
          <div className="mb-4 p-4 bg-gray-50 rounded-xl space-y-3">
            <textarea value={commentText} onChange={(e) => setCommentText(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 bg-white resize-none"
              rows={2} placeholder={user?.role === 'teacher' ? 'Leave feedback for your student...' : 'Add a note...'} />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                  <input type="checkbox" checked={commentAtTimestamp} onChange={(e) => setCommentAtTimestamp(e.target.checked)}
                    className="rounded border-gray-300" />
                  At {fmtTime(currentTime)}
                </label>

                <label className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                  <input type="file" accept="video/*" className="hidden"
                    onChange={(e) => setCommentVideoFile(e.target.files[0])} />
                  {commentVideoFile ? `📎 ${commentVideoFile.name}` : '📎 Attach video'}
                </label>
              </div>

              <button onClick={addComment} disabled={!commentText.trim() || submittingComment}
                className="text-sm font-medium text-white bg-gray-900 rounded-lg px-4 py-1.5 hover:bg-gray-800 disabled:opacity-40 transition-colors">
                {submittingComment ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>

          {/* Comment list */}
          <div className="space-y-3">
            {comments.map(comment => (
              <div key={comment.id} className="group">
                <div className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors">
                  {/* Avatar placeholder */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 ${
                    comment.role === 'teacher' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {(comment.display_name || comment.username)[0].toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">{comment.display_name || comment.username}</span>
                      {comment.role === 'teacher' && (
                        <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">Teacher</span>
                      )}
                      <span className="text-xs text-gray-400">{fmtDate(comment.created_at)}</span>
                    </div>

                    {comment.timestamp_seconds !== null && (
                      <button onClick={() => seekTo(comment.timestamp_seconds)}
                        className="text-xs text-gray-500 hover:text-gray-900 mt-0.5 font-mono transition-colors">
                        @ {fmtTime(comment.timestamp_seconds)}
                      </button>
                    )}

                    <p className="text-sm text-gray-700 mt-1">{comment.text}</p>

                    {comment.video_reply && (
                      <div className="mt-2 max-w-xs">
                        <video src={videoUrl(comment.video_reply)} controls
                          className="w-full rounded-lg border border-gray-200" />
                      </div>
                    )}
                  </div>

                  {(comment.username === user?.username || user?.role === 'teacher') && (
                    <button onClick={() => removeComment(comment.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-red-400 transition-all flex-shrink-0">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {comments.length === 0 && (
            <div className="text-center py-10">
              <p className="text-sm text-gray-400">No feedback yet</p>
              <p className="text-xs text-gray-400 mt-1">
                {user?.role === 'teacher' ? 'Watch the video and leave feedback for your student' : 'Your teacher can leave feedback here'}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default SessionDetail
