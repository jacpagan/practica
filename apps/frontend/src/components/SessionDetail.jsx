import React, { useEffect, useMemo, useRef, useState } from 'react'
import { fmtTimer, preferredSessionVideoUrl, videoUrl } from '../utils'
import { useConfirm } from './ConfirmDialog'
import { useToast } from './Toast'

function SessionDetail({ session: initialSession, token, onBack, onSessionUpdate, onSessionDelete }) {
  const toast = useToast()
  const confirm = useConfirm()
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
  const [activeReviewLink, setActiveReviewLink] = useState(session?.active_review_link || null)
  const [sharing, setSharing] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [retryingProcessing, setRetryingProcessing] = useState(false)
  const [revokingShare, setRevokingShare] = useState(false)
  const [editingFeedbackId, setEditingFeedbackId] = useState(null)
  const [feedbackDraft, setFeedbackDraft] = useState({ text: '', timestamp_seconds: '' })
  const [savingFeedback, setSavingFeedback] = useState(false)
  const [deletingFeedbackId, setDeletingFeedbackId] = useState(null)

  useEffect(() => {
    setActiveReviewLink(initialSession?.active_review_link || null)
  }, [initialSession?.active_review_link])

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
        setActiveReviewLink(data)
        try { await navigator.clipboard.writeText(data.url) } catch {}
        toast.success(res.status === 201 ? 'Review link created' : 'Review link copied')
      }
      else throw new Error('share')
    } catch { toast.error('Could not create review link') }
    finally { setSharing(false) }
  }

  const copyShareLink = async () => {
    if (!activeReviewLink?.url) return
    try {
      await navigator.clipboard.writeText(activeReviewLink.url)
      toast.success('Review link copied')
    } catch {
      toast.error('Could not copy review link')
    }
  }

  const revokeShareLink = async () => {
    if (!token || !session?.id || !activeReviewLink) return
    const accepted = await confirm?.({
      title: 'Revoke review link?',
      message: 'People with the current link will no longer be able to open or comment on this review page.',
      confirmLabel: 'Revoke',
      cancelLabel: 'Keep active',
      tone: 'danger',
    })
    if (!accepted) return

    setRevokingShare(true)
    try {
      const res = await fetch(`/api/sessions/${session.id}/share/revoke/`, {
        method: 'POST',
        headers: authHeaders,
      })
      if (!res.ok) throw new Error('revoke')
      setActiveReviewLink(null)
      const nextSession = { ...session, active_review_link: null }
      setSession(nextSession)
      onSessionUpdate?.(nextSession)
      toast.success('Review link revoked')
    } catch {
      toast.error('Could not revoke review link')
    } finally {
      setRevokingShare(false)
    }
  }

  const refreshSession = async () => {
    if (!session?.id || !token) return
    setRefreshing(true)
    try {
      const res = await fetch(`/api/sessions/${session.id}/`, { headers: authHeaders })
      if (!res.ok) throw new Error('refresh')
      const data = await res.json()
      setSession(data)
      setActiveReviewLink(data.active_review_link || null)
      onSessionUpdate?.(data)
    } catch {
      toast.error('Could not refresh session')
    } finally {
      setRefreshing(false)
    }
  }

  const deleteSession = async () => {
    if (!session?.id || !token || !canEdit) return
    const accepted = await confirm?.({
      title: 'Delete practice entry?',
      message: 'This permanently deletes the video and its session details. This cannot be undone.',
      confirmLabel: 'Delete',
      cancelLabel: 'Keep',
      tone: 'danger',
    })
    if (!accepted) return

    setDeleting(true)
    try {
      const res = await fetch(`/api/sessions/${session.id}/`, {
        method: 'DELETE',
        headers: authHeaders,
      })
      if (!res.ok) throw new Error('delete')
      toast.success('Practice entry deleted')
      onSessionDelete?.(session.id)
    } catch {
      toast.error('Could not delete practice entry')
    } finally {
      setDeleting(false)
    }
  }

  const retryProcessing = async () => {
    if (!token || !session?.id || !canEdit) return
    setRetryingProcessing(true)
    try {
      const res = await fetch(`/api/sessions/${session.id}/retry-processing/`, {
        method: 'POST',
        headers: authHeaders,
      })
      if (!res.ok) throw new Error('retry-processing')
      const data = await res.json()
      setSession(data)
      setActiveReviewLink(data.active_review_link || null)
      onSessionUpdate?.(data)
      toast.success('Conversion started')
    } catch {
      toast.error('Could not start conversion')
    } finally {
      setRetryingProcessing(false)
    }
  }

  const startEditingFeedback = (item) => {
    setEditingFeedbackId(item.id)
    setFeedbackDraft({
      text: item.text || '',
      timestamp_seconds: typeof item.timestamp_seconds === 'number' ? String(item.timestamp_seconds) : '',
    })
  }

  const cancelEditingFeedback = () => {
    setEditingFeedbackId(null)
    setFeedbackDraft({ text: '', timestamp_seconds: '' })
  }

  const saveFeedbackEdit = async (feedbackId) => {
    if (!token || !session?.id) return
    const payload = {
      text: feedbackDraft.text.trim(),
      timestamp_seconds: feedbackDraft.timestamp_seconds === '' ? null : Number(feedbackDraft.timestamp_seconds),
    }
    if (!payload.text) {
      toast.error('Feedback text is required')
      return
    }
    setSavingFeedback(true)
    try {
      const res = await fetch(`/api/sessions/${session.id}/review-feedback/${feedbackId}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('save-feedback')
      const updated = await res.json()
      const nextSession = {
        ...session,
        review_feedback: reviewFeedback.map((item) => item.id === feedbackId ? updated : item),
      }
      setSession(nextSession)
      onSessionUpdate?.(nextSession)
      cancelEditingFeedback()
      toast.success('Feedback updated')
    } catch {
      toast.error('Could not update feedback')
    } finally {
      setSavingFeedback(false)
    }
  }

  const deleteFeedback = async (item) => {
    if (!token || !session?.id) return
    const accepted = await confirm?.({
      title: 'Delete feedback?',
      message: 'This removes the public feedback comment from the session.',
      confirmLabel: 'Delete',
      cancelLabel: 'Keep',
      tone: 'danger',
    })
    if (!accepted) return

    setDeletingFeedbackId(item.id)
    try {
      const res = await fetch(`/api/sessions/${session.id}/review-feedback/${item.id}/`, {
        method: 'DELETE',
        headers: authHeaders,
      })
      if (!res.ok) throw new Error('delete-feedback')
      const nextSession = {
        ...session,
        review_feedback: reviewFeedback.filter((feedback) => feedback.id !== item.id),
      }
      setSession(nextSession)
      onSessionUpdate?.(nextSession)
      if (editingFeedbackId === item.id) cancelEditingFeedback()
      toast.success('Feedback deleted')
    } catch {
      toast.error('Could not delete feedback')
    } finally {
      setDeletingFeedbackId(null)
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
                    {activeReviewLink ? (
                      <>
                        <button onClick={copyShareLink} className="text-xs text-gray-500 hover:text-gray-900 transition-colors">
                          Copy review link
                        </button>
                        <button onClick={revokeShareLink} disabled={revokingShare} className="text-xs text-red-600 hover:text-red-700 disabled:opacity-50 transition-colors">
                          {revokingShare ? 'Revoking…' : 'Revoke link'}
                        </button>
                      </>
                    ) : (
                      <button onClick={createShare} className="text-xs text-gray-500 hover:text-gray-900 transition-colors">
                        {sharing ? 'Sharing…' : 'Share for review'}
                      </button>
                    )}
                    <button onClick={refreshSession} className="text-xs text-gray-500 hover:text-gray-900 transition-colors">
                      {refreshing ? 'Refreshing…' : 'Refresh'}
                    </button>
                    <button onClick={startEditing} className="text-xs text-gray-500 hover:text-gray-900 transition-colors">Edit</button>
                    <button onClick={deleteSession} disabled={deleting} className="text-xs text-red-600 hover:text-red-700 disabled:opacity-50 transition-colors">
                      {deleting ? 'Deleting…' : 'Delete'}
                    </button>
                  </div>
                ) : null}
              </div>

              {activeReviewLink?.url ? (
                <div className="rounded-md bg-gray-50 border border-gray-200 px-3 py-2">
                  <p className="text-xs text-gray-700">Share this URL for feedback:</p>
                  <p className="text-xs text-blue-700 break-all">{activeReviewLink.url}</p>
                  {activeReviewLink.expires_at ? (
                    <p className="text-[11px] text-gray-400 mt-1">Expires {new Date(activeReviewLink.expires_at).toLocaleString()}</p>
                  ) : null}
                </div>
              ) : null}

                {session.description ? <p className="text-sm text-gray-600">{session.description}</p> : null}

              <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                {session.recorded_at ? <span>Recorded {new Date(session.recorded_at).toLocaleString()}</span> : null}
                {session.duration_seconds ? <span>{Math.round(session.duration_seconds / 60)} min</span> : null}
                {session.processing_status ? <span>Status: {session.processing_status}</span> : null}
              </div>

              {canEdit && String(session.video_file || '').toLowerCase().endsWith('.mov') ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-amber-900">QuickTime upload</p>
                      <p className="text-sm text-amber-800 mt-1">If playback is blank, convert this MOV into a browser-friendly MP4 proxy.</p>
                    </div>
                    <button
                      type="button"
                      onClick={retryProcessing}
                      disabled={retryingProcessing || session.processing_status === 'processing'}
                      className="text-xs font-medium text-white bg-amber-700 rounded-lg px-3 py-2 hover:bg-amber-800 disabled:opacity-50 transition-colors"
                    >
                      {retryingProcessing || session.processing_status === 'processing' ? 'Converting…' : 'Convert for playback'}
                    </button>
                  </div>
                </div>
              ) : null}

              {session.processing_status === 'failed' && session.processing_error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                  <p className="text-sm font-medium text-red-800">Playback needs conversion</p>
                  <p className="text-sm text-red-700 mt-1">{session.processing_error}</p>
                  {session.video_file ? (
                    <a
                      href={videoUrl(session.video_file)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex mt-3 text-xs text-red-700 hover:text-red-900 transition-colors"
                    >
                      Open original file
                    </a>
                  ) : null}
                </div>
              ) : null}

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
                        {editingFeedbackId === item.id ? (
                          <div className="mt-2 space-y-3">
                            <textarea
                              value={feedbackDraft.text}
                              onChange={(e) => setFeedbackDraft((current) => ({ ...current, text: e.target.value }))}
                              rows={3}
                              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 resize-none bg-white"
                            />
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">Timestamp (seconds)</label>
                              <input
                                type="number"
                                min="0"
                                max={session.duration_seconds || undefined}
                                step="1"
                                value={feedbackDraft.timestamp_seconds}
                                onChange={(e) => setFeedbackDraft((current) => ({ ...current, timestamp_seconds: e.target.value }))}
                                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 bg-white"
                                placeholder="Leave blank for no timestamp"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => saveFeedbackEdit(item.id)}
                                disabled={savingFeedback}
                                className="text-xs font-medium text-white bg-gray-900 rounded-lg px-3 py-2 hover:bg-gray-800 disabled:opacity-50 transition-colors"
                              >
                                {savingFeedback ? 'Saving…' : 'Save'}
                              </button>
                              <button type="button" onClick={cancelEditingFeedback} className="text-xs text-gray-500 hover:text-gray-700 transition-colors">
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{item.text}</p>
                            {canEdit ? (
                              <div className="flex items-center gap-3 mt-2">
                                <button type="button" onClick={() => startEditingFeedback(item)} className="text-xs text-gray-500 hover:text-gray-900 transition-colors">
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteFeedback(item)}
                                  disabled={deletingFeedbackId === item.id}
                                  className="text-xs text-red-600 hover:text-red-700 disabled:opacity-50 transition-colors"
                                >
                                  {deletingFeedbackId === item.id ? 'Deleting…' : 'Delete'}
                                </button>
                              </div>
                            ) : null}
                          </>
                        )}
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
