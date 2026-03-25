import React, { useMemo } from 'react'
import VideoThumbnail from './VideoThumbnail'

function SeriesView({ seriesName = '', sessions = [], onBack, onOpenSession, onCreateVideo }) {
  const seriesSessions = useMemo(
    () => sessions
      .filter((session) => session.can_edit && String(session.practice_series || '').trim() === String(seriesName || '').trim())
      .sort((left, right) => new Date(left.recorded_at || left.created_at) - new Date(right.recorded_at || right.created_at)),
    [seriesName, sessions],
  )

  const latestSession = seriesSessions[seriesSessions.length - 1] || null

  return (
    <div className="px-4 sm:px-6 py-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="space-y-3">
          <button type="button" onClick={onBack} className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
            ← Back to library
          </button>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Practice thread</p>
              <h2 className="text-2xl font-semibold text-gray-900 tracking-tight mt-1">{seriesName}</h2>
              <p className="text-sm text-gray-500 mt-2">{seriesSessions.length} takes{latestSession ? ` • latest ${new Date(latestSession.recorded_at || latestSession.created_at).toLocaleString()}` : ''}</p>
            </div>
            <button
              type="button"
              onClick={onCreateVideo}
              className="rounded-full bg-gray-900 text-white px-4 py-2.5 text-sm font-medium hover:bg-gray-800 transition-colors"
            >
              New take
            </button>
          </div>
        </div>

        {seriesSessions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-10 text-center">
            <p className="text-sm text-gray-700">No takes in this thread yet.</p>
            <p className="text-xs text-gray-500 mt-1">Create a new video and save it into this practice thread.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {seriesSessions.map((session, index) => (
              <button
                key={session.id}
                type="button"
                onClick={() => onOpenSession?.(session, { view: 'series', seriesName })}
                className="w-full text-left rounded-2xl border border-gray-200 px-4 py-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <VideoThumbnail session={session} className="relative w-24 h-16 rounded-xl shrink-0" />
                    <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] uppercase tracking-wide bg-gray-100 text-gray-700 px-2 py-1 rounded-full">Take {index + 1}</span>
                      {session.processing_status === 'ready' ? <span className="text-[11px] uppercase tracking-wide bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">Ready</span> : null}
                    </div>
                    <p className="text-sm font-medium text-gray-900 mt-3 line-clamp-1">{session.title}</p>
                    <p className="text-xs text-gray-500 mt-1">{new Date(session.recorded_at || session.created_at).toLocaleString()}</p>
                    {session.description ? <p className="text-xs text-gray-500 mt-2 line-clamp-2">{session.description}</p> : null}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-gray-500">{session.video_feedback_count || 0} replies</p>
                    <p className="text-xs text-gray-400 mt-2">Open</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default SeriesView
