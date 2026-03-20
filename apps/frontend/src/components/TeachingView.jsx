import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { feedbackCategoryLabel, feedbackCategoryTone, fmtDate } from '../utils'
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
  const [tab, setTab] = useState('inbox')
  const [requests, setRequests] = useState([])
  const [requestsLoading, setRequestsLoading] = useState(true)
  const [roster, setRoster] = useState([])
  const [rosterLoading, setRosterLoading] = useState(true)
  const [templates, setTemplates] = useState([])
  const [templatesLoading, setTemplatesLoading] = useState(true)
  const [templateTitle, setTemplateTitle] = useState('')
  const [templateText, setTemplateText] = useState('')
  const [savingTemplate, setSavingTemplate] = useState(false)

  const authHeaders = useMemo(() => (token ? { Authorization: `Token ${token}` } : {}), [token])

  const loadInbox = useCallback(async () => {
    setRequestsLoading(true)
    try {
      const res = await fetch('/api/teacher/inbox/', { headers: authHeaders })
      if (!res.ok) throw new Error('inbox')
      const data = await res.json()
      setRequests(Array.isArray(data) ? data : [])
    } catch {
      setRequests([])
    } finally {
      setRequestsLoading(false)
    }
  }, [authHeaders])

  const loadRoster = useCallback(async () => {
    setRosterLoading(true)
    try {
      const res = await fetch('/api/teacher/roster/', { headers: authHeaders })
      if (!res.ok) throw new Error('roster')
      const data = await res.json()
      setRoster(Array.isArray(data) ? data : [])
    } catch {
      setRoster([])
    } finally {
      setRosterLoading(false)
    }
  }, [authHeaders])

  const loadTemplates = useCallback(async () => {
    setTemplatesLoading(true)
    try {
      const res = await fetch('/api/teacher/templates/', { headers: authHeaders })
      if (!res.ok) throw new Error('templates')
      const data = await res.json()
      setTemplates(Array.isArray(data) ? data : [])
    } catch {
      setTemplates([])
    } finally {
      setTemplatesLoading(false)
    }
  }, [authHeaders])

  useEffect(() => {
    if (!token) return
    loadInbox()
    loadRoster()
    loadTemplates()
  }, [loadInbox, loadRoster, loadTemplates, token])

  const createTemplate = async () => {
    if (!templateTitle.trim()) {
      toast.error('Add a template title first')
      return
    }
    setSavingTemplate(true)
    try {
      const res = await fetch('/api/teacher/templates/', {
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
      const res = await fetch(`/api/teacher/templates/${templateId}/`, {
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

  const pendingCount = requests.filter((item) => ['requested', 'opened'].includes(item.status)).length

  return (
    <div className="px-4 sm:px-6 py-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900 tracking-tight">Teaching</h2>
            <p className="text-sm text-gray-500 mt-1">Review student requests, respond with video feedback, and keep your roster organized.</p>
          </div>
          <div className="rounded-2xl border border-gray-200 px-4 py-3 bg-white">
            <p className="text-xs uppercase tracking-wide text-gray-400">Pending now</p>
            <p className="text-lg font-semibold text-gray-900 mt-1">{pendingCount}</p>
          </div>
        </div>

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
            Roster
          </button>
          <button
            type="button"
            onClick={() => setTab('templates')}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${tab === 'templates' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
          >
            Templates
          </button>
        </div>

        {tab === 'inbox' ? (
          requestsLoading ? (
            <div className="rounded-2xl border border-gray-200 px-4 py-8 text-center text-sm text-gray-500">Loading teaching inbox…</div>
          ) : requests.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-10 text-center">
              <p className="text-sm text-gray-700">No review requests yet.</p>
              <p className="text-xs text-gray-500 mt-1">Once students send you private review requests, they will appear here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map((item) => (
                <div key={item.id} className="rounded-2xl border border-gray-200 bg-white px-4 py-4">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-gray-900">{item.session?.title || 'Review request'}</p>
                        <span className={`text-[11px] uppercase tracking-wide px-2 py-1 rounded-full ${statusTone[item.status] || 'bg-gray-100 text-gray-700'}`}>
                          {statusLabel(item.status)}
                        </span>
                        {item.parent_request ? <span className="text-[11px] uppercase tracking-wide bg-violet-100 text-violet-800 px-2 py-1 rounded-full">Follow-up</span> : null}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {item.student?.display_name || item.student?.username || 'Student'} • {item.instrument}{item.student_level ? ` • ${item.student_level}` : ''}
                      </p>
                      <p className="text-sm text-gray-700 mt-3">{item.goal}</p>
                      {item.exercise_or_song ? <p className="text-xs text-gray-500 mt-2">Focus: {item.exercise_or_song}</p> : null}
                      {item.feedback_category_counts && Object.keys(item.feedback_category_counts).length > 0 ? (
                        <div className="flex flex-wrap gap-2 mt-3">
                          {Object.entries(item.feedback_category_counts).map(([category, count]) => (
                            <span key={category} className={`text-[11px] uppercase tracking-wide px-2 py-1 rounded-full ${feedbackCategoryTone(category)}`}>
                              {feedbackCategoryLabel(category)} · {count}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      {item.deadline ? <p className="text-xs text-gray-500 mt-1">Due {new Date(item.deadline).toLocaleString()}</p> : <p className="text-xs text-gray-500 mt-1">Requested {fmtDate(item.created_at)}</p>}
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onOpenReviewRequest?.(item)}
                        className="rounded-xl bg-gray-900 text-white px-4 py-2.5 text-sm font-medium hover:bg-gray-800 transition-colors"
                      >
                        Open request
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : tab === 'roster' ? (
          rosterLoading ? (
            <div className="rounded-2xl border border-gray-200 px-4 py-8 text-center text-sm text-gray-500">Loading roster…</div>
          ) : roster.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-10 text-center">
              <p className="text-sm text-gray-700">No students on your roster yet.</p>
              <p className="text-xs text-gray-500 mt-1">Students appear here automatically when they send you a review request.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {roster.map((item) => (
                <div key={item.id} className="rounded-2xl border border-gray-200 bg-white px-4 py-4 space-y-2">
                  <p className="text-sm font-semibold text-gray-900">{item.student?.display_name || item.student?.username}</p>
                  <p className="text-xs text-gray-500">Pending reviews: {item.pending_review_count}</p>
                  <p className="text-xs text-gray-500">Total requests: {item.total_review_count}</p>
                  <p className="text-xs text-gray-500">Last request: {item.last_request_at ? new Date(item.last_request_at).toLocaleString() : '—'}</p>
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">Save a reusable feedback template</p>
                <p className="text-xs text-gray-500 mt-1">Use templates for recurring drum-technique reminders and save time in async reviews.</p>
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
              <div className="rounded-2xl border border-gray-200 px-4 py-8 text-center text-sm text-gray-500">Loading templates…</div>
            ) : templates.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-10 text-center">
                <p className="text-sm text-gray-700">No templates yet.</p>
                <p className="text-xs text-gray-500 mt-1">Create your first reusable coaching note here.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {templates.map((template) => (
                  <div key={template.id} className="rounded-2xl border border-gray-200 bg-white px-4 py-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{template.title}</p>
                        <p className="text-xs text-gray-400 mt-1">Updated {new Date(template.updated_at).toLocaleString()}</p>
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
        )}
      </div>
    </div>
  )
}

export default TeachingView
