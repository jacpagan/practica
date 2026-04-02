import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { fmtDate } from '../utils'
import { useToast } from './Toast'

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
  const toast = useToast()
  const [showWorkspaceDetails, setShowWorkspaceDetails] = useState(false)
  const [requests, setRequests] = useState([])
  const [requestsLoading, setRequestsLoading] = useState(true)
  // Simplified: remove roster/templates

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

  // Removed loadRoster/loadTemplates

  useEffect(() => {
    if (!token) return
    loadInbox()
  }, [loadInbox, token])

  const createTemplate = async () => {
    if (!templateTitle.trim()) {
      toast.error('Add a template title first')
      return
    }
    setSavingTemplate(true)
    try {
      const res = await fetch('/api/feedback-templates/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ title: templateTitle.trim(), text: templateText.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.title?.[0] || data?.error || 'Could not save template')
      setTemplates((current) => [...current, data].sort((left, right) => left.title.localeCompare(right.title)))
      setTemplateTitle('')
      setTemplateText('')
      toast.success('Template saved')
    } catch (error) {
      toast.error(error?.message || 'Could not save template')
    } finally {
      setSavingTemplate(false)
    }
  }

  const deleteTemplate = async (templateId) => {
    try {
      const res = await fetch(`/api/feedback-templates/${templateId}/`, {
        method: 'DELETE',
        headers: authHeaders,
      })
      if (!res.ok) throw new Error('delete-template')
      setTemplates((current) => current.filter((item) => item.id !== templateId))
      toast.success('Template deleted')
    } catch {
      toast.error('Could not delete template')
    }
  }

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

  const uniqueSessions = useMemo(() => {
    const bySessionId = new Map()
    requests.forEach((req) => {
      const sid = Number(req?.session?.id || 0)
      if (!sid) return
      const prev = bySessionId.get(sid)
      if (!prev || new Date(req.created_at) > new Date(prev.request.created_at)) {
        bySessionId.set(sid, { session: req.session, request: req })
      }
    })
    return Array.from(bySessionId.values()).sort((l, r) => new Date(r.request.created_at) - new Date(l.request.created_at))
  }, [requests])

  return (
    <div className="px-4 sm:px-6 py-6">
      <div className="max-w-4xl mx-auto space-y-4">
        <h2 className="text-2xl font-semibold text-gray-900 tracking-tight">Requests</h2>
        <p className="text-sm text-gray-500">Open and respond.</p>

        {requestsLoading ? (
          <div className="rounded-2xl border border-gray-200 px-4 py-8 text-center text-sm text-gray-500">Loading…</div>
        ) : nextRequest ? (
          <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 space-y-3">
            <div>
              <p className="text-sm font-semibold text-gray-900">Recent</p>
              <p className="text-xs text-gray-500 mt-1">Your latest review.</p>
            </div>
            <div className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-3">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-gray-900">{nextRequest.session?.title || 'Feedback request'}</p>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {nextRequest.owner?.display_name || nextRequest.student?.display_name || nextRequest.owner?.username || nextRequest.student?.username || 'Member'} • {nextRequest.instrument}
                  </p>
                  {/* Thread title is enough; remove extra goal text */}
                  <p className="text-xs text-gray-500 mt-2">Requested {fmtDate(nextRequest.created_at)}</p>
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenReviewRequest?.(nextRequest)}
                    className="rounded-xl bg-gray-900 text-white px-4 py-2.5 text-sm font-medium hover:bg-gray-800 transition-colors"
                  >
                    {['requested', 'opened'].includes(nextRequestStatus) ? 'Review' : 'Open'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-10 text-center">
            <p className="text-sm text-gray-700">No feedback requests yet.</p>
            <p className="text-xs text-gray-500 mt-1">New requests show up here.</p>
          </div>
        )}

        <details className="rounded-2xl border border-gray-200 bg-white px-4 py-3" open={showWorkspaceDetails}>
          <summary onClick={() => setShowWorkspaceDetails((current) => !current)} className="cursor-pointer list-none flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-gray-900">Workspace details</p>
              <p className="text-xs text-gray-500 mt-1">Optional.</p>
            </div>
            <span className="text-xs text-gray-500">{showWorkspaceDetails ? 'Hide' : 'Show'}</span>
          </summary>
          <div className="pt-3 space-y-4">
            <div className="flex gap-2 rounded-2xl bg-gray-100 p-1 w-full sm:w-fit">
              <button
                type="button"
                onClick={() => setTab('inbox')}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${tab === 'inbox' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
              >
                Inbox
              </button>
              <button
                type="button"
                onClick={() => setTab('roster')}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${tab === 'roster' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
              >
                Connections
              </button>
              <button
                type="button"
                onClick={() => setTab('templates')}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${tab === 'templates' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
              >
                Templates
              </button>
              <button
                type="button"
                onClick={() => setTab('videos')}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${tab === 'videos' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
              >
                Videos
              </button>
            </div>

            {tab === 'inbox' ? (
              requestsLoading ? (
                <div className="rounded-2xl border border-gray-200 px-4 py-8 text-center text-sm text-gray-500">Loading…</div>
              ) : requests.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-10 text-center">
                  <p className="text-sm text-gray-700">No feedback requests yet.</p>
                  <p className="text-xs text-gray-500 mt-1">New requests show up here.</p>
                </div>
              ) : (
            <div className="space-y-3">
              {requests.map((item) => (
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
                      {/* Thread title is enough; remove extra goal/focus lines */}
                      {item.feedback_category_counts && Object.keys(item.feedback_category_counts).length > 0 ? (
                        <div className="flex flex-wrap gap-2 mt-3">
                          {Object.entries(item.feedback_category_counts).map(([category, count]) => (
                            <span key={category} className={`text-[11px] uppercase tracking-wide px-2 py-1 rounded-full ${feedbackCategoryTone(category)}`}>
                              {feedbackCategoryLabel(category)} · {count}
                            </span>
                          ))}
                        </div>
                      ) : null}
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
              )
            ) : tab === 'roster' ? (
          rosterLoading ? (
            <div className="rounded-2xl border border-gray-200 px-4 py-8 text-center text-sm text-gray-500">Loading…</div>
          ) : roster.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-10 text-center">
              <p className="text-sm text-gray-700">No connections yet.</p>
              <p className="text-xs text-gray-500 mt-1">People appear here after a request.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {roster.map((item) => (
                <div key={item.id} className="rounded-2xl border border-gray-200 bg-white px-4 py-3 space-y-2">
                  <p className="text-sm font-semibold text-gray-900">{item.member?.display_name || item.student?.display_name || item.member?.username || item.student?.username}</p>
                  <p className="text-xs text-gray-500">Pending reviews: {item.pending_review_count}</p>
                  <p className="text-xs text-gray-500">Total requests: {item.total_review_count}</p>
                  <p className="text-xs text-gray-500">Last request: {item.last_request_at ? new Date(item.last_request_at).toLocaleString(undefined, { hour12: undefined }) : '—'}</p>
                </div>
              ))}
            </div>
              )
            ) : tab === 'templates' ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-3 space-y-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">New template</p>
                <p className="text-xs text-gray-500 mt-1">Keep common coaching notes ready.</p>
              </div>
              <input
                type="text"
                value={templateTitle}
                onChange={(event) => setTemplateTitle(event.target.value)}
                placeholder="Template title"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
              />
              <textarea
                value={templateText}
                onChange={(event) => setTemplateText(event.target.value)}
                rows={4}
                placeholder="Template note"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 resize-none"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={createTemplate}
                  disabled={savingTemplate}
                  className="rounded-xl bg-gray-900 text-white px-4 py-2.5 text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors"
                >
                  {savingTemplate ? 'Saving…' : 'Save template'}
                </button>
              </div>
            </div>

            {templatesLoading ? (
              <div className="rounded-2xl border border-gray-200 px-4 py-8 text-center text-sm text-gray-500">Loading…</div>
            ) : templates.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-10 text-center">
                <p className="text-sm text-gray-700">No templates yet.</p>
                <p className="text-xs text-gray-500 mt-1">Save a note to reuse it.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {templates.map((template) => (
                  <div key={template.id} className="rounded-2xl border border-gray-200 bg-white px-4 py-3 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{template.title}</p>
                        <p className="text-xs text-gray-400 mt-1">Updated {new Date(template.updated_at).toLocaleString(undefined, { hour12: undefined })}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteTemplate(template.id)}
                        className="text-xs text-red-600 hover:text-red-700 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{template.text || 'No note text yet.'}</p>
                  </div>
                ))}
              </div>
            )}
              </div>
            ) : tab === 'videos' ? (
          <div className="space-y-4">
            {requestsLoading ? (
              <div className="rounded-2xl border border-gray-200 px-4 py-8 text-center text-sm text-gray-500">Loading…</div>
            ) : uniqueSessions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-10 text-center">
                <p className="text-sm text-gray-700">No member videos yet.</p>
                <p className="text-xs text-gray-500 mt-1">Assigned sessions appear here.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {uniqueSessions.map(({ session, request }) => (
                  <div key={session.id} className="rounded-2xl border border-gray-200 bg-white px-4 py-3">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-gray-900">{session.title || 'Video'}</p>
                          <span className={`text-[11px] uppercase tracking-wide px-2 py-1 rounded-full ${statusTone[request.status] || 'bg-gray-100 text-gray-700'}`}>{statusLabel(request.status)}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{request.owner?.display_name || request.student?.display_name || request.owner?.username || request.student?.username || 'Member'} • {fmtDate(request.created_at)}</p>
                      </div>
                      <div className="shrink-0 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onOpenReviewRequest?.(request)}
                          className="rounded-xl bg-gray-900 text-white px-4 py-2.5 text-sm font-medium hover:bg-gray-800 transition-colors"
                        >
                          Open
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
            ) : null}
          </div>
        </details>
      </div>
    </div>
  )
}

export default TeachingView
