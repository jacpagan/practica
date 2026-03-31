import React, { useEffect, useMemo, useRef, useState } from 'react'
import { fmtTimer, MAX_RECORDER_DURATION_SECONDS, MAX_VIDEO_UPLOAD_BYTES, sessionVideoSources, videoUrl, isLikelyVideoFile, videoFileAccept, uploadMultipartRequest } from '../utils'
import { useAuth } from '../auth'
import VideoRecorder from './VideoRecorder'

const reviewLinkLoadErrorState = ({ status, data }) => {
  const code = data?.code || ''
  if (code === 'review_link_expired' || status === 410) {
    return {
      title: 'Private link expired',
      message: 'This private feedback link expired. Ask the owner for a new link.',
    }
  }
  if (code === 'review_link_revoked' || status === 403) {
    return {
      title: 'Private link turned off',
      message: 'The owner has turned off this private feedback link. Ask for a new one if you still need access.',
    }
  }
  if (code === 'review_link_invalid' || status === 404) {
    return {
      title: 'Private link not found',
      message: 'This private feedback link does not exist or may have been copied incorrectly.',
    }
  }
  return {
    title: 'Could not open private link',
    message: data?.error || 'Try again in a moment.',
  }
}

const reviewLinkSubmitErrorMessage = ({ status, data }) => {
  const code = data?.code || ''
  if (code === 'review_link_feedback_disabled') return 'Video feedback is turned off for this link.'
  if (code === 'review_request_forbidden') return data?.error || 'Only the assigned reviewer can respond to this review request.'
  if (code === 'review_link_expired' || status === 410) return 'This private feedback link expired. Ask for a new link.'
  if (code === 'review_link_revoked' || status === 403) return 'This private feedback link has been turned off.'
  if (code === 'review_link_invalid' || status === 404) return 'This private feedback link is no longer available.'
  return data?.error || 'Could not send feedback.'
}

