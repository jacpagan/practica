import React, { useState, useRef, useEffect } from 'react'
import VideoRecorder from './VideoRecorder'
import TagInput from './TagInput'
import { useToast } from './Toast'
import { fmtTime, fmtDate, videoUrl, parseTimeInput, fmtDuration } from '../utils'

function SessionDetail({ session: initialSession, exercises, token, user, onBack, onSessionUpdate }) {
  const toast = useToast()
  const [session, setSession] = useState(initialSession)
  const [currentTime, setCurrentTime] = useState(0)

  // Edit state
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editTags, setEditTags] = useState([])
  const [saving, setSaving] = useState(false)

  // Chapter state
  const [showAddChapter, setShowAddChapter] = useState(false)
  const [chapterExercise, setChapterExercise] = useState('')
  const [chapterNotes, setChapterNotes] = useState('')
  const [chapterTimestamp, setChapterTimestamp] = useState(0)
  const [chapterEndTime, setChapterEndTime] = useState(null)
  const [suggestions, setSuggestions] = useState([])

  // Comment state
  const [commentText, setCommentText] = useState('')
  const [commentAtTimestamp, setCommentAtTimestamp] = useState(false)
  const [commentVideoFile, setCommentVideoFile] = useState(null)
  const [commentVideoPreview, setCommentVideoPreview] = useState(null)
  const [showRecorder, setShowRecorder] = useState(false)
  const [submittingComment, setSubmittingComment] = useState(false)

  // Tab
  const [tab, setTab] = useState('chapters')

  const videoRef = useRef(null)
  const authHeaders = token ? { 'Authorization': `Token ${token}` } : {}

  const markSeen = async (sessionId) => {
    try {
      await fetch(`/api/sessions/${sessionId}/mark_seen/`, { method: 'POST', headers: authHeaders })
    } catch {}
  }

  const switchTab = (t) => {
    setTab(t)
    if (t === 'comments') markSeen(session.id)
  }

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

  const handleTimeUpdate = () => { if (videoRef.current) setCurrentTime(videoRef.current.currentTime) }
  const seekTo = (seconds) => { if (videoRef.current) { videoRef.current.currentTime = seconds; videoRef.current.play() } }

  // ── Chapter actions ──

  const openAddChapter = () => {
    if (videoRef.current) videoRef.current.pause()
    setChapterTimestamp(Math.floor(currentTime))
    setChapterEndTime(null)
    setChapterExercise('')
    setChapterNotes('')
    setShowAddChapter(true)
  }

  const handleExerciseInput = (value) => {
    setChapterExercise(value)
    setSuggestions(value.length > 0
      ? exercises.filter(e => e.name.toLowerCase().includes(value.toLowerCase()))
      : [])
  }

  const addChapter = async () => {
    if (!chapterExercise.trim()) return toast.error('Please enter an exercise name.')
    try {
      const res = await fetch(`/api/sessions/${session.id}/add_chapter/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          exercise_name: chapterExercise.trim(),
          timestamp_seconds: chapterTimestamp,
          end_seconds: chapterEndTime,
          notes: chapterNotes.trim(),
        }),
      })
      if (res.ok) { const d = await res.json(); setSession(d); onSessionUpdate(d); setShowAddChapter(false); setSuggestions([]); toast.success('Chapter added') }
    } catch { toast.error('Error adding chapter') }
  }

  const removeChapter = async (chapterId) => {
    if (!confirm('Remove this chapter?')) return
    try {
      const res = await fetch(`/api/sessions/${session.id}/chapters/${chapterId}/`, { method: 'DELETE', headers: authHeaders })
      if (res.ok) { const d = await res.json(); setSession(d); onSessionUpdate(d); toast.success('Chapter removed') }
    } catch { toast.error('Error removing chapter') }
  }

  // ── Comment actions ──

  const resetCommentForm = () => {
    setCommentText('')
    setCommentAtTimestamp(false)
    setCommentVideoFile(null)
    setCommentVideoPreview(null)
    setShowRecorder(false)
  }

  const addComment = async () => {
    if (!commentText.trim()) return
    setSubmittingComment(true)
    try {
      const fd = new FormData()
      fd.append('text', commentText.trim())
      if (commentAtTimestamp) fd.append('timestamp_seconds', Math.floor(currentTime))
      if (commentVideoFile) fd.append('video_reply', commentVideoFile)

      const res = await fetch(`/api/sessions/${session.id}/add_comment/`, { method: 'POST', body: fd, headers: authHeaders })
      if (res.ok) {
        const data = await res.json()
        setSession(data); onSessionUpdate(data)
        resetCommentForm()
        toast.success('Feedback posted')
      } else {
        const err = await res.json()
        toast.error(err.error || 'Failed to add comment')
      }
    } catch { toast.error('Error adding comment') }
    finally { setSubmittingComment(false) }
  }

  const removeComment = async (commentId) => {
    if (!confirm('Delete this comment?')) return
    try {
      const res = await fetch(`/api/sessions/${session.id}/comments/${commentId}/`, { method: 'DELETE', headers: authHeaders })
      if (res.ok) { const d = await res.json(); setSession(d); onSessionUpdate(d); toast.success('Comment deleted') }
    } catch { toast.error('Error deleting comment') }
  }

  const handleVideoRecorded = (file, previewUrl) => {
    setCommentVideoFile(file)
    setCommentVideoPreview(previewUrl)
    setShowRecorder(false)
  }

  const removeAttachedVideo = () => {
    if (commentVideoPreview) URL.revokeObjectURL(commentVideoPreview)
    setCommentVideoFile(null)
    setCommentVideoPreview(null)
  }

  // ── Edit actions ──

  const startEditing = () => {
    setEditTitle(session.title)
    setEditDescription(session.description || '')
    setEditTags(session.tag_names || [])
    setEditing(true)
  }

  const cancelEditing = () => {
    setEditing(false)
  }

  const saveEdits = async () => {
    if (!editTitle.trim()) return toast.error('Title is required')
    setSaving(true)
    try {
      // Update title + description via PATCH
      const res = await fetch(`/api/sessions/${session.id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ title: editTitle.trim(), description: editDescription.trim() }),
      })

      // Update tags via set_tags
      await fetch(`/api/sessions/${session.id}/set_tags/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ tags: editTags }),
      })

      if (res.ok) {
        await refreshSession()
        setEditing(false)
        toast.success('Session updated')
      } else {
        toast.error('Failed to save')
      }
    } catch { toast.error('Error saving') }
    finally { setSaving(false) }
  }

  const chapters = session.chapters || []
  const comments = session.comments || []
  const activeChapter = [...chapters].reverse().find(c => currentTime >= c.timestamp_seconds)

  return (
    <div className="px-4 sm:px-6 py-4">
      {/* Title */}
      <div className="mb-4">
        {editing ? (
          <div className="space-y-3">
            <input
              type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
              className="w-full text-lg font-semibold text-gray-900 border-b border-gray-200 focus:border-gray-400 focus:outline-none pb-1"
              autoFocus
            />
            <textarea
              value={editDescription} onChange={(e) => setEditDescription(e.target.value)}
              rows={2} placeholder="Description"
              className="w-full text-sm text-gray-600 border-b border-gray-200 focus:border-gray-400 focus:outline-none resize-none"
            />
            <div>
              <label className="block text-xs text-gray-500 mb-1">Tags</label>
              <TagInput value={editTags} onChange={setEditTags} token={token} />
            </div>
            <div className="flex gap-2">
              <button onClick={saveEdits} disabled={saving}
                className="text-xs font-medium text-white bg-gray-900 px-3 py-1.5 rounded-md disabled:opacity-40">
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button onClick={cancelEditing} className="text-xs text-gray-500 px-3 py-1.5">Cancel</button>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-start justify-between gap-2">
              <h1 className="text-lg font-semibold text-gray-900">{session.title}</h1>
              <button onClick={startEditing} className="text-xs text-gray-400 hover:text-gray-600 flex-shrink-0 pt-1">Edit</button>
            </div>
            {session.description && <p className="text-sm text-gray-500 mt-0.5">{session.description}</p>}
            {(session.tag_names || []).length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {session.tag_names.map(tag => (
                  <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md">{tag}</span>
                ))}
              </div>
            )}
            {session.owner && <p className="text-xs text-gray-400 mt-2">by {session.owner.display_name}</p>}
          </div>
        )}
      </div>

      {/* Video player */}
      <div className="mb-4">
        <div className="aspect-video bg-black rounded-lg overflow-hidden">
          <video ref={videoRef} src={videoUrl(session.video_file)} controls className="w-full h-full" onTimeUpdate={handleTimeUpdate} />
        </div>
        {chapters.length > 0 && videoRef.current?.duration > 0 && (
          <div className="mt-1 h-1 bg-gray-100 rounded-full relative overflow-hidden">
            {chapters.map(ch => {
              const left = (ch.timestamp_seconds / videoRef.current.duration) * 100
              const width = ch.end_seconds ? ((ch.end_seconds - ch.timestamp_seconds) / videoRef.current.duration) * 100 : 2
              return <div key={ch.id} onClick={() => seekTo(ch.timestamp_seconds)}
                className="absolute top-0 h-full bg-gray-400 hover:bg-gray-600 cursor-pointer rounded-full transition-colors"
                style={{ left: `${left}%`, width: `${Math.max(width, 1)}%` }} title={ch.exercise_name || ch.title} />
            })}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-gray-100">
        <button onClick={() => switchTab('chapters')}
          className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === 'chapters' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
          Chapters{chapters.length > 0 && <span className="ml-1 text-gray-400 font-normal">{chapters.length}</span>}
        </button>
        <button onClick={() => switchTab('comments')}
          className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === 'comments' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
          Feedback{comments.length > 0 && <span className="ml-1 text-gray-400 font-normal">{comments.length}</span>}
        </button>
      </div>

      {/* ── CHAPTERS TAB ── */}
      {tab === 'chapters' && (
        <>
          <div className="flex items-center justify-between mb-3">
            <span />
            <button onClick={openAddChapter} className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
              + Add at {fmtTime(currentTime)}
            </button>
          </div>

          {showAddChapter && (
            <div className="mb-4 p-4 bg-gray-50 rounded-xl space-y-3">
              {/* Time range */}
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">Start</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={fmtTime(chapterTimestamp)}
                      onChange={(e) => { const v = parseTimeInput(e.target.value); if (v !== null) setChapterTimestamp(v) }}
                      className="w-20 px-2 py-1.5 text-sm font-mono text-center border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 bg-white"
                    />
                    <button
                      onClick={() => { if (videoRef.current) setChapterTimestamp(Math.floor(videoRef.current.currentTime)) }}
                      className="text-[11px] text-gray-400 hover:text-gray-900 whitespace-nowrap transition-colors"
                    >now</button>
                  </div>
                </div>
                <div className="text-gray-300 pb-1.5">→</div>
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">End <span className="text-gray-400">(optional)</span></label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={chapterEndTime !== null ? fmtTime(chapterEndTime) : ''}
                      onChange={(e) => { setChapterEndTime(e.target.value ? parseTimeInput(e.target.value) : null) }}
                      placeholder="—"
                      className="w-20 px-2 py-1.5 text-sm font-mono text-center border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 bg-white placeholder-gray-300"
                    />
                    <button
                      onClick={() => { if (videoRef.current) setChapterEndTime(Math.floor(videoRef.current.currentTime)) }}
                      className="text-[11px] text-gray-400 hover:text-gray-900 whitespace-nowrap transition-colors"
                    >now</button>
                  </div>
                </div>
                {chapterEndTime !== null && chapterEndTime > chapterTimestamp && (
                  <div className="pb-1.5">
                    <span className="text-xs text-gray-400 font-mono">{fmtDuration(chapterTimestamp, chapterEndTime)}</span>
                  </div>
                )}
              </div>

              {/* Exercise */}
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

              {/* Notes */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">Notes</label>
                <input type="text" value={chapterNotes} onChange={(e) => setChapterNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 bg-white"
                  placeholder="How did it go?" />
              </div>

              {/* Actions */}
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
                  <div className="flex flex-col items-center flex-shrink-0 w-12">
                    <span className="text-xs text-gray-400 font-mono">{fmtTime(chapter.timestamp_seconds)}</span>
                    {chapter.end_seconds && (
                      <span className="text-[10px] text-gray-300 font-mono">{fmtTime(chapter.end_seconds)}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-gray-900 truncate">{chapter.exercise_name || chapter.title || 'Untitled'}</h4>
                    {chapter.notes && <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{chapter.notes}</p>}
                  </div>
                  {chapter.end_seconds && (
                    <span className="text-xs text-gray-300 flex-shrink-0">{fmtDuration(chapter.timestamp_seconds, chapter.end_seconds)}</span>
                  )}
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

      {/* ── FEEDBACK TAB ── */}
      {tab === 'comments' && (
        <>
          {/* ── Compose ── */}
          <div className="mb-6">
            <div className="rounded-2xl border border-gray-200 overflow-hidden transition-all">
              {/* Text input */}
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                className="w-full px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none resize-none border-0"
                rows={2}
                placeholder={user?.role === 'teacher' ? 'Leave feedback for your student...' : 'Add a note...'}
              />

              {/* Attached video preview */}
              {commentVideoFile && !showRecorder && (
                <div className="mx-3 mb-3">
                  <div className="relative rounded-xl overflow-hidden bg-gray-950 inline-block max-w-xs">
                    <video
                      src={commentVideoPreview}
                      className="w-full rounded-xl"
                      controls
                      playsInline
                    />
                    <button
                      onClick={removeAttachedVideo}
                      className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center transition-colors"
                    >
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}

              {/* Video recorder */}
              {showRecorder && (
                <div className="mx-3 mb-3">
                  <VideoRecorder
                    onRecorded={handleVideoRecorded}
                    onCancel={() => setShowRecorder(false)}
                    maxDuration={60}
                  />
                </div>
              )}

              {/* Toolbar */}
              <div className="flex items-center justify-between px-3 py-2 border-t border-gray-100 bg-gray-50/50">
                <div className="flex items-center gap-1">
                  {/* Timestamp toggle */}
                  <button
                    onClick={() => setCommentAtTimestamp(!commentAtTimestamp)}
                    className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-all ${
                      commentAtTimestamp
                        ? 'bg-gray-900 text-white'
                        : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                    }`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {fmtTime(currentTime)}
                  </button>

                  {/* Record video button */}
                  {!showRecorder && !commentVideoFile && (
                    <button
                      onClick={() => { setShowRecorder(true); if (videoRef.current) videoRef.current.pause() }}
                      className="flex items-center gap-1.5 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700 px-2.5 py-1.5 rounded-lg transition-all"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                      </svg>
                      Record video
                    </button>
                  )}

                  {/* Video attached indicator */}
                  {commentVideoFile && !showRecorder && (
                    <span className="flex items-center gap-1 text-xs text-green-600 px-2.5 py-1.5">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Video attached
                    </span>
                  )}
                </div>

                {/* Send */}
                <button
                  onClick={addComment}
                  disabled={!commentText.trim() || submittingComment}
                  className="text-xs font-medium text-white bg-gray-900 hover:bg-gray-800 disabled:opacity-30 px-4 py-1.5 rounded-lg transition-all active:scale-95"
                >
                  {submittingComment ? (
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Sending
                    </span>
                  ) : 'Send'}
                </button>
              </div>
            </div>
          </div>

          {/* ── Comment thread ── */}
          <div className="space-y-1">
            {comments.map(comment => (
              <div key={comment.id} className="group">
                <div className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50/80 transition-colors">
                  {/* Avatar */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${
                    comment.role === 'teacher'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {(comment.display_name || comment.username)[0].toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Header */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-900">
                        {comment.display_name || comment.username}
                      </span>
                      {comment.role === 'teacher' && (
                        <span className="text-[10px] font-medium uppercase tracking-wider bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">
                          Teacher
                        </span>
                      )}
                      {comment.timestamp_seconds !== null && (
                        <button
                          onClick={() => seekTo(comment.timestamp_seconds)}
                          className="text-[11px] font-mono text-gray-400 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-1.5 py-0.5 rounded transition-all"
                        >
                          {fmtTime(comment.timestamp_seconds)}
                        </button>
                      )}
                      <span className="text-xs text-gray-300">{fmtDate(comment.created_at)}</span>
                    </div>

                    {/* Text */}
                    <p className="text-sm text-gray-700 mt-1 leading-relaxed">{comment.text}</p>

                    {/* Video reply */}
                    {comment.video_reply && (
                      <div className="mt-3 max-w-sm">
                        <div className="rounded-xl overflow-hidden bg-gray-950 border border-gray-800">
                          <video
                            src={videoUrl(comment.video_reply)}
                            controls
                            playsInline
                            className="w-full"
                            preload="metadata"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Delete */}
                  {(comment.username === user?.username) && (
                    <button onClick={() => removeComment(comment.id)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-300 hover:text-red-400 transition-all flex-shrink-0 mt-0.5">
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
            <div className="text-center py-12">
              <p className="text-sm text-gray-400">No feedback yet</p>
              <p className="text-xs text-gray-400 mt-1">
                {user?.role === 'teacher'
                  ? 'Watch the video and leave feedback for your student'
                  : 'Your teacher can leave feedback here'}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default SessionDetail
