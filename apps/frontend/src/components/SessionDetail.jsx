import React, { useEffect, useMemo, useRef, useState } from 'react'
import { fmtTimer, preferredSessionVideoUrl, videoUrl } from '../utils'
import { useConfirm } from './ConfirmDialog'
import { useToast } from './Toast'

function SessionDetail({ session: initialSession, token, onBack, onSessionUpdate, onSessionDelete, justUploaded = false, onRecordAnother }) {
  const toast = useToast()
  const confirm = useConfirm()
  const videoRef = useRef(null)
  const [session, setSession] = useState(initialSession)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [retryingProcessing, setRetryingProcessing] = useState(false)
  const [revokingShare, setRevokingShare] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [activeReviewLink, setActiveReviewLink] = useState(initialSession?.active_review_link || null)

  const authHeaders = useMemo(() => (token ? { Authorization: `Token ${token}` } : {}), [token])
  const canEdit = Boolean(session?.can_edit)
  const playableUrl = session?.local_preview_url || preferredSessionVideoUrl(session)
  const videoFeedback = Array.isArray(session?.video_feedback)
    ? session.video_feedback.filter((item) => item.feedback_video)
    : []

  useEffect(() => {
    setSession(initialSession)
    setActiveReviewLink(initialSession?.active_review_link || null)
  }, [initialSession])

  const startEditing = () => {
    setEditTitle(session.title || '')
    setEditDescription(session.description || '')
    setEditing(true)
  }

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
        body: JSON.stringify({ title: editTitle.trim(), description: editDescription.trim() }),
      })
      if (!res.ok) throw new Error('save')
      const data = await res.json()
      setSession((current) => ({ ...data, local_preview_url: current?.local_preview_url || '' }))
      onSessionUpdate?.({ ...data, local_preview_url: session?.local_preview_url || '' })
      setEditing(false)
      toast.success('Video updated')
    } catch {
      toast.error('Could not save changes')
    } finally {
      setSaving(false)
    }
  }

  const refreshSession = async () => {
    if (!token || !session?.id) return
    setRefreshing(true)
    try {
      const res = await fetch(`/api/sessions/${session.id}/`, { headers: authHeaders })
      if (!res.ok) throw new Error('refresh')
      const data = await res.json()
      const next = { ...data, local_preview_url: session?.local_preview_url || '' }
      setSession(next)
      setActiveReviewLink(next.active_review_link || null)
      onSessionUpdate?.(next)
    } catch {
      toast.error('Could not refresh this video')
    } finally {
      setRefreshing(false)
    }
  }

  const createShare = async () => {
    if (!token || !session?.id) return
    setSharing(true)
    try {
      const res = await fetch(`/api/sessions/${session.id}/share/`, {
        method: 'POST',
        headers: authHeaders,
      })
      if (!res.ok) throw new Error('share')
      const data = await res.json()
      setActiveReviewLink(data)
      await navigator.clipboard.writeText(data.url)
      toast.success(res.status === 201 ? 'Private feedback link created' : 'Private feedback link copied')
    } catch {
      toast.error('Could not create private feedback link')
    } finally {
      setSharing(false)
    }
  }

  const copyShareLink = async () => {
    if (!activeReviewLink?.url) return
    try {
      await navigator.clipboard.writeText(activeReviewLink.url)
      toast.success('Private feedback link copied')
    } catch {
      toast.error('Could not copy link')
    }
  }

  const revokeShareLink = async () => {
    if (!token || !session?.id || !activeReviewLink) return
    const accepted = await confirm({
      title: 'Turn off private link?',
      message: 'People with the current link will no longer be able to open this feedback page.',
      confirmLabel: 'Turn off',
      cancelLabel: 'Keep active',
      tone: 'danger',
    })
    if (!accepted) return

    setRevokingShare(true)
    try {
      const res = await fetch(`/api/sessions/${session.id}/share/`, {
        method: 'DELETE',
        headers: authHeaders,
      })
      if (!res.ok) throw new Error('revoke-share')
      setActiveReviewLink(null)
      toast.success('Private feedback link turned off')
    } catch {
      toast.error('Could not turn off the link')
    } finally {
      setRevokingShare(false)
    }
  }

  const retryProcessing = async () => {
    if (!token || !session?.id) return
    setRetryingProcessing(true)
    try {
      const res = await fetch(`/api/sessions/${session.id}/retry-processing/`, {
        method: 'POST',
        headers: authHeaders,
      })
      if (!res.ok) throw new Error('retry')
      const data = await res.json()
      const next = { ...data, local_preview_url: session?.local_preview_url || '' }
      setSession(next)
      onSessionUpdate?.(next)
      toast.success('Playback processing restarted')
    } catch {
      toast.error('Could not restart processing')
    } finally {
      setRetryingProcessing(false)
    }
  }

  const deleteSession = async () => {
    if (!token || !session?.id) return
    const accepted = await confirm({
      title: 'Delete video?',
      message: 'This removes the video and all attached feedback videos.',
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
      toast.success('Video deleted')
      onSessionDelete?.(session.id)
    } catch {
      toast.error('Could not delete video')
    } finally {
      setDeleting(false)
    }
  }

  const jumpToTimestamp = (seconds) => {
    const video = videoRef.current
    if (!video || typeof seconds !== 'number') return
    try {
      video.currentTime = seconds
      video.play?.().catch?.(() => {})
    } catch {}
  }

  return (
    <div className="px-4 sm:px-6 py-4 pb-28 max-w-3xl mx-auto">
      <div className="mb-4">
        <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-900 transition-colors">← Back to library</button>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
        <div className="aspect-video bg-black">
          {playableUrl ? (
            <video key={playableUrl} ref={videoRef} src={playableUrl} controls playsInline className="w-full h-full bg-black" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-sm text-white/70">Video is still preparing for playback.</div>
          )}
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          {editing ? (
            <div className="space-y-4">
              <input
                type="text"
                value={editTitle}
                onChange={(event) => setEditTitle(event.target.value)}
                className="w-full text-lg font-semibold text-gray-900 border-b border-gray-200 focus:border-gray-400 focus:outline-none pb-1"
              />
              <textarea
                value={editDescription}
                onChange={(event) => setEditDescription(event.target.value)}
                rows={3}
                placeholder="Add a note"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 resize-none"
              />
              <div className="flex gap-2">
                <button onClick={saveEdits} disabled={saving} className="text-sm font-medium text-white bg-gray-900 rounded-lg px-4 py-2.5 hover:bg-gray-800 disabled:opacity-50 transition-colors">
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button onClick={() => setEditing(false)} className="text-sm text-gray-500 border border-gray-200 rounded-lg px-4 py-2.5 hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h1 className="text-lg font-semibold text-gray-900">{session.title}</h1>
                  <p className="text-xs text-gray-400 mt-1">Private library</p>
                </div>
              </div>

              {justUploaded ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4">
                  <p className="text-sm font-medium text-emerald-900">Your video is saved.</p>
                  <p className="text-sm text-emerald-800 mt-1">It is already in your private library. Watch it now, or record another one.</p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <button type="button" onClick={() => videoRef.current?.play?.().catch?.(() => {})} className="text-sm font-medium text-white bg-gray-900 rounded-lg px-4 py-2.5 hover:bg-gray-800 transition-colors">
                      Watch video
                    </button>
                    <button type="button" onClick={onRecordAnother} className="text-sm text-gray-700 border border-gray-200 rounded-lg px-4 py-2.5 hover:bg-white transition-colors">
                      Record another
                    </button>
                  </div>
                </div>
              ) : null}

              {session.description ? <p className="text-sm text-gray-600">{session.description}</p> : null}

              <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                {session.recorded_at ? <span className="rounded-full bg-gray-100 px-3 py-1">{new Date(session.recorded_at).toLocaleString()}</span> : null}
                <span className="rounded-full bg-gray-100 px-3 py-1">{session.processing_status === 'ready' ? 'Playback ready' : session.processing_status || 'Saved'}</span>
                {session.duration_seconds ? <span className="rounded-full bg-gray-100 px-3 py-1">{fmtTimer(session.duration_seconds)}</span> : null}
              </div>

              {session.processing_status === 'failed' ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4">
                  <p className="text-sm font-medium text-amber-900">Playback needs processing help.</p>
                  <p className="text-sm text-amber-800 mt-1">{session.processing_error || 'This video is not ready for browser playback yet.'}</p>
                  {canEdit ? (
                    <button type="button" onClick={retryProcessing} disabled={retryingProcessing} className="mt-3 text-sm font-medium text-amber-900 border border-amber-300 rounded-lg px-4 py-2.5 hover:bg-amber-100 disabled:opacity-50 transition-colors">
                      {retryingProcessing ? 'Retrying…' : 'Retry playback processing'}
                    </button>
                  ) : null}
                </div>
              ) : null}

              {canEdit ? (
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-4 space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Private feedback link</p>
                    <p className="text-xs text-gray-500 mt-1">Anyone with this link must log in before sending a video response.</p>
                  </div>
                  {activeReviewLink?.url ? (
                    <div className="space-y-3">
                      <div className="rounded-lg border border-gray-200 bg-white px-3 py-3">
                        <p className="text-xs text-gray-500">Share this private link</p>
                        <p className="text-sm text-gray-900 break-all mt-1">{activeReviewLink.url}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={copyShareLink} className="text-sm font-medium text-white bg-gray-900 rounded-lg px-4 py-2.5 hover:bg-gray-800 transition-colors">
                          Copy link
                        </button>
                        <button type="button" onClick={revokeShareLink} disabled={revokingShare} className="text-sm text-gray-700 border border-gray-200 rounded-lg px-4 py-2.5 hover:bg-white disabled:opacity-50 transition-colors">
                          {revokingShare ? 'Turning off…' : 'Turn off link'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button type="button" onClick={createShare} disabled={sharing} className="text-sm font-medium text-white bg-gray-900 rounded-lg px-4 py-2.5 hover:bg-gray-800 disabled:opacity-50 transition-colors">
                      {sharing ? 'Creating…' : 'Create private feedback link'}
                    </button>
                  )}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-4">
                <button type="button" onClick={refreshSession} disabled={refreshing} className="text-sm text-gray-700 border border-gray-200 rounded-lg px-4 py-2.5 hover:bg-gray-50 disabled:opacity-50 transition-colors">
                  {refreshing ? 'Refreshing…' : 'Refresh'}
                </button>
                {canEdit ? (
                  <button type="button" onClick={startEditing} className="text-sm text-gray-700 border border-gray-200 rounded-lg px-4 py-2.5 hover:bg-gray-50 transition-colors">
                    Edit
                  </button>
                ) : null}
                {canEdit && session.video_file ? (
                  <a href={videoUrl(session.video_file)} download className="text-sm text-gray-700 border border-gray-200 rounded-lg px-4 py-2.5 hover:bg-gray-50 transition-colors">
                    Download original
                  </a>
                ) : null}
                {canEdit ? (
                  <button type="button" onClick={deleteSession} disabled={deleting} className="text-sm text-red-600 border border-red-200 rounded-lg px-4 py-2.5 hover:bg-red-50 disabled:opacity-50 transition-colors">
                    {deleting ? 'Deleting…' : 'Delete'}
                  </button>
                ) : null}
              </div>

              <div className="rounded-xl border border-gray-200 bg-white px-4 py-4 space-y-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Video feedback</p>
                  <p className="text-xs text-gray-500 mt-1">Feedback comes back as response videos, not text-only notes.</p>
                </div>

                {videoFeedback.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-200 px-4 py-4 text-center">
                    <p className="text-sm text-gray-600">No video feedback yet.</p>
                    <p className="text-xs text-gray-400 mt-1">Share your private link when you want someone to respond with a video.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {videoFeedback.map((item) => (
                      <div key={item.id} className="rounded-xl bg-gray-50 px-3 py-3 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{item.display_name || item.username || 'Viewer'}</p>
                            <p className="text-xs text-gray-400 mt-1">{new Date(item.created_at).toLocaleString()}</p>
                          </div>
                          {typeof item.timestamp_seconds === 'number' ? (
                            <button type="button" onClick={() => jumpToTimestamp(item.timestamp_seconds)} className="text-xs text-blue-700 hover:text-blue-900 transition-colors">
                              @{fmtTimer(item.timestamp_seconds)}
                            </button>
                          ) : null}
                        </div>
                        <div className="rounded-xl overflow-hidden bg-black">
                          <video src={videoUrl(item.feedback_video)} controls playsInline className="w-full aspect-video bg-black" />
                        </div>
                        {item.text ? <p className="text-sm text-gray-600 whitespace-pre-wrap">{item.text}</p> : null}
                      </div>
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
