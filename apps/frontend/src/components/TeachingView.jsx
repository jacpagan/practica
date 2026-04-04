import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { fmtDate } from '../utils'

const statusTone = {
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

const statusPriority = {
  requested: 0,
  opened: 1,
  responded: 2,
  viewed: 3,
  needs_resubmission: 4,
  declined_unrelated: 5,
  flagged: 6,
  resubmitted: 7,
  closed: 8,
  revoked: 9,
}

const needsActionStatuses = new Set(['requested', 'opened'])
const waitingOnMemberStatuses = new Set(['responded', 'viewed', 'needs_resubmission', 'declined_unrelated', 'resubmitted'])
const doneStatuses = new Set(['closed', 'revoked'])

const statusLabel = (value = '') => {
  const normalized = String(value || '').trim().toLowerCase()
  if (!normalized) return 'Unknown'
  return normalized.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
}

const requestActionLabel = (status = '') => {
  const normalized = String(status || '').trim().toLowerCase()
  if (needsActionStatuses.has(normalized)) return 'Review now'
  if (waitingOnMemberStatuses.has(normalized)) return 'Open thread'
  return 'View history'
}

const requestStatusHint = (status = '') => {
  const normalized = String(status || '').trim().toLowerCase()
  if (normalized === 'requested') return 'A member sent a take and is waiting for your first response.'
  if (normalized === 'opened') return 'You opened this take, but the response is still waiting on you.'
  if (normalized === 'responded') return 'You replied. The member has not reviewed your response yet.'
  if (normalized === 'viewed') return 'The member has seen your feedback and may continue the loop next.'
  if (normalized === 'needs_resubmission') return 'You asked for a new take before continuing this thread.'
  if (normalized === 'declined_unrelated') return 'You asked the member to send a take that matches the requested thread.'
  if (normalized === 'resubmitted') return 'The loop is marked for continuation from the member side.'
  if (normalized === 'closed') return 'This thread has been resolved.'
  if (normalized === 'revoked') return 'This request was closed by the owner.'
  return 'Open the private thread to review the current state.'
}

const groupForStatus = (status = '') => {
  const normalized = String(status || '').trim().toLowerCase()
  if (needsActionStatuses.has(normalized)) return 'needs_action'
  if (waitingOnMemberStatuses.has(normalized)) return 'waiting_on_member'
  if (doneStatuses.has(normalized)) return 'done'
  return 'needs_action'
}

function RequestCard({ item, onOpenReviewRequest }) {
  const normalizedStatus = String(item?.status || '').trim().toLowerCase()
  const memberName = item?.owner?.display_name || item?.student?.display_name || item?.owner?.username || item?.student?.username || 'Member'

  return (
    <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-gray-900">{item?.session?.title || 'Feedback request'}</p>
            <span className={`text-[11px] uppercase tracking-wide px-2 py-1 rounded-full ${statusTone[normalizedStatus] || 'bg-gray-100 text-gray-700'}`}>
              {statusLabel(normalizedStatus)}
            </span>
            {item?.parent_request ? <span className="text-[11px] uppercase tracking-wide bg-violet-100 text-violet-800 px-2 py-1 rounded-full">Follow-up</span> : null}
          </div>
          <p className="text-xs text-gray-500">
            {memberName} • {item?.instrument || 'Private review'}
          </p>
          <p className="text-sm text-gray-700">{requestStatusHint(normalizedStatus)}</p>
          <p className="text-xs text-gray-500">
            Requested {fmtDate(item?.created_at)}
            {item?.latest_feedback_at ? ` • Last response ${fmtDate(item.latest_feedback_at)}` : ''}
          </p>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <button
            type="button"
            onClick={() => onOpenReviewRequest?.(item)}
            className="rounded-xl bg-gray-900 text-white px-4 py-2.5 text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            {requestActionLabel(normalizedStatus)}
          </button>
        </div>
      </div>
    </div>
  )
}

function RequestSection({ title, description, items, emptyCopy, onOpenReviewRequest }) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">{title}</p>
          <p className="text-xs text-gray-500 mt-1">{description}</p>
        </div>
        <span className="text-xs text-gray-500">{items.length}</span>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-6 text-sm text-gray-500">
          {emptyCopy}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <RequestCard key={item.id} item={item} onOpenReviewRequest={onOpenReviewRequest} />
          ))}
        </div>
      )}
    </section>
  )
}

