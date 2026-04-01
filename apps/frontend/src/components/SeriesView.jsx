import React, { useMemo, useState } from 'react'
import { useToast } from './Toast'
import { fmtDate } from '../utils'
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

function SeriesView({ seriesName = '', sessions = [], reviewRequests = [], onBack, onOpenSession, onCreateVideo }) {
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
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
  const totalReplies = useMemo(
    () => seriesSessions.reduce((sum, session) => sum + Number(session.video_feedback_count || 0), 0),
    [seriesSessions],
  )
  const latestRequestStatus = String(latestSession?.activeRequest?.status || '').trim().toLowerCase()

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
              <p className="text-sm text-gray-500 mt-2">{seriesSessions.length} takes{latestSession ? ` • latest ${new Date(latestSession.recorded_at || latestSession.created_at).toLocaleString(undefined, { hour12: undefined })}` : ''}</p>
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
                  <p className="text-sm text-gray-500 mt-1">{latestSession ? new Date(latestSession.recorded_at || latestSession.created_at).toLocaleString(undefined, { hour12: undefined }) : ''}</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] uppercase tracking-wide bg-gray-100 text-gray-700 px-2 py-1 rounded-full">Take {latestSession?.takeNumber}</span>
                  {latestSession?.processing_status === 'ready' ? <span className="text-[11px] uppercase tracking-wide bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">Ready</span> : null}
                  {latestSession?.processing_status === 'processing' ? <span className="text-[11px] uppercase tracking-wide bg-amber-100 text-amber-800 px-2 py-1 rounded-full">Processing</span> : null}
                  {latestSession?.activeRequest ? <span className={`text-[11px] uppercase tracking-wide px-2 py-1 rounded-full ${requestStatusTone[latestRequestStatus] || 'bg-gray-100 text-gray-700'}`}>{requestStatusLabel(latestSession.activeRequest.status)}</span> : null}
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
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] uppercase tracking-wide bg-gray-100 text-gray-700 px-2 py-1 rounded-full">Take {previousSession.takeNumber}</span>
                      <span className="text-[11px] uppercase tracking-wide bg-gray-100 text-gray-700 px-2 py-1 rounded-full">{previousSession.video_feedback_count || 0} replies</span>
                    </div>
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
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] uppercase tracking-wide bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">Reviewed</span>
                      <span className="text-[11px] uppercase tracking-wide bg-gray-100 text-gray-700 px-2 py-1 rounded-full">Take {latestReviewedSession.takeNumber}</span>
                    </div>
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
                <span className="text-xs text-gray-500">{seriesSessions.length} takes</span>
              </div>
              <div className="space-y-3">
                {seriesSessions.map((session) => (
                  <SessionListItem
                    key={session.id}
                    session={session}
                    status={session.activeRequest?.status}
                    onOpen={() => onOpenSession?.(session, { view: 'series', seriesName })}
                    onRecordFollowUp={session.activeRequest ? () => onCreateVideo?.({ parent_request_id: session.activeRequest.id, practiceSeries: seriesName }) : null}
                    onChangeThread={() => setEditing(session)}
                  />
                ))}
              </div>
              <ThreadPickerModal
                open={Boolean(editing)}
                title={`${editing?.practice_series ? 'Change' : 'Add to'} thread`}
                initialValue={editing?.practice_series || ''}
                options={threadOptions}
                saving={saving}
                onClose={() => setEditing(null)}
                onSave={async (val) => {
                  if (!editing?.id) return
                  setSaving(true)
                  try {
                    const res = await fetch(`/api/sessions/${editing.id}/`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ practice_series: val }),
                    })
                    const data = await res.json().catch(() => ({}))
                    if (!res.ok) throw new Error(data?.error || 'Could not update')
                    try { window.dispatchEvent(new CustomEvent('practica:session-updated', { detail: { id: editing.id } })) } catch {}
                    toast.success(val ? 'Moved to thread' : 'Removed from thread')
                  } catch (e) { toast.error(e?.message || 'Could not update thread') }
                  setSaving(false)
                  setEditing(null)
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
