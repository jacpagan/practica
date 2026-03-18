import React from 'react'
import { fmtDate } from '../utils'

function TeacherQueue({ primaryRole = 'teacher', sessions = [], sessionsLoading = false, onOpenSession }) {
  const now = Date.now()
  const reviewable = sessions
    .filter((session) => session.can_review_feedback && !session.can_edit)
  const needsAttention = reviewable
    .filter((session) => session.needs_review || session.has_unread)
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
  const coachedByYou = reviewable
    .filter((session) => session.has_feedback_from_you && !session.needs_review && !session.has_unread)
    .sort((left, right) => new Date(right.recorded_at || right.created_at) - new Date(left.recorded_at || left.created_at))

  const needsReviewCount = needsAttention.filter((session) => session.needs_review).length
  const unreadCount = needsAttention.filter((session) => session.has_unread).length
  const nextToReview = needsAttention[0] || null

  const renderSessionRow = (session) => {
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
                <span className="text-[11px] uppercase tracking-wide bg-emerald-100 text-emerald-800 px-2 py-1 rounded-full">Coached by you</span>
              )}
            </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {session.owner_name || 'Student'}
                      {session.space_name ? ` · ${session.space_name}` : ''}
                      {` · ${fmtDate(session.recorded_at || session.created_at)}`}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap mt-2">
                      {stale ? <span className="text-[11px] uppercase tracking-wide bg-rose-100 text-rose-800 px-2 py-1 rounded-full">Stale</span> : null}
                      {session.feedback_given_by_you_count ? <span className="text-[11px] uppercase tracking-wide bg-gray-100 text-gray-700 px-2 py-1 rounded-full">{session.feedback_given_by_you_count} from you</span> : null}
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
  }

  return (
    <div className="px-4 sm:px-6 py-6">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6 space-y-2">
          <h2 className="text-2xl font-semibold text-gray-900 tracking-tight">Review</h2>
          <p className="text-sm text-gray-500">
            {primaryRole === 'teacher_student'
              ? 'This is your teacher inbox. It shows student clips that need your coaching; your own uploads stay in Record / Upload and Library.'
              : 'Open student clips, leave timestamped feedback, and keep the practice loop moving.'}
          </p>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="rounded-full bg-gray-100 px-3 py-1">{reviewable.length} student clip{reviewable.length === 1 ? '' : 's'}</span>
            <span className="rounded-full bg-amber-100 text-amber-800 px-3 py-1">{needsReviewCount} need review</span>
            <span className="rounded-full bg-blue-100 text-blue-800 px-3 py-1">{unreadCount} new updates</span>
          </div>
        </div>

        {nextToReview ? (
          <div className="rounded-3xl border border-gray-900 bg-gray-900 text-white px-5 py-5 mb-6">
            <p className="text-xs font-medium uppercase tracking-wide text-white/70">Next action</p>
            <p className="text-xl font-semibold mt-1">Review {nextToReview.owner_name || 'your student'}’s latest clip</p>
            <p className="text-sm text-white/75 mt-2">
              {nextToReview.has_unread
                ? 'There is new activity waiting for you on this clip.'
                : 'This student clip is waiting for your first round of coaching.'}
            </p>
            <button
              type="button"
              onClick={() => onOpenSession?.(nextToReview, 'review')}
              className="mt-4 rounded-2xl bg-white text-gray-900 px-4 py-3 text-sm font-medium hover:bg-gray-100 transition-colors"
            >
              Open next review
            </button>
          </div>
        ) : null}

        {sessionsLoading ? (
          <div className="rounded-2xl border border-gray-200 px-4 py-8 text-center text-sm text-gray-500">Loading review queue…</div>
        ) : reviewable.length ? (
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-900">Needs your attention</h3>
                <span className="text-xs text-gray-400">{needsAttention.length}</span>
              </div>
              {needsAttention.length ? <div className="space-y-2">{needsAttention.map(renderSessionRow)}</div> : <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-500">Nothing urgent right now.</div>}
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-900">Recent coaching by you</h3>
                <span className="text-xs text-gray-400">{coachedByYou.length}</span>
              </div>
              {coachedByYou.length ? <div className="space-y-2">{coachedByYou.map(renderSessionRow)}</div> : <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-500">Your reviewed student clips will show up here.</div>}
            </div>
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
