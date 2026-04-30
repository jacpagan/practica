import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { fmtDate, reportClientEvent } from '../utils'
import StatusChip from './StatusChip'

const formatResolutionTimestamp = (resolution) => {
  const raw = resolution?.updated_at || resolution?.created_at || ''
  if (!raw) return ''
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return ''
  const dayPart = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  const timePart = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  return `${dayPart} · ${timePart}`
}

const statusPriority = {
  requested: 0,
  opened: 1,
  resubmitted: 2,
  needs_resubmission: 3,
  declined_unrelated: 4,
  responded: 5,
  viewed: 6,
  flagged: 7,
  closed: 8,
  revoked: 9,
}

const needsActionStatuses = new Set(['requested', 'opened', 'resubmitted'])
const waitingOnCreatorStatuses = new Set(['responded', 'viewed', 'needs_resubmission', 'declined_unrelated'])
const doneStatuses = new Set(['closed', 'revoked'])

const FILTER_AWAITING_REVIEW = 'awaiting_review'
const FILTER_NEEDS_NEW_TAKE = 'needs_new_take'
const FILTER_RECENTLY_RESPONDED = 'recently_responded'
const FILTER_DONE = 'done'
const FILTER_ALL = 'all'

const filterButtonOrder = [
  FILTER_AWAITING_REVIEW,
  FILTER_NEEDS_NEW_TAKE,
  FILTER_RECENTLY_RESPONDED,
  FILTER_DONE,
  FILTER_ALL,
]

const filterLabel = {
  [FILTER_AWAITING_REVIEW]: 'Awaiting review',
  [FILTER_NEEDS_NEW_TAKE]: 'Needs new take',
  [FILTER_RECENTLY_RESPONDED]: 'Recently responded',
  [FILTER_DONE]: 'Done',
  [FILTER_ALL]: 'All',
}

const sortOptions = [
  { value: 'activity_desc', label: 'Recent activity' },
  { value: 'requested_desc', label: 'Newest requests' },
  { value: 'requested_asc', label: 'Oldest requests' },
]

const requestActionLabel = (status = '') => {
  const normalized = String(status || '').trim().toLowerCase()
  if (needsActionStatuses.has(normalized)) return 'Review now'
  if (waitingOnCreatorStatuses.has(normalized)) return 'Open thread'
  return 'View history'
}

const requestStatusHint = (status = '') => {
  const normalized = String(status || '').trim().toLowerCase()
  if (normalized === 'requested') return 'A member sent a take and is waiting for your first response.'
  if (normalized === 'opened') return 'You opened this take, but the response is still waiting on you.'
  if (normalized === 'resubmitted') return 'A follow-up take is back in your queue for review.'
  if (normalized === 'responded') return 'You replied. The member has not reviewed your response yet.'
  if (normalized === 'viewed') return 'The member has seen your feedback and may continue the loop next.'
  if (normalized === 'needs_resubmission') return 'You asked for a new take before continuing this thread.'
  if (normalized === 'declined_unrelated') return 'You asked the member to send a take that matches the requested thread.'
  if (normalized === 'closed') return 'This thread has been resolved.'
  if (normalized === 'revoked') return 'This request was closed by the creator.'
  return 'Open the private thread to review the current state.'
}

const filterForStatus = (status = '') => {
  const normalized = String(status || '').trim().toLowerCase()
  if (['requested', 'opened', 'resubmitted'].includes(normalized)) return FILTER_AWAITING_REVIEW
  if (['needs_resubmission', 'declined_unrelated'].includes(normalized)) return FILTER_NEEDS_NEW_TAKE
  if (['responded', 'viewed'].includes(normalized)) return FILTER_RECENTLY_RESPONDED
  if (['closed', 'revoked'].includes(normalized)) return FILTER_DONE
  return FILTER_AWAITING_REVIEW
}

