import React, { useEffect, useMemo, useRef, useState } from 'react'
import { fmtTimer, preferredSessionVideoUrl } from '../utils'
import { useToast } from './Toast'

function SessionDetail({ session: initialSession, token, onBack, onSessionUpdate }) {
  const toast = useToast()
  const videoRef = useRef(null)
  const [session, setSession] = useState(initialSession)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  

  const authHeaders = useMemo(() => (token ? { Authorization: `Token ${token}` } : {}), [token])

  useEffect(() => {
    setSession(initialSession)
  }, [initialSession])

  const canEdit = Boolean(session?.can_edit)
  const reviewFeedback = Array.isArray(session?.review_feedback) ? session.review_feedback : []
  const [shareUrl, setShareUrl] = useState('')
  const [sharing, setSharing] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const jumpToTimestamp = (seconds) => {
    const video = videoRef.current
    if (!video || typeof seconds !== 'number') return
    try {
      video.currentTime = seconds
      video.play?.().catch?.(() => {})
    } catch {}
  }

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
      const res = await fetch(`/api/sessions/${session.id}/`, {
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
      const res = await fetch(`/api/sessions/${session.id}/share/`, {
        method: 'POST',
        headers: { Authorization: `Token ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setShareUrl(data.url)
        try { await navigator.clipboard.writeText(data.url) } catch {}
      }
    } catch {}
    finally { setSharing(false) }
  }

  const refreshSession = async () => {
    if (!session?.id || !token) return
    setRefreshing(true)
    try {
      const res = await fetch(`/api/sessions/${session.id}/`, { headers: authHeaders })
      if (!res.ok) throw new Error('refresh')
      const data = await res.json()
      setSession(data)
      onSessionUpdate?.(data)
    } catch {
      toast.error('Could not refresh session')
    } finally {
      setRefreshing(false)
    }
  }

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
                    <button onClick={refreshSession} className="text-xs text-gray-500 hover:text-gray-900 transition-colors">
                      {refreshing ? 'Refreshing…' : 'Refresh'}
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

              <div className="border-t border-gray-100 pt-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <h2 className="text-sm font-semibold text-gray-900">Public feedback</h2>
                  {reviewFeedback.length ? <span className="text-xs text-gray-400">{reviewFeedback.length} comment{reviewFeedback.length === 1 ? '' : 's'}</span> : null}
                </div>

                {reviewFeedback.length ? (
                  <div className="space-y-2">
                    {reviewFeedback.map((item) => (
                      <div key={item.id} className="rounded-xl bg-gray-50 px-3 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{item.name || 'Anonymous reviewer'}</p>
                            {item.email ? <p className="text-xs text-gray-400 mt-0.5">{item.email}</p> : null}
                          </div>
                          {typeof item.timestamp_seconds === 'number' ? (
                            <button
                              type="button"
                              onClick={() => jumpToTimestamp(item.timestamp_seconds)}
                              className="text-xs text-blue-700 hover:text-blue-900 transition-colors"
                            >
                              @{fmtTimer(item.timestamp_seconds)}
                            </button>
                          ) : null}
                        </div>
                        <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{item.text}</p>
                        <p className="text-xs text-gray-400 mt-2">{new Date(item.created_at).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-gray-200 px-4 py-4 text-center">
                    <p className="text-sm text-gray-600">No public feedback yet.</p>
                    <p className="text-xs text-gray-400 mt-1">Share the review link and comments left there will show up here.</p>
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
