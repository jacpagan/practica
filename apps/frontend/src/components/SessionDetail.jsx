import React, { useEffect, useMemo, useRef, useState } from 'react'
import { feedbackCategoryLabel, feedbackCategoryTone, fmtTimer, isLikelyVideoFile, sessionVideoSources, uploadMultipartRequest, videoFileAccept, videoUrl } from '../utils'
import { useConfirm } from './ConfirmDialog'
import { useToast } from './Toast'
import PracticeThreadField from './PracticeThreadField'

const requestStatusTone = {
  requested: 'bg-amber-100 text-amber-800',
  opened: 'bg-blue-100 text-blue-800',
  responded: 'bg-emerald-100 text-emerald-800',
  viewed: 'bg-violet-100 text-violet-800',
  needs_resubmission: 'bg-orange-100 text-orange-800',
  declined_unrelated: 'bg-rose-100 text-rose-800',
  flagged: 'bg-red-100 text-red-800',
  resubmitted: 'bg-fuchsia-100 text-fuchsia-800',
  closed: 'bg-gray-100 text-gray-700',
  revoked: 'bg-red-100 text-red-700',
}

const requestStatusLabel = (value = '') => {
  const normalized = String(value || '').trim().toLowerCase()
  if (!normalized) return 'Unknown'
  return normalized.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
}

const requestReasonLabel = (value = '') => {
  const normalized = String(value || '').trim().toLowerCase()
  if (!normalized) return ''
  if (normalized === 'needs_new_take') return 'Needs new take'
  if (normalized === 'unrelated_video') return 'Unrelated take'
  if (normalized === 'unsafe_content') return 'Unsafe content'
  if (normalized === 'spam') return 'Spam'
  if (normalized === 'other') return 'Other'
  return normalized.replace(/_/g, ' ')
}

const LAST_REVIEWER_KEY = 'practica.last_reviewer.v1'
const LEGACY_LAST_REVIEWER_STORAGE_KEY = 'practica.last_teacher.v1'
const LESSON_GOAL_PRESETS = [
  'Today\'s drum lesson follow-up',
  'Timing and consistency',
  'Groove and feel',
  'Technique and motion',
]

const normalizeReviewerText = (value = '') => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

