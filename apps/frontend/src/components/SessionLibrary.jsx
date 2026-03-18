import React from 'react'
import { fmtDate } from '../utils'

function SessionLibrary({
  sessions = [],
  sessionsLoading = false,
  sessionsLoadingMore = false,
  hasMoreSessions = false,
  onLoadMoreSessions,
  onOpenSession,
  onDeleteSession,
}) {
  return (
    <div className="px-4 sm:px-6 py-6">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold text-gray-900 tracking-tight">Library</h2>
          <p className="text-sm text-gray-500 mt-1">Your practice entries, feedback, and shareable reviews in one place.</p>
        </div>

        {sessionsLoading ? (
          <div className="rounded-2xl border border-gray-200 px-4 py-8 text-center text-sm text-gray-500">Loading practice entries…</div>
        ) : sessions.length ? (
          <div className="space-y-2">
            {sessions.map((session) => (
              <div key={session.id} className="rounded-2xl border border-gray-200 px-4 py-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <button type="button" onClick={() => onOpenSession?.(session)} className="flex-1 text-left min-w-0">
                    <p className="text-sm font-medium text-gray-900 line-clamp-1">{session.title}</p>
                    <p className="text-xs text-gray-500 mt-1">{fmtDate(session.recorded_at || session.created_at)}</p>
                    {session.description ? <p className="text-xs text-gray-500 mt-2 line-clamp-2">{session.description}</p> : null}
                    {session.processing_status === 'failed' && session.processing_error ? (
                      <p className="text-xs text-red-600 mt-2 line-clamp-2">{session.processing_error}</p>
                    ) : null}
                  </button>
                  <div className="flex flex-col items-end gap-2 pl-2">
                    <span className="text-[11px] uppercase tracking-wide text-gray-400">
                      {session.processing_status === 'ready' ? 'Ready' : session.processing_status || 'Saved'}
                    </span>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => onOpenSession?.(session)} className="text-xs text-gray-500 hover:text-gray-900 transition-colors">
                        Open
                      </button>
                      {session.can_edit ? (
                        <button
                          type="button"
                          onClick={() => onDeleteSession?.(session)}
                          className="text-xs text-red-600 hover:text-red-700 transition-colors"
                        >
                          Delete
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {hasMoreSessions ? (
              <button
                type="button"
                onClick={() => onLoadMoreSessions?.()}
                disabled={sessionsLoadingMore}
                className="w-full text-sm text-gray-600 border border-gray-200 rounded-2xl py-3 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                {sessionsLoadingMore ? 'Loading…' : 'Load more'}
              </button>
            ) : null}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-8 text-center">
            <p className="text-sm text-gray-600">No practice entries yet.</p>
            <p className="text-xs text-gray-400 mt-1">Record or upload your first video to start your library.</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default SessionLibrary
