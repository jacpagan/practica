import React, { useEffect, useMemo, useRef, useState } from 'react'
import { feedbackCategoryLabel, feedbackCategoryTone, fmtTimer, sessionVideoSources, videoUrl } from '../utils'
import { useConfirm } from './ConfirmDialog'
import { useToast } from './Toast'

const requestStatusTone = {
  requested: 'bg-amber-100 text-amber-800',
  opened: 'bg-blue-100 text-blue-800',
  responded: 'bg-emerald-100 text-emerald-800',
  viewed: 'bg-violet-100 text-violet-800',
  resubmitted: 'bg-fuchsia-100 text-fuchsia-800',
  closed: 'bg-gray-100 text-gray-700',
  revoked: 'bg-red-100 text-red-700',
}

const requestStatusLabel = (value = '') => {
  const normalized = String(value || '').trim().toLowerCase()
  if (!normalized) return 'Unknown'
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

const LAST_TEACHER_KEY = 'practica.last_teacher.v1'
const LESSON_GOAL_PRESETS = [
  'Today\'s drum lesson follow-up',
  'Timing and consistency',
  'Groove and feel',
  'Technique and motion',
]

const normalizeTeacherText = (value = '') => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

const findTeacherAutoPick = (query, teachers = []) => {
  const normalizedQuery = normalizeTeacherText(query)
  if (!normalizedQuery) return null

  const queryWords = normalizedQuery.split(/\s+/).filter(Boolean)
  const candidates = teachers
    .map((teacher) => {
      const display = normalizeTeacherText(teacher.display_name)
      const username = normalizeTeacherText(teacher.username)
      const haystack = `${display} ${username}`.trim()
      let score = 0

      if (display === normalizedQuery || username === normalizedQuery) score += 100
      if (display.startsWith(normalizedQuery) || username.startsWith(normalizedQuery)) score += 80
      if (queryWords.length > 0 && queryWords.every((word) => haystack.includes(word))) score += 60
      if (normalizedQuery.includes('jimmy') && haystack.includes('jimmy')) score += 50
      if (normalizedQuery.includes('sage') && haystack.includes('sage')) score += 50
      if (haystack.includes('jimmy sage')) score += 25

      return { teacher, score }
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)

  if (candidates.length === 0) return null
  if (candidates.length === 1) return candidates[0].teacher
  if (candidates[0].score >= 130 && candidates[0].score >= candidates[1].score + 20) return candidates[0].teacher
  return null
}

const readLastTeacher = () => {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(LAST_TEACHER_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || !parsed.id) return null
    return parsed
  } catch {
    return null
  }
}

const writeLastTeacher = (teacher) => {
  if (typeof window === 'undefined' || !teacher?.id) return
  try {
    window.localStorage.setItem(LAST_TEACHER_KEY, JSON.stringify({
      id: teacher.id,
      username: teacher.username,
      display_name: teacher.display_name,
    }))
  } catch {}
}

function SessionDetail({ session: initialSession, token, onBack, onOpenReviewRequest, initialReviewRequestDraft = null, onReviewRequestDraftCleared, onSessionUpdate, onSessionDelete, justUploaded = false, onRecordAnother, onOpenSeries }) {
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
  const [editPracticeSeries, setEditPracticeSeries] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [activeReviewLink, setActiveReviewLink] = useState(initialSession?.active_review_link || null)
  const [reviewRequests, setReviewRequests] = useState([])
  const [requestsLoading, setRequestsLoading] = useState(false)
  const [showRequestComposer, setShowRequestComposer] = useState(false)
  const [creatingRequest, setCreatingRequest] = useState(false)
  const [teacherQuery, setTeacherQuery] = useState('')
  const [teacherResults, setTeacherResults] = useState([])
  const [teacherSearchLoading, setTeacherSearchLoading] = useState(false)
  const [selectedTeacher, setSelectedTeacher] = useState(null)
  const [recentTeachers, setRecentTeachers] = useState([])
  const [recentTeachersLoading, setRecentTeachersLoading] = useState(false)
  const [showRequestDetails, setShowRequestDetails] = useState(false)
  const [requestInstrument, setRequestInstrument] = useState('drums')
  const [requestStudentLevel, setRequestStudentLevel] = useState('')
  const [requestGoal, setRequestGoal] = useState('')
  const [requestExerciseOrSong, setRequestExerciseOrSong] = useState('')
  const [requestNotes, setRequestNotes] = useState('')
  const [requestTurnaroundHours, setRequestTurnaroundHours] = useState('24')
  const [requestDeadline, setRequestDeadline] = useState('')

  const authHeaders = useMemo(() => (token ? { Authorization: `Token ${token}` } : {}), [token])
  const canEdit = Boolean(session?.can_edit)
  const canCreateShareLink = session?.processing_status === 'ready'
  const playbackSources = useMemo(() => sessionVideoSources(session, session?.local_preview_url || ''), [session])
  const [playbackSourceIndex, setPlaybackSourceIndex] = useState(0)
  const [playbackFailed, setPlaybackFailed] = useState(false)
  const playableUrl = playbackSources[playbackSourceIndex] || null
  const selectedTeacherName = selectedTeacher?.display_name || selectedTeacher?.username || ''
  const videoFeedback = Array.isArray(session?.video_feedback)
    ? session.video_feedback
    : []

  useEffect(() => {
    setPlaybackSourceIndex(0)
    setPlaybackFailed(false)
  }, [session?.id, session?.local_preview_url, session?.video_file, JSON.stringify(session?.assets || [])])

  useEffect(() => {
    setSession(initialSession)
    setActiveReviewLink(initialSession?.active_review_link || null)
  }, [initialSession])

  useEffect(() => {
    setReviewRequests([])
    setShowRequestComposer(false)
    setTeacherQuery('')
    setTeacherResults([])
    setSelectedTeacher(null)
    setRecentTeachers([])
    setShowRequestDetails(false)
    setRequestInstrument('drums')
    setRequestStudentLevel('')
    setRequestGoal('')
    setRequestExerciseOrSong('')
    setRequestNotes('')
    setRequestTurnaroundHours('24')
    setRequestDeadline('')
  }, [initialSession?.id])

  useEffect(() => {
    if (!initialReviewRequestDraft || !canEdit) return
    setShowRequestComposer(true)
    setSelectedTeacher(initialReviewRequestDraft.teacher || null)
    setShowRequestDetails(true)
    setRequestInstrument(initialReviewRequestDraft.instrument || 'drums')
    setRequestStudentLevel(initialReviewRequestDraft.student_level || '')
    setRequestGoal(initialReviewRequestDraft.goal || '')
    setRequestExerciseOrSong(initialReviewRequestDraft.exercise_or_song || '')
    setRequestNotes(initialReviewRequestDraft.notes || '')
    setRequestTurnaroundHours(initialReviewRequestDraft.requested_turnaround_hours ? String(initialReviewRequestDraft.requested_turnaround_hours) : '24')
  }, [initialReviewRequestDraft, canEdit])

  const loadReviewRequests = async () => {
    if (!token || !session?.id || !canEdit) return
    setRequestsLoading(true)
    try {
      const res = await fetch(`/api/review-requests/?session_id=${session.id}&role=student`, { headers: authHeaders })
      if (!res.ok) throw new Error('review-requests')
      const data = await res.json()
      setReviewRequests(Array.isArray(data) ? data : data.results || [])
    } catch {
      setReviewRequests([])
    } finally {
      setRequestsLoading(false)
    }
  }

  useEffect(() => {
    loadReviewRequests()
  }, [token, session?.id, canEdit])

  useEffect(() => {
    if (!token || !canEdit) return undefined

    let cancelled = false
    const loadRecentTeachers = async () => {
      setRecentTeachersLoading(true)
      try {
        const res = await fetch('/api/review-requests/?role=student', { headers: authHeaders })
        if (!res.ok) throw new Error('student-review-requests')
        const data = await res.json()
        const items = Array.isArray(data) ? data : data.results || []
        const seen = new Set()
        const teachers = []
        items.forEach((item) => {
          const teacher = item?.teacher
          if (!teacher?.id || seen.has(teacher.id)) return
          seen.add(teacher.id)
          teachers.push(teacher)
        })
        if (cancelled) return
        setRecentTeachers(teachers.slice(0, 6))
        setSelectedTeacher((current) => {
          if (current?.id || initialReviewRequestDraft?.teacher?.id) return current
          const storedTeacher = readLastTeacher()
          if (storedTeacher?.id) {
            return teachers.find((teacher) => teacher.id === storedTeacher.id) || storedTeacher
          }
          if (teachers.length === 1) return teachers[0]
          return current
        })
      } catch {
        if (!cancelled) setRecentTeachers([])
      } finally {
        if (!cancelled) setRecentTeachersLoading(false)
      }
    }

    loadRecentTeachers()
    return () => { cancelled = true }
  }, [authHeaders, canEdit, initialReviewRequestDraft?.teacher?.id, token])

  useEffect(() => {
    if (!token || !canEdit) return undefined
    const query = teacherQuery.trim()
    if (query.length < 2) {
      setTeacherResults([])
      setTeacherSearchLoading(false)
      return undefined
    }

    let cancelled = false
    const timer = window.setTimeout(async () => {
      setTeacherSearchLoading(true)
      try {
        const res = await fetch(`/api/users/search/?q=${encodeURIComponent(query)}`, { headers: authHeaders })
        if (!res.ok) throw new Error('teacher-search')
        const data = await res.json()
        if (cancelled) return
        const results = Array.isArray(data) ? data : []
        const autoPick = findTeacherAutoPick(query, results)
        if (autoPick) {
          setSelectedTeacher(autoPick)
          setTeacherQuery('')
          setTeacherResults([])
          writeLastTeacher(autoPick)
          return
        }
        setTeacherResults(results)
      } catch {
        if (!cancelled) setTeacherResults([])
      } finally {
        if (!cancelled) setTeacherSearchLoading(false)
      }
    }, 250)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [authHeaders, canEdit, teacherQuery, token])

  const startEditing = () => {
    setEditTitle(session.title || '')
    setEditPracticeSeries(session.practice_series || '')
    setEditDescription(session.description || '')
    setEditing(true)
  }

  const chooseTeacher = (teacher) => {
    setSelectedTeacher(teacher)
    setTeacherQuery('')
    setTeacherResults([])
    writeLastTeacher(teacher)
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
        body: JSON.stringify({ title: editTitle.trim(), practice_series: editPracticeSeries.trim(), description: editDescription.trim() }),
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
      await loadReviewRequests()
    } catch {
      toast.error('Could not refresh this video')
    } finally {
      setRefreshing(false)
    }
  }

  const copyReviewRequestLink = async (requestItem) => {
    const url = requestItem?.feedback_link?.url || requestItem?.review_link?.url
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Feedback request link copied')
    } catch {
      toast.error('Could not copy request link')
    }
  }

  const updateRequestInState = (nextRequest) => {
    setReviewRequests((current) => current.map((item) => (item.id === nextRequest.id ? nextRequest : item)))
  }

  const markReviewRequestViewed = async (requestItem) => {
    if (!token || !requestItem?.id) return
    try {
      const res = await fetch(`/api/review-requests/${requestItem.id}/mark-viewed/`, {
        method: 'POST',
        headers: authHeaders,
      })
      if (!res.ok) throw new Error('mark-viewed')
      const data = await res.json()
      updateRequestInState(data)
      toast.success('Marked as viewed')
    } catch {
      toast.error('Could not update request status')
    }
  }

  const patchReviewRequestStatus = async (requestItem, statusValue, successMessage) => {
    if (!token || !requestItem?.id) return
    try {
      const res = await fetch(`/api/review-requests/${requestItem.id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ status: statusValue }),
      })
      if (!res.ok) throw new Error('patch-review-request')
      const data = await res.json()
      updateRequestInState(data)
      toast.success(successMessage)
    } catch {
      toast.error('Could not update request status')
    }
  }

  const createReviewRequest = async () => {
    if (!token || !session?.id) return
    if (!selectedTeacher?.id) {
      toast.error('Choose a reviewer first')
      return
    }
    if (!requestGoal.trim()) {
      toast.error('Add a goal for this feedback request')
      return
    }

    setCreatingRequest(true)
    try {
      const payload = {
        session_id: session.id,
        teacher_id: selectedTeacher.id,
        parent_request_id: initialReviewRequestDraft?.parent_request_id || null,
        instrument: requestInstrument.trim() || 'drums',
        student_level: requestStudentLevel.trim(),
        goal: requestGoal.trim(),
        exercise_or_song: requestExerciseOrSong.trim(),
        notes: requestNotes.trim(),
        requested_turnaround_hours: requestTurnaroundHours ? Number(requestTurnaroundHours) : null,
        deadline: requestDeadline ? new Date(requestDeadline).toISOString() : null,
      }
      const res = await fetch('/api/review-requests/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.session_id?.[0] || data?.teacher_id?.[0] || data?.goal?.[0] || data?.error || 'Could not create review request')
      }
      setReviewRequests((current) => [data, ...current])
      setShowRequestComposer(false)
      setTeacherQuery('')
      setTeacherResults([])
      setSelectedTeacher(null)
      setShowRequestDetails(false)
      setRequestGoal('')
      setRequestExerciseOrSong('')
      setRequestNotes('')
      setRequestStudentLevel('')
      setRequestDeadline('')
      onReviewRequestDraftCleared?.()
      writeLastTeacher(selectedTeacher)
      toast.success(`Request sent to ${selectedTeacher.display_name || selectedTeacher.username}`)
      if ((data?.feedback_link?.url || data?.review_link?.url)) {
        try {
          await navigator.clipboard.writeText(data.feedback_link?.url || data.review_link?.url)
          toast.success('Feedback request link copied')
        } catch {}
      }
    } catch (error) {
      toast.error(error?.message || 'Could not create feedback request')
    } finally {
      setCreatingRequest(false)
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
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Could not create private feedback link')
      setActiveReviewLink(data)
      await navigator.clipboard.writeText(data.url)
      toast.success(res.status === 201 ? 'Private feedback link created' : 'Private feedback link copied')
    } catch (error) {
      toast.error(error?.message || 'Could not create private feedback link')
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

  const handlePlaybackError = () => {
    if (playbackSourceIndex < playbackSources.length - 1) {
      setPlaybackSourceIndex((current) => current + 1)
      return
    }
    setPlaybackFailed(true)
  }

  return (
    <div className="px-4 sm:px-6 py-4 pb-28 max-w-3xl mx-auto">
      <div className="mb-4">
        <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-900 transition-colors">← Back to library</button>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
        <div className="aspect-video bg-black">
          {playableUrl && !playbackFailed ? (
            <video key={playableUrl} ref={videoRef} src={playableUrl} controls playsInline onError={handlePlaybackError} className="w-full h-full bg-black" />
          ) : (
            <div className="w-full h-full flex items-center justify-center px-6 text-center text-sm text-white/70">
              {session?.processing_status === 'ready'
                ? 'This video is marked ready, but playback failed. Try downloading the original below.'
                : 'Video is still preparing for playback.'}
            </div>
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
              <input
                type="text"
                value={editPracticeSeries}
                onChange={(event) => setEditPracticeSeries(event.target.value)}
                placeholder="Practice thread"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
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
                  {session.practice_series ? (
                    <div className="flex items-center gap-2 flex-wrap mt-2">
                      <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">{session.practice_series}</span>
                      <button type="button" onClick={() => onOpenSeries?.(session.practice_series)} className="text-xs text-gray-500 hover:text-gray-900 transition-colors">
                        View thread
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>

              {justUploaded ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4">
                  <p className="text-sm font-medium text-emerald-900">Your video is saved.</p>
                  <p className="text-sm text-emerald-800 mt-1">It is already in your private library. Watch it, share a feedback link, or record another one.</p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <button type="button" onClick={() => videoRef.current?.play?.().catch?.(() => {})} className="text-sm font-medium text-white bg-gray-900 rounded-lg px-4 py-2.5 hover:bg-gray-800 transition-colors">
                      Watch video
                    </button>
                    {canEdit && canCreateShareLink ? (
                      <button type="button" onClick={() => (activeReviewLink?.url ? copyShareLink() : createShare())} className="text-sm text-gray-700 border border-gray-200 rounded-lg px-4 py-2.5 hover:bg-white transition-colors">
                        {activeReviewLink?.url ? 'Copy feedback link' : 'Create feedback link'}
                      </button>
                    ) : null}
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
                    <p className="text-sm font-semibold text-gray-900">Feedback link</p>
                    <p className="text-xs text-gray-500 mt-1">Anyone with this link can log in and leave feedback.</p>
                  </div>
                  {activeReviewLink?.url ? (
                    <div className="space-y-3">
                      <div className="rounded-lg border border-gray-200 bg-white px-3 py-3">
                        <p className="text-xs text-gray-500">Share this link</p>
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
                    <div className="space-y-3">
                      {!canCreateShareLink ? (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3">
                          <p className="text-xs font-medium uppercase tracking-wide text-amber-800">Not shareable yet</p>
                          <p className="text-sm text-amber-900 mt-1">
                            {session.processing_status === 'failed'
                              ? 'Fix playback processing before sharing this feedback link.'
                              : 'Wait until playback is ready before sharing this feedback link.'}
                          </p>
                        </div>
                      ) : null}
                      <button type="button" onClick={createShare} disabled={sharing || !canCreateShareLink} className="text-sm font-medium text-white bg-gray-900 rounded-lg px-4 py-2.5 hover:bg-gray-800 disabled:opacity-50 transition-colors">
                        {sharing ? 'Creating…' : 'Create feedback link'}
                      </button>
                    </div>
                  )}
                </div>
              ) : null}

              {canEdit ? (
                <div className="rounded-xl border border-gray-200 bg-white px-4 py-4 space-y-4">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Request feedback</p>
                      <p className="text-xs text-gray-500 mt-1">Choose one person, add one goal, and start a repeatable thread.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowRequestComposer((current) => !current)}
                      disabled={!canCreateShareLink}
                      className="text-sm font-medium text-white bg-gray-900 rounded-lg px-4 py-2.5 hover:bg-gray-800 disabled:opacity-50 transition-colors"
                    >
                      {showRequestComposer ? 'Close' : (selectedTeacherName ? `Request from ${selectedTeacherName}` : 'New request')}
                    </button>
                  </div>

                  {showRequestComposer ? (
                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-4">
                      {!canCreateShareLink ? (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3">
                          <p className="text-xs font-medium uppercase tracking-wide text-amber-800">Playback ready required</p>
                          <p className="text-sm text-amber-900 mt-1">Wait until this session is playback ready before sending a feedback request.</p>
                        </div>
                      ) : null}

                      {selectedTeacherName ? (
                        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3">
                          <p className="text-xs font-medium uppercase tracking-wide text-emerald-800">Ready</p>
                          <p className="text-sm text-emerald-900 mt-1">This feedback request will go to {selectedTeacherName}.</p>
                        </div>
                      ) : null}

                      <div className="space-y-2">
                        <label className="block text-xs font-medium uppercase tracking-wide text-gray-500">Reviewer</label>
                        {selectedTeacher ? (
                          <div className="rounded-lg border border-gray-200 bg-white px-3 py-3 flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium text-gray-900">{selectedTeacher.display_name || selectedTeacher.username}</p>
                              <p className="text-xs text-gray-500">@{selectedTeacher.username}</p>
                            </div>
                            <button type="button" onClick={() => { setSelectedTeacher(null); setTeacherQuery('') }} className="text-xs text-red-600 hover:text-red-700 transition-colors">Change</button>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {recentTeachersLoading ? <p className="text-xs text-gray-500">Loading recent teachers…</p> : null}
                            {recentTeachers.length > 0 ? (
                              <div className="flex flex-wrap gap-2">
                                {recentTeachers.map((teacher) => (
                                  <button
                                    key={teacher.id}
                                    type="button"
                                    onClick={() => chooseTeacher(teacher)}
                                    className="rounded-full border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                                  >
                                    {teacher.display_name || teacher.username}
                                  </button>
                                ))}
                              </div>
                            ) : null}
                            <input
                              type="text"
                              value={teacherQuery}
                              onChange={(event) => setTeacherQuery(event.target.value)}
                              placeholder="Search by member name or username"
                              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
                            />
                            {teacherSearchLoading ? <p className="text-xs text-gray-500">Searching…</p> : null}
                            {teacherResults.length > 0 ? (
                              <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                                {teacherResults.map((teacher) => (
                                  <button
                                    key={teacher.id}
                                    type="button"
                                    onClick={() => chooseTeacher(teacher)}
                                    className="w-full text-left px-3 py-3 hover:bg-gray-50 transition-colors border-b last:border-b-0 border-gray-100"
                                  >
                                    <p className="text-sm font-medium text-gray-900">{teacher.display_name || teacher.username}</p>
                                    <p className="text-xs text-gray-500 mt-1">@{teacher.username}</p>
                                  </button>
                                ))}
                              </div>
                            ) : teacherQuery.trim().length >= 2 && !teacherSearchLoading ? <p className="text-xs text-gray-500">No matching members found yet.</p> : null}
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-medium uppercase tracking-wide text-gray-500 mb-1.5">Goal</label>
                        <input type="text" value={requestGoal} onChange={(event) => setRequestGoal(event.target.value)} placeholder="What do you want help with today?" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400" />
                        <div className="flex flex-wrap gap-2 mt-2">
                          {LESSON_GOAL_PRESETS.map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => setRequestGoal(preset)}
                              className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                              {preset}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-lg border border-gray-200 bg-white px-3 py-3 space-y-3">
                        <button type="button" onClick={() => setShowRequestDetails((current) => !current)} className="text-xs text-gray-600 hover:text-gray-900 transition-colors">
                          {showRequestDetails ? 'Hide details' : 'Add details (optional)'}
                        </button>

                        {showRequestDetails ? (
                          <div className="space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-medium uppercase tracking-wide text-gray-500 mb-1.5">Level</label>
                                <input type="text" value={requestStudentLevel} onChange={(event) => setRequestStudentLevel(event.target.value)} placeholder="Beginner, intermediate, advanced" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400" />
                              </div>
                              <div>
                                <label className="block text-xs font-medium uppercase tracking-wide text-gray-500 mb-1.5">Turnaround hours</label>
                                <input type="number" min="1" step="1" value={requestTurnaroundHours} onChange={(event) => setRequestTurnaroundHours(event.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400" />
                              </div>
                            </div>

                            <div>
                              <label className="block text-xs font-medium uppercase tracking-wide text-gray-500 mb-1.5">Exercise or song</label>
                              <input type="text" value={requestExerciseOrSong} onChange={(event) => setRequestExerciseOrSong(event.target.value)} placeholder="Optional focus area" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400" />
                            </div>

                            <div>
                              <label className="block text-xs font-medium uppercase tracking-wide text-gray-500 mb-1.5">Deadline</label>
                              <input type="datetime-local" value={requestDeadline} onChange={(event) => setRequestDeadline(event.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400" />
                            </div>

                            <div>
                              <label className="block text-xs font-medium uppercase tracking-wide text-gray-500 mb-1.5">Notes</label>
                              <textarea value={requestNotes} onChange={(event) => setRequestNotes(event.target.value)} rows={3} placeholder="Anything the teacher should watch for?" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 resize-none" />
                            </div>
                          </div>
                        ) : null}
                      </div>

                      <div className="flex justify-end">
                        <button type="button" disabled={creatingRequest || !canCreateShareLink} onClick={createReviewRequest} className="text-sm font-medium text-white bg-gray-900 rounded-lg px-4 py-2.5 hover:bg-gray-800 disabled:opacity-50 transition-colors">
                          {creatingRequest ? (selectedTeacherName ? `Sending to ${selectedTeacherName}…` : 'Sending…') : (selectedTeacherName ? `Send to ${selectedTeacherName}` : 'Send request')}
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {requestsLoading ? (
                    <div className="rounded-xl border border-gray-200 px-4 py-5 text-center text-sm text-gray-500">Loading feedback requests…</div>
                  ) : reviewRequests.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-200 px-4 py-5 text-center">
                      <p className="text-sm text-gray-600">No feedback requests for this video yet.</p>
                      <p className="text-xs text-gray-400 mt-1">Create one when you want a repeatable proof → feedback → retry loop with someone specific.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {reviewRequests.map((requestItem) => (
                        <div key={requestItem.id} className="rounded-xl bg-gray-50 px-3 py-3 space-y-3">
                          <div className="flex items-start justify-between gap-3 flex-wrap">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-medium text-gray-900">{requestItem.reviewer?.display_name || requestItem.teacher?.display_name || requestItem.reviewer?.username || requestItem.teacher?.username || 'Reviewer'}</p>
                                <span className={`text-[11px] uppercase tracking-wide px-2 py-1 rounded-full ${requestStatusTone[requestItem.status] || 'bg-gray-100 text-gray-700'}`}>
                                  {requestStatusLabel(requestItem.status)}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 mt-1">{requestItem.instrument}{requestItem.student_level ? ` • ${requestItem.student_level}` : ''}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-gray-500">{requestItem.deadline ? `Due ${new Date(requestItem.deadline).toLocaleString()}` : `Requested ${new Date(requestItem.created_at).toLocaleString()}`}</p>
                              <p className="text-xs text-gray-400 mt-1">Responses: {requestItem.response_count || 0}</p>
                            </div>
                          </div>
                          <div>
                            <p className="text-sm text-gray-800">{requestItem.goal}</p>
                            {requestItem.exercise_or_song ? <p className="text-xs text-gray-500 mt-1">Focus: {requestItem.exercise_or_song}</p> : null}
                            {requestItem.notes ? <p className="text-xs text-gray-500 mt-2 whitespace-pre-wrap">{requestItem.notes}</p> : null}
                            {requestItem.feedback_category_counts && Object.keys(requestItem.feedback_category_counts).length > 0 ? (
                              <div className="flex flex-wrap gap-2 mt-3">
                                {Object.entries(requestItem.feedback_category_counts).map(([category, count]) => (
                                  <span key={category} className={`text-[11px] uppercase tracking-wide px-2 py-1 rounded-full ${feedbackCategoryTone(category)}`}>
                                    {feedbackCategoryLabel(category)} · {count}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                          </div>
                          {Array.isArray(requestItem.feedback_items) && requestItem.feedback_items.length > 0 ? (
                            <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-3">
                              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Request thread</p>
                              {requestItem.feedback_items.map((feedbackItem) => (
                                <div key={feedbackItem.id} className="rounded-xl bg-gray-50 px-3 py-3 space-y-3">
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <p className="text-sm font-medium text-gray-900">{feedbackItem.author_display_name || 'Teacher'}</p>
                                        {feedbackItem.feedback_category ? (
                                          <span className={`text-[11px] uppercase tracking-wide px-2 py-1 rounded-full ${feedbackCategoryTone(feedbackItem.feedback_category)}`}>
                                            {feedbackCategoryLabel(feedbackItem.feedback_category)}
                                          </span>
                                        ) : null}
                                      </div>
                                      <p className="text-xs text-gray-400 mt-1">{new Date(feedbackItem.created_at).toLocaleString()}</p>
                                    </div>
                                    {typeof feedbackItem.timestamp_seconds === 'number' ? (
                                      <button type="button" onClick={() => jumpToTimestamp(feedbackItem.timestamp_seconds)} className="text-xs text-blue-700 hover:text-blue-900 transition-colors">
                                        @{fmtTimer(feedbackItem.timestamp_seconds)}
                                      </button>
                                    ) : null}
                                  </div>
                                  <div className="rounded-xl overflow-hidden bg-black">
                                    <video src={videoUrl(feedbackItem.feedback_video)} controls playsInline className="w-full aspect-video bg-black" />
                                  </div>
                                  {feedbackItem.text ? <p className="text-sm text-gray-600 whitespace-pre-wrap">{feedbackItem.text}</p> : null}
                                </div>
                              ))}
                            </div>
                          ) : null}
                          <div className="flex flex-wrap gap-2">
                            {(requestItem.feedback_link?.url || requestItem.review_link?.url) ? (
                              <button type="button" onClick={() => copyReviewRequestLink(requestItem)} className="text-xs text-gray-700 border border-gray-200 rounded-lg px-3 py-2 hover:bg-white transition-colors">
                                Copy feedback request link
                              </button>
                            ) : null}
                            {(requestItem.feedback_link?.token || requestItem.review_link?.token) ? (
                              <button type="button" onClick={() => onOpenReviewRequest?.(requestItem)} className="text-xs text-gray-700 border border-gray-200 rounded-lg px-3 py-2 hover:bg-white transition-colors">
                                Open request thread
                              </button>
                            ) : null}
                            {requestItem.status !== 'closed' && requestItem.teacher ? (
                              <button
                                type="button"
                                onClick={() => onRecordAnother?.({
                                  parent_request_id: requestItem.id,
                                  teacher: requestItem.teacher,
                                  instrument: requestItem.instrument,
                                  student_level: requestItem.student_level,
                                  goal: requestItem.goal,
                                  exercise_or_song: requestItem.exercise_or_song,
                                  notes: requestItem.notes,
                                  requested_turnaround_hours: requestItem.requested_turnaround_hours,
                                })}
                                className="text-xs text-gray-700 border border-gray-200 rounded-lg px-3 py-2 hover:bg-white transition-colors"
                              >
                                Record follow-up
                              </button>
                            ) : null}
                            {requestItem.status === 'responded' ? (
                              <button type="button" onClick={() => markReviewRequestViewed(requestItem)} className="text-xs text-gray-700 border border-gray-200 rounded-lg px-3 py-2 hover:bg-white transition-colors">
                                Mark viewed
                              </button>
                            ) : null}
                            {['viewed', 'responded'].includes(requestItem.status) ? (
                              <button type="button" onClick={() => patchReviewRequestStatus(requestItem, 'resubmitted', 'Marked as retried')} className="text-xs text-gray-700 border border-gray-200 rounded-lg px-3 py-2 hover:bg-white transition-colors">
                                Mark retried
                              </button>
                            ) : null}
                            {['requested', 'opened'].includes(requestItem.status) ? (
                              <button type="button" onClick={() => patchReviewRequestStatus(requestItem, 'revoked', 'Feedback request turned off')} className="text-xs text-red-600 border border-red-200 rounded-lg px-3 py-2 hover:bg-red-50 transition-colors">
                                Turn off request
                              </button>
                            ) : null}
                            {['viewed', 'resubmitted'].includes(requestItem.status) ? (
                              <button type="button" onClick={() => patchReviewRequestStatus(requestItem, 'closed', 'Feedback request closed')} className="text-xs text-gray-700 border border-gray-200 rounded-lg px-3 py-2 hover:bg-white transition-colors">
                                Close request
                              </button>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
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
                  <p className="text-sm font-semibold text-gray-900">Feedback</p>
                  <p className="text-xs text-gray-500 mt-1">Anyone who logs in with your feedback link can leave a video response.</p>
                </div>

                {videoFeedback.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-200 px-4 py-4 text-center">
                    <p className="text-sm text-gray-600">No feedback yet.</p>
                    <p className="text-xs text-gray-400 mt-1">Share your feedback link when you want video responses.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {videoFeedback.map((item) => (
                      <div key={item.id} className="rounded-xl bg-gray-50 px-3 py-3 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-medium text-gray-900">{item.display_name || item.username || 'Viewer'}</p>
                            </div>
                            <p className="text-xs text-gray-400 mt-1">{new Date(item.created_at).toLocaleString()}</p>
                          </div>
                          {typeof item.timestamp_seconds === 'number' ? (
                            <button type="button" onClick={() => jumpToTimestamp(item.timestamp_seconds)} className="text-xs text-blue-700 hover:text-blue-900 transition-colors">
                              @{fmtTimer(item.timestamp_seconds)}
                            </button>
                          ) : null}
                        </div>
                        {item.feedback_video ? (
                          <div className="rounded-xl overflow-hidden bg-black">
                            <video src={videoUrl(item.feedback_video)} controls playsInline className="w-full aspect-video bg-black" />
                          </div>
                        ) : null}
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