const findReviewerAutoPick = (query, reviewers = []) => {
  const normalizedQuery = normalizeReviewerText(query)
  if (!normalizedQuery) return null

  const queryWords = normalizedQuery.split(/\s+/).filter(Boolean)
  const candidates = reviewers
    .map((reviewer) => {
      const display = normalizeReviewerText(reviewer.display_name)
      const username = normalizeReviewerText(reviewer.username)
      const haystack = `${display} ${username}`.trim()
      let score = 0

      if (display === normalizedQuery || username === normalizedQuery) score += 100
      if (display.startsWith(normalizedQuery) || username.startsWith(normalizedQuery)) score += 80
      if (queryWords.length > 0 && queryWords.every((word) => haystack.includes(word))) score += 60
      if (normalizedQuery.includes('jimmy') && haystack.includes('jimmy')) score += 50
      if (normalizedQuery.includes('sage') && haystack.includes('sage')) score += 50
      if (haystack.includes('jimmy sage')) score += 25

      return { reviewer, score }
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)

  if (candidates.length === 0) return null
  if (candidates.length === 1) return candidates[0].reviewer
  if (candidates[0].score >= 130 && candidates[0].score >= candidates[1].score + 20) return candidates[0].reviewer
  return null
}

const readLastReviewer = () => {
  if (typeof window === 'undefined') return null
  for (const storageKey of [LAST_REVIEWER_KEY, LEGACY_LAST_REVIEWER_STORAGE_KEY]) {
    try {
      const raw = window.localStorage.getItem(storageKey)
      if (!raw) continue
      const parsed = JSON.parse(raw)
      if (!parsed || typeof parsed !== 'object' || !parsed.id) continue
      return parsed
    } catch {}
  }
  return null
}

const writeLastReviewer = (reviewer) => {
  if (typeof window === 'undefined' || !reviewer?.id) return
  try {
    window.localStorage.setItem(LAST_REVIEWER_KEY, JSON.stringify({
      id: reviewer.id,
      username: reviewer.username,
      display_name: reviewer.display_name,
    }))
  } catch {}
}

function SessionDetail({ session: initialSession, token, onBack, onOpenReviewRequest, initialReviewRequestDraft = null, onReviewRequestDraftCleared, onSessionUpdate, onSessionDelete, justUploaded = false, onRecordAnother, onOpenSeries, practiceThreadOptions = [] }) {
  const toast = useToast()
  const confirm = useConfirm()
  const videoRef = useRef(null)
  const loopDetailsRef = useRef(null)
  const editFeedbackInputRef = useRef(null)
  const editFeedbackUploadIdRef = useRef('')
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
  const [showLoopDetails, setShowLoopDetails] = useState(false)
  const [reviewerQuery, setReviewerQuery] = useState('')
  const [designatedReviewers, setDesignatedReviewers] = useState([])
  const [reviewerResults, setReviewerResults] = useState([])
  const [reviewerSearchLoading, setReviewerSearchLoading] = useState(false)
  const [selectedReviewer, setSelectedReviewer] = useState(null)
  const [recentReviewers, setRecentReviewers] = useState([])
  const [recentReviewersLoading, setRecentReviewersLoading] = useState(false)
  const [creatingInvite, setCreatingInvite] = useState(false)
  const [showRequestDetails, setShowRequestDetails] = useState(false)
  const [showRequestHistory, setShowRequestHistory] = useState(false)
  const [showLegacyLinkTools, setShowLegacyLinkTools] = useState(false)
  const [requestInstrument, setRequestInstrument] = useState('drums')
  const [requestGoal, setRequestGoal] = useState('')
  const [requestExerciseOrSong, setRequestExerciseOrSong] = useState('')
  const [requestNotes, setRequestNotes] = useState('')
  const [editingFeedbackId, setEditingFeedbackId] = useState(null)
  const [editingFeedbackTimestampSeconds, setEditingFeedbackTimestampSeconds] = useState('')
  const [editingFeedbackVideoFile, setEditingFeedbackVideoFile] = useState(null)
  const [editingFeedbackPreviewUrl, setEditingFeedbackPreviewUrl] = useState('')
  const [savingFeedbackId, setSavingFeedbackId] = useState(null)
  const [deletingFeedbackId, setDeletingFeedbackId] = useState(null)
  const [editFeedbackUploadProgressPercent, setEditFeedbackUploadProgressPercent] = useState(null)

  const authHeaders = useMemo(() => (token ? { Authorization: `Token ${token}` } : {}), [token])
  const canEdit = Boolean(session?.can_edit)
  const canCreateShareLink = session?.processing_status === 'ready'
  const playbackSources = useMemo(() => sessionVideoSources(session, session?.local_preview_url || ''), [session])
  const [playbackSourceIndex, setPlaybackSourceIndex] = useState(0)
  const [playbackFailed, setPlaybackFailed] = useState(false)
  const playableUrl = playbackSources[playbackSourceIndex] || null
  const selectedReviewerName = selectedReviewer?.display_name || selectedReviewer?.username || ''
  const sortedReviewRequests = useMemo(
    () => [...reviewRequests].sort((left, right) => new Date(right.created_at) - new Date(left.created_at)),
    [reviewRequests],
  )
  const currentLoopRequest = sortedReviewRequests.find((item) => !['closed', 'revoked'].includes(item.status)) || sortedReviewRequests[0] || null
  const currentLoopStatus = String(currentLoopRequest?.status || '').trim().toLowerCase()
  const waitingOnReviewer = ['requested', 'opened'].includes(currentLoopStatus)
  const feedbackReadyToReview = currentLoopStatus === 'responded'
  const readyForFollowUp = ['viewed', 'needs_resubmission', 'declined_unrelated'].includes(currentLoopStatus)
  const canStartNewRequest = canEdit && canCreateShareLink && !waitingOnReviewer
  const currentLoopReviewerName = currentLoopRequest?.reviewer?.display_name || currentLoopRequest?.reviewer?.username || 'your reviewer'
  const currentLoopSummary = useMemo(() => {
    if (!currentLoopRequest) return null
    if (currentLoopStatus === 'requested') {
      return {
        tone: 'border-amber-200 bg-amber-50',
        title: `Waiting on ${currentLoopReviewerName}`,
        message: 'Your review request is live. Open the private thread to check the request and any updates.',
      }
    }
    if (currentLoopStatus === 'opened') {
      return {
        tone: 'border-blue-200 bg-blue-50',
        title: `${currentLoopReviewerName} opened this request`,
        message: 'Your reviewer has seen the take. Open the private thread to follow the feedback conversation.',
      }
    }
    if (currentLoopStatus === 'responded') {
      return {
        tone: 'border-emerald-200 bg-emerald-50',
        title: 'Feedback is ready',
        message: 'Open the private thread to watch the response before you decide on the next take.',
      }
    }
    if (currentLoopStatus === 'viewed') {
      return {
        tone: 'border-violet-200 bg-violet-50',
        title: 'Ready for the next take',
        message: 'You have seen the feedback. Record the next take when you are ready, or reopen the private thread.',
      }
    }
    if (currentLoopStatus === 'needs_resubmission') {
      return {
        tone: 'border-orange-200 bg-orange-50',
        title: 'New take requested',
        message: 'Your reviewer asked for a cleaner or more complete take. Record a new take to continue this loop.',
      }
    }
    if (currentLoopStatus === 'declined_unrelated') {
      return {
        tone: 'border-rose-200 bg-rose-50',
        title: 'Matching take needed',
        message: 'Your reviewer said this take does not match the requested thread. Record the right take to continue.',
      }
    }
    if (currentLoopStatus === 'flagged') {
      return {
        tone: 'border-red-200 bg-red-50',
        title: 'Request flagged',
        message: 'This request is out of the normal loop for now. Open the private thread to review the note.',
      }
    }
    return {
      tone: 'border-gray-200 bg-gray-50',
      title: 'Private review thread',
      message: 'Open the private thread to review the current status.',
    }
  }, [currentLoopRequest, currentLoopReviewerName, currentLoopStatus])
  const defaultRequestGoal = useMemo(() => {
    if (session?.practice_series) return `${session.practice_series} follow-up`
    return LESSON_GOAL_PRESETS[0]
  }, [session?.practice_series])
  const justUploadedWithoutRequest = justUploaded && reviewRequests.length === 0
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
    setReviewerQuery('')
    setDesignatedReviewers([])
    setReviewerResults([])
    setSelectedReviewer(null)
    setRecentReviewers([])
    setShowLoopDetails(false)
    setShowRequestDetails(false)
    setShowRequestHistory(false)
    setShowLegacyLinkTools(false)
    setRequestInstrument('drums')
    setRequestGoal('')
    setRequestExerciseOrSong('')
    setRequestNotes('')
    setEditingFeedbackId(null)
    setEditingFeedbackTimestampSeconds('')
    setEditingFeedbackVideoFile(null)
    setEditingFeedbackPreviewUrl('')
  }, [initialSession?.id])

  useEffect(() => () => {
    if (editingFeedbackPreviewUrl && editingFeedbackPreviewUrl.startsWith('blob:')) {
      try { window.URL.revokeObjectURL(editingFeedbackPreviewUrl) } catch {}
    }
  }, [editingFeedbackPreviewUrl])

  useEffect(() => {
    if (!justUploaded) return
    if (!canEdit) return
    if (reviewRequests.length > 0) return
    // Nudge: auto-open the request composer for fresh uploads.
    setShowRequestComposer(true)
    try { loopDetailsRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }) } catch {}
  }, [canEdit, justUploaded, reviewRequests.length])

  useEffect(() => {
    if (!initialReviewRequestDraft || !canEdit) return
    setShowLoopDetails(true)
    setShowRequestComposer(true)
    setSelectedReviewer(initialReviewRequestDraft.reviewer || null)
    setShowRequestDetails(true)
    setRequestInstrument(initialReviewRequestDraft.instrument || 'drums')
    setRequestGoal(initialReviewRequestDraft.goal || '')
    setRequestExerciseOrSong(initialReviewRequestDraft.exercise_or_song || '')
    setRequestNotes(initialReviewRequestDraft.notes || '')
  }, [initialReviewRequestDraft, canEdit])

  useEffect(() => {
    if (!canEdit || !canCreateShareLink || requestsLoading || showRequestComposer || initialReviewRequestDraft) return
    if (justUploaded && reviewRequests.length === 0) {
      setShowLoopDetails(true)
      setShowRequestComposer(true)
    }
  }, [canCreateShareLink, canEdit, initialReviewRequestDraft, justUploaded, requestsLoading, reviewRequests.length, showRequestComposer])

  useEffect(() => {
    if (showRequestComposer || showRequestHistory || reviewRequests.length > 0) {
      setShowLoopDetails(true)
    } else {
      setShowLoopDetails(false)
    }
  }, [reviewRequests.length, showRequestComposer, showRequestHistory])

  useEffect(() => {
    if (!showRequestComposer) return
    if (String(requestGoal || '').trim()) return
    setRequestGoal(defaultRequestGoal)
  }, [defaultRequestGoal, requestGoal, showRequestComposer])

  useEffect(() => {
    if (!justUploadedWithoutRequest || !showLoopDetails || !showRequestComposer) return
    const timer = window.setTimeout(() => {
      loopDetailsRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
    }, 80)
    return () => window.clearTimeout(timer)
  }, [justUploadedWithoutRequest, showLoopDetails, showRequestComposer])

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
    const loadRecentReviewers = async () => {
      setRecentReviewersLoading(true)
      try {
        const res = await fetch('/api/connections/?role=student', { headers: authHeaders })
        if (!res.ok) throw new Error('designated-reviewers')
        const data = await res.json()
        const items = Array.isArray(data) ? data : data.results || []
        const seen = new Set()
        const reviewers = []
        const sortedItems = [...items].sort((left, right) => {
          const leftDate = new Date(left?.last_request_at || left?.created_at || 0)
          const rightDate = new Date(right?.last_request_at || right?.created_at || 0)
          return rightDate - leftDate
        })
        sortedItems.forEach((item) => {
          const reviewer = item?.reviewer
          if (!reviewer?.id || seen.has(reviewer.id)) return
          seen.add(reviewer.id)
          reviewers.push({
            ...reviewer,
            pending_review_count: item?.pending_review_count || 0,
            total_review_count: item?.total_review_count || 0,
            last_request_at: item?.last_request_at || '',
            membership_id: item?.id,
          })
        })
        if (cancelled) return
        setDesignatedReviewers(reviewers)
        setRecentReviewers(reviewers.slice(0, 6))
        setSelectedReviewer((current) => {
          if (initialReviewRequestDraft?.reviewer?.id) {
            return reviewers.find((reviewer) => reviewer.id === initialReviewRequestDraft.reviewer.id) || initialReviewRequestDraft.reviewer
          }
          if (current?.id) {
            return reviewers.find((reviewer) => reviewer.id === current.id) || null
          }
          const storedReviewer = readLastReviewer()
          if (storedReviewer?.id) {
            return reviewers.find((reviewer) => reviewer.id === storedReviewer.id) || null
          }
          if (reviewers.length === 1) return reviewers[0]
          return null
        })
      } catch {
        if (!cancelled) {
          setDesignatedReviewers([])
          setRecentReviewers([])
        }
      } finally {
        if (!cancelled) setRecentReviewersLoading(false)
      }
    }

    loadRecentReviewers()
    return () => { cancelled = true }
  }, [authHeaders, canEdit, initialReviewRequestDraft?.reviewer?.id, token])

  useEffect(() => {
    if (!token || !canEdit) return undefined
    const query = reviewerQuery.trim()
    if (query.length < 2) {
      setReviewerResults([])
      setReviewerSearchLoading(false)
      return undefined
    }
    setReviewerSearchLoading(true)
    const normalizedQuery = normalizeReviewerText(query)
    const results = designatedReviewers.filter((reviewer) => {
      const display = normalizeReviewerText(reviewer.display_name)
      const username = normalizeReviewerText(reviewer.username)
      return display.includes(normalizedQuery) || username.includes(normalizedQuery)
    })
    const autoPick = findReviewerAutoPick(query, results)
    if (autoPick) {
      setSelectedReviewer(autoPick)
      setReviewerQuery('')
      setReviewerResults([])
      writeLastReviewer(autoPick)
      setReviewerSearchLoading(false)
      return undefined
    }
    setReviewerResults(results)
    setReviewerSearchLoading(false)
    return undefined
  }, [canEdit, designatedReviewers, reviewerQuery, token])

  const startEditing = () => {
    setEditTitle(session.title || '')
    setEditPracticeSeries(session.practice_series || '')
    setEditDescription(session.description || '')
    setEditing(true)
  }

  const chooseReviewer = (reviewer) => {
    setSelectedReviewer(reviewer)
    setReviewerQuery('')
    setReviewerResults([])
    writeLastReviewer(reviewer)
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

  const refreshSession = async ({ silent = false } = {}) => {
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
      if (!silent) toast.error('Could not refresh this video')
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (!token || !session?.id) return undefined
    if (session.processing_status !== 'processing') return undefined

    let cancelled = false
    let timeoutId = null

    const poll = async () => {
      if (cancelled) return
      await refreshSession({ silent: true })
      if (cancelled) return
      timeoutId = window.setTimeout(poll, 5000)
    }

    timeoutId = window.setTimeout(poll, 5000)
    return () => {
      cancelled = true
      if (timeoutId) window.clearTimeout(timeoutId)
    }
  }, [authHeaders, loadReviewRequests, onSessionUpdate, session?.id, session?.processing_status, token])

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
    if (!selectedReviewer?.id) {
      toast.error('Choose a reviewer first')
      return
    }

    setCreatingRequest(true)
    try {
      const payload = {
        session_id: session.id,
        reviewer_id: selectedReviewer.id,
        parent_request_id: initialReviewRequestDraft?.parent_request_id || null,
        instrument: String(requestInstrument || '').trim() || 'drums',
        goal: String(requestGoal || '').trim() || defaultRequestGoal,
        exercise_or_song: String(requestExerciseOrSong || '').trim(),
        notes: String(requestNotes || '').trim(),
      }
      const res = await fetch('/api/review-requests/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.session_id?.[0] || data?.reviewer_id?.[0] || data?.goal?.[0] || data?.error || 'Could not create review request')
      }
      setReviewRequests((current) => [data, ...current])
      setShowRequestComposer(false)
      setReviewerQuery('')
      setReviewerResults([])
      setSelectedReviewer(null)
      setShowRequestDetails(false)
      setRequestGoal('')
      setRequestExerciseOrSong('')
      onReviewRequestDraftCleared?.()
      writeLastReviewer(selectedReviewer)
      toast.success(`Request sent to ${selectedReviewer.display_name || selectedReviewer.username}`)
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

  const ensurePrivateLink = async () => {
    if (activeReviewLink?.url) return activeReviewLink
    const res = await fetch(`/api/sessions/${session.id}/share/`, {
      method: 'POST',
      headers: authHeaders,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data?.error || 'Could not create private feedback link')
    setActiveReviewLink(data)
    return data
  }

  const createShare = async () => {
    if (!token || !session?.id) return
    setSharing(true)
    try {
      const data = await ensurePrivateLink()
      await navigator.clipboard.writeText(data.url)
      toast.success('Private feedback link copied')
    } catch (error) {
      toast.error(error?.message || 'Could not create private feedback link')
    } finally {
      setSharing(false)
    }
  }

  const inviteNewReviewer = async () => {
    if (!token || !session?.id) return
    setCreatingInvite(true)
    try {
      const linkData = await ensurePrivateLink()
      const inviteRes = await fetch('/api/invite-codes/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({ label: `Review ${session.title}` }),
      })
      const inviteData = await inviteRes.json().catch(() => ({}))
      if (!inviteRes.ok) throw new Error(inviteData?.error || 'Could not create invite code')
      const bundledUrl = `${linkData.url}${linkData.url.includes('?') ? '&' : '?'}claim=${encodeURIComponent(inviteData.code)}`
      const message = [
        'You have been invited to join Practica and review a private video.',
        '',
        `Open this private invite link: ${bundledUrl}`,
      ].join('\n')
      await navigator.clipboard.writeText(message)
      toast.success('Invite message copied')
    } catch (error) {
      toast.error(error?.message || 'Could not create invite message')
    } finally {
      setCreatingInvite(false)
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

  const createClientUploadId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

  const replaceEditingFeedbackPreviewUrl = (nextUrl) => {
    setEditingFeedbackPreviewUrl((current) => {
      if (current && current.startsWith('blob:')) {
        try { window.URL.revokeObjectURL(current) } catch {}
      }
      return nextUrl || ''
    })
  }

  const startEditingFeedback = (item) => {
    setEditingFeedbackId(item.id)
    setEditingFeedbackTimestampSeconds(typeof item.timestamp_seconds === 'number' ? String(item.timestamp_seconds) : '')
    setEditingFeedbackVideoFile(null)
    editFeedbackUploadIdRef.current = ''
    setEditFeedbackUploadProgressPercent(null)
    replaceEditingFeedbackPreviewUrl('')
  }

  const cancelEditingFeedback = () => {
    setEditingFeedbackId(null)
    setEditingFeedbackTimestampSeconds('')
    setEditingFeedbackVideoFile(null)
    editFeedbackUploadIdRef.current = ''
    setEditFeedbackUploadProgressPercent(null)
    replaceEditingFeedbackPreviewUrl('')
  }

  const pickEditFeedbackFile = (event) => {
    const file = event.target.files?.[0]
    if (!file || !isLikelyVideoFile(file)) return
    setEditingFeedbackVideoFile(file)
    editFeedbackUploadIdRef.current = ''
    setEditFeedbackUploadProgressPercent(null)
    replaceEditingFeedbackPreviewUrl(URL.createObjectURL(file))
    if (event.target) event.target.value = ''
  }

  const saveFeedbackEdit = async (feedbackId) => {
    if (!token || !session?.id) return
    setSavingFeedbackId(feedbackId)
    try {
      const payload = new FormData()
      payload.append('timestamp_seconds', editingFeedbackTimestampSeconds)
      if (editingFeedbackVideoFile) {
        payload.append('feedback_video', editingFeedbackVideoFile)
        if (!editFeedbackUploadIdRef.current) editFeedbackUploadIdRef.current = createClientUploadId()
        payload.append('client_upload_id', editFeedbackUploadIdRef.current)
      }

      const res = await uploadMultipartRequest({
        url: `/api/sessions/${session.id}/video-feedback/${feedbackId}/`,
        method: 'PATCH',
        formData: payload,
        token,
        onProgress: (percent) => setEditFeedbackUploadProgressPercent(percent ?? null),
      })
      if (!res.ok) throw new Error(res.data?.error || 'Could not update feedback video')
      await refreshSession({ silent: true })
      cancelEditingFeedback()
      toast.success('Feedback video updated')
    } catch (error) {
      toast.error(error.message || 'Could not update feedback video')
    } finally {
      setSavingFeedbackId(null)
      setEditFeedbackUploadProgressPercent(null)
    }
  }

  const deleteFeedback = async (feedbackId) => {
    if (!token || !session?.id) return
    const accepted = await confirm({
      title: 'Delete feedback video?',
      message: 'This removes your feedback video from the thread.',
      confirmLabel: 'Delete',
      cancelLabel: 'Keep',
      tone: 'danger',
    })
    if (!accepted) return
    setDeletingFeedbackId(feedbackId)
    try {
      const res = await fetch(`/api/sessions/${session.id}/video-feedback/${feedbackId}/`, {
        method: 'DELETE',
        headers: authHeaders,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Could not delete feedback video')
      await refreshSession({ silent: true })
      if (editingFeedbackId === feedbackId) cancelEditingFeedback()
      toast.success('Feedback video deleted')
    } catch (error) {
      toast.error(error.message || 'Could not delete feedback video')
    } finally {
      setDeletingFeedbackId(null)
    }
  }

  const openRequestComposer = () => {
    if (!canCreateShareLink) return
    setShowLoopDetails(true)
    setShowRequestComposer(true)
  }

  const toggleLoopDetails = () => {
    setShowLoopDetails((current) => {
      const next = !current
      if (!next) {
        setShowRequestComposer(false)
        setShowRequestHistory(false)
      }
      return next
    })
  }

  const startFollowUp = (requestItem = currentLoopRequest) => {
    const reviewer = requestItem?.reviewer
    if (!reviewer) return
    onRecordAnother?.({
      parent_request_id: requestItem.id,
      reviewer,
      instrument: requestItem.instrument,
      goal: requestItem.goal,
      exercise_or_song: requestItem.exercise_or_song,
      notes: requestItem.notes,
      practiceSeries: session?.practice_series || '',
    })
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

        <div className="p-4 sm:p-4 space-y-3">
          {editing ? (
            <div className="space-y-4">
              <input
                type="text"
                value={editTitle}
                onChange={(event) => setEditTitle(event.target.value)}
                className="w-full text-lg font-semibold text-gray-900 border-b border-gray-200 focus:border-gray-400 focus:outline-none pb-1"
              />
              <PracticeThreadField
                value={editPracticeSeries}
                onChange={setEditPracticeSeries}
                options={practiceThreadOptions}
                placeholder="Choose a thread or create a new one"
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
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <p className="text-sm font-medium text-emerald-900">This take is now in your private library.</p>
                </div>
              ) : null}

              {session.description ? <p className="text-sm text-gray-600">{session.description}</p> : null}

              {(session.recorded_at || session.duration_seconds) ? (
                <details className="text-xs text-gray-500">
                  <summary className="cursor-pointer list-none hover:text-gray-900 transition-colors">Video details</summary>
                  <div className="flex flex-wrap gap-2 pt-2">
                    {session.recorded_at ? <span className="rounded-full bg-gray-100 px-3 py-1">{new Date(session.recorded_at).toLocaleString(undefined, { hour12: undefined })}</span> : null}
                    {session.duration_seconds ? <span className="rounded-full bg-gray-100 px-3 py-1">{fmtTimer(session.duration_seconds)}</span> : null}
                  </div>
                </details>
              ) : null}

              {session.processing_status === 'failed' ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <p className="text-sm font-medium text-amber-900">Playback needs another pass.</p>
                  <p className="text-sm text-amber-800 mt-1">{session.processing_error || 'This take is not ready for browser playback yet.'}</p>
                  {canEdit ? (
                    <button type="button" onClick={retryProcessing} disabled={retryingProcessing} className="mt-3 text-sm font-medium text-amber-900 border border-amber-300 rounded-lg px-4 py-2.5 hover:bg-amber-100 disabled:opacity-50 transition-colors">
                      {retryingProcessing ? 'Retrying…' : 'Retry playback'}
                    </button>
                  ) : null}
                </div>
              ) : null}

              {playbackFailed && session.processing_status === 'ready' ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <p className="text-sm font-medium text-amber-900">Playback is not available on this device yet.</p>
                  <p className="text-sm text-amber-800 mt-1">Retry playback to generate a more compatible version for Mac and phone browsers.</p>
                  {canEdit ? (
                    <button type="button" onClick={retryProcessing} disabled={retryingProcessing} className="mt-3 text-sm font-medium text-amber-900 border border-amber-300 rounded-lg px-4 py-2.5 hover:bg-amber-100 disabled:opacity-50 transition-colors">
                      {retryingProcessing ? 'Retrying…' : 'Retry playback'}
                    </button>
                  ) : null}
                </div>
              ) : null}

              {canEdit && !showRequestComposer ? (
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 space-y-3">
                  {currentLoopSummary ? (
                    <div className={`rounded-lg border px-3 py-3 ${currentLoopSummary.tone}`}>
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{currentLoopSummary.title}</p>
                          <p className="text-sm text-gray-700 mt-1">{currentLoopSummary.message}</p>
                        </div>
                        {currentLoopRequest ? (
                          <span className={`text-[11px] uppercase tracking-wide px-2 py-1 rounded-full ${requestStatusTone[currentLoopRequest.status] || 'bg-gray-100 text-gray-700'}`}>
                            {requestStatusLabel(currentLoopRequest.status)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    {waitingOnReviewer && currentLoopRequest ? (
                      <>
                        <button type="button" onClick={() => onOpenReviewRequest?.(currentLoopRequest)} className="text-sm font-medium text-white bg-gray-900 rounded-lg px-4 py-2.5 hover:bg-gray-800 transition-colors">
                          Check request
                        </button>
                      </>
                    ) : null}
                    {feedbackReadyToReview && currentLoopRequest ? (
                      <>
                        <button type="button" onClick={() => onOpenReviewRequest?.(currentLoopRequest)} className="text-sm font-medium text-white bg-gray-900 rounded-lg px-4 py-2.5 hover:bg-gray-800 transition-colors">
                          Review feedback
                        </button>
                      </>
                    ) : null}
                    {readyForFollowUp && currentLoopRequest ? (
                      <>
                        <button type="button" onClick={() => startFollowUp(currentLoopRequest)} className="text-sm font-medium text-white bg-gray-900 rounded-lg px-4 py-2.5 hover:bg-gray-800 transition-colors">
                          {currentLoopStatus === 'needs_resubmission' ? 'Record new take' : currentLoopStatus === 'declined_unrelated' ? 'Record matching take' : 'Record next take'}
                        </button>
                        <button type="button" onClick={() => onOpenReviewRequest?.(currentLoopRequest)} className="text-sm text-gray-700 border border-gray-200 rounded-lg px-4 py-2.5 hover:bg-white transition-colors">
                          Open private thread
                        </button>
                      </>
                    ) : null}
                    {currentLoopStatus === 'flagged' && currentLoopRequest ? (
                      <button type="button" onClick={() => onOpenReviewRequest?.(currentLoopRequest)} className="text-sm font-medium text-white bg-gray-900 rounded-lg px-4 py-2.5 hover:bg-gray-800 transition-colors">
                        Open private thread
                      </button>
                    ) : null}
                    {!waitingOnReviewer && !feedbackReadyToReview && !readyForFollowUp && currentLoopStatus !== 'flagged' ? (
                      <button type="button" onClick={openRequestComposer} disabled={!canCreateShareLink} className="text-sm font-medium text-white bg-gray-900 rounded-lg px-4 py-2.5 hover:bg-gray-800 disabled:opacity-50 transition-colors">
                        Request feedback
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {canEdit ? (
                <details className="rounded-xl border border-gray-200 bg-white px-4 py-3" open={showLegacyLinkTools}>
                  <summary onClick={() => setShowLegacyLinkTools((current) => !current)} className="cursor-pointer list-none flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Need a simple private link instead?</p>
                      <p className="text-xs text-gray-500 mt-1">Use this when you want a lighter private share instead of a named review thread.</p>
                    </div>
                    <span className="text-xs text-gray-500">{showLegacyLinkTools ? 'Hide option' : 'Use simple link instead'}</span>
                  </summary>
                  <div className="space-y-3 pt-4">
                  {activeReviewLink?.url ? (
                    <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-3">
                      <p className="text-sm text-gray-800">Private link ready.</p>
                      <p className="text-xs text-gray-500">Signed-in access only • expires {new Date(activeReviewLink.expires_at).toLocaleString(undefined, { hour12: undefined })}</p>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={copyShareLink} className="text-sm font-medium text-white bg-gray-900 rounded-lg px-4 py-2.5 hover:bg-gray-800 transition-colors">
                          Copy private link
                        </button>
                        <button type="button" onClick={revokeShareLink} disabled={revokingShare} className="text-sm text-gray-700 border border-gray-200 rounded-lg px-4 py-2.5 hover:bg-white disabled:opacity-50 transition-colors">
                          {revokingShare ? 'Turning off…' : 'Turn off link'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-3">
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
                      {!canCreateShareLink ? null : <p className="text-sm text-gray-800">Create one signed-in private link you can send anywhere.</p>}
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={createShare} disabled={sharing || !canCreateShareLink} className="text-sm font-medium text-white bg-gray-900 rounded-lg px-4 py-2.5 hover:bg-gray-800 disabled:opacity-50 transition-colors">
                          {sharing ? 'Creating…' : 'Create private link'}
                        </button>
                      </div>
                    </div>
                  )}
                  </div>
                </details>
              ) : null}

              {canEdit ? (
                <div ref={loopDetailsRef} className="rounded-xl border border-gray-200 bg-white px-4 py-3 space-y-4">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{reviewRequests.length > 0 ? 'Trusted feedback' : 'Bring in feedback'}</p>
                      <p className="text-xs text-gray-500 mt-1">{reviewRequests.length > 0 ? `${reviewRequests.length} trusted feedback request${reviewRequests.length === 1 ? '' : 's'} on this take.` : 'Bring trusted feedback into this take only when you want it.'}</p>
                    </div>
                    <div className="flex items-center gap-2" />
                  </div>

                  {showRequestComposer ? (
                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-4">
                      {!canCreateShareLink ? (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3">
                          <p className="text-xs font-medium uppercase tracking-wide text-amber-800">Playback ready required</p>
                          <p className="text-sm text-amber-900 mt-1">Wait until this session is playback ready before sending a feedback request.</p>
                        </div>
                      ) : null}

                      {selectedReviewerName ? (
                        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3">
                          <p className="text-xs font-medium uppercase tracking-wide text-emerald-800">Ready</p>
                          <p className="text-sm text-emerald-900 mt-1">This will open a private thread with {selectedReviewerName}. Only the two of you can see it.</p>
                        </div>
                      ) : null}

                      <div className="space-y-2">
                        <label className="block text-xs font-medium uppercase tracking-wide text-gray-500">Reviewer</label>
                        {selectedReviewer ? (
                          <div className="rounded-lg border border-gray-200 bg-white px-3 py-3 flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium text-gray-900">{selectedReviewer.display_name || selectedReviewer.username}</p>
                              <p className="text-xs text-gray-500">@{selectedReviewer.username}</p>
                            </div>
                            <button type="button" onClick={() => { setSelectedReviewer(null); setReviewerQuery('') }} className="text-xs text-red-600 hover:text-red-700 transition-colors">Change</button>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {recentReviewersLoading ? <p className="text-xs text-gray-500">Loading designated reviewers…</p> : null}
                            {!recentReviewersLoading && designatedReviewers.length === 0 ? (
                              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3">
                                <p className="text-xs font-medium uppercase tracking-wide text-amber-800">Designated reviewer required</p>
                                <p className="text-sm text-amber-900 mt-1">Structured feedback requests only work with reviewers already assigned to your roster. Ask an admin to add one, or use a lighter private link below.</p>
                              </div>
                            ) : null}
                            {recentReviewers.length > 0 ? (
                              <div className="flex flex-wrap gap-2">
                                {recentReviewers.map((reviewer) => (
                                  <button
                                    key={reviewer.id}
                                    type="button"
                                    onClick={() => chooseReviewer(reviewer)}
                                    className="rounded-full border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                                  >
                                    {reviewer.display_name || reviewer.username}
                                  </button>
                                ))}
                              </div>
                            ) : null}
                            {designatedReviewers.length > 0 ? (
                              <>
                                <input
                                  type="text"
                                  value={reviewerQuery}
                                  onChange={(event) => setReviewerQuery(event.target.value)}
                                  placeholder="Search designated reviewers"
                                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
                                />
                                <p className="text-xs text-gray-500">Only reviewers already on your roster can receive a structured feedback request.</p>
                                {reviewerSearchLoading ? <p className="text-xs text-gray-500">Searching…</p> : null}
                                {reviewerResults.length > 0 ? (
                                  <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                                    {reviewerResults.map((reviewer) => (
                                      <button
                                        key={reviewer.id}
                                        type="button"
                                        onClick={() => chooseReviewer(reviewer)}
                                        className="w-full text-left px-3 py-3 hover:bg-gray-50 transition-colors border-b last:border-b-0 border-gray-100"
                                      >
                                        <p className="text-sm font-medium text-gray-900">{reviewer.display_name || reviewer.username}</p>
                                        <p className="text-xs text-gray-500 mt-1">@{reviewer.username}</p>
                                      </button>
                                    ))}
                                  </div>
                                ) : reviewerQuery.trim().length >= 2 && !reviewerSearchLoading ? <p className="text-xs text-gray-500">No matching designated reviewers found yet.</p> : null}
                              </>
                            ) : null}
                          </div>
                        )}
                      </div>

                      <div className="rounded-lg border border-gray-200 bg-white px-3 py-3 space-y-2">
                        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Other ways</p>
                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={inviteNewReviewer} disabled={creatingInvite || !canCreateShareLink} className="text-sm text-gray-700 border border-gray-200 rounded-lg px-4 py-2 hover:bg-gray-50 disabled:opacity-50 transition-colors">
                            {creatingInvite ? 'Creating invite…' : 'Invite with private link'}
                          </button>
                        </div>
                        <p className="text-xs text-gray-500">This sends a private invitation link for trusted feedback. It does not add someone as a designated reviewer for structured requests.</p>
                      </div>

                      {/* Title of the practice thread is sufficient context; no extra request fields */}

                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => setShowRequestComposer(false)} className="text-sm text-gray-600 border border-gray-200 rounded-lg px-4 py-2.5 hover:bg-white transition-colors">
                          Cancel
                        </button>
                        <button type="button" disabled={creatingRequest || !canCreateShareLink || !selectedReviewer?.id} onClick={createReviewRequest} className="text-sm font-medium text-white bg-gray-900 rounded-lg px-4 py-2.5 hover:bg-gray-800 disabled:opacity-50 transition-colors">
                          {creatingRequest ? 'Sending…' : (selectedReviewerName ? `Send to ${selectedReviewerName}` : 'Choose reviewer')}
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {requestsLoading ? (
                    <div className="rounded-xl border border-gray-200 px-4 py-5 text-center text-sm text-gray-500">Loading feedback requests…</div>
                  ) : reviewRequests.length > 0 ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs text-gray-500">Thread history</p>
                        <button type="button" onClick={() => setShowRequestHistory((current) => !current)} className="text-xs text-gray-700 border border-gray-200 rounded-lg px-3 py-2 hover:bg-white transition-colors">
                          {showRequestHistory ? 'Hide request history' : 'Show request history'}
                        </button>
                      </div>
                      {!showRequestHistory ? null : (
                        <div className="space-y-3">
                      {reviewRequests.map((requestItem) => (
                        <div key={requestItem.id} className="rounded-xl bg-gray-50 px-3 py-3 space-y-3">
                          <div className="flex items-start justify-between gap-3 flex-wrap">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-medium text-gray-900">{requestItem.reviewer?.display_name || requestItem.reviewer?.username || 'Reviewer'}</p>
                                <span className={`text-[11px] uppercase tracking-wide px-2 py-1 rounded-full ${requestStatusTone[requestItem.status] || 'bg-gray-100 text-gray-700'}`}>
                                  {requestStatusLabel(requestItem.status)}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 mt-1">{requestItem.instrument}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-gray-500">Requested {new Date(requestItem.created_at).toLocaleString(undefined, { hour12: undefined })}</p>
                              <p className="text-xs text-gray-400 mt-1">Responses: {requestItem.response_count || 0}</p>
                            </div>
                          </div>
                          <div>
                            <p className="text-sm text-gray-800">{requestItem.goal}</p>
                            {requestItem.exercise_or_song ? <p className="text-xs text-gray-500 mt-1">Focus: {requestItem.exercise_or_song}</p> : null}
                            {requestItem.status_reason ? <p className="text-xs text-gray-600 mt-2">Reason: {requestReasonLabel(requestItem.status_reason)}</p> : null}
                            {requestItem.status_note ? <p className="text-xs text-gray-600 mt-1">Note: {requestItem.status_note}</p> : null}
                            {/* Notes removed from display */}
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
                                        <p className="text-sm font-medium text-gray-900">{feedbackItem.author_display_name || 'Reviewer'}</p>
                                        {feedbackItem.feedback_category ? (
                                          <span className={`text-[11px] uppercase tracking-wide px-2 py-1 rounded-full ${feedbackCategoryTone(feedbackItem.feedback_category)}`}>
                                            {feedbackCategoryLabel(feedbackItem.feedback_category)}
                                          </span>
                                        ) : null}
                                      </div>
                                      <p className="text-xs text-gray-400 mt-1">{new Date(feedbackItem.created_at).toLocaleString(undefined, { hour12: undefined })}</p>
                                    </div>
                                    {typeof feedbackItem.timestamp_seconds === 'number' ? (
                                      <button type="button" onClick={() => jumpToTimestamp(feedbackItem.timestamp_seconds)} className="text-xs text-blue-700 hover:text-blue-900 transition-colors">
                                        @{fmtTimer(feedbackItem.timestamp_seconds)}
                                      </button>
                                    ) : null}
                                  </div>
                                  {feedbackItem.authored_by_current_user ? (
                                    <div className="flex items-center justify-end gap-2">
                                      <button type="button" onClick={() => startEditingFeedback(feedbackItem)} className="text-xs text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-white transition-colors">
                                        Edit
                                      </button>
                                      <button type="button" onClick={() => deleteFeedback(feedbackItem.id)} disabled={deletingFeedbackId === feedbackItem.id} className="text-xs text-red-600 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50 disabled:opacity-50 transition-colors">
                                        {deletingFeedbackId === feedbackItem.id ? 'Deleting…' : 'Delete'}
                                      </button>
                                    </div>
                                  ) : null}
                                  <div className="rounded-xl overflow-hidden bg-black">
                                    <video src={videoUrl(feedbackItem.feedback_video)} controls playsInline className="w-full aspect-video bg-black" />
                                  </div>
                                  {editingFeedbackId === feedbackItem.id ? (
                                    <div className="rounded-xl border border-gray-200 bg-white p-3 space-y-3">
                                      <input
                                        type="number"
                                        min="0"
                                        step="1"
                                        value={editingFeedbackTimestampSeconds}
                                        onChange={(event) => setEditingFeedbackTimestampSeconds(event.target.value)}
                                        placeholder="Timestamp seconds"
                                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
                                      />
                                      <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                                        <div className="flex items-center justify-between gap-3">
                                          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Video</p>
                                          <button type="button" onClick={() => editFeedbackInputRef.current?.click()} className="text-xs text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-white transition-colors">
                                            {feedbackItem.feedback_video || editingFeedbackVideoFile ? 'Replace video' : 'Add video'}
                                          </button>
                                        </div>
                                        <input ref={editFeedbackInputRef} type="file" accept={videoFileAccept()} className="hidden" onChange={pickEditFeedbackFile} />
                                        {editingFeedbackPreviewUrl ? (
                                          <div className="rounded-xl overflow-hidden bg-black">
                                            <video src={editingFeedbackPreviewUrl} controls playsInline className="w-full aspect-video bg-black" />
                                          </div>
                                        ) : feedbackItem.feedback_video ? (
                                          <div className="rounded-xl overflow-hidden bg-black">
                                            <video src={videoUrl(feedbackItem.feedback_video)} controls playsInline className="w-full aspect-video bg-black" />
                                          </div>
                                        ) : null}
                                        {savingFeedbackId === feedbackItem.id && editingFeedbackVideoFile ? (
                                          <div className="space-y-2">
                                            <div className="flex items-center justify-between gap-3 text-xs text-gray-600">
                                              <span>Uploading replacement video…</span>
                                              <span>{editFeedbackUploadProgressPercent !== null ? `${editFeedbackUploadProgressPercent}%` : 'Working…'}</span>
                                            </div>
                                            <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
                                              <div className="h-full bg-gray-900 transition-all" style={{ width: `${Math.max(5, editFeedbackUploadProgressPercent || 0)}%` }} />
                                            </div>
                                          </div>
                                        ) : null}
                                      </div>
                                      <div className="flex justify-end gap-2">
                                        <button type="button" onClick={cancelEditingFeedback} className="text-sm text-gray-600 border border-gray-200 rounded-lg px-4 py-2 hover:bg-gray-50 transition-colors">
                                          Cancel
                                        </button>
                                        <button type="button" onClick={() => saveFeedbackEdit(feedbackItem.id)} disabled={savingFeedbackId === feedbackItem.id} className="text-sm font-medium text-white bg-gray-900 rounded-lg px-4 py-2 hover:bg-gray-800 disabled:opacity-50 transition-colors">
                                          {savingFeedbackId === feedbackItem.id ? 'Saving…' : 'Save'}
                                        </button>
                                      </div>
                                    </div>
                                  ) : null}
                                  {/* Video-only feedback: no text rendering */}
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
                            {['responded', 'viewed', 'needs_resubmission', 'declined_unrelated'].includes(requestItem.status) && requestItem.reviewer ? (
                              <button
                                type="button"
                                onClick={() => startFollowUp(requestItem)}
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
                            {['viewed', 'responded', 'needs_resubmission', 'declined_unrelated'].includes(requestItem.status) ? (
                              <button type="button" onClick={() => patchReviewRequestStatus(requestItem, 'resubmitted', 'Marked as retried')} className="text-xs text-gray-700 border border-gray-200 rounded-lg px-3 py-2 hover:bg-white transition-colors">
                                Mark retried
                              </button>
                            ) : null}
                            {['requested', 'opened'].includes(requestItem.status) ? (
                              <button type="button" onClick={() => patchReviewRequestStatus(requestItem, 'revoked', 'Feedback request turned off')} className="text-xs text-red-600 border border-red-200 rounded-lg px-3 py-2 hover:bg-red-50 transition-colors">
                                Turn off request
                              </button>
                            ) : null}
                            {['viewed', 'resubmitted', 'needs_resubmission', 'declined_unrelated', 'flagged'].includes(requestItem.status) ? (
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
                </div>
              ) : null}

              <details className="border-t border-gray-100 pt-4">
                <summary className="cursor-pointer list-none text-sm text-gray-500 hover:text-gray-900 transition-colors">More options</summary>
                <div className="flex flex-wrap gap-2 pt-4">
                  {canEdit ? (
                    <button type="button" onClick={startEditing} className="text-sm text-gray-700 border border-gray-200 rounded-lg px-4 py-2.5 hover:bg-gray-50 transition-colors">
                      Edit video
                    </button>
                  ) : null}
                  {canEdit ? (
                    <button type="button" onClick={deleteSession} disabled={deleting} className="text-sm text-red-600 border border-red-200 rounded-lg px-4 py-2.5 hover:bg-red-50 disabled:opacity-50 transition-colors">
                      {deleting ? 'Deleting…' : 'Delete video'}
                    </button>
                  ) : null}
                  <button type="button" onClick={refreshSession} disabled={refreshing} className="text-sm text-gray-700 border border-gray-200 rounded-lg px-4 py-2.5 hover:bg-gray-50 disabled:opacity-50 transition-colors">
                    {refreshing ? 'Refreshing…' : 'Refresh'}
                  </button>
                  {canEdit && session.video_file ? (
                    <a href={videoUrl(session.video_file)} download className="text-sm text-gray-700 border border-gray-200 rounded-lg px-4 py-2.5 hover:bg-gray-50 transition-colors">
                      Download original
                    </a>
                  ) : null}
                </div>
              </details>

              <div className="rounded-xl border border-gray-200 bg-white px-4 py-4 space-y-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Feedback</p>
                  <p className="text-xs text-gray-500 mt-1">Responses stay private to you and the people included in this review.</p>
                </div>

                {videoFeedback.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-200 px-4 py-4 text-center">
                    <p className="text-sm text-gray-600">No responses yet.</p>
                    <p className="text-xs text-gray-400 mt-1">Use a private review or a private link when you want a response.</p>
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
                              <p className="text-xs text-gray-400 mt-1">{new Date(item.created_at).toLocaleString(undefined, { hour12: undefined })}</p>
                          </div>
                          {typeof item.timestamp_seconds === 'number' ? (
                            <button type="button" onClick={() => jumpToTimestamp(item.timestamp_seconds)} className="text-xs text-blue-700 hover:text-blue-900 transition-colors">
                              @{fmtTimer(item.timestamp_seconds)}
                            </button>
                          ) : null}
                        </div>
                        {!item.review_request_id && item.authored_by_current_user ? (
                          <div className="flex items-center justify-end gap-2">
                            <button type="button" onClick={() => startEditingFeedback(item)} className="text-xs text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-white transition-colors">
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
                        {!item.review_request_id && editingFeedbackId === item.id ? (
                          <div className="rounded-xl border border-gray-200 bg-white p-3 space-y-3">
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={editingFeedbackTimestampSeconds}
                              onChange={(event) => setEditingFeedbackTimestampSeconds(event.target.value)}
                              placeholder="Timestamp seconds"
                              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
                            />
                            <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Video</p>
                                <button type="button" onClick={() => editFeedbackInputRef.current?.click()} className="text-xs text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-white transition-colors">
                                  {item.feedback_video || editingFeedbackVideoFile ? 'Replace video' : 'Add video'}
                                </button>
                              </div>
                              <input ref={editFeedbackInputRef} type="file" accept={videoFileAccept()} className="hidden" onChange={pickEditFeedbackFile} />
                              {editingFeedbackPreviewUrl ? (
                                <div className="rounded-xl overflow-hidden bg-black">
                                  <video src={editingFeedbackPreviewUrl} controls playsInline className="w-full aspect-video bg-black" />
                                </div>
                              ) : item.feedback_video ? (
                                <div className="rounded-xl overflow-hidden bg-black">
                                  <video src={videoUrl(item.feedback_video)} controls playsInline className="w-full aspect-video bg-black" />
                                </div>
                              ) : null}
                              {savingFeedbackId === item.id && editingFeedbackVideoFile ? (
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between gap-3 text-xs text-gray-600">
                                    <span>Uploading replacement video…</span>
                                    <span>{editFeedbackUploadProgressPercent !== null ? `${editFeedbackUploadProgressPercent}%` : 'Working…'}</span>
                                  </div>
                                  <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
                                    <div className="h-full bg-gray-900 transition-all" style={{ width: `${Math.max(5, editFeedbackUploadProgressPercent || 0)}%` }} />
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
                        {/* Video-only feedback: no text rendering */}
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
