import React, { useMemo } from 'react'
import { fmtDate } from '../utils'

function LibraryView({ sessions = [], sessionsLoading = false, onOpenSession, onOpenSeries, onCreateVideo }) {
  const ownSessions = useMemo(
    () => sessions
      .filter((session) => session.can_edit)
      .sort((left, right) => new Date(right.recorded_at || right.created_at) - new Date(left.recorded_at || left.created_at)),
    [sessions],
  )
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
  const readyCount = ownSessions.filter((session) => session.processing_status === 'ready').length
  const feedbackCount = ownSessions.reduce((sum, session) => sum + (session.video_feedback_count || 0), 0)

  return (
    <div className="px-4 sm:px-6 py-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-3">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900 tracking-tight">Library</h2>
              <p className="text-sm text-gray-500 mt-1">Private by default.</p>
            </div>
            {!sessionsLoading ? (
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">{ownSessions.length} videos</span>
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">{readyCount} ready</span>
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">{feedbackCount} replies</span>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onCreateVideo}
            className="rounded-full bg-gray-900 text-white px-4 py-2.5 text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            New video
          </button>
        </div>

        {sessionsLoading ? (
          <div className="rounded-2xl border border-gray-200 px-4 py-8 text-center text-sm text-gray-500">Loading library…</div>
        ) : ownSessions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-10 text-center">
            <p className="text-sm text-gray-700">No videos yet.</p>
            <p className="text-xs text-gray-500 mt-1">Record or upload one to start your private library.</p>
            <button
              type="button"
              onClick={onCreateVideo}
              className="mt-4 rounded-full bg-gray-900 text-white px-4 py-2.5 text-sm font-medium hover:bg-gray-800 transition-colors"
            >
              New video
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {seriesGroups.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Practice threads</p>
                {seriesGroups.map(({ seriesName, items }) => {
                  const latest = items[0]
                  return (
                    <button
                      key={seriesName}
                      type="button"
                      onClick={() => onOpenSeries?.(seriesName)}
                      className="w-full text-left rounded-2xl border border-gray-200 px-4 py-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-gray-900 line-clamp-1">{seriesName}</p>
                            <span className="text-[11px] uppercase tracking-wide bg-gray-100 text-gray-700 px-2 py-1 rounded-full">{items.length} takes</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">Latest {fmtDate(latest.recorded_at || latest.created_at)}</p>
                          <p className="text-xs text-gray-500 mt-2 line-clamp-2">Newest take: {latest.title}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs text-gray-500">{items.reduce((sum, item) => sum + (item.video_feedback_count || 0), 0)} replies</p>
                          <p className="text-xs text-gray-400 mt-2">Open thread</p>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            ) : null}

            {standaloneSessions.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Standalone videos</p>
                {standaloneSessions.map((session) => (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => onOpenSession?.(session, { view: 'library', sessionId: null, seriesName: '' })}
                    className="w-full text-left rounded-2xl border border-gray-200 px-4 py-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-gray-900 line-clamp-1">{session.title}</p>
                          <span className="text-[11px] uppercase tracking-wide bg-gray-100 text-gray-700 px-2 py-1 rounded-full">Private</span>
                          {session.processing_status === 'ready' ? <span className="text-[11px] uppercase tracking-wide bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">Ready</span> : null}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{fmtDate(session.recorded_at || session.created_at)}</p>
                        {session.description ? <p className="text-xs text-gray-500 mt-2 line-clamp-2">{session.description}</p> : null}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-gray-500">{session.video_feedback_count || 0} replies</p>
                        <p className="text-xs text-gray-400 mt-2">Open</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}

export default LibraryView
