import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { fmtDate } from '../utils'

const statusTone = {
  requested: 'bg-amber-100 text-amber-800',
  opened: 'bg-blue-100 text-blue-800',
  responded: 'bg-emerald-100 text-emerald-800',
  viewed: 'bg-violet-100 text-violet-800',
  resubmitted: 'bg-fuchsia-100 text-fuchsia-800',
  closed: 'bg-gray-100 text-gray-700',
  revoked: 'bg-red-100 text-red-700',
}

const statusLabel = (value = '') => {
  const normalized = String(value || '').trim().toLowerCase()
  if (!normalized) return 'Unknown'
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
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
    const priority = { requested: 0, opened: 1, responded: 2, viewed: 3, resubmitted: 4, closed: 5, revoked: 6 }
    return [...requests].sort((left, right) => {
      const leftPriority = priority[String(left.status || '').trim().toLowerCase()] ?? 99
      const rightPriority = priority[String(right.status || '').trim().toLowerCase()] ?? 99
      if (leftPriority !== rightPriority) return leftPriority - rightPriority
      return new Date(right.created_at) - new Date(left.created_at)
    })
  }, [requests])
  const nextRequest = sortedRequests[0] || null
  const nextRequestStatus = String(nextRequest?.status || '').trim().toLowerCase()

  return (
    <div className="px-4 sm:px-6 py-6">
      <div className="max-w-4xl mx-auto space-y-4">
        <h2 className="text-2xl font-semibold text-gray-900 tracking-tight">Requests</h2>
        <p className="text-sm text-gray-500">Open and respond.</p>

        {requestsLoading ? (
          <div className="rounded-2xl border border-gray-200 px-4 py-8 text-center text-sm text-gray-500">Loading…</div>
        ) : requests.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-10 text-center">
            <p className="text-sm text-gray-700">No feedback requests yet.</p>
            <p className="text-xs text-gray-500 mt-1">New requests show up here.</p>
          </div>
        ) : null}

        {sortedRequests.length > 1 ? (
          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">All requests</p>
            {sortedRequests.map((item) => (
              <div key={item.id} className="rounded-2xl border border-gray-200 bg-white px-4 py-3">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900">{item.session?.title || 'Feedback request'}</p>
                      <span className={`text-[11px] uppercase tracking-wide px-2 py-1 rounded-full ${statusTone[item.status] || 'bg-gray-100 text-gray-700'}`}>
                        {statusLabel(item.status)}
                      </span>
                      {item.parent_request ? <span className="text-[11px] uppercase tracking-wide bg-violet-100 text-violet-800 px-2 py-1 rounded-full">Follow-up</span> : null}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {item.owner?.display_name || item.student?.display_name || item.owner?.username || item.student?.username || 'Member'} • {item.instrument}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Requested {fmtDate(item.created_at)}</p>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenReviewRequest?.(item)}
                      className="rounded-xl bg-gray-900 text-white px-4 py-2.5 text-sm font-medium hover:bg-gray-800 transition-colors"
                    >
                      Open
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default TeachingView
