import { useEffect, useMemo, useState } from 'react'

import { reportClientEvent } from '../utils'

const LESSON_GOAL_PRESETS = [
  'Today\'s drum lesson follow-up',
  'Timing and consistency',
  'Groove and feel',
  'Technique and motion',
]

const normalizeReviewerText = (value = '') => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

export default function useReviewRequestFlow({
  session,
  token,
  authHeaders,
  canEdit,
  canCreateShareLink,
  justUploaded,
  initialReviewRequestDraft = null,
  onReviewRequestDraftCleared,
  onOpenReviewRequest,
  onRecordAnother,
  toast,
  confirm,
  loopDetailsRef,
}) {
  const [activeReviewLink, setActiveReviewLink] = useState(session?.active_review_link || null)
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
  const [showInviteManager, setShowInviteManager] = useState(false)
  const [inviteManagerLoading, setInviteManagerLoading] = useState(false)
  const [activeInviteCodes, setActiveInviteCodes] = useState([])
  const [latestInviteUrl, setLatestInviteUrl] = useState('')
  const [sharing, setSharing] = useState(false)
  const [pendingShareIntent, setPendingShareIntent] = useState('')
  const [showRequestDetails, setShowRequestDetails] = useState(false)
  const [showRequestHistory, setShowRequestHistory] = useState(false)
  const [requestInstrument, setRequestInstrument] = useState('drums')
  const [requestGoal, setRequestGoal] = useState('')
  const [requestExerciseOrSong, setRequestExerciseOrSong] = useState('')
  const [requestNotes, setRequestNotes] = useState('')

  useEffect(() => {
    setActiveReviewLink(session?.active_review_link || null)
    setReviewRequests([])
    setRequestsLoading(false)
    setShowRequestComposer(false)
    setCreatingRequest(false)
    setShowLoopDetails(false)
    setReviewerQuery('')
    setDesignatedReviewers([])
    setReviewerResults([])
    setReviewerSearchLoading(false)
    setSelectedReviewer(null)
    setRecentReviewers([])
    setRecentReviewersLoading(false)
    setShowInviteManager(false)
    setInviteManagerLoading(false)
    setActiveInviteCodes([])
    setLatestInviteUrl('')
    setSharing(false)
    setPendingShareIntent('')
    setShowRequestDetails(false)
    setShowRequestHistory(false)
    setRequestInstrument('drums')
    setRequestGoal('')
    setRequestExerciseOrSong('')
    setRequestNotes('')
  }, [session?.id])

  useEffect(() => {
    if (!token || !session?.id || !canEdit) return undefined
    setRequestsLoading(true)
    let cancelled = false

    const loadReviewRequests = async () => {
      try {
        const res = await fetch(`/api/review-requests/?session_id=${session.id}&role=student`, { headers: authHeaders })
        if (!res.ok) throw new Error('review-requests')
        const data = await res.json()
        if (!cancelled) {
          setReviewRequests(Array.isArray(data) ? data : data.results || [])
        }
      } catch {
        if (!cancelled) setReviewRequests([])
      } finally {
        if (!cancelled) setRequestsLoading(false)
      }
    }

    loadReviewRequests()
    return () => {
      cancelled = true
    }
  }, [authHeaders, canEdit, session?.id, token])

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
    return () => {
      cancelled = true
    }
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
    setReviewerResults(results)
    setReviewerSearchLoading(false)
    return undefined
  }, [canEdit, designatedReviewers, reviewerQuery, token])

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

  const defaultRequestGoal = useMemo(() => {
    if (session?.practice_series) return `${session.practice_series} follow-up`
    return LESSON_GOAL_PRESETS[0]
  }, [session?.practice_series])

  useEffect(() => {
    if (!showRequestComposer) return
    if (String(requestGoal || '').trim()) return
    setRequestGoal(defaultRequestGoal)
  }, [defaultRequestGoal, requestGoal, showRequestComposer])

  const justUploadedWithoutRequest = justUploaded && reviewRequests.length === 0

  useEffect(() => {
    if (!justUploadedWithoutRequest || !showLoopDetails || !showRequestComposer) return
    const timer = window.setTimeout(() => {
      loopDetailsRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
    }, 80)
    return () => window.clearTimeout(timer)
  }, [justUploadedWithoutRequest, showLoopDetails, showRequestComposer, loopDetailsRef])

  useEffect(() => {
    if (!canCreateShareLink || !pendingShareIntent) return

    const activatePendingIntent = async () => {
      const intent = pendingShareIntent
      if (intent === 'ask_for_feedback' && recentReviewersLoading) return
      setPendingShareIntent('')
      if (intent === 'ask_for_feedback') {
        if (designatedReviewers.length > 0) {
          setShowLoopDetails(true)
          setShowRequestComposer(true)
          try { loopDetailsRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }) } catch {}
          toast.success('Playback is ready. Choose who should review this take.')
          return
        }
        await inviteReviewerFromComposer({ skipReadyIntent: true, sourceAction: 'ask_for_feedback' })
        return
      }
      if (intent === 'request_review') {
        setShowLoopDetails(true)
        setShowRequestComposer(true)
        try { loopDetailsRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }) } catch {}
        toast.success('Playback is ready. You can request review now.')
        return
      }
      if (intent === 'invite_reviewer') {
        await inviteReviewerFromComposer({ skipReadyIntent: true })
      }
    }

    activatePendingIntent()
  }, [canCreateShareLink, designatedReviewers.length, pendingShareIntent, recentReviewersLoading])

  const sortedReviewRequests = useMemo(
    () => [...reviewRequests].sort((left, right) => new Date(right.created_at) - new Date(left.created_at)),
    [reviewRequests],
  )
  const currentLoopRequest = sortedReviewRequests.find((item) => !['closed', 'revoked'].includes(item.status)) || sortedReviewRequests[0] || null
  const currentLoopStatus = String(currentLoopRequest?.status || '').trim().toLowerCase()
  const waitingOnReviewer = ['requested', 'opened'].includes(currentLoopStatus)
  const feedbackReadyToReview = currentLoopStatus === 'responded'
  const readyForFollowUp = ['viewed', 'needs_resubmission', 'declined_unrelated'].includes(currentLoopStatus)
  const currentLoopReviewerName = currentLoopRequest?.reviewer?.display_name || currentLoopRequest?.reviewer?.username || 'your reviewer'
  const pendingShareIntentLabel = pendingShareIntent === 'ask_for_feedback'
    ? 'feedback request'
    : pendingShareIntent === 'request_review'
      ? 'review request'
      : pendingShareIntent === 'invite_reviewer'
        ? 'reviewer invite'
        : ''
  const currentLoopSummary = useMemo(() => {
    if (!currentLoopRequest) return null
    if (currentLoopStatus === 'requested') {
      return {
        tone: 'border-amber-200 bg-amber-50',
        title: `Waiting on ${currentLoopReviewerName}`,
        message: 'Open the thread or turn it off.',
      }
    }
    if (currentLoopStatus === 'opened') {
      return {
        tone: 'border-blue-200 bg-blue-50',
        title: `${currentLoopReviewerName} opened this request`,
        message: 'Open the thread to continue.',
      }
    }
    if (currentLoopStatus === 'responded') {
      return {
        tone: 'border-emerald-200 bg-emerald-50',
        title: 'Feedback is ready',
        message: 'Open the thread to review it.',
      }
    }
    if (currentLoopStatus === 'viewed') {
      return {
        tone: 'border-violet-200 bg-violet-50',
        title: 'Ready for the next take',
        message: 'Record the next take or reopen the thread.',
      }
    }
    if (currentLoopStatus === 'needs_resubmission') {
      return {
        tone: 'border-orange-200 bg-orange-50',
        title: 'New take requested',
        message: 'Record a new take to continue.',
      }
    }
    if (currentLoopStatus === 'declined_unrelated') {
      return {
        tone: 'border-rose-200 bg-rose-50',
        title: 'Matching take needed',
        message: 'Record the right take to continue.',
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
  const selectedReviewerName = selectedReviewer?.display_name || selectedReviewer?.username || ''

  const updateRequestInState = (nextRequest) => {
    setReviewRequests((current) => current.map((item) => (item.id === nextRequest.id ? nextRequest : item)))
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

  const loadInviteCodes = async () => {
    if (!token) return
    setInviteManagerLoading(true)
    try {
      const query = session?.id ? `?session_id=${session.id}` : ''
      const res = await fetch(`/api/reviewer-invites/${query}`, { headers: authHeaders })
      const data = await res.json().catch(() => ([]))
      if (!res.ok) throw new Error('Could not load invites')
      const activeCodes = Array.isArray(data)
        ? data.filter((item) => String(item?.status || '').trim().toLowerCase() === 'pending')
        : []
      setActiveInviteCodes(activeCodes)
    } catch (error) {
      toast.error(error?.message || 'Could not load invites')
    } finally {
      setInviteManagerLoading(false)
    }
  }

  const copyInviteUrl = async (inviteUrl, { successMessage = 'Invite link copied' } = {}) => {
    const normalizedUrl = String(inviteUrl || '').trim()
    if (!normalizedUrl) return false
    try {
      await navigator.clipboard.writeText(normalizedUrl)
      toast.success(successMessage)
      return true
    } catch {
      toast.error('Could not copy automatically. You can copy the link below.')
      return false
    }
  }

  const createBundledShareLink = async ({ intent = 'lightweight_review', label = `Access ${session.title}` } = {}) => {
    if (!token || !session?.id) return
    const inviteRes = await fetch('/api/reviewer-invites/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({ session_id: session.id, label, intent }),
    })
    const inviteData = await inviteRes.json().catch(() => ({}))
    if (!inviteRes.ok) {
      throw new Error(inviteData?.session_id?.[0] || inviteData?.error || 'Could not create reviewer invite')
    }
    if (inviteData?.review_link) setActiveReviewLink(inviteData.review_link)
    try {
      if (showInviteManager) await loadInviteCodes()
    } catch {}
    return inviteData.invite_url || ''
  }

  const turnOffInviteCode = async (inviteId) => {
    if (!token || !inviteId) return
    try {
      const res = await fetch(`/api/reviewer-invites/${inviteId}/`, {
        method: 'DELETE',
        headers: authHeaders,
      })
      if (!res.ok) throw new Error('Could not turn off invite')
      setActiveInviteCodes((current) => current.filter((item) => item.id !== inviteId))
      toast.success('Invite turned off')
    } catch (error) {
      toast.error(error?.message || 'Could not turn off invite')
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

    setSharing(true)
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
      setSharing(false)
    }
  }

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

  const markReviewRequestViewed = async (requestItem, { silent = false } = {}) => {
    if (!token || !requestItem?.id) return null
    try {
      const res = await fetch(`/api/review-requests/${requestItem.id}/mark-viewed/`, {
        method: 'POST',
        headers: authHeaders,
      })
      if (!res.ok) throw new Error('mark-viewed')
      const data = await res.json()
      updateRequestInState(data)
      if (!silent) toast.success('Marked as viewed')
      return data
    } catch {
      if (!silent) toast.error('Could not update request status')
      return null
    }
  }

  const openReviewRequestThread = async (requestItem) => {
    if (!requestItem) return
    const statusValue = String(requestItem.status || '').trim().toLowerCase()
    let nextRequest = requestItem
    if (statusValue === 'responded') {
      nextRequest = await markReviewRequestViewed(requestItem, { silent: true }) || requestItem
    }
    onOpenReviewRequest?.(nextRequest)
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

  const inviteReviewerFromComposer = async ({ skipReadyIntent = false, sourceAction = 'invite_reviewer' } = {}) => {
    if (!token || !session?.id) return
    if (!canCreateShareLink && !skipReadyIntent) {
      setPendingShareIntent('invite_reviewer')
      setShowLoopDetails(true)
      reportClientEvent('share_blocked_session_not_ready', {
        action: sourceAction,
        session_id: session.id,
        processing_status: session?.processing_status || '',
      })
      toast.success('We will create the reviewer invite as soon as playback is ready.')
      return
    }
    setSharing(true)
    try {
      const inviteLabel = String(reviewerQuery || '').trim() || `Review ${session.title}`
      const bundledUrl = await createBundledShareLink({
        intent: 'roster_join',
        label: inviteLabel,
      })
      setLatestInviteUrl(bundledUrl)
      await copyInviteUrl(bundledUrl, { successMessage: 'Invite link copied. Send it to the person you want feedback from.' })
      reportClientEvent('reviewer_invite_created', {
        action: sourceAction,
        session_id: session.id,
      })
      setShowInviteManager(true)
      await loadInviteCodes()
    } catch (error) {
      toast.error(error?.message || 'Could not invite reviewer')
    } finally {
      setSharing(false)
    }
  }

  const openRequestComposer = () => {
    setShowLoopDetails(true)
    if (!canCreateShareLink) {
      setPendingShareIntent('ask_for_feedback')
      reportClientEvent('share_blocked_session_not_ready', {
        action: 'ask_for_feedback',
        session_id: session.id,
        processing_status: session?.processing_status || '',
      })
      toast.success('We will reopen feedback as soon as playback is ready.')
      return
    }
    if (recentReviewersLoading) {
      setShowRequestComposer(true)
      return
    }
    if (designatedReviewers.length > 0) {
      setShowRequestComposer(true)
      return
    }
    inviteReviewerFromComposer({ skipReadyIntent: true, sourceAction: 'ask_for_feedback' })
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

  const toggleInviteManager = async () => {
    if (showInviteManager) {
      setShowInviteManager(false)
      return
    }
    setShowInviteManager(true)
    await loadInviteCodes()
  }

  const submitFeedbackChoice = async () => {
    if (selectedReviewer?.id) {
      await createReviewRequest()
      return
    }
    await inviteReviewerFromComposer({ sourceAction: 'ask_for_feedback' })
  }

  const chooseReviewer = (reviewer) => {
    setSelectedReviewer(reviewer)
    setReviewerQuery('')
    setReviewerResults([])
  }

  const startFollowUp = (requestItem = currentLoopRequest) => {
    const reviewer = requestItem?.reviewer
    if (!reviewer) return
    reportClientEvent('follow_up_take_launched', {
      review_request_id: requestItem?.id || null,
      prior_status: String(requestItem?.status || '').trim().toLowerCase(),
      session_id: session?.id || null,
    })
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

  return {
    activeReviewLink,
    activeInviteCodes,
    canCreateShareLink,
    chooseReviewer,
    currentLoopRequest,
    currentLoopStatus,
    currentLoopSummary,
    createReviewRequest,
    creatingRequest,
    designatedReviewers,
    feedbackReadyToReview,
    copyInviteUrl,
    inviteManagerLoading,
    copyReviewRequestLink,
    inviteReviewerFromComposer,
    justUploadedWithoutRequest,
    latestInviteUrl,
    loadReviewRequests,
    markReviewRequestViewed,
    openRequestComposer,
    openReviewRequestThread,
    pendingShareIntentLabel,
    patchReviewRequestStatus,
    pendingShareIntent,
    recentReviewers,
    recentReviewersLoading,
    readyForFollowUp,
    requestExerciseOrSong,
    requestGoal,
    requestInstrument,
    requestNotes,
    reviewRequests,
    requestsLoading,
    revokeShareLink,
    reviewerQuery,
    reviewerResults,
    reviewerSearchLoading,
    selectedReviewer,
    selectedReviewerName,
    setActiveReviewLink,
    setPendingShareIntent,
    setRequestExerciseOrSong,
    setRequestGoal,
    setShowRequestHistory,
    setRequestInstrument,
    setRequestNotes,
    setShowRequestDetails,
    setReviewRequests,
    setReviewerQuery,
    setSelectedReviewer,
    setShowInviteManager,
    setShowLoopDetails,
    setShowRequestComposer,
    showInviteManager,
    showLoopDetails,
    showRequestComposer,
    showRequestDetails,
    showRequestHistory,
    sharing,
    startFollowUp,
    submitFeedbackChoice,
    toggleInviteManager,
    toggleLoopDetails,
    turnOffInviteCode,
    updateRequestInState,
    waitingOnReviewer,
  }
}