import React, { useEffect, useMemo, useState } from 'react'
import { fmtDate } from '../utils'
import { useToast } from './Toast'
import VideoThumbnail from './VideoThumbnail'
import SessionListItem from './SessionListItem'
import ThreadPickerModal from './ThreadPickerModal'

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

function InviteCodesPanel({ token }) {
  const toast = useToast()
  const [inviteCodes, setInviteCodes] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [label, setLabel] = useState('')

  const loadInviteCodes = async () => {
    if (!token) return
    setLoading(true)
    try {
      const res = await fetch('/api/invite-codes/', { headers: { Authorization: `Token ${token}` } })
      if (!res.ok) throw new Error('invite-codes')
      const data = await res.json()
      setInviteCodes(Array.isArray(data) ? data : [])
    } catch {
      setInviteCodes([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadInviteCodes()
  }, [token])

  const createInviteCode = async () => {
    if (!token) return
    setCreating(true)
    try {
      const res = await fetch('/api/invite-codes/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Token ${token}`,
        },
        body: JSON.stringify({ label: label.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Could not create invite code')
      setInviteCodes((current) => [data, ...current])
      setLabel('')
      try {
        await navigator.clipboard.writeText(data.code)
        toast.success('Invite code created and copied')
      } catch {
        toast.success('Invite code created')
      }
    } catch (error) {
      toast.error(error?.message || 'Could not create invite code')
    } finally {
      setCreating(false)
    }
  }

  const revokeInviteCode = async (inviteId) => {
    if (!token) return
    try {
      const res = await fetch(`/api/invite-codes/${inviteId}/`, {
        method: 'DELETE',
        headers: { Authorization: `Token ${token}` },
      })
      if (!res.ok) throw new Error('revoke-invite')
      setInviteCodes((current) => current.map((item) => (item.id === inviteId ? { ...item, is_active: false } : item)))
      toast.success('Invite code turned off')
    } catch {
      toast.error('Could not turn off invite code')
    }
  }

  const copyInviteCode = async (code) => {
    try {
      await navigator.clipboard.writeText(code)
      toast.success('Invite code copied')
    } catch {
      toast.error('Could not copy invite code')
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white px-4 py-4 space-y-4">
      <div>
        <p className="text-sm font-semibold text-gray-900">Invite someone</p>
        <p className="text-xs text-gray-500 mt-1">Create a single-use invite code for a trusted person.</p>
      </div>
      <div className="flex gap-2 flex-wrap">
        <input
          type="text"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="Optional label"
          className="flex-1 min-w-[180px] px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
        />
        <button
          type="button"
          onClick={createInviteCode}
          disabled={creating}
          className="rounded-full bg-gray-900 text-white px-4 py-2.5 text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors"
        >
          {creating ? 'Creating…' : 'Create invite code'}
        </button>
      </div>
      {loading ? (
        <p className="text-sm text-gray-500">Loading invite codes…</p>
      ) : inviteCodes.length === 0 ? (
        <p className="text-sm text-gray-500">No invite codes yet.</p>
      ) : (
        <div className="space-y-2">
          {inviteCodes.map((invite) => (
            <div key={invite.id} className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-gray-900 tracking-wide">{invite.code}</p>
                  <span className={`text-[11px] uppercase tracking-wide px-2 py-1 rounded-full ${invite.is_active && invite.redeemable ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                    {invite.is_active && invite.redeemable ? 'Active' : 'Inactive'}
                  </span>
                </div>
                {invite.label ? <p className="text-xs text-gray-500 mt-1">{invite.label}</p> : null}
                <p className="text-xs text-gray-400 mt-1">Uses {invite.use_count}/{invite.max_uses}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button type="button" onClick={() => copyInviteCode(invite.code)} className="text-xs text-gray-700 border border-gray-200 rounded-lg px-3 py-2 hover:bg-white transition-colors">
                  Copy
                </button>
                {invite.is_active ? (
                  <button type="button" onClick={() => revokeInviteCode(invite.id)} className="text-xs text-red-600 border border-red-200 rounded-lg px-3 py-2 hover:bg-red-50 transition-colors">
                    Turn off
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function LibraryView({
  sessions = [],
  sessionsLoading = false,
  reviewRequests = [],
  reviewRequestsLoading = false,
  onOpenSession,
  onOpenSeries,
  onCreateVideo,
  onOpenReviewRequest,
  onRecordFollowUp,
  onOpenRequests,
  onOpenCalendar,
  hasReviewerWorkspace = false,
  mode = 'home',
  token = '',
}) {
  const toast = useToast()
  const SORT_KEY = 'practica.sort.newestFirst.v1'
  const DATE_FILTER_KEY = 'practica.filter.date.v1'
  const [newestFirst, setNewestFirst] = useState(() => {
    try { return (window.localStorage.getItem(SORT_KEY) || 'true') === 'true' } catch { return true }
  })
  useEffect(() => { try { window.localStorage.setItem(SORT_KEY, String(Boolean(newestFirst))) } catch {} }, [newestFirst])
  const [dateFilter, setDateFilter] = useState('')
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(DATE_FILTER_KEY)
      if (raw) {
        setDateFilter(raw)
        window.localStorage.removeItem(DATE_FILTER_KEY)
        setTimeout(() => {
          const anchor = document.getElementById(`date-${raw}`)
          if (anchor) anchor.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }, 100)
      }
    } catch {}
  }, [])
  const [archiveView, setArchiveView] = useState('all')
  const [expandedSeriesNames, setExpandedSeriesNames] = useState({})

  const byDateKey = (d) => {
    const x = new Date(d)
    const yyyy = x.getFullYear()
    const mm = String(x.getMonth() + 1).padStart(2, '0')
    const dd = String(x.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }
  const ownSessions = useMemo(() => {
    const filtered = sessions
      .filter((session) => session.can_edit)
      .filter((s) => !dateFilter || byDateKey(s.recorded_at || s.created_at) === dateFilter)
    const cmp = (a, b) => {
      const ta = new Date(a.recorded_at || a.created_at)
      const tb = new Date(b.recorded_at || b.created_at)
      return newestFirst ? (tb - ta) : (ta - tb)
    }
    return filtered.sort(cmp)
  }, [dateFilter, newestFirst, sessions])

  const seriesGroups = useMemo(() => {
    const groups = new Map()
    ownSessions.forEach((session) => {
      const seriesName = String(session.practice_series || '').trim()
      if (!seriesName) return
      if (!groups.has(seriesName)) groups.set(seriesName, [])
      groups.get(seriesName).push(session)
    })
    return Array.from(groups.entries())
      .map(([seriesName, items]) => ({ seriesName, items }))
      .sort((left, right) => new Date(right.items[0].recorded_at || right.items[0].created_at) - new Date(left.items[0].recorded_at || left.items[0].created_at))
  }, [ownSessions])

  const standaloneSessions = useMemo(
    () => ownSessions.filter((session) => !String(session.practice_series || '').trim()),
    [ownSessions],
  )

  const ownerRequests = useMemo(
    () => [...reviewRequests].sort((left, right) => new Date(right.created_at) - new Date(left.created_at)),
    [reviewRequests],
  )

  const activeRequestBySessionId = useMemo(() => {
    const bySessionId = new Map()
    ownerRequests.forEach((item) => {
      const status = String(item?.status || '').trim().toLowerCase()
      if (['closed', 'revoked'].includes(status)) return
      const sessionId = Number(item?.session?.id || item?.session_id || 0)
      if (!sessionId || bySessionId.has(sessionId)) return
      bySessionId.set(sessionId, item)
    })
    return bySessionId
  }, [ownerRequests])

  const activeRequest = useMemo(
    () => ownerRequests.find((item) => !['closed', 'revoked'].includes(String(item.status || '').trim().toLowerCase())) || null,
    [ownerRequests],
  )

  const activeRequestStatus = String(activeRequest?.status || '').trim().toLowerCase()
  const latestSeries = seriesGroups[0] || null
  const latestSessionNeedingRequest = ownSessions.find((session) => session.processing_status === 'ready') || ownSessions[0] || null
  const isHomeMode = mode === 'home'
  const isArchiveMode = mode === 'archive'
  const [editingThreadSession, setEditingThreadSession] = useState(null)
  const [savingThread, setSavingThread] = useState(false)
  const threadOptions = useMemo(() => Array.from(new Set(sessions.map(s => String(s.practice_series || '').trim()).filter(Boolean))).sort(), [sessions])

  const moveToThread = async (session) => {
    if (!token || !session?.id) return
    const current = String(session.practice_series || '').trim()
    const next = window.prompt('Move to practice thread (name)', current)
    if (next === null) return
    try {
      const res = await fetch(`/api/sessions/${session.id}/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Token ${token}`,
        },
        body: JSON.stringify({ practice_series: String(next || '').trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Could not move video')
      toast.success(next ? 'Moved to thread' : 'Removed from thread')
    } catch (error) {
      toast.error(error?.message || 'Could not move video')
    }
  }

  const toggleSeriesExpanded = (seriesName) => {
    setExpandedSeriesNames((current) => ({
      ...current,
      [seriesName]: !current[seriesName],
    }))
  }

  const renderSessionRows = (items, returnRoute = { view: 'library', sessionId: null, seriesName: '' }) => items.map((session) => {
    const ar = activeRequestBySessionId.get(Number(session.id)) || null
    const onFollowUp = ar ? () => onRecordFollowUp?.({ parent_request_id: ar.id, practiceSeries: session.practice_series || '' }) : null
    const openThreadPicker = () => setEditingThreadSession(session)
    return (
      <SessionListItem
        key={session.id}
        session={session}
        status={ar?.status}
        showSeries={Boolean(String(session.practice_series || '').trim())}
        onOpen={() => onOpenSession?.(session, returnRoute)}
        onChangeThread={openThreadPicker}
        onRecordFollowUp={onFollowUp}
      />
    )
  })

  const saveThreadForEditing = async (nextValue = '') => {
    const s = editingThreadSession
    if (!token || !s?.id) { setEditingThreadSession(null); return }
    const value = String(nextValue || '').trim()
    setSavingThread(true)
    try {
      const res = await fetch(`/api/sessions/${s.id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Token ${token}` },
        body: JSON.stringify({ practice_series: value }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Could not update thread')
      toast.success(value ? 'Moved to thread' : 'Removed from thread')
      try { window.dispatchEvent(new CustomEvent('practica:session-updated', { detail: { id: s.id } })) } catch {}
    } catch (e) {
      toast.error(e?.message || 'Could not update thread')
    } finally {
      setSavingThread(false)
      setEditingThreadSession(null)
    }
  }

  return (
    <div className="px-4 sm:px-6 py-6">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-2">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900 tracking-tight">Home</h2>
              <p className="text-sm text-gray-500 mt-1">Your next step.</p>
            </div>
            {hasReviewerWorkspace ? (
              <div className="flex flex-wrap gap-2">
                <button type="button" className="rounded-full bg-gray-900 text-white px-3 py-1.5 text-xs font-medium">
                  Videos I own
                </button>
                <button type="button" onClick={onOpenRequests} className="rounded-full border border-gray-200 bg-white text-gray-700 px-3 py-1.5 text-xs font-medium hover:bg-gray-50 transition-colors">
                  Requests I’m reviewing
                </button>
              </div>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCreateVideo}
              className="rounded-full bg-gray-900 text-white px-4 py-2.5 text-sm font-medium hover:bg-gray-800 transition-colors"
            >
              New video
            </button>
            <button
              type="button"
              onClick={() => setNewestFirst((v) => !v)}
              className={`rounded-full px-3 py-2 text-xs border ${newestFirst ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
            >
              {newestFirst ? 'Newest first' : 'Oldest first'}
            </button>
          </div>
        </div>

        {sessionsLoading ? (
          <div className="rounded-2xl border border-gray-200 px-4 py-8 text-center text-sm text-gray-500">Loading…</div>
        ) : ownSessions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-10 text-center">
            <p className="text-sm text-gray-700">No videos yet.</p>
            <p className="text-xs text-gray-500 mt-1">Record one to start.</p>
            <button
              type="button"
              onClick={onCreateVideo}
              className="mt-4 rounded-full bg-gray-900 text-white px-4 py-2.5 text-sm font-medium hover:bg-gray-800 transition-colors"
            >
              New video
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 space-y-3" id={dateFilter ? `date-${dateFilter}` : undefined}>
              <div>
                <p className="text-sm font-semibold text-gray-900">{isHomeMode ? 'Recent' : 'Archive overview'}</p>
                <p className="text-xs text-gray-500 mt-1">{isHomeMode ? 'Your latest items.' : 'Everything you own, organized clearly.'}</p>
              </div>
              {(dateFilter || withFeedbackOnly) ? (
                <div className="flex items-center gap-2 flex-wrap">
                  {dateFilter ? (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] uppercase tracking-wide bg-gray-100 text-gray-700 px-2 py-1 rounded-full">Date: {dateFilter}</span>
                      <button type="button" onClick={() => setDateFilter('')} className="text-[11px] px-2 py-1 rounded-full border border-gray-200 text-gray-700 hover:bg-gray-50">Clear date</button>
                      <button type="button" onClick={() => { try { window.localStorage.setItem(DATE_FILTER_KEY, dateFilter) } catch {} ; onOpenCalendar?.() }} className="text-[11px] px-2 py-1 rounded-full border border-gray-200 text-gray-700 hover:bg-gray-50">Back to calendar</button>
                    </div>
                  ) : null}
                  {withFeedbackOnly ? (
                    <button type="button" onClick={() => setWithFeedbackOnly(false)} className="text-[11px] px-2 py-1 rounded-full border border-gray-200 text-gray-700 hover:bg-gray-50">With feedback</button>
                  ) : null}
                </div>
              ) : null}

              {isHomeMode && reviewRequestsLoading ? (
                <div className="rounded-xl bg-gray-50 px-4 py-4 text-sm text-gray-500">Loading…</div>
              ) : isHomeMode && activeRequest && ['requested', 'opened'].includes(activeRequestStatus) ? (
                <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 space-y-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-gray-900">Waiting on {activeRequest.reviewer?.display_name || activeRequest.teacher?.display_name || activeRequest.reviewer?.username || activeRequest.teacher?.username || 'reviewer'}</p>
                        <span className={`text-[11px] uppercase tracking-wide px-2 py-1 rounded-full ${requestStatusTone[activeRequestStatus] || 'bg-gray-100 text-gray-700'}`}>
                          {requestStatusLabel(activeRequest.status)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{activeRequest.goal || 'Feedback requested'} • {fmtDate(activeRequest.created_at)}</p>
                    </div>
                    <div className="text-xs text-gray-500">Session: {activeRequest.session?.title || 'Video'}</div>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      type="button"
                      onClick={() => onOpenReviewRequest?.(activeRequest)}
                      className="rounded-full bg-gray-900 text-white px-4 py-2.5 text-sm font-medium hover:bg-gray-800 transition-colors"
                    >
                      Open request
                    </button>
                    {activeRequest.session?.id ? (
                      <button
                        type="button"
                        onClick={() => onOpenSession?.(activeRequest.session, { view: 'library', sessionId: null, seriesName: '' })}
                        className="text-xs text-gray-600 hover:text-gray-900 transition-colors"
                      >
                        View video
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : isHomeMode && activeRequest && ['responded', 'viewed', 'resubmitted'].includes(activeRequestStatus) ? (
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 space-y-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-gray-900">Feedback is back</p>
                        <span className={`text-[11px] uppercase tracking-wide px-2 py-1 rounded-full ${requestStatusTone[activeRequestStatus] || 'bg-gray-100 text-gray-700'}`}>
                          {requestStatusLabel(activeRequest.status)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{activeRequest.goal || 'Ready for another take'} • {activeRequest.reviewer?.display_name || activeRequest.teacher?.display_name || activeRequest.reviewer?.username || activeRequest.teacher?.username || 'Reviewer'}</p>
                    </div>
                    <div className="text-xs text-gray-500">Session: {activeRequest.session?.title || 'Video'}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onRecordFollowUp?.({
                        parent_request_id: activeRequest.id,
                        teacher: activeRequest.teacher,
                        student_level: activeRequest.student_level,
                        goal: activeRequest.goal,
                        exercise_or_song: activeRequest.exercise_or_song,
                        notes: activeRequest.notes,
                        practiceSeries: activeRequest.session?.practice_series || '',
                      })}
                      className="rounded-full bg-gray-900 text-white px-4 py-2.5 text-sm font-medium hover:bg-gray-800 transition-colors"
                    >
                      Record follow-up
                    </button>
                    <button type="button" onClick={() => onOpenReviewRequest?.(activeRequest)} className="rounded-full border border-gray-200 bg-white text-gray-900 px-4 py-2.5 text-sm font-medium hover:bg-gray-50 transition-colors">
                      Open feedback
                    </button>
                  </div>
                </div>
              ) : isHomeMode && latestSessionNeedingRequest ? (
                <div className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 space-y-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <p className="text-sm font-medium text-gray-900">Ready to send</p>
                      <p className="text-xs text-gray-500 mt-1">Latest ready video: {latestSessionNeedingRequest.title}</p>
                    </div>
                    <div className="text-xs text-gray-500">{fmtDate(latestSessionNeedingRequest.recorded_at || latestSessionNeedingRequest.created_at)}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => onOpenSession?.(latestSessionNeedingRequest, { view: 'library', sessionId: null, seriesName: '' })} className="rounded-full bg-gray-900 text-white px-4 py-2.5 text-sm font-medium hover:bg-gray-800 transition-colors">
                      Open
                    </button>
                    <button type="button" onClick={onCreateVideo} className="rounded-full border border-gray-200 bg-white text-gray-900 px-4 py-2.5 text-sm font-medium hover:bg-gray-50 transition-colors">
                      Record
                    </button>
                  </div>
                </div>
              ) : isHomeMode && latestSeries ? (
                <div className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 space-y-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <p className="text-sm font-medium text-gray-900">Keep the thread going</p>
                      <p className="text-xs text-gray-500 mt-1">Latest thread: {latestSeries.seriesName}.</p>
                    </div>
                    <div className="text-xs text-gray-500">{latestSeries.items.length} takes</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => onOpenSeries?.(latestSeries.seriesName)} className="rounded-full border border-gray-200 bg-white text-gray-900 px-4 py-2.5 text-sm font-medium hover:bg-gray-50 transition-colors">
                      Open
                    </button>
                    <button type="button" onClick={onCreateVideo} className="rounded-full border border-gray-200 bg-white text-gray-900 px-4 py-2.5 text-sm font-medium hover:bg-gray-50 transition-colors">
                      Record
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-xl bg-gray-50 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-wide text-gray-500">Owned videos</p>
                    <p className="text-lg font-semibold text-gray-900 mt-1">{ownSessions.length}</p>
                  </div>
                  <div className="rounded-xl bg-gray-50 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-wide text-gray-500">Threads</p>
                    <p className="text-lg font-semibold text-gray-900 mt-1">{seriesGroups.length}</p>
                  </div>
                  <div className="rounded-xl bg-gray-50 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-wide text-gray-500">Standalone</p>
                    <p className="text-lg font-semibold text-gray-900 mt-1">{standaloneSessions.length}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 space-y-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{isArchiveMode ? 'Archive' : 'Browse archive'}</p>
                  <p className="text-xs text-gray-500 mt-1">{isArchiveMode ? 'Every owned video, thread, and standalone take.' : 'All your owned videos.'}</p>
                </div>
                <div className="flex flex-wrap gap-2 rounded-full border border-gray-200 p-1">
                  <button type="button" onClick={() => setArchiveView('all')} className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${archiveView === 'all' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:text-gray-900'}`}>
                    All my videos
                  </button>
                  <button type="button" onClick={() => setArchiveView('threads')} className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${archiveView === 'threads' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:text-gray-900'}`}>
                    Threads
                  </button>
                  <button type="button" onClick={() => setArchiveView('standalone')} className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${archiveView === 'standalone' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:text-gray-900'}`}>
                    Standalone
                  </button>
                </div>
              </div>

              {archiveView === 'all' ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">All videos • {ownSessions.length}</p>
                  {renderSessionRows(ownSessions)}
                </div>
              ) : null}

              {archiveView === 'threads' ? (
                seriesGroups.length > 0 ? (
                  <div className="space-y-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Practice threads • {seriesGroups.length}</p>
                    {seriesGroups.map(({ seriesName, items }) => {
                      const latest = items[0]
                      const latestRequest = activeRequestBySessionId.get(Number(latest.id))
                      const latestRequestStatus = String(latestRequest?.status || '').trim().toLowerCase()
                      const isExpanded = Boolean(expandedSeriesNames[seriesName])
                      return (
                        <div key={seriesName} className="rounded-2xl border border-gray-200 overflow-hidden">
                          <div className="px-4 py-3 bg-white">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-3 min-w-0">
                                <VideoThumbnail session={latest} className="relative w-24 h-16 rounded-xl shrink-0" />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="text-sm font-medium text-gray-900 line-clamp-1">{seriesName}</p>
                                    <span className="text-[11px] uppercase tracking-wide bg-gray-100 text-gray-700 px-2 py-1 rounded-full">{items.length} takes</span>
                                    {latestRequest ? <span className={`text-[11px] uppercase tracking-wide px-2 py-1 rounded-full ${requestStatusTone[latestRequestStatus] || 'bg-gray-100 text-gray-700'}`}>{requestStatusLabel(latestRequest.status)}</span> : null}
                                  </div>
                                  <p className="text-xs text-gray-500 mt-1">Latest {fmtDate(latest.recorded_at || latest.created_at)}</p>
                                  <p className="text-xs text-gray-500 mt-2 line-clamp-2">Newest take: {latest.title}</p>
                                </div>
                              </div>
                              <div className="text-right shrink-0 space-y-2">
                                <p className="text-xs text-gray-500">{items.reduce((sum, item) => sum + (item.video_feedback_count || 0), 0)} replies</p>
                                <div className="flex flex-wrap justify-end gap-2">
                                  <button type="button" onClick={() => toggleSeriesExpanded(seriesName)} className="text-xs text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors">
                                    {isExpanded ? 'Hide takes' : 'Show takes'}
                                  </button>
                                  <button type="button" onClick={() => onOpenSeries?.(seriesName)} className="text-xs text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors">
                                    Open thread
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                          {isExpanded ? (
                            <div className="border-t border-gray-200 bg-gray-50 px-3 py-3 space-y-2">
                              {renderSessionRows(items, { view: 'series', sessionId: null, seriesName })}
                            </div>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-gray-200 px-4 py-4 text-center">
                    <p className="text-sm text-gray-600">No practice threads yet.</p>
                    <p className="text-xs text-gray-400 mt-1">Add a thread name when saving a video to group repeated takes.</p>
                  </div>
                )
              ) : null}

              {archiveView === 'standalone' ? (
                standaloneSessions.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Standalone videos • {standaloneSessions.length}</p>
                    {renderSessionRows(standaloneSessions)}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-gray-200 px-4 py-4 text-center">
                    <p className="text-sm text-gray-600">No standalone videos.</p>
                    <p className="text-xs text-gray-400 mt-1">Every owned video is currently grouped into a thread.</p>
                  </div>
                )
              ) : null}
            </div>

            {isHomeMode ? (
            <details className="rounded-2xl border border-gray-200 bg-white px-4 py-3">
              <summary className="cursor-pointer list-none flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Invite tools</p>
                  <p className="text-xs text-gray-500 mt-1">Secondary.</p>
                </div>
                <span className="text-xs text-gray-500">Show</span>
              </summary>
              <div className="pt-4">
                <InviteCodesPanel token={token} />
              </div>
            </details>
            ) : null}
          </div>
        )}
        <ThreadPickerModal
          open={Boolean(editingThreadSession)}
          title={`${editingThreadSession?.practice_series ? 'Change' : 'Add to'} thread`}
          initialValue={editingThreadSession?.practice_series || ''}
          options={threadOptions}
          saving={savingThread}
          onSave={saveThreadForEditing}
          onClose={() => setEditingThreadSession(null)}
        />
      </div>
    </div>
  )
}

export default LibraryView