const waitingStateLabel = (status = '') => {
  const normalized = String(status || '').trim().toLowerCase()
  if (needsActionStatuses.has(normalized)) return 'Waiting on reviewer'
  if (waitingOnCreatorStatuses.has(normalized)) return 'Waiting on creator'
  if (doneStatuses.has(normalized)) return 'Closed'
  return 'Waiting on reviewer'
}

const emptyCopyForFilter = (filter) => {
  if (filter === FILTER_AWAITING_REVIEW) return 'No requests are currently waiting on your review.'
  if (filter === FILTER_NEEDS_NEW_TAKE) return 'No requests are waiting on a new take.'
  if (filter === FILTER_RECENTLY_RESPONDED) return 'No recently responded requests right now.'
  if (filter === FILTER_DONE) return 'No closed requests yet.'
  return 'No requests in this view.'
}

function RequestCard({ item, onOpenReviewRequest, activeFilter = '' }) {
  const normalizedStatus = String(item?.status || '').trim().toLowerCase()
  const memberName = item?.creator?.display_name || item?.member?.display_name || item?.owner?.display_name || item?.student?.display_name || item?.creator?.username || item?.member?.username || item?.owner?.username || item?.student?.username || 'Member'
  const resolution = item?.resolution || null
  const resolutionTimestamp = formatResolutionTimestamp(resolution)

  const handleOpenRequest = () => {
    reportClientEvent('reviewer_inbox_request_opened', {
      action: 'reviewer_inbox_open_request',
      review_request_id: item?.id || null,
      status: normalizedStatus,
      filter: String(activeFilter || '').trim().toLowerCase(),
    })
    onOpenReviewRequest?.(item)
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-gray-900">{item?.session?.title || 'Feedback request'}</p>
            <StatusChip status={normalizedStatus} resolution={resolution} />
            {item?.parent_request ? <span className="text-[11px] uppercase tracking-wide bg-violet-100 text-violet-800 px-2 py-1 rounded-full">Follow-up</span> : null}
          </div>
          <p className="text-xs text-gray-500">
            {memberName} • {item?.instrument || 'Private review'}
          </p>
          <p className="text-xs font-medium text-gray-600">{waitingStateLabel(normalizedStatus)}</p>
          <p className="text-sm text-gray-700">{resolution?.detail || requestStatusHint(normalizedStatus)}</p>
          <p className="text-xs text-gray-500">
            {resolution?.summary ? `${resolution.summary} • ` : ''}
            Requested {fmtDate(item?.created_at)}
            {item?.latest_feedback_at ? ` • Last response ${fmtDate(item.latest_feedback_at)}` : ''}
          </p>
          {resolutionTimestamp ? <p className="text-xs text-gray-500">{resolutionTimestamp}</p> : null}
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <button
            type="button"
            onClick={handleOpenRequest}
            className="rounded-xl bg-gray-900 text-white px-4 py-2.5 text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            {requestActionLabel(normalizedStatus)}
          </button>
        </div>
      </div>
    </div>
  )
}

