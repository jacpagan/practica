import React, { useEffect, useMemo, useRef, useState } from 'react'
import { feedbackCategoryLabel, feedbackCategoryOptions, feedbackCategoryTone, fmtTimer, MAX_RECORDER_DURATION_SECONDS, MAX_VIDEO_UPLOAD_BYTES, reportClientEvent, sessionVideoSources, videoUrl, isLikelyVideoFile, videoFileAccept, uploadMultipartRequest } from '../utils'
import { useAuth } from '../auth'
import AuthForm from './AuthForm'
import VideoRecorder from './VideoRecorder'
import StatusChip from './StatusChip'
import ClosureBar from './ClosureBar'
import ResolutionBanner from './ResolutionBanner'

const reviewLinkLoadErrorState = ({ status, data }) => {
  const code = data?.code || ''
  if (code === 'review_link_expired' || status === 410) {
    return {
      title: 'Private link expired',
      message: 'This private feedback link expired. Ask the creator for a new link.',
    }
  }
  if (code === 'review_link_revoked' || status === 403) {
    return {
      title: 'Private link turned off',
      message: 'The creator has turned off this private feedback link. Ask for a new one if you still need access.',
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

function ReviewPage({ reviewToken = '', onContinueLoop = null }) {
  const { user, token: authToken } = useAuth()
  const videoRef = useRef(null)
  const inputRef = useRef(null)
  const editInputRef = useRef(null)
  const responseComposerRef = useRef(null)
  const autoOpenRecorderRef = useRef(false)
  const [session, setSession] = useState(null)
  const [link, setLink] = useState(null)
  const [reviewerInvite, setReviewerInvite] = useState(null)
  const [showInviteClaimConfirmation, setShowInviteClaimConfirmation] = useState(false)
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
  const [showPreciseTimestampControls, setShowPreciseTimestampControls] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [showResponseDetails, setShowResponseDetails] = useState(false)
  const [editingFeedbackId, setEditingFeedbackId] = useState(null)
  const [editingText, setEditingText] = useState('')
  const [editingCategory, setEditingCategory] = useState('')
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
  const playbackRefreshTriedRef = useRef(false)
  const [uploadProgressPercent, setUploadProgressPercent] = useState(null)
  const [uploadProgressLoaded, setUploadProgressLoaded] = useState(0)
  const [uploadProgressTotal, setUploadProgressTotal] = useState(0)
  const [editUploadProgressPercent, setEditUploadProgressPercent] = useState(null)
  const [closing, setClosing] = useState(false)
  const categoryOptions = useMemo(() => feedbackCategoryOptions(), [])
  const claimTelemetrySentRef = useRef(false)

  const createClientUploadId = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
    return `upload-${Date.now()}-${Math.random().toString(16).slice(2)}`
  }

  const token = reviewToken || window.location.pathname.replace(/^\/r\//, '')
  const claimCode = useMemo(() => {
    try {
      return (new URLSearchParams(window.location.search).get('claim') || '').trim().toUpperCase()
    } catch {
      return ''
    }
  }, [token])

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
    if (!token) return
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError('')
      setLoadError(null)
      try {
        const infoHeaders = authToken ? { Authorization: `Token ${authToken}` } : {}
        const reviewInfoUrl = `/api/review/${token}/${claimCode ? `?claim=${encodeURIComponent(claimCode)}` : ''}`
        let infoRes
        let attempt = 0
        while (true) {
          try {
            infoRes = await fetch(reviewInfoUrl, { headers: infoHeaders })
            if (infoRes.ok || infoRes.status < 500 || attempt >= 2) break
          } catch (e) {
            if (attempt >= 2) throw e
          }
          await new Promise((r) => setTimeout(r, 400 * Math.pow(2, attempt)))
          attempt += 1
        }
        const infoData = await infoRes.json().catch(() => ({}))
        if (!infoRes.ok) {
          throw { status: infoRes.status, data: infoData }
        }

        let feedbackData = []
        if (authToken) {
          let feedbackRes
          let fattempt = 0
          while (true) {
            try {
              feedbackRes = await fetch(`/api/review/${token}/feedback/`, { headers: { Authorization: `Token ${authToken}` } })
              if (feedbackRes.ok || feedbackRes.status < 500 || fattempt >= 2) break
            } catch (e) {
              if (fattempt >= 2) break
            }
            await new Promise((r) => setTimeout(r, 400 * Math.pow(2, fattempt)))
            fattempt += 1
          }
          feedbackData = await feedbackRes.json().catch(() => ({}))
          if (!feedbackRes.ok) {
            throw { status: feedbackRes.status, data: feedbackData }
          }
        }
        if (cancelled) return
        setSession(infoData.session)
        setLink(infoData.link)
        setReviewerInvite(infoData.reviewer_invite || null)
        setReviewRequest(infoData.feedback_request || infoData.review_request || null)
        setFeedback(authToken && Array.isArray(feedbackData) ? feedbackData : [])
        if (infoData?.claim_error) setError(infoData.claim_error)
        if (!claimTelemetrySentRef.current && claimCode) {
          if (infoData?.reviewer_invite?.status === 'claimed') {
            reportClientEvent('reviewer_invite_claimed', {
              review_token_present: Boolean(token),
              invite_id: infoData?.reviewer_invite?.id || null,
            })
            claimTelemetrySentRef.current = true
          } else if (infoData?.claim_error) {
            reportClientEvent('reviewer_invite_claim_failed', {
              review_token_present: Boolean(token),
              reason: String(infoData.claim_error || '').slice(0, 160),
            })
            claimTelemetrySentRef.current = true
          }
        }
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

  useEffect(() => {
    if (!user || reviewerInvite?.status !== 'claimed') {
      setShowInviteClaimConfirmation(false)
      return
    }
    const storageKey = `practica.reviewer_invite_claim_seen.v1:${reviewerInvite.id}`
    try {
      const alreadySeen = window.sessionStorage.getItem(storageKey)
      setShowInviteClaimConfirmation(!alreadySeen)
    } catch {
      setShowInviteClaimConfirmation(true)
    }
  }, [reviewerInvite?.id, reviewerInvite?.status, user])

  const dismissInviteClaimConfirmation = () => {
    if (reviewerInvite?.id) {
      try { window.sessionStorage.setItem(`practica.reviewer_invite_claim_seen.v1:${reviewerInvite.id}`, '1') } catch {}
    }
    setShowInviteClaimConfirmation(false)
  }

  const memberRole = reviewRequest?.current_member_role || reviewRequest?.current_user_role || ''
  const canRespondToRequest = !reviewRequest || memberRole === 'reviewer'
  const reviewerShouldRespond = memberRole === 'reviewer' && ['requested', 'opened', 'resubmitted'].includes(String(reviewRequest?.status || '').trim().toLowerCase())
  const hasCurrentUserFeedback = feedback.some((item) => item.authored_by_current_user)
  const isAdditionalResponseComposer = !(reviewerShouldRespond && !hasCurrentUserFeedback)

  const canCreatorClose = memberRole === 'owner' || memberRole === 'creator'
  const statusKey = String(reviewRequest?.status || '').trim().toLowerCase()
  const canShowClosure = Boolean(reviewRequest && canCreatorClose && ['responded', 'viewed', 'resubmitted', 'needs_resubmission', 'declined_unrelated', 'flagged'].includes(statusKey))
  const canShowRetry = Boolean(reviewRequest && canCreatorClose && ['responded', 'viewed', 'needs_resubmission', 'declined_unrelated'].includes(statusKey))
  const reviewerCanModerate = Boolean(reviewRequest && memberRole === 'reviewer' && ['requested', 'opened', 'resubmitted'].includes(statusKey))
  const reviewerCanQuickRespond = Boolean(reviewRequest && memberRole === 'reviewer' && link?.allow_video_feedback && canRespondToRequest)
  const showReviewerQuickActions = Boolean(reviewRequest && memberRole === 'reviewer' && (reviewerCanQuickRespond || reviewerCanModerate))
  const reviewerName = reviewRequest?.reviewer?.display_name || reviewRequest?.reviewer?.username || 'your reviewer'
  const reviewPageHeading = useMemo(() => {
    if (!reviewRequest) {
      return {
        title: 'Trusted feedback',
        subtitle: 'Watch the take and keep trusted feedback attached to one private thread.',
      }
    }
    if (memberRole === 'reviewer') {
      if (reviewerShouldRespond) {
        return {
          title: 'Respond to this take',
          subtitle: 'Watch the take, then record or upload one private response video.',
        }
      }
      if (hasCurrentUserFeedback) {
        return {
          title: 'Response sent',
          subtitle: 'Your feedback is already in the thread. You can update it or add another response.',
        }
      }
        return {
          title: 'Trusted feedback',
          subtitle: 'This thread stays private to the creator and assigned reviewer.',
        }
    }
    if (statusKey === 'responded') {
      return {
        title: 'Feedback is ready',
        subtitle: 'Watch the response, then decide whether to continue or close the thread.',
      }
    }
    if (statusKey === 'viewed') {
      return {
        title: 'Ready for the next take',
        subtitle: 'You have seen the feedback. Continue the loop when you are ready.',
      }
    }
    if (statusKey === 'needs_resubmission') {
      return {
        title: 'New take requested',
        subtitle: 'Your reviewer asked for a cleaner or more complete take.',
      }
    }
    if (statusKey === 'declined_unrelated') {
      return {
        title: 'Matching take needed',
        subtitle: 'This take did not match the requested thread.',
      }
    }
    if (statusKey === 'flagged') {
      return {
        title: 'Request flagged',
        subtitle: 'This request is out of the normal reviewer inbox for now.',
      }
    }
    if (statusKey === 'resubmitted') {
      return {
        title: 'Loop continuing',
        subtitle: 'Record the next take from your library when you are ready.',
      }
    }
    return {
      title: 'Private review',
      subtitle: 'Keep this feedback thread moving one take at a time.',
    }
  }, [hasCurrentUserFeedback, memberRole, reviewRequest, reviewerShouldRespond, statusKey])
  const statusBanner = useMemo(() => {
    if (!reviewRequest) return null
    if (memberRole === 'reviewer' && reviewerShouldRespond) {
      return {
        tone: 'border-blue-200 bg-blue-50',
        title: 'Your response is next',
        message: 'Watch the take, then send one response video. Use reviewer actions only if the creator needs a different submission.',
      }
    }
    if (memberRole === 'reviewer' && hasCurrentUserFeedback) {
      return {
        tone: 'border-emerald-200 bg-emerald-50',
        title: 'Response delivered',
        message: 'Your feedback is in the thread. Reopen it anytime to edit, add another response, or follow the next take.',
      }
    }
    if (canCreatorClose && statusKey === 'responded') {
      return {
        tone: 'border-emerald-200 bg-emerald-50',
        title: 'Feedback is ready',
        message: `Open the response from ${reviewerName}, then continue the loop or close the thread when you are done.`,
      }
    }
    if (canCreatorClose && statusKey === 'viewed') {
      return {
        tone: 'border-violet-200 bg-violet-50',
        title: 'Ready for the next take',
        message: 'You have seen the feedback. Record the next take from your library when you are ready.',
      }
    }
    if (canCreatorClose && statusKey === 'needs_resubmission') {
      return {
        tone: 'border-orange-200 bg-orange-50',
        title: 'New take requested',
        message: 'Your reviewer asked for a cleaner or more complete take. Continue the loop only when you are ready to resend.',
      }
    }
    if (canCreatorClose && statusKey === 'declined_unrelated') {
      return {
        tone: 'border-rose-200 bg-rose-50',
        title: 'Matching take needed',
        message: 'Your reviewer said this take does not match the request. Continue only if you want to send the right take.',
      }
    }
    if (canCreatorClose && statusKey === 'flagged') {
      return {
        tone: 'border-red-200 bg-red-50',
        title: 'Request flagged',
        message: 'This request is removed from the normal reviewer inbox for now. Review the thread note before continuing.',
      }
    }
    if (canCreatorClose && statusKey === 'resubmitted') {
      return {
        tone: 'border-fuchsia-200 bg-fuchsia-50',
        title: 'Loop continuing',
        message: 'This thread is marked for continuation. Record the next take from your library when you are ready.',
      }
    }
    return null
  }, [canCreatorClose, hasCurrentUserFeedback, memberRole, reviewRequest, reviewerName, reviewerShouldRespond, statusKey])
  const closureBarRetryLabel = statusKey === 'needs_resubmission'
    ? 'Record new take'
    : statusKey === 'declined_unrelated'
      ? 'Record matching take'
      : 'Record next take'
  const closureBarCloseLabel = statusKey === 'resubmitted'
    ? 'Mark loop complete'
    : 'Close thread'
  const closureBarPrimaryAction = canShowRetry ? 'retry' : 'close'
  const closureBarSubtleText = statusKey === 'responded'
    ? 'Feedback is ready. Record your next take now, or close this thread.'
    : statusKey === 'viewed'
      ? 'You have seen the feedback. Record your next take, or close this thread.'
      : statusKey === 'needs_resubmission'
        ? 'Your reviewer asked for a new take.'
        : statusKey === 'declined_unrelated'
          ? 'This take did not match the requested thread.'
          : statusKey === 'flagged'
            ? 'This request is flagged and removed from the normal reviewer inbox.'
            : statusKey === 'resubmitted'
              ? 'Loop marked for continuation. Record the next take from your library when ready.'
              : 'Ready to close this thread'

  const openResponseComposer = useCallback(() => {
    try { responseComposerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) } catch {}
  }, [])

  const reasonLabel = (value = '') => {
    const normalized = String(value || '').trim().toLowerCase()
    if (!normalized) return ''
    if (normalized === 'needs_new_take') return 'Needs new take'
    if (normalized === 'unrelated_video') return 'Unrelated take'
    if (normalized === 'unsafe_content') return 'Unsafe content'
    if (normalized === 'spam') return 'Spam'
    if (normalized === 'other') return 'Other'
    return normalized.replace(/_/g, ' ')
  }

  const patchReviewRequestStatus = async (nextStatus, extra = {}) => {
    if (!authToken || !reviewRequest?.id) return
    const res = await fetch(`/api/review-requests/${reviewRequest.id}/`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Token ${authToken}` },
      body: JSON.stringify({ status: nextStatus, ...extra }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data?.error || 'Could not update request')
    setReviewRequest((current) => ({ ...(current || {}), ...data }))
    return data
  }

  const continueLoopDraft = useMemo(() => {
    if (!reviewRequest?.id || !reviewRequest?.reviewer?.id) return null
    return {
      parent_request_id: reviewRequest.id,
      reviewer: reviewRequest.reviewer,
      instrument: reviewRequest.instrument || 'drums',
      goal: reviewRequest.goal || '',
      exercise_or_song: reviewRequest.exercise_or_song || '',
      notes: reviewRequest.notes || '',
      practiceSeries: session?.practice_series || '',
    }
  }, [reviewRequest, session?.practice_series])

  const handleCloseRequest = async () => {
    if (!canShowClosure || closing) return
    setClosing(true)
    try { await patchReviewRequestStatus('closed') } catch {}
    setClosing(false)
  }

  const handleRetryRequest = async () => {
    if (!canShowRetry || closing) return
    setClosing(true)
    try {
      const updated = await patchReviewRequestStatus('resubmitted')
      const draft = continueLoopDraft || {
        parent_request_id: updated?.id,
        reviewer: updated?.reviewer,
        instrument: updated?.instrument || 'drums',
        goal: updated?.goal || '',
        exercise_or_song: updated?.exercise_or_song || '',
        notes: updated?.notes || '',
        practiceSeries: session?.practice_series || '',
      }
      onContinueLoop?.(draft)
    } catch {}
    setClosing(false)
  }

  const handleReviewerLoopState = async (nextStatus, statusReason) => {
    if (!reviewerCanModerate || closing) return
    const statusNote = typeof window !== 'undefined'
      ? window.prompt('Optional note for the creator', '') || ''
      : ''
    setClosing(true)
    try {
      await patchReviewRequestStatus(nextStatus, { status_reason: statusReason, status_note: statusNote })
    } catch {}
    setClosing(false)
  }

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

  const clampTimestamp = (value) => {
    const normalizedValue = Math.max(0, Math.round(Number(value) || 0))
    if (durationSeconds > 0) return Math.min(normalizedValue, durationSeconds)
    return normalizedValue
  }

  const nudgeTimestamp = (deltaSeconds) => {
    setSelectedTimestampSeconds((current) => {
      const base = typeof current === 'number' ? current : Math.round(currentTime || 0)
      return clampTimestamp(base + deltaSeconds)
    })
  }

  const clearTimestamp = () => {
    setSelectedTimestampSeconds(null)
    setShowPreciseTimestampControls(false)
  }

  const handlePlaybackError = async () => {
    if (playbackSourceIndex < playbackSources.length - 1) {
      setPlaybackSourceIndex((current) => current + 1)
      return
    }
    // Try one refresh of review info to renew any signed URLs, then reattempt first source
    if (!playbackRefreshTriedRef.current) {
      playbackRefreshTriedRef.current = true
      try {
        const infoHeaders = authToken ? { Authorization: `Token ${authToken}` } : {}
        const infoRes = await fetch(`/api/review/${token}/`, { headers: infoHeaders })
        const infoData = await infoRes.json().catch(() => ({}))
        if (infoRes.ok && infoData?.session) {
          setSession(infoData.session)
          setLink(infoData.link)
          setPlaybackSourceIndex(0)
          setPlaybackFailed(false)
          return
        }
      } catch {}
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
    // Keep UX minimal; avoid undo toast here
  }

  const beginEditingFeedback = (item) => {
    setEditingFeedbackId(item.id)
    setEditingText(item.text || '')
    setEditingCategory(item.feedback_category || '')
    setEditingTimestampSeconds(typeof item.timestamp_seconds === 'number' ? String(item.timestamp_seconds) : '')
    setEditingVideoFile(null)
    replaceEditPreviewUrl('')
    setError('')
  }

  const cancelEditingFeedback = () => {
    setEditingFeedbackId(null)
    setEditingText('')
    setEditingCategory('')
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
      payload.append('text', editingText)
      payload.append('feedback_category', editingCategory)
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
      if (!isAdditionalResponseComposer) {
        formData.append('text', responseNotes.trim())
        formData.append('feedback_category', responseCategory)
      }
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
      const isFirstResponse = !hasCurrentUserFeedback
      setFeedback((current) => [...current, data].sort((left, right) => {
        const leftTs = typeof left.timestamp_seconds === 'number' ? left.timestamp_seconds : Number.MAX_SAFE_INTEGER
        const rightTs = typeof right.timestamp_seconds === 'number' ? right.timestamp_seconds : Number.MAX_SAFE_INTEGER
        if (leftTs !== rightTs) return leftTs - rightTs
        return new Date(left.created_at) - new Date(right.created_at)
      }))
      if (isFirstResponse) {
        reportClientEvent('reviewer_first_response_submitted', {
          review_request_id: reviewRequest?.id || null,
          via_claim_link: Boolean(claimCode),
          category: responseCategory || '',
          has_note: Boolean(responseNotes.trim()),
        })
      }
      setResponseFile(null)
      submitUploadIdRef.current = ''
      setUploadProgressLoaded(0)
      setUploadProgressTotal(0)
      replaceOwnedPreviewUrl('')
      setResponseNotes('')
      setResponseCategory('')
      setSelectedTimestampSeconds(null)
    } catch (submitError) {
      setError(submitError.message || 'Could not send feedback.')
    } finally {
      setSubmitting(false)
      setUploadProgressPercent(null)
    }
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

  if (!user) {
    const reviewerName = reviewRequest?.reviewer?.display_name || reviewRequest?.reviewer?.username || ''
    const creatorName = reviewRequest?.creator?.display_name || reviewRequest?.member?.display_name || reviewRequest?.owner?.display_name || reviewRequest?.creator?.username || reviewRequest?.member?.username || reviewRequest?.owner?.username || reviewRequest?.student?.display_name || reviewRequest?.student?.username || ''
    const authTitle = claimCode ? 'You were invited to review privately' : 'Sign in to continue'
    const authSubtitle = claimCode
      ? 'Create your account once or log in to join this private feedback thread as a trusted reviewer.'
      : 'This trusted feedback thread stays private and opens right where you left off.'

    return (
      <div className="min-h-screen bg-white px-4 py-6 sm:px-6">
        <main className="max-w-3xl mx-auto grid gap-6 lg:grid-cols-[1.1fr_0.9fr] items-start">
          <div className="space-y-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Private review</p>
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight mt-2">{session?.title || 'Review this take'}</h1>
              <p className="text-sm text-gray-600 mt-2">
                {reviewerName
                  ? `${reviewerName} has been invited into a private feedback thread in Practica.`
                  : 'You have been invited into a private feedback thread in Practica.'}
              </p>
              {creatorName ? <p className="text-xs text-gray-500 mt-2">Shared privately by {creatorName}.</p> : null}
          {reviewRequest?.goal ? <p className="text-xs text-gray-500 mt-1">Focus: {reviewRequest.goal}</p> : null}
          {reviewRequest?.status_reason ? <p className="text-xs text-gray-500 mt-1">Reason: {reasonLabel(reviewRequest.status_reason)}</p> : null}
          {reviewRequest?.status_note ? <p className="text-xs text-gray-500 mt-1">Note: {reviewRequest.status_note}</p> : null}
          {link?.expires_at ? <p className="text-xs text-gray-500 mt-1">Private access • sign-in required • expires {new Date(link.expires_at).toLocaleString(undefined, { hour12: undefined })}</p> : null}
        </div>

            <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
              <div className="aspect-video bg-black">
                <div className="w-full h-full flex items-center justify-center px-6 text-center text-sm text-white/70">
                  Sign in to watch the take and leave your response.
                </div>
              </div>
              <div className="p-4 space-y-2">
                {session?.description ? <p className="text-sm text-gray-600">{session.description}</p> : null}
                <p className="text-sm text-gray-800">Everything here stays private to the people included in this review.</p>
              </div>
            </div>
          </div>

          <AuthForm
            initialMode={claimCode ? 'register' : 'login'}
            prefilledInviteCode={claimCode}
            inviteCodeLocked={Boolean(claimCode)}
            inviteContext={claimCode ? 'reviewer' : ''}
            contextTitle={authTitle}
            contextSubtitle={authSubtitle}
            embedded
          />
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white px-4 py-6 sm:px-6">
      <main className="max-w-3xl mx-auto space-y-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Private review</p>
          <div className="flex items-start justify-between gap-3 mt-2">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">{reviewPageHeading.title}</h1>
              <p className="text-sm text-gray-600 mt-1">{reviewPageHeading.subtitle}</p>
            </div>
            {reviewRequest ? <StatusChip status={reviewRequest.status} resolution={reviewRequest.resolution} /> : null}
          </div>
          <p className="text-xs text-gray-500 mt-2">Signed in as {user.display_name || user.username}.</p>
          {link?.expires_at ? <p className="text-xs text-gray-500 mt-1">Private access • sign-in required • expires {new Date(link.expires_at).toLocaleString(undefined, { hour12: undefined })}</p> : null}
        </div>

        {showInviteClaimConfirmation ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-emerald-950">{reviewerInvite?.resolution?.summary || 'You’re in'}</p>
                <p className="text-sm text-emerald-900 mt-1">{reviewerInvite?.resolution?.detail || 'You can review this take privately now, and this learner can ask you again later without sending a brand-new invite.'}</p>
              </div>
              <button type="button" onClick={dismissInviteClaimConfirmation} className="text-xs text-emerald-800 hover:text-emerald-950 transition-colors">
                Dismiss
              </button>
            </div>
          </div>
        ) : null}

        {reviewRequest?.resolution ? (
          <ResolutionBanner
            resolution={reviewRequest.resolution}
            statusReason={reviewRequest?.status_reason ? reasonLabel(reviewRequest.status_reason) : ''}
            statusNote={reviewRequest?.status_note || ''}
          />
        ) : statusBanner ? (
          <div className={`rounded-xl border px-4 py-3 ${statusBanner.tone}`}>
            <p className="text-sm font-semibold text-gray-900">{statusBanner.title}</p>
            <p className="text-sm text-gray-700 mt-1">{statusBanner.message}</p>
            {reviewRequest?.status_reason ? <p className="text-xs text-gray-600 mt-2">Reason: {reasonLabel(reviewRequest.status_reason)}</p> : null}
            {reviewRequest?.status_note ? <p className="text-xs text-gray-600 mt-1">Note: {reviewRequest.status_note}</p> : null}
          </div>
        ) : null}

        {showReviewerQuickActions ? (
          <div className="rounded-xl border border-gray-200 bg-white px-3 py-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Reviewer actions</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={openResponseComposer}
                  disabled={!reviewerCanQuickRespond}
                  className="text-xs text-gray-700 border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Respond
                </button>
                <button
                  type="button"
                  onClick={() => handleReviewerLoopState('needs_resubmission', 'needs_new_take')}
                  disabled={!reviewerCanModerate || closing}
                  className="text-xs text-gray-700 border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Request resubmission
                </button>
                <button
                  type="button"
                  onClick={() => handleReviewerLoopState('declined_unrelated', 'unrelated_video')}
                  disabled={!reviewerCanModerate || closing}
                  className="text-xs text-rose-700 border border-rose-200 rounded-lg px-3 py-2 hover:bg-rose-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Mark unrelated
                </button>
              </div>
            </div>
          </div>
        ) : null}

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

        {link?.allow_video_feedback && canRespondToRequest && (!reviewRequest || reviewerShouldRespond || hasCurrentUserFeedback) ? (
          <div ref={responseComposerRef} className="rounded-xl border border-gray-200 p-3 space-y-4">
            <div>
              <p className="text-sm font-semibold text-gray-900">{reviewerShouldRespond && !hasCurrentUserFeedback ? 'Add your response' : 'Add another response'}</p>
              <p className="text-xs text-gray-500 mt-1">Record here or upload a video you already have.</p>
            </div>

            {memberRole === 'reviewer' && !isAdditionalResponseComposer ? (
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

            {!isAdditionalResponseComposer ? (
              <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div>
                <label className="block text-xs font-medium uppercase tracking-wide text-gray-500">Note</label>
                <textarea
                  value={responseNotes}
                  onChange={(event) => setResponseNotes(event.target.value)}
                  rows={3}
                  placeholder="Optional context for the learner"
                  className="mt-2 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 resize-none bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium uppercase tracking-wide text-gray-500">Category</label>
                <select
                  value={responseCategory}
                  onChange={(event) => setResponseCategory(event.target.value)}
                  className="mt-2 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 bg-white"
                >
                  {categoryOptions.map((option) => (
                    <option key={option.value || 'uncategorized'} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              </div>
            ) : null}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button type="button" onClick={() => setShowRecorder(true)} className="rounded-2xl bg-gray-900 text-white px-4 py-3 text-sm font-medium hover:bg-gray-800 transition-colors">
                {responseFile ? 'Record again' : 'Record response'}
              </button>
              <button type="button" onClick={() => inputRef.current?.click()} className="rounded-2xl border border-gray-200 bg-white text-gray-900 px-4 py-3 text-sm font-medium hover:bg-gray-50 transition-colors">
                Upload response
              </button>
              <input ref={inputRef} type="file" accept={videoFileAccept()} className="hidden" onChange={pickFile} />
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 space-y-1">
              <p className="text-xs text-gray-500">Recorder: {Math.round(MAX_RECORDER_DURATION_SECONDS / 60)} min • Upload: {Math.round(MAX_VIDEO_UPLOAD_BYTES / (1024 * 1024 * 1024))}GB</p>
            </div>

            {showRecorder ? (
              <VideoRecorder
                onRecorded={handleRecorded}
                onCancel={() => setShowRecorder(false)}
                maxDuration={MAX_RECORDER_DURATION_SECONDS}
                autoUseOnStop={true}
                minAutoUseSeconds={2}
              />
            ) : null}

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

            <form onSubmit={submit} className="space-y-2">
              {/* Lean timestamp controls (removed Details wrapper) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Timestamp</p>
                    <p className="text-sm text-gray-700 mt-1">{typeof selectedTimestampSeconds === 'number' ? `Attach at ${fmtTimer(selectedTimestampSeconds)}` : 'No timestamp attached'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={useCurrentVideoTime} className="text-xs text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-white transition-colors">
                      Use current moment
                    </button>
                    <button type="button" onClick={clearTimestamp} className="text-xs text-gray-500 hover:text-gray-700 transition-colors">
                      Clear
                    </button>
                  </div>
                </div>

                {typeof selectedTimestampSeconds === 'number' ? (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {[-5, -1, 1, 5].map((delta) => (
                        <button
                          key={delta}
                          type="button"
                          onClick={() => nudgeTimestamp(delta)}
                          className="text-xs text-gray-700 border border-gray-200 rounded-lg px-3 py-2 hover:bg-white transition-colors"
                        >
                          {delta > 0 ? `+${delta}s` : `${delta}s`}
                        </button>
                      ))}
                    </div>

                    {durationSeconds > 0 ? (
                      <div>
                        <button
                          type="button"
                          onClick={() => setShowPreciseTimestampControls((current) => !current)}
                          className="text-xs text-gray-600 hover:text-gray-900 transition-colors"
                        >
                          {showPreciseTimestampControls ? 'Hide precise adjustment' : 'Adjust precisely'}
                        </button>

                        {showPreciseTimestampControls ? (
                          <div className="mt-3">
                            <input
                              type="range"
                              min="0"
                              max={durationSeconds}
                              step="1"
                              value={selectedTimestampSeconds}
                              onChange={(event) => setSelectedTimestampSeconds(clampTimestamp(event.target.value))}
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
                    ) : null}
                  </div>
                ) : null}
              </div>

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
                  {submitting ? 'Sending…' : 'Send response'}
                </button>
              </div>
            </form>
          </div>
        ) : link?.allow_video_feedback ? (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 space-y-2">
            <p className="text-sm font-semibold text-blue-900">This thread is ready for your reviewer</p>
            <p className="text-sm text-blue-800">{reviewRequest?.reviewer?.display_name || reviewRequest?.reviewer?.username || 'Your reviewer'} can respond here privately. When you are ready to continue, record a new take from your library and send the next request.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 space-y-2">
            <p className="text-sm font-semibold text-blue-900">This review is view-only right now</p>
            <p className="text-sm text-blue-800">You can still watch the take here, but new video responses are currently turned off.</p>
          </div>
        )}

        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Responses</p>
              {feedback.length === 0 ? (
                <p className="text-sm text-gray-500">No responses yet.</p>
              ) : (
                <div className="space-y-3">
                  {feedback.map((item) => (
                    <div key={item.id} className="rounded-xl bg-gray-50 px-3 py-3 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-gray-900">{item.author_display_name || 'Member'}</p>
                          </div>
                          <p className="text-xs text-gray-400 mt-1">{new Date(item.created_at).toLocaleString(undefined, { hour12: undefined })}</p>
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
                  {item.feedback_category ? (
                    <div>
                      <span className={`text-[11px] uppercase tracking-wide px-2 py-1 rounded-full ${feedbackCategoryTone(item.feedback_category)}`}>
                        {feedbackCategoryLabel(item.feedback_category)}
                      </span>
                    </div>
                  ) : null}
                  {item.text ? <p className="text-sm text-gray-700 whitespace-pre-wrap">{item.text}</p> : null}
                  {editingFeedbackId === item.id ? (
                    <div className="rounded-xl border border-gray-200 bg-white p-3 space-y-3">
                      <textarea
                        value={editingText}
                        onChange={(event) => setEditingText(event.target.value)}
                        rows={3}
                        placeholder="Optional note"
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 resize-none"
                      />
                      <select
                        value={editingCategory}
                        onChange={(event) => setEditingCategory(event.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 bg-white"
                      >
                        {categoryOptions.map((option) => (
                          <option key={option.value || 'uncategorized'} value={option.value}>{option.label}</option>
                        ))}
                      </select>
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
      {canShowClosure ? (
        <ClosureBar
          canClose
          canRetry={canShowRetry}
          onClose={handleCloseRequest}
          onRetry={handleRetryRequest}
          subtleText={closureBarSubtleText}
          retryLabel={closureBarRetryLabel}
          closeLabel={closureBarCloseLabel}
          primaryAction={closureBarPrimaryAction}
        />
      ) : null}
    </div>
  )
}

export default ReviewPage
