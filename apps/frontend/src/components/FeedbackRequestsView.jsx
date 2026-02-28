import React, { useEffect, useMemo, useState } from 'react'
import { authHeaders } from '../auth'
import { useToast } from './Toast'

const fmtDue = (value) => {
  const d = new Date(value)
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const dueTone = (value) => {
  const due = new Date(value)
  const now = new Date()
  const remainingMs = due.getTime() - now.getTime()
  if (remainingMs <= 0) return 'text-red-600'
  if (remainingMs < 12 * 60 * 60 * 1000) return 'text-amber-600'
  return 'text-gray-500'
}

function FeedbackRequestsView({ token, user, onOpenSession }) {
  const toast = useToast()
  const [openRequests, setOpenRequests] = useState([])
  const [assigned, setAssigned] = useState([])
  const [loading, setLoading] = useState(true)
  const [drafts, setDrafts] = useState({})

  const headers = authHeaders(token)

  const fetchQueues = async () => {
    setLoading(true)
    try {
      const [openRes, assignedRes] = await Promise.all([
        fetch('/api/feedback-requests/open/', { headers }),
        fetch('/api/feedback-requests/assigned/', { headers }),
      ])

      if (!openRes.ok || !assignedRes.ok) {
        const openErr = openRes.ok ? null : await openRes.json().catch(() => ({}))
        const assignedErr = assignedRes.ok ? null : await assignedRes.json().catch(() => ({}))
        const message = openErr?.error || assignedErr?.error || 'Could not load feedback queues'
        throw new Error(message)
      }

      const [openData, assignedData] = await Promise.all([openRes.json(), assignedRes.json()])
      setOpenRequests(openData)
      setAssigned(assignedData)
    } catch (e) {
      toast.error(e.message || 'Could not load feedback queues')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchQueues()
  }, [])

  const myOpenRequests = useMemo(
    () => openRequests.filter(req => req.requester === user?.id),
    [openRequests, user?.id]
  )
  const claimableRequests = useMemo(
    () => openRequests.filter(
      req => req.requester !== user?.id && req.my_assignment_status !== 'claimed' && req.my_assignment_status !== 'completed'
    ),
    [openRequests, user?.id]
  )

  const claimRequest = async (requestId) => {
    try {
      const res = await fetch(`/api/feedback-requests/${requestId}/claim/`, {
        method: 'POST',
        headers,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return toast.error(data.error || 'Could not claim request')
      toast.success('Request claimed')
      fetchQueues()
    } catch {
      toast.error('Could not claim request')
    }
  }

  const releaseRequest = async (requestId) => {
    try {
      const res = await fetch(`/api/feedback-requests/${requestId}/release/`, {
        method: 'POST',
        headers,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return toast.error(data.error || 'Could not release request')
      toast.success('Request released')
      fetchQueues()
    } catch {
      toast.error('Could not release request')
    }
  }

  const cancelRequest = async (requestId) => {
    if (!confirm('Cancel this feedback request?')) return
    try {
      const res = await fetch(`/api/feedback-requests/${requestId}/cancel/`, {
        method: 'POST',
        headers,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return toast.error(data.error || 'Could not cancel request')
      toast.success('Request cancelled')
      fetchQueues()
    } catch {
      toast.error('Could not cancel request')
    }
  }

  const updateDraft = (requestId, patch) => {
    setDrafts(prev => ({
      ...prev,
      [requestId]: {
        ...(prev[requestId] || { text: '', videoFile: null, videoName: '' }),
        ...patch,
      },
    }))
  }

  const completeRequest = async (item) => {
    const requestData = item.feedback_request
    const draft = drafts[requestData.id] || { text: '', videoFile: null }
    const text = (draft.text || '').trim()
    if (!text) return toast.error('Feedback text is required')

    const remainingReviews = Math.max(0, requestData.required_reviews - requestData.completed_count)
    const remainingVideos = Math.max(0, requestData.video_required_count - requestData.video_completed_count)
    const needsVideoForFinal = remainingReviews <= 1 && remainingVideos > 0
    if (needsVideoForFinal && !draft.videoFile) {
      return toast.error('A video review is required to complete this request')
    }

    try {
      const fd = new FormData()
      fd.append('text', text)
      if (draft.videoFile) fd.append('video_reply', draft.videoFile)

      const res = await fetch(`/api/feedback-requests/${requestData.id}/complete/`, {
        method: 'POST',
        headers,
        body: fd,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return toast.error(data.error || 'Could not complete request')

      toast.success('Feedback submitted')
      setDrafts(prev => ({ ...prev, [requestData.id]: { text: '', videoFile: null, videoName: '' } }))
      fetchQueues()
    } catch {
      toast.error('Could not complete request')
    }
  }

  if (loading) {
    return (
      <div className="px-4 sm:px-6 py-6">
        <p className="text-sm text-gray-500">Loading feedback queues...</p>
      </div>
    )
  }

  return (
    <div className="px-4 sm:px-6 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Feedback Requests</h2>
          <p className="text-sm text-gray-500">Claim requests, give feedback, and keep due windows in check.</p>
        </div>
        <button
          onClick={fetchQueues}
          className="text-xs text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50"
        >
          Refresh
        </button>
      </div>

      <section>
        <h3 className="text-sm font-semibold text-gray-900 mb-2">Assigned to me</h3>
        {assigned.length === 0 ? (
          <p className="text-sm text-gray-500 p-4 border border-gray-200 rounded-xl">No claimed requests right now.</p>
        ) : (
          <div className="space-y-3">
            {assigned.map(item => {
              const req = item.feedback_request
              const draft = drafts[req.id] || { text: '', videoFile: null, videoName: '' }
              const remainingReviews = Math.max(0, req.required_reviews - req.completed_count)
              const remainingVideos = Math.max(0, req.video_required_count - req.video_completed_count)
              const needsVideoForFinal = remainingReviews <= 1 && remainingVideos > 0

              return (
                <div key={item.id} className="border border-gray-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <button
                        onClick={() => onOpenSession(req.session_id)}
                        className="text-sm font-semibold text-gray-900 hover:underline text-left"
                      >
                        {req.session_title}
                      </button>
                      <p className="text-xs text-gray-500 mt-1">{req.space_name} · Requested by {req.requester_name}</p>
                      <p className={`text-xs mt-1 ${dueTone(req.due_at)}`}>Due {fmtDue(req.due_at)}</p>
                    </div>
                    <button
                      onClick={() => releaseRequest(req.id)}
                      className="text-xs text-gray-500 hover:text-red-600"
                    >
                      Release
                    </button>
                  </div>

                  <p className="text-sm text-gray-700">{req.focus_prompt}</p>

                  <textarea
                    value={draft.text}
                    onChange={(e) => updateDraft(req.id, { text: e.target.value })}
                    placeholder="Write your feedback"
                    rows={3}
                    className="w-full text-sm border border-gray-200 rounded-lg p-2.5 focus:outline-none focus:border-gray-400"
                  />

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <input
                        type="file"
                        accept="video/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null
                          updateDraft(req.id, { videoFile: file, videoName: file ? file.name : '' })
                        }}
                        className="text-xs"
                      />
                      {draft.videoName && <p className="text-xs text-gray-500 mt-1">Attached: {draft.videoName}</p>}
                      {needsVideoForFinal && <p className="text-xs text-amber-600 mt-1">A video is required before this request can complete.</p>}
                    </div>
                    <button
                      onClick={() => completeRequest(item)}
                      className="text-xs font-medium text-white bg-gray-900 rounded-lg px-3 py-2 hover:bg-gray-800"
                    >
                      Submit feedback
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section>
        <h3 className="text-sm font-semibold text-gray-900 mb-2">Open queue</h3>
        {claimableRequests.length === 0 ? (
          <p className="text-sm text-gray-500 p-4 border border-gray-200 rounded-xl">No claimable requests in your spaces.</p>
        ) : (
          <div className="space-y-2">
            {claimableRequests.map(req => (
              <div key={req.id} className="border border-gray-200 rounded-xl p-4 flex items-start justify-between gap-3">
                <div>
                  <button
                    onClick={() => onOpenSession(req.session_id)}
                    className="text-sm font-semibold text-gray-900 hover:underline text-left"
                  >
                    {req.session_title}
                  </button>
                  <p className="text-xs text-gray-500 mt-1">{req.space_name} · Requested by {req.requester_name}</p>
                  <p className={`text-xs mt-1 ${dueTone(req.due_at)}`}>Due {fmtDue(req.due_at)}</p>
                  <p className="text-sm text-gray-700 mt-2">{req.focus_prompt}</p>
                </div>
                <button
                  onClick={() => claimRequest(req.id)}
                  className="text-xs font-medium text-white bg-gray-900 rounded-lg px-3 py-2 hover:bg-gray-800 flex-shrink-0"
                >
                  Claim
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="text-sm font-semibold text-gray-900 mb-2">Requested by me</h3>
        {myOpenRequests.length === 0 ? (
          <p className="text-sm text-gray-500 p-4 border border-gray-200 rounded-xl">No open requests created by you.</p>
        ) : (
          <div className="space-y-2">
            {myOpenRequests.map(req => (
              <div key={req.id} className="border border-gray-200 rounded-xl p-4 flex items-start justify-between gap-3">
                <div>
                  <button
                    onClick={() => onOpenSession(req.session_id)}
                    className="text-sm font-semibold text-gray-900 hover:underline text-left"
                  >
                    {req.session_title}
                  </button>
                  <p className={`text-xs mt-1 ${dueTone(req.due_at)}`}>Due {fmtDue(req.due_at)}</p>
                  <p className="text-sm text-gray-700 mt-2">{req.focus_prompt}</p>
                </div>
                <button
                  onClick={() => cancelRequest(req.id)}
                  className="text-xs text-gray-500 hover:text-red-600 flex-shrink-0"
                >
                  Cancel
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

export default FeedbackRequestsView