function ReviewPage({ reviewToken = '' }) {
  const { user, token: authToken } = useAuth()
  const videoRef = useRef(null)
  const inputRef = useRef(null)
  const editInputRef = useRef(null)
  const responseComposerRef = useRef(null)
  const autoOpenRecorderRef = useRef(false)
  const [session, setSession] = useState(null)
  const [link, setLink] = useState(null)
  const [reviewRequest, setReviewRequest] = useState(null)
  const [feedback, setFeedback] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [loadError, setLoadError] = useState(null)
  const [showRecorder, setShowRecorder] = useState(false)
  const [responseFile, setResponseFile] = useState(null)
  const [responsePreviewUrl, setResponsePreviewUrl] = useState('')
  const [responseNotes, setResponseNotes] = useState('')
  const [selectedTimestampSeconds, setSelectedTimestampSeconds] = useState(null)
  const [durationSeconds, setDurationSeconds] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [showResponseDetails, setShowResponseDetails] = useState(false)
  const [editingFeedbackId, setEditingFeedbackId] = useState(null)
  const [editingText, setEditingText] = useState('')
  const [editingTimestampSeconds, setEditingTimestampSeconds] = useState('')
  const [editingVideoFile, setEditingVideoFile] = useState(null)
  const [editingVideoPreviewUrl, setEditingVideoPreviewUrl] = useState('')
  const [savingFeedbackId, setSavingFeedbackId] = useState(null)
  const [deletingFeedbackId, setDeletingFeedbackId] = useState(null)
  const [templates, setTemplates] = useState([])
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const ownedPreviewUrlRef = useRef('')
  const editPreviewUrlRef = useRef('')
  const submitUploadIdRef = useRef('')
  const editUploadIdRef = useRef('')
  const playbackSources = useMemo(() => sessionVideoSources(session), [session])
  const [playbackSourceIndex, setPlaybackSourceIndex] = useState(0)
  const [playbackFailed, setPlaybackFailed] = useState(false)
  const playableUrl = playbackSources[playbackSourceIndex] || null
  const [uploadProgressPercent, setUploadProgressPercent] = useState(null)
  const [uploadProgressLoaded, setUploadProgressLoaded] = useState(0)
  const [uploadProgressTotal, setUploadProgressTotal] = useState(0)
  const [editUploadProgressPercent, setEditUploadProgressPercent] = useState(null)

  const createClientUploadId = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
    return `upload-${Date.now()}-${Math.random().toString(16).slice(2)}`
  }

  const token = reviewToken || window.location.pathname.replace(/^\/r\//, '')

  const replaceOwnedPreviewUrl = (nextUrl = '') => {
    if (ownedPreviewUrlRef.current) {
      try { URL.revokeObjectURL(ownedPreviewUrlRef.current) } catch {}
      ownedPreviewUrlRef.current = ''
    }
    if (nextUrl) ownedPreviewUrlRef.current = nextUrl
    setResponsePreviewUrl(nextUrl)
  }

  const replaceEditPreviewUrl = (nextUrl = '') => {
    if (editPreviewUrlRef.current) {
      try { URL.revokeObjectURL(editPreviewUrlRef.current) } catch {}
      editPreviewUrlRef.current = ''
    }
    if (nextUrl) editPreviewUrlRef.current = nextUrl
    setEditingVideoPreviewUrl(nextUrl)
  }

  useEffect(() => () => {
    replaceOwnedPreviewUrl('')
    replaceEditPreviewUrl('')
  }, [])

  useEffect(() => {
    setPlaybackSourceIndex(0)
    setPlaybackFailed(false)
  }, [session?.id, session?.video_file, JSON.stringify(session?.assets || [])])

  useEffect(() => {
    if (!token || !authToken) return
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError('')
      setLoadError(null)
      try {
        const infoRes = await fetch(`/api/review/${token}/`, { headers: { Authorization: `Token ${authToken}` } })
        const infoData = await infoRes.json().catch(() => ({}))
        if (!infoRes.ok) {
          throw { status: infoRes.status, data: infoData }
        }

        const feedbackRes = await fetch(`/api/review/${token}/feedback/`, { headers: { Authorization: `Token ${authToken}` } })
        const feedbackData = await feedbackRes.json().catch(() => ({}))
        if (!feedbackRes.ok) {
          throw { status: feedbackRes.status, data: feedbackData }
        }
        if (cancelled) return
        setSession(infoData.session)
        setLink(infoData.link)
        setReviewRequest(infoData.feedback_request || infoData.review_request || null)
        setFeedback(Array.isArray(feedbackData) ? feedbackData : [])
      } catch (loadFailure) {
        if (!cancelled) setLoadError(reviewLinkLoadErrorState(loadFailure || {}))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [authToken, token])

  useEffect(() => {
    const memberRole = reviewRequest?.current_member_role || reviewRequest?.current_user_role || ''
    if (!authToken || memberRole !== 'reviewer') {
      setTemplates([])
      setTemplatesLoading(false)
      return
    }
    let cancelled = false
    const loadTemplates = async () => {
      setTemplatesLoading(true)
      try {
        const res = await fetch('/api/feedback-templates/', { headers: { Authorization: `Token ${authToken}` } })
        if (!res.ok) throw new Error('templates')
        const data = await res.json()
        if (!cancelled) setTemplates(Array.isArray(data) ? data : [])
      } catch {
        if (!cancelled) setTemplates([])
      } finally {
        if (!cancelled) setTemplatesLoading(false)
      }
    }
    loadTemplates()
    return () => { cancelled = true }
  }, [authToken, reviewRequest?.current_member_role, reviewRequest?.current_user_role])

  const memberRole = reviewRequest?.current_member_role || reviewRequest?.current_user_role || ''
  const canRespondToRequest = !reviewRequest || memberRole === 'reviewer'
  const reviewerShouldRespond = memberRole === 'reviewer' && ['requested', 'opened', 'resubmitted'].includes(String(reviewRequest?.status || '').trim().toLowerCase())
  const hasCurrentUserFeedback = feedback.some((item) => item.authored_by_current_user)

  useEffect(() => {
    if (autoOpenRecorderRef.current) return
    if (!link?.allow_video_feedback || !canRespondToRequest) return
    if (!reviewerShouldRespond || hasCurrentUserFeedback || showRecorder || responseFile) return
    autoOpenRecorderRef.current = true
    setShowRecorder(true)
    const timer = window.setTimeout(() => {
      responseComposerRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
    }, 80)
    return () => window.clearTimeout(timer)
  }, [canRespondToRequest, hasCurrentUserFeedback, link?.allow_video_feedback, responseFile, reviewerShouldRespond, showRecorder])

  const applyTemplate = (template) => {
    if (!template) return
    setResponseNotes(template.text || '')
  }

  const saveCurrentNoteAsTemplate = async () => {
    const text = responseNotes.trim()
    if (!text) {
      setError('Write a note first if you want to save it as a template.')
      return
    }
    const title = window.prompt('Template title')
    if (!title || !title.trim()) return

    try {
      const res = await fetch('/api/feedback-templates/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Token ${authToken}`,
        },
        body: JSON.stringify({ title: title.trim(), text }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.title?.[0] || data?.error || 'Could not save template')
      setTemplates((current) => [...current, data].sort((left, right) => left.title.localeCompare(right.title)))
      setError('')
    } catch (saveError) {
      setError(saveError.message || 'Could not save template.')
    }
  }

  const useCurrentVideoTime = () => {
    const video = videoRef.current
    if (!video) return
    setSelectedTimestampSeconds(Math.max(0, Math.round(video.currentTime || 0)))
  }

  const clearTimestamp = () => setSelectedTimestampSeconds(null)

  const handlePlaybackError = () => {
    if (playbackSourceIndex < playbackSources.length - 1) {
      setPlaybackSourceIndex((current) => current + 1)
      return
    }
    setPlaybackFailed(true)
  }

  const pickFile = (event) => {
    const file = event.target.files?.[0]
    if (!file || !isLikelyVideoFile(file)) return
    setResponseFile(file)
    submitUploadIdRef.current = ''
    setUploadProgressPercent(null)
    setUploadProgressLoaded(0)
    setUploadProgressTotal(file.size || 0)
    replaceOwnedPreviewUrl(URL.createObjectURL(file))
  }

  const handleRecorded = (file) => {
    setShowRecorder(false)
    if (!isLikelyVideoFile(file)) return
    setResponseFile(file)
    submitUploadIdRef.current = ''
    setUploadProgressPercent(null)
    setUploadProgressLoaded(0)
    setUploadProgressTotal(file.size || 0)
    replaceOwnedPreviewUrl(URL.createObjectURL(file))
  }

  const beginEditingFeedback = (item) => {
    setEditingFeedbackId(item.id)
    setEditingText(item.text || '')
    setEditingTimestampSeconds(typeof item.timestamp_seconds === 'number' ? String(item.timestamp_seconds) : '')
    setEditingVideoFile(null)
    replaceEditPreviewUrl('')
    setError('')
  }

  const cancelEditingFeedback = () => {
    setEditingFeedbackId(null)
    // Video-only feedback: no text editing state
    setEditingTimestampSeconds('')
    setEditingVideoFile(null)
    editUploadIdRef.current = ''
    setEditUploadProgressPercent(null)
    replaceEditPreviewUrl('')
  }

  const pickEditFile = (event) => {
    const file = event.target.files?.[0]
    if (!file || !isLikelyVideoFile(file)) return
    setEditingVideoFile(file)
    editUploadIdRef.current = ''
    setEditUploadProgressPercent(null)
    replaceEditPreviewUrl(URL.createObjectURL(file))
    event.target.value = ''
  }

  const saveFeedbackEdit = async (feedbackId) => {
    if (!authToken) return
    setSavingFeedbackId(feedbackId)
    setEditUploadProgressPercent(editingVideoFile ? 0 : null)
    setError('')
    try {
      const payload = new FormData()
      payload.append('feedback_id', String(feedbackId))
      payload.append('timestamp_seconds', editingTimestampSeconds)
      if (editingVideoFile) payload.append('feedback_video', editingVideoFile)
      if (editingVideoFile) {
        if (!editUploadIdRef.current) editUploadIdRef.current = createClientUploadId()
        payload.append('client_upload_id', editUploadIdRef.current)
      }

      const attemptRequest = () => uploadMultipartRequest({
        url: `/api/review/${token}/feedback/`,
        method: 'PATCH',
        formData: payload,
        token: authToken,
        onProgress: (percent) => setEditUploadProgressPercent(percent ?? null),
      })

      let res
      try {
        res = await attemptRequest()
      } catch (networkError) {
        if (editingVideoFile) {
          await new Promise((resolve) => window.setTimeout(resolve, 800))
          res = await attemptRequest()
        } else {
          throw networkError
        }
      }

      const data = res.data || {}
      if (!res.ok) throw new Error(reviewLinkSubmitErrorMessage({ status: res.status, data }))
      setFeedback((current) => current.map((item) => (item.id === feedbackId ? data : item)))
      cancelEditingFeedback()
    } catch (saveError) {
      setError(saveError.message || 'Could not update feedback.')
    } finally {
      setSavingFeedbackId(null)
      setEditUploadProgressPercent(null)
    }
  }

  const deleteFeedback = async (feedbackId) => {
    if (!authToken) return
    if (!window.confirm('Delete your feedback?')) return
    setDeletingFeedbackId(feedbackId)
    setError('')
    try {
      const res = await fetch(`/api/review/${token}/feedback/`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Token ${authToken}`,
        },
        body: JSON.stringify({ feedback_id: feedbackId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(reviewLinkSubmitErrorMessage({ status: res.status, data }))
      setFeedback((current) => current.filter((item) => item.id !== feedbackId))
      if (editingFeedbackId === feedbackId) cancelEditingFeedback()
    } catch (deleteError) {
      setError(deleteError.message || 'Could not delete feedback.')
    } finally {
      setDeletingFeedbackId(null)
    }
  }

  const submit = async (event) => {
    event.preventDefault()
    if (!authToken) {
      setError('Please log in to send video feedback.')
      return
    }
    if (!responseFile) {
      setError('Record or upload a feedback video first.')
      return
    }

    setSubmitting(true)
    setUploadProgressPercent(0)
    setUploadProgressLoaded(0)
    setUploadProgressTotal(responseFile.size || 0)
    setError('')
    try {
      const formData = new FormData()
      formData.append('feedback_video', responseFile)
      if (typeof selectedTimestampSeconds === 'number') formData.append('timestamp_seconds', selectedTimestampSeconds)
      if (!submitUploadIdRef.current) submitUploadIdRef.current = createClientUploadId()
      formData.append('client_upload_id', submitUploadIdRef.current)

      const attemptRequest = () => uploadMultipartRequest({
        url: `/api/review/${token}/feedback/`,
        method: 'POST',
        formData,
        token: authToken,
        onProgress: (percent, loaded, total) => {
          setUploadProgressPercent(percent ?? null)
          setUploadProgressLoaded(loaded || 0)
          setUploadProgressTotal(total || responseFile.size || 0)
        },
      })

      let res
      try {
        res = await attemptRequest()
      } catch (networkError) {
        await new Promise((resolve) => window.setTimeout(resolve, 800))
        res = await attemptRequest()
      }

      const data = res.data || {}
      if (!res.ok) throw new Error(reviewLinkSubmitErrorMessage({ status: res.status, data }))
      setFeedback((current) => [...current, data].sort((left, right) => {
        const leftTs = typeof left.timestamp_seconds === 'number' ? left.timestamp_seconds : Number.MAX_SAFE_INTEGER
        const rightTs = typeof right.timestamp_seconds === 'number' ? right.timestamp_seconds : Number.MAX_SAFE_INTEGER
        if (leftTs !== rightTs) return leftTs - rightTs
        return new Date(left.created_at) - new Date(right.created_at)
      }))
      setResponseFile(null)
      submitUploadIdRef.current = ''
      setUploadProgressLoaded(0)
      setUploadProgressTotal(0)
      replaceOwnedPreviewUrl('')
      setSelectedTimestampSeconds(null)
    } catch (submitError) {
      setError(submitError.message || 'Could not send feedback.')
    } finally {
      setSubmitting(false)
      setUploadProgressPercent(null)
    }
  }

  if (!user) {
    return null
  }

  if (loading) {
    return <div className="min-h-screen bg-white flex items-center justify-center"><p className="text-sm text-gray-400">Opening private link…</p></div>
  }

  if (loadError && !session) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="max-w-md rounded-2xl border border-gray-200 bg-white px-6 py-6 text-center">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Private feedback link</p>
          <h1 className="text-xl font-semibold text-gray-900 mt-2">{loadError.title}</h1>
          <p className="text-sm text-gray-600 mt-3">{loadError.message}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white px-4 py-6 sm:px-6">
      <main className="max-w-3xl mx-auto space-y-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Leave video feedback</h1>
          <p className="text-xs text-gray-500 mt-2">Signed in as {user.display_name || user.username}.</p>
          {link?.expires_at ? <p className="text-xs text-gray-500 mt-1">Private link • authenticated access only • expires {new Date(link.expires_at).toLocaleString()}</p> : null}
        </div>

        {/* Thread title is enough; omit extra request metadata here */}

        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
          <div className="aspect-video bg-black">
            {playableUrl && !playbackFailed ? (
              <video
                key={playableUrl}
                ref={videoRef}
                src={playableUrl}
                controls
                playsInline
                onError={handlePlaybackError}
                className="w-full h-full bg-black"
                onTimeUpdate={(event) => setCurrentTime(Math.round(event.currentTarget.currentTime || 0))}
                onLoadedMetadata={(event) => {
                  const duration = Math.round(event.currentTarget.duration || 0)
                  if (Number.isFinite(duration) && duration > 0) {
                    setDurationSeconds(duration)
                    setSelectedTimestampSeconds((current) => (typeof current === 'number' ? Math.min(current, duration) : current))
                  }
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center px-6 text-center text-sm text-white/70">
                This video is marked ready, but playback failed.
              </div>
            )}
          </div>
          <div className="p-3 space-y-1">
            <h2 className="text-lg font-semibold text-gray-900">{session.title}</h2>
            {session.description ? <p className="text-sm text-gray-600">{session.description}</p> : null}
          </div>
        </div>

        {link?.allow_video_feedback && canRespondToRequest ? (
          <div ref={responseComposerRef} className="rounded-xl border border-gray-200 p-3 space-y-4">
            <div>
              <p className="text-sm font-semibold text-gray-900">{reviewerShouldRespond && !hasCurrentUserFeedback ? 'Respond now' : 'Add your video'}</p>
              <p className="text-xs text-gray-500 mt-1">{reviewerShouldRespond && !hasCurrentUserFeedback ? 'Record now.' : 'Record or upload.'}</p>
            </div>

            {false ? (
              <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-3 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Saved templates</p>
                  <button type="button" onClick={saveCurrentNoteAsTemplate} className="text-xs text-gray-600 hover:text-gray-900 transition-colors">
                    Save current note
                  </button>
                </div>
                {templatesLoading ? <p className="text-xs text-gray-500">Loading templates…</p> : null}
                {templates.length === 0 && !templatesLoading ? <p className="text-xs text-gray-500">No templates yet.</p> : null}
                {templates.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {templates.map((template) => (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => applyTemplate(template)}
                        className="text-xs text-gray-700 border border-gray-200 rounded-full px-3 py-1.5 hover:bg-white transition-colors"
                      >
                        {template.title}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button type="button" onClick={() => setShowRecorder(true)} className="rounded-2xl bg-gray-900 text-white px-4 py-3 text-sm font-medium hover:bg-gray-800 transition-colors">
                {responseFile ? 'Record again' : 'Record now'}
              </button>
              <button type="button" onClick={() => inputRef.current?.click()} className="rounded-2xl border border-gray-200 bg-white text-gray-900 px-4 py-3 text-sm font-medium hover:bg-gray-50 transition-colors">
                Upload video
              </button>
              <input ref={inputRef} type="file" accept={videoFileAccept()} className="hidden" onChange={pickFile} />
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 space-y-1">
              <p className="text-xs text-gray-500">Recorder: {Math.round(MAX_RECORDER_DURATION_SECONDS / 60)} min • Upload: {Math.round(MAX_VIDEO_UPLOAD_BYTES / (1024 * 1024 * 1024))}GB</p>
            </div>

            {showRecorder ? <VideoRecorder onRecorded={handleRecorded} onCancel={() => setShowRecorder(false)} maxDuration={MAX_RECORDER_DURATION_SECONDS} /> : null}

            {responsePreviewUrl ? (
              <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-gray-900">Video preview</p>
                  <button type="button" onClick={() => {
                    setResponseFile(null)
                    submitUploadIdRef.current = ''
                    setUploadProgressPercent(null)
                    setUploadProgressLoaded(0)
                    setUploadProgressTotal(0)
                    replaceOwnedPreviewUrl('')
                  }} className="text-xs text-red-600 hover:text-red-700 transition-colors">
                    Remove
                  </button>
                </div>
                <div className="rounded-xl overflow-hidden bg-black">
                  <video src={responsePreviewUrl} controls playsInline className="w-full aspect-video bg-black" />
                </div>
              </div>
            ) : null}

            <form onSubmit={submit} className="space-y-3">
              <details className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-3" open={showResponseDetails}>
                <summary onClick={() => setShowResponseDetails((current) => !current)} className="cursor-pointer list-none flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Details</p>
                    <p className="text-sm text-gray-700 mt-1">Optional.</p>
                  </div>
                  <span className="text-xs text-gray-500">{showResponseDetails ? 'Hide' : 'Show'}</span>
                </summary>
                <div className="space-y-3 pt-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Timestamp</p>
                      <p className="text-sm text-gray-700 mt-1">{typeof selectedTimestampSeconds === 'number' ? `Attach at ${fmtTimer(selectedTimestampSeconds)}` : 'No timestamp attached'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={useCurrentVideoTime} className="text-xs text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-white transition-colors">
                        Use current time
                      </button>
                      <button type="button" onClick={clearTimestamp} className="text-xs text-gray-500 hover:text-gray-700 transition-colors">
                        Clear
                      </button>
                    </div>
                  </div>

                  {durationSeconds > 0 ? (
                    <div>
                      <input
                        type="range"
                        min="0"
                        max={durationSeconds}
                        step="1"
                        value={typeof selectedTimestampSeconds === 'number' ? selectedTimestampSeconds : 0}
                        onChange={(event) => setSelectedTimestampSeconds(Number(event.target.value))}
                        className="w-full"
                      />
                      <div className="flex items-center justify-between text-[11px] text-gray-400 mt-1">
                        <span>0:00</span>
                        <span>Now: {fmtTimer(currentTime)}</span>
                        <span>{fmtTimer(durationSeconds)}</span>
                      </div>
                    </div>
                  ) : null}

                  {/* Video-only feedback: no caption/note field */}
                </div>
              </details>

              {submitting && responseFile ? (
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 space-y-2">
                  <div className="flex items-center justify-between gap-3 text-xs text-gray-600">
                    <span>Uploading feedback video…</span>
                    <span>{uploadProgressPercent !== null ? `${uploadProgressPercent}%` : 'Working…'}</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
                    <div
                      className="h-full bg-gray-900 transition-all"
                      style={{ width: `${Math.max(5, uploadProgressPercent || 0)}%` }}
                    />
                  </div>
                  {uploadProgressTotal > 0 ? (
                    <p className="text-[11px] text-gray-500">
                      {`${Math.round(uploadProgressLoaded / (1024 * 1024))} MB of ${Math.round(uploadProgressTotal / (1024 * 1024))} MB`}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {error ? <p className="text-xs text-red-500">{error}</p> : null}

              <div className="flex justify-end">
                <button type="submit" disabled={submitting} className="text-sm font-medium text-white bg-gray-900 rounded-lg px-4 py-2.5 hover:bg-gray-800 disabled:opacity-50">
                  {submitting ? 'Sending…' : 'Send feedback'}
                </button>
              </div>
            </form>
          </div>
        ) : link?.allow_video_feedback ? (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 space-y-2">
            <p className="text-sm font-semibold text-blue-900">Review replies are reviewer-only</p>
            <p className="text-sm text-blue-800">This page is for {reviewRequest?.reviewer?.display_name || reviewRequest?.teacher?.display_name || reviewRequest?.reviewer?.username || reviewRequest?.teacher?.username || 'the assigned reviewer'} to leave video feedback. To follow up, add a new session from your private library and send a new review request.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 space-y-2">
            <p className="text-sm font-semibold text-blue-900">Feedback is turned off</p>
            <p className="text-sm text-blue-800">The owner left this page open for viewing, but new feedback is currently disabled.</p>
          </div>
        )}

        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Feedback</p>
              {feedback.length === 0 ? (
                <p className="text-sm text-gray-500">No feedback yet.</p>
              ) : (
                <div className="space-y-3">
                  {feedback.map((item) => (
                    <div key={item.id} className="rounded-xl bg-gray-50 px-3 py-3 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-gray-900">{item.author_display_name || 'Member'}</p>
                          </div>
                          <p className="text-xs text-gray-400 mt-1">{new Date(item.created_at).toLocaleString()}</p>
                        </div>
                    {typeof item.timestamp_seconds === 'number' ? <span className="text-xs text-gray-500">@{fmtTimer(item.timestamp_seconds)}</span> : null}
                  </div>
                  {item.authored_by_current_user ? (
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => beginEditingFeedback(item)} className="text-xs text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-white transition-colors">
                        Edit
                      </button>
                      <button type="button" onClick={() => deleteFeedback(item.id)} disabled={deletingFeedbackId === item.id} className="text-xs text-red-600 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50 disabled:opacity-50 transition-colors">
                        {deletingFeedbackId === item.id ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>
                  ) : null}
                  {item.feedback_video ? (
                    <div className="rounded-xl overflow-hidden bg-black">
                      <video src={videoUrl(item.feedback_video)} controls playsInline className="w-full aspect-video bg-black" />
                    </div>
                  ) : null}
                  {/* Video-only feedback: no text display */}
                  {editingFeedbackId === item.id ? (
                    <div className="rounded-xl border border-gray-200 bg-white p-3 space-y-3">
                      {/* Video-only feedback: no text editing */}
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={editingTimestampSeconds}
                        onChange={(event) => setEditingTimestampSeconds(event.target.value)}
                        placeholder="Timestamp seconds"
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
                      />
                      <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Video</p>
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={() => editInputRef.current?.click()} className="text-xs text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-white transition-colors">
                              {item.feedback_video || editingVideoFile ? 'Replace video' : 'Add video'}
                            </button>
                          </div>
                        </div>
                        <input ref={editInputRef} type="file" accept={videoFileAccept()} className="hidden" onChange={pickEditFile} />
                        {editingVideoPreviewUrl ? (
                          <div className="rounded-xl overflow-hidden bg-black">
                            <video src={editingVideoPreviewUrl} controls playsInline className="w-full aspect-video bg-black" />
                          </div>
                        ) : item.feedback_video ? (
                          <div className="rounded-xl overflow-hidden bg-black">
                            <video src={videoUrl(item.feedback_video)} controls playsInline className="w-full aspect-video bg-black" />
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500">Add a replacement video before saving.</p>
                        )}
                        {savingFeedbackId === item.id && editingVideoFile ? (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-3 text-xs text-gray-600">
                              <span>Uploading replacement video…</span>
                              <span>{editUploadProgressPercent !== null ? `${editUploadProgressPercent}%` : 'Working…'}</span>
                            </div>
                            <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
                              <div
                                className="h-full bg-gray-900 transition-all"
                                style={{ width: `${Math.max(5, editUploadProgressPercent || 0)}%` }}
                              />
                            </div>
                          </div>
                        ) : null}
                      </div>
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={cancelEditingFeedback} className="text-sm text-gray-600 border border-gray-200 rounded-lg px-4 py-2 hover:bg-gray-50 transition-colors">
                          Cancel
                        </button>
                        <button type="button" onClick={() => saveFeedbackEdit(item.id)} disabled={savingFeedbackId === item.id} className="text-sm font-medium text-white bg-gray-900 rounded-lg px-4 py-2 hover:bg-gray-800 disabled:opacity-50 transition-colors">
                          {savingFeedbackId === item.id ? 'Saving…' : 'Save'}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default ReviewPage
