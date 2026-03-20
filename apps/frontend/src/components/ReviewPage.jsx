import React, { useEffect, useRef, useState } from 'react'
import { feedbackCategoryLabel, feedbackCategoryOptions, feedbackCategoryTone, fmtTimer, preferredSessionVideoUrl, videoUrl, isLikelyVideoFile, videoFileAccept } from '../utils'
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
  if (code === 'review_link_expired' || status === 410) return 'This private feedback link expired. Ask for a new link.'
  if (code === 'review_link_revoked' || status === 403) return 'This private feedback link has been turned off.'
  if (code === 'review_link_invalid' || status === 404) return 'This private feedback link is no longer available.'
  return data?.error || 'Could not send feedback.'
}

function ReviewPage({ reviewToken = '' }) {
  const { user, token: authToken } = useAuth()
  const videoRef = useRef(null)
  const inputRef = useRef(null)
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
  const [responseCategory, setResponseCategory] = useState('')
  const [selectedTimestampSeconds, setSelectedTimestampSeconds] = useState(null)
  const [durationSeconds, setDurationSeconds] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [templates, setTemplates] = useState([])
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const ownedPreviewUrlRef = useRef('')

  const token = reviewToken || window.location.pathname.replace(/^\/r\//, '')

  const replaceOwnedPreviewUrl = (nextUrl = '') => {
    if (ownedPreviewUrlRef.current) {
      try { URL.revokeObjectURL(ownedPreviewUrlRef.current) } catch {}
      ownedPreviewUrlRef.current = ''
    }
    if (nextUrl) ownedPreviewUrlRef.current = nextUrl
    setResponsePreviewUrl(nextUrl)
  }

  useEffect(() => () => replaceOwnedPreviewUrl(''), [])

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
        setReviewRequest(infoData.review_request || null)
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
    if (!authToken || reviewRequest?.current_user_role !== 'teacher') {
      setTemplates([])
      setTemplatesLoading(false)
      return
    }
    let cancelled = false
    const loadTemplates = async () => {
      setTemplatesLoading(true)
      try {
        const res = await fetch('/api/teacher/templates/', { headers: { Authorization: `Token ${authToken}` } })
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
  }, [authToken, reviewRequest?.current_user_role])

  const canRespondToRequest = !reviewRequest || reviewRequest.current_user_role !== 'student'

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
      const res = await fetch('/api/teacher/templates/', {
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

  const pickFile = (event) => {
    const file = event.target.files?.[0]
    if (!file || !isLikelyVideoFile(file)) return
    setResponseFile(file)
    replaceOwnedPreviewUrl(URL.createObjectURL(file))
  }

  const handleRecorded = (file) => {
    setShowRecorder(false)
    if (!isLikelyVideoFile(file)) return
    setResponseFile(file)
    replaceOwnedPreviewUrl(URL.createObjectURL(file))
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
    setError('')
    try {
      const formData = new FormData()
      formData.append('feedback_video', responseFile)
      if (responseCategory) formData.append('feedback_category', responseCategory)
      if (responseNotes.trim()) formData.append('text', responseNotes.trim())
      if (typeof selectedTimestampSeconds === 'number') formData.append('timestamp_seconds', selectedTimestampSeconds)

      const res = await fetch(`/api/review/${token}/feedback/`, {
        method: 'POST',
        headers: { Authorization: `Token ${authToken}` },
        body: formData,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(reviewLinkSubmitErrorMessage({ status: res.status, data }))
      setFeedback((current) => [...current, data].sort((left, right) => {
        const leftTs = typeof left.timestamp_seconds === 'number' ? left.timestamp_seconds : Number.MAX_SAFE_INTEGER
        const rightTs = typeof right.timestamp_seconds === 'number' ? right.timestamp_seconds : Number.MAX_SAFE_INTEGER
        if (leftTs !== rightTs) return leftTs - rightTs
        return new Date(left.created_at) - new Date(right.created_at)
      }))
      setResponseFile(null)
      replaceOwnedPreviewUrl('')
      setResponseNotes('')
      setResponseCategory('')
      setSelectedTimestampSeconds(null)
    } catch (submitError) {
      setError(submitError.message || 'Could not send feedback.')
    } finally {
      setSubmitting(false)
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
      <main className="max-w-3xl mx-auto space-y-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Private feedback link</p>
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight mt-1">Respond with a video</h1>
          <p className="text-sm text-gray-500 mt-2">You are logged in as {user.display_name || user.username}. Your feedback is a video response, not a text-only note.</p>
        </div>

        {reviewRequest ? (
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-gray-900">Teacher request</p>
              <span className="text-[11px] uppercase tracking-wide bg-gray-100 text-gray-700 px-2 py-1 rounded-full">{reviewRequest.instrument}</span>
              {reviewRequest.student_level ? <span className="text-[11px] uppercase tracking-wide bg-gray-100 text-gray-700 px-2 py-1 rounded-full">{reviewRequest.student_level}</span> : null}
            </div>
            <p className="text-sm text-gray-800">{reviewRequest.goal}</p>
            {reviewRequest.exercise_or_song ? <p className="text-xs text-gray-500">Focus: {reviewRequest.exercise_or_song}</p> : null}
            {reviewRequest.notes ? <p className="text-xs text-gray-500 whitespace-pre-wrap">{reviewRequest.notes}</p> : null}
            {reviewRequest.deadline ? <p className="text-xs text-gray-500">Requested deadline: {new Date(reviewRequest.deadline).toLocaleString()}</p> : null}
          </div>
        ) : null}

        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
          <div className="aspect-video bg-black">
            <video
              ref={videoRef}
              src={preferredSessionVideoUrl(session)}
              controls
              playsInline
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
          </div>
          <div className="p-4 space-y-1">
            <h2 className="text-lg font-semibold text-gray-900">{session.title}</h2>
            {session.description ? <p className="text-sm text-gray-600">{session.description}</p> : null}
          </div>
        </div>

        {link?.allow_video_feedback && canRespondToRequest ? (
          <div className="rounded-xl border border-gray-200 p-4 space-y-4">
            <div>
              <p className="text-sm font-semibold text-gray-900">Record your feedback video</p>
              <p className="text-xs text-gray-500 mt-1">Show first, then tell. Add an optional note or timestamp if it helps.</p>
            </div>

            {reviewRequest?.current_user_role === 'teacher' ? (
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
                Record feedback
              </button>
              <button type="button" onClick={() => inputRef.current?.click()} className="rounded-2xl border border-gray-200 bg-white text-gray-900 px-4 py-3 text-sm font-medium hover:bg-gray-50 transition-colors">
                Upload feedback video
              </button>
              <input ref={inputRef} type="file" accept={videoFileAccept()} className="hidden" onChange={pickFile} />
            </div>

            {showRecorder ? <VideoRecorder onRecorded={handleRecorded} onCancel={() => setShowRecorder(false)} maxDuration={300} /> : null}

            {responsePreviewUrl ? (
              <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-gray-900">Feedback preview</p>
                  <button type="button" onClick={() => { setResponseFile(null); replaceOwnedPreviewUrl('') }} className="text-xs text-red-600 hover:text-red-700 transition-colors">
                    Remove
                  </button>
                </div>
                <div className="rounded-xl overflow-hidden bg-black">
                  <video src={responsePreviewUrl} controls playsInline className="w-full aspect-video bg-black" />
                </div>
              </div>
            ) : null}

            <form onSubmit={submit} className="space-y-3">
              <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Sending as</p>
                <p className="text-sm font-medium text-gray-900 mt-1">{user.display_name || user.username}</p>
              </div>

              <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-3 space-y-3">
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wide text-gray-500 mb-1.5">Category</label>
                  <select
                    value={responseCategory}
                    onChange={(event) => setResponseCategory(event.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 bg-white"
                  >
                    {feedbackCategoryOptions().map((option) => (
                      <option key={option.value || 'uncategorized'} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
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
              </div>

              <textarea
                value={responseNotes}
                onChange={(event) => setResponseNotes(event.target.value)}
                rows={3}
                placeholder="Optional note to go with your video reply"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 resize-none"
              />

              {error ? <p className="text-xs text-red-500">{error}</p> : null}

              <div className="flex justify-end">
                <button type="submit" disabled={submitting} className="text-sm font-medium text-white bg-gray-900 rounded-lg px-4 py-2.5 hover:bg-gray-800 disabled:opacity-50">
                  {submitting ? 'Sending…' : 'Send video feedback'}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-2">
            <p className="text-sm font-semibold text-blue-900">Feedback is view-only</p>
            <p className="text-sm text-blue-800">
              {reviewRequest?.current_user_role === 'student'
                ? 'This request belongs to your teacher workflow, so you can view the feedback here but only the designated teacher can reply.'
                : 'The owner left this private page open for viewing, but new video replies are turned off.'}
            </p>
          </div>
        )}

        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Video feedback</p>
              {feedback.length === 0 ? (
                <p className="text-sm text-gray-500">No video feedback yet.</p>
              ) : (
                <div className="space-y-3">
                  {feedback.map((item) => (
                    <div key={item.id} className="rounded-xl bg-gray-50 px-3 py-3 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-gray-900">{item.author_display_name || 'Viewer'}</p>
                            {item.feedback_category ? (
                              <span className={`text-[11px] uppercase tracking-wide px-2 py-1 rounded-full ${feedbackCategoryTone(item.feedback_category)}`}>
                                {feedbackCategoryLabel(item.feedback_category)}
                              </span>
                            ) : null}
                          </div>
                          <p className="text-xs text-gray-400 mt-1">{new Date(item.created_at).toLocaleString()}</p>
                        </div>
                    {typeof item.timestamp_seconds === 'number' ? <span className="text-xs text-gray-500">@{fmtTimer(item.timestamp_seconds)}</span> : null}
                  </div>
                  <div className="rounded-xl overflow-hidden bg-black">
                    <video src={videoUrl(item.feedback_video)} controls playsInline className="w-full aspect-video bg-black" />
                  </div>
                  {item.text ? <p className="text-sm text-gray-700 whitespace-pre-wrap">{item.text}</p> : null}
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
