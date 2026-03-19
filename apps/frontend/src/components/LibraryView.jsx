import React, { useMemo } from 'react'
import { fmtDate } from '../utils'

function LibraryView({ sessions = [], sessionsLoading = false, onOpenSession, onCreateVideo }) {
  const ownSessions = useMemo(
    () => sessions
      .filter((session) => session.can_edit)
      .sort((left, right) => new Date(right.recorded_at || right.created_at) - new Date(left.recorded_at || left.created_at)),
    [sessions],
  )

  return (
    <div className="px-4 sm:px-6 py-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900 tracking-tight">My Library</h2>
            <p className="text-sm text-gray-500 mt-1">Every video stays private until you share a private feedback link.</p>
          </div>
          <button
            type="button"
            onClick={onCreateVideo}
            className="rounded-2xl bg-gray-900 text-white px-4 py-3 text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            Record or upload
          </button>
        </div>

        {sessionsLoading ? (
          <div className="rounded-2xl border border-gray-200 px-4 py-8 text-center text-sm text-gray-500">Loading library…</div>
        ) : ownSessions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-10 text-center">
            <p className="text-sm text-gray-700">No videos yet.</p>
            <p className="text-xs text-gray-500 mt-1">Record your first video, keep it private, and share it later when you want personalized feedback.</p>
            <button
              type="button"
              onClick={onCreateVideo}
              className="mt-4 rounded-xl bg-gray-900 text-white px-4 py-2.5 text-sm font-medium hover:bg-gray-800 transition-colors"
            >
              Create first video
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {ownSessions.map((session) => (
              <button
                key={session.id}
                type="button"
                onClick={() => onOpenSession?.(session, 'library')}
                className="w-full text-left rounded-2xl border border-gray-200 px-4 py-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-gray-900 line-clamp-1">{session.title}</p>
                      <span className="text-[11px] uppercase tracking-wide bg-gray-100 text-gray-700 px-2 py-1 rounded-full">Private</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{fmtDate(session.recorded_at || session.created_at)}</p>
                    {session.description ? <p className="text-xs text-gray-500 mt-2 line-clamp-2">{session.description}</p> : null}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[11px] uppercase tracking-wide text-gray-400">{session.processing_status === 'ready' ? 'Ready' : session.processing_status || 'Saved'}</p>
                    <p className="text-xs text-gray-500 mt-2">{session.video_feedback_count || 0} video feedback</p>
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

export default LibraryView
