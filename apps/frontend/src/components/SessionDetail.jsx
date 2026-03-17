import React, { useEffect, useMemo, useRef, useState } from 'react'
import { preferredSessionVideoUrl } from '../utils'
import { useToast } from './Toast'

function SessionDetail({ session: initialSession, currentUser, token, onBack, onSessionUpdate }) {
  const toast = useToast()
  const [session, setSession] = useState(initialSession)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [comments, setComments] = useState([])
  const [commentBody, setCommentBody] = useState('')
  const [commentTimestamp, setCommentTimestamp] = useState('')
  const [commenting, setCommenting] = useState(false)
  const videoRef = useRef(null)
  const authHeaders = useMemo(() => (token ? { Authorization: `Token ${token}` } : {}), [token])

  useEffect(() => {
    setSession(initialSession)
  }, [initialSession])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch(`/api/v1/sessions/${initialSession.id}/comments`, { headers: authHeaders })
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled) setComments(Array.isArray(data) ? data : [])
      } catch {}
    }
    load()
    return () => { cancelled = true }
  }, [initialSession.id, authHeaders])

  const canEdit = Boolean(session?.can_edit)
  const canComment = ['coach', 'admin'].includes(currentUser?.role)
  const [shareUrl, setShareUrl] = useState('')
  const [sharing, setSharing] = useState(false)

  const startEditing = () => {
    setEditTitle(session.title || '')
    setEditDescription(session.description || '')
    
    setEditing(true)
  }

  const cancelEditing = () => setEditing(false)

  const saveEdits = async () => {
    if (!editTitle.trim()) {
      toast.error('Title is required')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/v1/sessions/${session.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          title: editTitle.trim(),
          description: editDescription.trim(),
        }),
      })
      if (!res.ok) throw new Error('save')
      const data = await res.json()
      setSession(data)
      onSessionUpdate?.(data)
      setEditing(false)
      toast.success('Journal entry updated')
    } catch {
      toast.error('Could not save changes')
    } finally {
      setSaving(false)
    }
  }

  const createShare = async () => {
    if (!token) return
    setSharing(true)
    try {
      const res = await fetch(`/api/v1/sessions/${session.id}/review-links`, {
        method: 'POST',
        headers: { Authorization: `Token ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        const url = `${window.location.origin}/r/${data.token}`
        setShareUrl(url)
        try { await navigator.clipboard.writeText(url) } catch {}
      }
    } catch {}
    finally { setSharing(false) }
  }

  const parseTimestamp = (raw) => {
    const value = raw.trim()
    if (!value) return null
    const parts = value.split(':').map((p) => Number.parseInt(p, 10))
    if (parts.length === 2 && Number.isInteger(parts[0]) && Number.isInteger(parts[1])) {
      return Math.max(0, parts[0] * 60 + parts[1])
    }
    if (parts.length === 1 && Number.isInteger(parts[0])) return Math.max(0, parts[0])
    return null
  }

  const postComment = async () => {
    if (!commentBody.trim()) return
    setCommenting(true)
    try {
      const res = await fetch(`/api/v1/sessions/${session.id}/comments`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: commentBody.trim(),
          timestamp_seconds: parseTimestamp(commentTimestamp),
        }),
      })
      if (!res.ok) throw new Error('comment')
      const data = await res.json()
      setComments((prev) => [...prev, data].sort((a, b) => {
        const ta = typeof a.timestamp_seconds === 'number' ? a.timestamp_seconds : Number.MAX_SAFE_INTEGER
        const tb = typeof b.timestamp_seconds === 'number' ? b.timestamp_seconds : Number.MAX_SAFE_INTEGER
        return ta - tb
      }))
      setCommentBody('')
      setCommentTimestamp('')
      toast.success('Comment added')
    } catch {
      toast.error('Could not add comment')
    } finally {
      setCommenting(false)
    }
  }

  const seekToComment = (comment) => {
    if (typeof comment.timestamp_seconds !== 'number' || !videoRef.current) return
    videoRef.current.currentTime = comment.timestamp_seconds
    videoRef.current.play().catch(() => {})
  }

  const fmtTs = (seconds) => `@${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

  return (
    <div className="px-4 sm:px-6 py-4 max-w-3xl mx-auto">
      <div className="mb-4">
        <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-900 transition-colors">← Back to practice</button>
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
        <div className="aspect-video bg-black">
          <video ref={videoRef} src={preferredSessionVideoUrl(session)} controls playsInline className="w-full h-full" />
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          {editing ? (
              <div className="space-y-4">
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full text-lg font-semibold text-gray-900 border-b border-gray-200 focus:border-gray-400 focus:outline-none pb-1"
                />
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                  placeholder="Notes about this attempt"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 resize-none"
                />
              
                <div className="flex gap-2">
                  <button onClick={saveEdits} disabled={saving} className="text-sm font-medium text-white bg-gray-900 rounded-lg px-4 py-2.5 hover:bg-gray-800 disabled:opacity-50 transition-colors">
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                  <button onClick={cancelEditing} className="text-sm text-gray-500 border border-gray-200 rounded-lg px-4 py-2.5 hover:bg-gray-50 transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h1 className="text-lg font-semibold text-gray-900">{session.title}</h1>
                  <p className="text-xs text-gray-400 mt-1">{session.owner?.display_name || 'You'}</p>
                </div>
                {canEdit ? (
                  <div className="flex items-center gap-2">
                    <button onClick={createShare} className="text-xs text-gray-500 hover:text-gray-900 transition-colors">
                      {sharing ? 'Sharing…' : 'Share for review'}
                    </button>
                    <button onClick={startEditing} className="text-xs text-gray-500 hover:text-gray-900 transition-colors">Edit</button>
                  </div>
                ) : null}
              </div>

              {shareUrl ? (
                <div className="rounded-md bg-gray-50 border border-gray-200 px-3 py-2">
                  <p className="text-xs text-gray-700">Link copied. Share this URL for feedback:</p>
                  <p className="text-xs text-blue-700 break-all">{shareUrl}</p>
                </div>
              ) : null}

                {session.description ? <p className="text-sm text-gray-600">{session.description}</p> : null}

              <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                {session.recorded_at ? <span>Recorded {new Date(session.recorded_at).toLocaleString()}</span> : null}
                {session.duration_seconds ? <span>{Math.round(session.duration_seconds / 60)} min</span> : null}
              </div>

              {canComment ? (
                <div className="rounded-xl border border-gray-200 p-3 space-y-2">
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Add coach feedback</p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={commentTimestamp}
                      onChange={(e) => setCommentTimestamp(e.target.value)}
                      placeholder="Timestamp mm:ss"
                      className="sm:w-40 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
                    />
                    <input
                      type="text"
                      value={commentBody}
                      onChange={(e) => setCommentBody(e.target.value)}
                      placeholder="What should improve?"
                      className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
                    />
                    <button
                      type="button"
                      onClick={postComment}
                      disabled={commenting}
                      className="px-3 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-50"
                    >
                      {commenting ? 'Saving…' : 'Post'}
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Feedback</p>
                {comments.length === 0 ? (
                  <p className="text-sm text-gray-500">No comments yet.</p>
                ) : (
                  <div className="space-y-2">
                    {comments.map((comment) => (
                      <button
                        key={comment.id}
                        type="button"
                        onClick={() => seekToComment(comment)}
                        className="w-full text-left rounded-lg border border-gray-200 px-3 py-2 hover:bg-gray-50"
                      >
                        <div className="text-xs text-gray-500">
                          {typeof comment.timestamp_seconds === 'number' ? fmtTs(comment.timestamp_seconds) : 'General'}
                        </div>
                        <div className="text-sm text-gray-800">{comment.body}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              </>
          )}
        </div>
      </div>
    </div>
  )
}

export default SessionDetail