function TeachingView({ token, onOpenReviewRequest }) {
  const [requests, setRequests] = useState([])
  const [requestsLoading, setRequestsLoading] = useState(true)

  const authHeaders = useMemo(() => (token ? { Authorization: `Token ${token}` } : {}), [token])

  const loadInbox = useCallback(async () => {
    setRequestsLoading(true)
    try {
      const res = await fetch('/api/inbox/', { headers: authHeaders })
      if (!res.ok) throw new Error('inbox')
      const data = await res.json()
      setRequests(Array.isArray(data) ? data : [])
    } catch {
      setRequests([])
    } finally {
      setRequestsLoading(false)
    }
  }, [authHeaders])

  useEffect(() => {
    if (!token) return
    loadInbox()
  }, [loadInbox, token])

  const sortedRequests = useMemo(() => {
    return [...requests].sort((left, right) => {
      const leftPriority = statusPriority[String(left?.status || '').trim().toLowerCase()] ?? 99
      const rightPriority = statusPriority[String(right?.status || '').trim().toLowerCase()] ?? 99
      if (leftPriority !== rightPriority) return leftPriority - rightPriority
      return new Date(right?.created_at || 0) - new Date(left?.created_at || 0)
    })
  }, [requests])

  const groupedRequests = useMemo(() => {
    return sortedRequests.reduce((groups, item) => {
      groups[groupForStatus(item?.status)].push(item)
      return groups
    }, {
      needs_action: [],
      waiting_on_member: [],
      done: [],
    })
  }, [sortedRequests])

  const urgentCount = groupedRequests.needs_action.length

  return (
    <div className="px-4 sm:px-6 py-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold text-gray-900 tracking-tight">Requests</h2>
          <p className="text-sm text-gray-500">Review what needs you now, then keep an eye on the loops waiting on members.</p>
        </div>

        {requestsLoading ? (
          <div className="rounded-2xl border border-gray-200 px-4 py-8 text-center text-sm text-gray-500">Loading…</div>
        ) : requests.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-10 text-center">
            <p className="text-sm text-gray-700">No feedback requests yet.</p>
            <p className="text-xs text-gray-500 mt-1">New assigned review requests will show up here.</p>
          </div>
        ) : (
          <>
            <div className={`rounded-2xl border px-4 py-4 ${urgentCount > 0 ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}>
              <p className="text-sm font-semibold text-gray-900">
                {urgentCount > 0 ? `Needs action now: ${urgentCount}` : 'Nothing is waiting on you right now'}
              </p>
              <p className="text-sm text-gray-700 mt-1">
                {urgentCount > 0
                  ? 'Start with requested or opened takes first. Everything else can wait on the member.'
                  : 'You are caught up. Check the waiting section for loops that may continue later.'}
              </p>
            </div>

            <RequestSection
              title="Needs action"
              description="Requested or opened takes that still need your response."
              items={groupedRequests.needs_action}
              emptyCopy="Nothing is waiting on you right now."
              onOpenReviewRequest={onOpenReviewRequest}
            />

            <RequestSection
              title="Waiting on member"
              description="Threads where you already responded or asked the member for a different take."
              items={groupedRequests.waiting_on_member}
              emptyCopy="No loops are currently waiting on the member."
              onOpenReviewRequest={onOpenReviewRequest}
            />

            <RequestSection
              title="Done"
              description="Closed or revoked threads that are no longer active."
              items={groupedRequests.done}
              emptyCopy="No finished review threads yet."
              onOpenReviewRequest={onOpenReviewRequest}
            />
          </>
        )}
      </div>
    </div>
  )
}

export default TeachingView
