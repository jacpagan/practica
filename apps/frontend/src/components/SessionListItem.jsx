import React from 'react'
import VideoThumbnail from './VideoThumbnail'
import StatusChip from './StatusChip'
import usePrefetchSession from '../hooks/usePrefetchSession'
import { fmtTimer } from '../utils'

const formatResolutionTimestamp = (resolution) => {
  const raw = resolution?.updated_at || resolution?.created_at || ''
  if (!raw) return ''
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString(undefined, { hour12: undefined })
}

const formatCompactDateTime = (value) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const dayPart = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  const timePart = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  return `${dayPart} · ${timePart}`
}

export default function SessionListItem({ session, onOpen, status = '', requestItem = null, showSeries = false, highlight = false, onRecordFollowUp = null, onChangeThread = null, prefetch = true, minimal = false }) {
  const prefetchSession = usePrefetchSession()
  if (!session) return null
  const recordedAt = new Date(session.recorded_at || session.created_at)
  const durationSeconds = Number(session.duration_seconds)
  const hasDuration = Number.isFinite(durationSeconds) && durationSeconds > 0
  const replies = Number(session.video_feedback_count || 0)
  const resolution = requestItem?.resolution || null
  const resolutionTimestamp = formatResolutionTimestamp(resolution)
  const recordedAtLabel = formatCompactDateTime(recordedAt)
  const metadataLabel = hasDuration ? `${recordedAtLabel} • ${fmtTimer(durationSeconds)}` : recordedAtLabel
  return (
    <button
      type="button"
      onClick={onOpen}
      onMouseEnter={() => { if (prefetch) prefetchSession(session.id) }}
      className={`w-full text-left rounded-2xl border border-gray-200 px-4 py-4 hover:bg-gray-50 transition-colors ${highlight ? 'ring-1 ring-gray-300' : ''}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <VideoThumbnail session={session} variant="poster" className="relative w-24 h-16 rounded-xl shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {status ? <StatusChip status={status} resolution={resolution} /> : null}
              {session.processing_status === 'ready' ? (
                <span className="text-[11px] uppercase tracking-wide bg-gray-100 text-gray-600 px-2 py-1 rounded-full">Ready</span>
              ) : null}
              {showSeries && session.practice_series ? (
                <span className="text-[11px] uppercase tracking-wide bg-gray-100 text-gray-700 px-2 py-1 rounded-full">
                  {String(session.practice_series).trim()}
                </span>
              ) : null}
            </div>
            <p className="text-sm font-medium text-gray-900 mt-2 line-clamp-1">{session.title || 'Untitled'}</p>
            <p className="text-xs text-gray-500 mt-1">{metadataLabel}</p>
            {!minimal && resolution?.summary ? <p className="text-xs font-medium text-gray-700 mt-2 line-clamp-1">resolution.summary</p> : null}
            {!minimal && resolution?.detail ? <p className="text-xs text-gray-500 mt-1 line-clamp-2">resolution.detail</p> : null}
            {!minimal && resolutionTimestamp ? <p className="text-[11px] text-gray-400 mt-1 line-clamp-1">resolutionTimestamp</p> : null}
          </div>
        </div>
        <div className="text-right shrink-0 space-y-2">
          {!minimal ? (
            <p className="text-xs text-gray-500">{replies} {replies === 1 ? 'reply' : 'replies'}</p>
          ) : null}
          {onChangeThread ? (
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onChangeThread?.() }}
              className="text-[11px] px-2.5 py-1.5 rounded-full border border-gray-200 text-gray-700 hover:bg-gray-50"
            >
              {session.practice_series ? 'Change thread' : 'Add to thread'}
            </button>
          ) : null}
          {!minimal && onRecordFollowUp ? (
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRecordFollowUp?.() }}
              className="text-[11px] px-2.5 py-1.5 rounded-full border border-gray-200 text-gray-700 hover:bg-gray-50"
            >
              Record follow-up
            </button>
          ) : null}
        </div>
      </div>
    </button>
  )
}