function TeachingView({ token, onOpenReviewRequest }) {
  const [requests, setRequests] = useState([])
  const [requestsLoading, setRequestsLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState(FILTER_AWAITING_REVIEW)
  const [activeSort, setActiveSort] = useState('activity_desc')

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

      if (activeSort === 'requested_asc') {
        return new Date(left?.created_at || 0) - new Date(right?.created_at || 0)
      }
      if (activeSort === 'requested_desc') {
        return new Date(right?.created_at || 0) - new Date(left?.created_at || 0)
      }

      const leftActivity = new Date(left?.latest_feedback_at || left?.updated_at || left?.created_at || 0)
      const rightActivity = new Date(right?.latest_feedback_at || right?.updated_at || right?.created_at || 0)
      if (leftActivity.getTime() !== rightActivity.getTime()) return rightActivity - leftActivity
      return new Date(right?.created_at || 0) - new Date(left?.created_at || 0)
    })
  }, [activeSort, requests])

  const countsByFilter = useMemo(() => {
    return requests.reduce((counts, item) => {
      const bucket = filterForStatus(item?.status)
      counts[bucket] += 1
      counts[FILTER_ALL] += 1
      return counts
    }, {
      [FILTER_AWAITING_REVIEW]: 0,
      [FILTER_NEEDS_NEW_TAKE]: 0,
      [FILTER_RECENTLY_RESPONDED]: 0,
      [FILTER_DONE]: 0,
      [FILTER_ALL]: 0,
    })
  }, [requests])

  const visibleRequests = useMemo(() => {
    if (activeFilter === FILTER_ALL) return sortedRequests
    return sortedRequests.filter((item) => filterForStatus(item?.status) === activeFilter)
  }, [activeFilter, sortedRequests])

  const urgentCount = countsByFilter[FILTER_AWAITING_REVIEW]
  const topUrgentRequest = visibleRequests.find((item) => ['requested', 'opened', 'resubmitted'].includes(String(item?.status || '').trim().toLowerCase()))
    || sortedRequests.find((item) => ['requested', 'opened', 'resubmitted'].includes(String(item?.status || '').trim().toLowerCase()))
    || null

  return (
    <div className="px-4 sm:px-6 py-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold text-gray-900 tracking-tight">Requests</h2>
          <p className="text-sm text-gray-500">Review what needs you now, then keep an eye on loops waiting on creators.</p>
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
                {urgentCount > 0 ? 'New feedback waiting in your inbox' : 'Nothing is waiting on you right now'}
              </p>
              <p className="text-sm text-gray-700 mt-1">
                {urgentCount > 0
                  ? `You have ${urgentCount} request${urgentCount === 1 ? '' : 's'} marked Awaiting review.`
                  : 'You are caught up. Check loops waiting on creators for follow-up progress.'}
              </p>
              {urgentCount > 0 && topUrgentRequest ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenReviewRequest?.(topUrgentRequest)}
                    className="rounded-xl bg-gray-900 text-white px-4 py-2.5 text-sm font-medium hover:bg-gray-800 transition-colors"
                  >
                    Open first request
                  </button>
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-3 space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-2">
                  {filterButtonOrder.map((filterValue) => (
                    <button
                      key={filterValue}
                      type="button"
                      onClick={() => {
                        reportClientEvent('reviewer_inbox_filter_changed', {
                          action: 'reviewer_inbox_filter_changed',
                          filter: filterValue,
                        })
                        setActiveFilter(filterValue)
                      }}
                      className={`rounded-full border px-3 py-1.5 text-xs ${activeFilter === filterValue ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                    >
                      {filterLabel[filterValue]} ({countsByFilter[filterValue] || 0})
                    </button>
                  ))}
                </div>
                <label className="flex items-center gap-2 text-xs text-gray-500">
                  Sort
                  <select
                    value={activeSort}
                    onChange={(event) => {
                      reportClientEvent('reviewer_inbox_sort_changed', {
                        action: 'reviewer_inbox_sort_changed',
                        sort: event.target.value,
                        filter: activeFilter,
                      })
                      setActiveSort(event.target.value)
                    }}
                    className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-700"
                  >
                    {sortOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-900">
                  {activeFilter === FILTER_AWAITING_REVIEW
                    ? 'Needs action'
                    : activeFilter === FILTER_NEEDS_NEW_TAKE
                      ? 'Needs new take'
                      : activeFilter === FILTER_RECENTLY_RESPONDED
                        ? 'Recently responded'
                        : activeFilter === FILTER_DONE
                          ? 'Done'
                          : 'All requests'}
                </p>
                <p className="text-xs text-gray-500">{visibleRequests.length}</p>
              </div>

              {visibleRequests.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-6 text-sm text-gray-500">
                  {emptyCopyForFilter(activeFilter)}
                </div>
              ) : (
                <div className="space-y-3">
                  {visibleRequests.map((item) => (
                    <RequestCard key={item.id} item={item} activeFilter={activeFilter} onOpenReviewRequest={onOpenReviewRequest} />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default TeachingView
