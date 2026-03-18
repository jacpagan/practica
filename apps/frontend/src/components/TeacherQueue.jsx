import React from 'react'
import { fmtDate } from '../utils'

function TeacherQueue({ sessions = [], sessionsLoading = false, onOpenSession }) {
  const now = Date.now()
  const reviewable = sessions
    .filter((session) => session.can_review_feedback && !session.can_edit)
    .sort((left, right) => {
      const leftRecordedAt = new Date(left.recorded_at || left.created_at).getTime()
      const rightRecordedAt = new Date(right.recorded_at || right.created_at).getTime()
      const leftStale = now - leftRecordedAt > 3 * 24 * 60 * 60 * 1000
      const rightStale = now - rightRecordedAt > 3 * 24 * 60 * 60 * 1000
      if (left.has_unread !== right.has_unread) return left.has_unread ? -1 : 1
      if (left.needs_review !== right.needs_review) return left.needs_review ? -1 : 1
      if (leftStale !== rightStale) return leftStale ? -1 : 1
      return leftRecordedAt - rightRecordedAt
    })

  const needsReviewCount = reviewable.filter((session) => session.needs_review).length
  const unreadCount = reviewable.filter((session) => session.has_unread).length

  return (
    <div className="px-4 sm:px-6 py-6">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6 space-y-2">
          <h2 className="text-2xl font-semibold text-gray-900 tracking-tight">Review</h2>
          <p className="text-sm text-gray-500">Open student clips, leave timestamped feedback, and keep the practice loop moving.</p>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="rounded-full bg-gray-100 px-3 py-1">{reviewable.length} student clip{reviewable.length === 1 ? '' : 's'}</span>
            <span className="rounded-full bg-amber-100 text-amber-800 px-3 py-1">{needsReviewCount} need review</span>
            <span className="rounded-full bg-blue-100 text-blue-800 px-3 py-1">{unreadCount} new updates</span>
          </div>
        </div>

        {sessionsLoading ? (
          <div className="rounded-2xl border border-gray-200 px-4 py-8 text-center text-sm text-gray-500">Loading review queue…</div>
        ) : reviewable.length ? (
          <div className="space-y-2">
            {reviewable.map((session) => {
              const recordedAt = new Date(session.recorded_at || session.created_at)
              const stale = now - recordedAt.getTime() > 3 * 24 * 60 * 60 * 1000
              return (
              <button
                key={session.id}
                type="button"
                onClick={() => onOpenSession?.(session, 'review')}
                className="w-full text-left rounded-2xl border border-gray-200 px-4 py-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-gray-900 line-clamp-1">{session.title}</p>
                      {session.has_unread ? (
                        <span className="text-[11px] uppercase tracking-wide bg-blue-100 text-blue-800 px-2 py-1 rounded-full">New activity</span>
                      ) : session.needs_review ? (
                        <span className="text-[11px] uppercase tracking-wide bg-amber-100 text-amber-800 px-2 py-1 rounded-full">Needs review</span>
                      ) : (
                        <span className="text-[11px] uppercase tracking-wide bg-gray-100 text-gray-600 px-2 py-1 rounded-full">Reviewed</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {session.owner_name || 'Student'}
                      {session.space_name ? ` · ${session.space_name}` : ''}
                      {` · ${fmtDate(session.recorded_at || session.created_at)}`}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap mt-2">
                      <span className="text-[11px] uppercase tracking-wide bg-emerald-100 text-emerald-800 px-2 py-1 rounded-full">{session.student_streak_days || 0} day streak</span>
                      {stale ? <span className="text-[11px] uppercase tracking-wide bg-rose-100 text-rose-800 px-2 py-1 rounded-full">Stale</span> : null}
                    </div>
                    {session.description ? <p className="text-xs text-gray-500 mt-2 line-clamp-2">{session.description}</p> : null}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[11px] uppercase tracking-wide text-gray-400">{session.processing_status === 'ready' ? 'Ready' : session.processing_status || 'Saved'}</p>
                    <p className="text-xs text-gray-500 mt-2">{session.review_feedback_count || 0} feedback</p>
                  </div>
                </div>
              </button>
              )
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-8 text-center">
            <p className="text-sm text-gray-600">No student clips need review right now.</p>
            <p className="text-xs text-gray-400 mt-1">When students upload into spaces you own, they will show up here.</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default TeacherQueue
