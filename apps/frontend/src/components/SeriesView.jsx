import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useToast } from './Toast'
import { fmtDate } from '../utils'
import VideoThumbnail from './VideoThumbnail'
import SessionListItem from './SessionListItem'
import ThreadPickerModal from './ThreadPickerModal'
import StatusChip from './StatusChip'

const formatCompactDateTime = (value) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const dayPart = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  const timePart = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  return `${dayPart} · ${timePart}`
}

function SeriesView({ seriesName = '', sessions = [], sessionsLoading = false, reviewRequests = [], token = '', onBack, onOpenSession, onCreateVideo }) {
  const [renamingThread, setRenamingThread] = useState('')
  const [threadMenuOpen, setThreadMenuOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const threadMenuRef = useRef(null)
  const toast = useToast()
  const threadOptions = useMemo(() => Array.from(new Set(sessions.map(s => String(s.practice_series || '').trim()).filter(Boolean))).sort(), [sessions])
  const seriesSessions = useMemo(() => {
    const filtered = sessions
      .filter((session) => session.can_edit && String(session.practice_series || '').trim() === String(seriesName || '').trim())
      .sort((left, right) => new Date(left.recorded_at || left.created_at) - new Date(right.recorded_at || right.created_at))

    const activeRequestBySessionId = new Map()
    ;[...reviewRequests]
      .sort((left, right) => new Date(right.created_at) - new Date(left.created_at))
      .forEach((requestItem) => {
        const status = String(requestItem?.status || '').trim().toLowerCase()
        if (['closed', 'revoked'].includes(status)) return
        const sessionId = Number(requestItem?.session?.id || requestItem?.session_id || 0)
        if (!sessionId || activeRequestBySessionId.has(sessionId)) return
        activeRequestBySessionId.set(sessionId, requestItem)
      })

    return filtered.map((session, index) => ({
      ...session,
      takeNumber: index + 1,
      activeRequest: activeRequestBySessionId.get(Number(session.id)) || null,
    }))
  }, [reviewRequests, seriesName, sessions])

  const latestSession = seriesSessions[seriesSessions.length - 1] || null
  const previousSession = seriesSessions.length > 1 ? seriesSessions[seriesSessions.length - 2] : null
  const reviewedSessions = useMemo(
    () => seriesSessions.filter((session) => Number(session.video_feedback_count || 0) > 0),
    [seriesSessions],
  )
  const latestReviewedSession = reviewedSessions[reviewedSessions.length - 1] || null
  useEffect(() => {
    if (!threadMenuOpen) return undefined
    const handlePointerDown = (event) => {
      const node = threadMenuRef.current
      if (!node || node.contains(event.target)) return
      setThreadMenuOpen(false)
    }
    window.addEventListener('pointerdown', handlePointerDown)
    return () => window.removeEventListener('pointerdown', handlePointerDown)
  }, [threadMenuOpen])
  if (sessionsLoading) {
    return (
      <div className="px-4 sm:px-6 py-6">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Practice thread</p>
              <div className="h-6 w-48 bg-gray-200 rounded animate-pulse mt-1" />
              <div className="h-4 w-32 bg-gray-100 rounded animate-pulse mt-2" />
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="h-10 w-28 bg-gray-200 rounded animate-pulse" />
              <div className="h-10 w-28 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>
          <div className="space-y-3">
            <div className="h-24 w-full bg-gray-100 rounded-2xl animate-pulse" />
            <div className="h-24 w-full bg-gray-100 rounded-2xl animate-pulse" />
            <div className="h-24 w-full bg-gray-100 rounded-2xl animate-pulse" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 sm:px-6 py-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="space-y-3">
          <button type="button" onClick={onBack} className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
            ← Back to home
          </button>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Practice thread</p>
              <h2 className="text-2xl font-semibold text-gray-900 tracking-tight mt-1">{seriesName}</h2>
              <p className="text-sm text-gray-500 mt-2">{latestSession ? `Latest ${formatCompactDateTime(latestSession.recorded_at || latestSession.created_at)}` : 'No takes yet'}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {latestSession ? (
                <button
                  type="button"
                  onClick={() => onOpenSession?.(latestSession, { view: 'series', seriesName })}
                  className="rounded-full border border-gray-200 bg-white text-gray-900 px-4 py-2.5 text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Open latest
                </button>
              ) : null}
              <button
                type="button"
                onClick={onCreateVideo}
                className="rounded-full bg-gray-900 text-white px-4 py-2.5 text-sm font-medium hover:bg-gray-800 transition-colors"
              >
                New take
              </button>
            </div>
          </div>
        </div>

        {seriesSessions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-10 text-center">
            <p className="text-sm text-gray-700">No takes in this thread yet.</p>
            <p className="text-xs text-gray-500 mt-1">Create a new video and save it into this practice thread.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">Latest take</p>
                  <h3 className="text-lg font-semibold text-gray-900 mt-1">{latestSession?.title}</h3>
                  <p className="text-sm text-gray-500 mt-1">{latestSession ? formatCompactDateTime(latestSession.recorded_at || latestSession.created_at) : ''}</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] uppercase tracking-wide bg-gray-100 text-gray-700 px-2 py-1 rounded-full">Take {latestSession?.takeNumber}</span>
                  {latestSession?.processing_status === 'ready' ? <span className="text-[11px] uppercase tracking-wide bg-gray-100 text-gray-600 px-2 py-1 rounded-full">Ready</span> : null}
                  {latestSession?.processing_status === 'processing' ? <span className="text-[11px] uppercase tracking-wide bg-amber-100 text-amber-800 px-2 py-1 rounded-full">Processing</span> : null}
                  {latestSession?.activeRequest ? <StatusChip status={latestSession.activeRequest.status} resolution={latestSession.activeRequest.resolution} /> : null}
                </div>
              </div>
              <div className="p-4 space-y-4">
                <VideoThumbnail session={latestSession} className="relative w-full max-w-xl aspect-video rounded-2xl overflow-hidden bg-black" />
                {/* Removed thread stats summary for leaner UI */}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenSession?.(latestSession, { view: 'series', seriesName })}
                    className="rounded-full bg-gray-900 text-white px-4 py-2.5 text-sm font-medium hover:bg-gray-800 transition-colors"
                  >
                    Open latest take
                  </button>
                  <button
                    type="button"
                    onClick={onCreateVideo}
                    className="rounded-full border border-gray-200 bg-white text-gray-900 px-4 py-2.5 text-sm font-medium hover:bg-gray-50 transition-colors"
                  >
                    Record next take
                  </button>
                </div>
              </div>
            </div>

            {(previousSession || latestReviewedSession) ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {previousSession ? (
                  <div className="rounded-2xl border border-gray-200 bg-white px-4 py-4 space-y-3">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500">Previous take</p>
                      <p className="text-sm font-medium text-gray-900 mt-1">{previousSession.title}</p>
                      <p className="text-xs text-gray-500 mt-1">{fmtDate(previousSession.recorded_at || previousSession.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap" />
                    <button type="button" onClick={() => onOpenSession?.(previousSession, { view: 'series', seriesName })} className="text-sm text-gray-700 border border-gray-200 rounded-lg px-4 py-2.5 hover:bg-gray-50 transition-colors">
                      Open previous take
                    </button>
                  </div>
                ) : null}

                {latestReviewedSession ? (
                  <div className="rounded-2xl border border-gray-200 bg-white px-4 py-4 space-y-3">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500">Latest feedback returned</p>
                      <p className="text-sm font-medium text-gray-900 mt-1">{latestReviewedSession.title}</p>
                      <p className="text-xs text-gray-500 mt-1">{latestReviewedSession.video_feedback_count || 0} replies attached</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap" />
                    <button type="button" onClick={() => onOpenSession?.(latestReviewedSession, { view: 'series', seriesName })} className="text-sm text-gray-700 border border-gray-200 rounded-lg px-4 py-2.5 hover:bg-gray-50 transition-colors">
                      Open reviewed take
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="rounded-2xl border border-gray-200 bg-white px-4 py-4 space-y-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Thread timeline</p>
                  <p className="text-xs text-gray-500 mt-1">Oldest to newest.</p>
                </div>
                <div className="relative" ref={threadMenuRef}>
                  <button
                    type="button"
                    onClick={() => setThreadMenuOpen((open) => !open)}
                    className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                    aria-expanded={threadMenuOpen ? 'true' : 'false'}
                    aria-haspopup="menu"
                  >
                    •••
                  </button>
                  {threadMenuOpen ? (
                    <div className="absolute right-0 mt-2 w-44 rounded-xl border border-gray-200 bg-white p-1.5 shadow-lg z-10" role="menu">
                      <button
                        type="button"
                        onClick={() => {
                          setThreadMenuOpen(false)
                          setRenamingThread(seriesName)
                        }}
                        className="w-full text-left rounded-lg px-2.5 py-2 text-xs text-gray-700 hover:bg-gray-50"
                        role="menuitem"
                      >
                        Rename thread
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="space-y-3">
                {seriesSessions.map((session) => (
                  <SessionListItem
                    key={session.id}
                    session={session}
                    requestItem={session.activeRequest}
                    status={session.activeRequest?.status}
                    onOpen={() => onOpenSession?.(session, { view: 'series', seriesName })}
                    minimal
                  />
                ))}
              </div>
              <ThreadPickerModal
                open={Boolean(renamingThread)}
                title="Rename thread"
                initialValue={renamingThread || ''}
                options={threadOptions}
                saving={saving}
                onClose={() => setRenamingThread('')}
                onSave={async (val) => {
                  if (!renamingThread || !token) return
                  setSaving(true)
                  try {
                    const res = await fetch('/api/sessions/threads/rename/', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Token ${token}` } : {}) },
                      body: JSON.stringify({ old_practice_series: renamingThread, new_practice_series: val }),
                    })
                    const data = await res.json().catch(() => ({}))
                    if (!res.ok) throw new Error(data?.error || 'Could not rename thread')
                    try { window.dispatchEvent(new CustomEvent('practica:thread-renamed', { detail: { oldSeriesName: renamingThread, newSeriesName: val } })) } catch {}
                    toast.success(
                      data?.affected_count === 1
                        ? `Renamed “${renamingThread}” to “${val}” on 1 take`
                        : `Renamed “${renamingThread}” to “${val}” on ${data?.affected_count || 0} takes`
                    )
                  } catch (e) { toast.error(e?.message || 'Could not rename thread') }
                  setSaving(false)
                  setRenamingThread('')
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default SeriesView
