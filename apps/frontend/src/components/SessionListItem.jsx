import React from 'react'
import VideoThumbnail from './VideoThumbnail'
import StatusChip from './StatusChip'

export default function SessionListItem({ session, onOpen, status = '', showSeries = false, highlight = false }) {
  if (!session) return null
  const recordedAt = new Date(session.recorded_at || session.created_at)
  const replies = Number(session.video_feedback_count || 0)
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`w-full text-left rounded-2xl border border-gray-200 px-4 py-4 hover:bg-gray-50 transition-colors ${highlight ? 'ring-1 ring-gray-300' : ''}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <VideoThumbnail session={session} className="relative w-24 h-16 rounded-xl shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {status ? <StatusChip status={status} /> : null}
              {session.processing_status === 'ready' ? (
                <span className="text-[11px] uppercase tracking-wide bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">Ready</span>
              ) : null}
              {showSeries && session.practice_series ? (
                <span className="text-[11px] uppercase tracking-wide bg-gray-100 text-gray-700 px-2 py-1 rounded-full">
                  {String(session.practice_series).trim()}
                </span>
              ) : null}
            </div>
            <p className="text-sm font-medium text-gray-900 mt-2 line-clamp-1">{session.title || 'Untitled'}</p>
            <p className="text-xs text-gray-500 mt-1">{recordedAt.toLocaleString(undefined, { hour12: undefined })}</p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs text-gray-500">{replies} {replies === 1 ? 'reply' : 'replies'}</p>
          <p className="text-xs text-gray-400 mt-2">Open</p>
        </div>
      </div>
    </button>
  )
}

