import React from 'react'
import VideoThumbnail from './VideoThumbnail'
import usePrefetchSession from '../hooks/usePrefetchSession'
import { fmtTimer } from '../utils'

const formatCompactDateTime = (value) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const dayPart = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  const timePart = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  return `${dayPart} · ${timePart}`
}

export default function SessionListItem({ session, onOpen, showSeries = false, highlight = false, onChangeSkill = null, prefetch = true, minimal = false }) {
  const prefetchSession = usePrefetchSession()
  if (!session) return null
  const recordedAt = new Date(session.recorded_at || session.created_at)
  const durationSeconds = Number(session.duration_seconds)
  const hasDuration = Number.isFinite(durationSeconds) && durationSeconds > 0
  const recordedAtLabel = formatCompactDateTime(recordedAt)
  const metadataLabel = hasDuration ? `${recordedAtLabel} • ${fmtTimer(durationSeconds)}` : recordedAtLabel
  const isProcessing = session.processing_status === 'processing'
  return (
    <button
      type="button"
      onClick={onOpen}
      onMouseEnter={() => { if (prefetch) prefetchSession(session.id) }}
      className={`w-full text-left rounded-2xl border border-gray-200 px-4 py-4 hover:bg-gray-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 ${highlight ? 'ring-1 ring-gray-300' : ''} ${isProcessing ? 'border-amber-200 bg-amber-50/40' : ''}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <VideoThumbnail session={session} variant="poster" className={`relative w-24 h-16 rounded-xl shrink-0 ${isProcessing ? 'ring-2 ring-amber-300 ring-offset-1' : ''}`} />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
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
          </div>
            </div>
            <div className="text-right shrink-0 space-y-2">
              {onChangeSkill ? (
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); onChangeSkill?.() }}
                  className="text-[11px] px-2.5 py-1.5 rounded-full border border-gray-200 text-gray-700 hover:bg-gray-50"
                >
                  {session.practice_series ? 'Change skill' : 'Add to skill'}
                </button>
              ) : null}
            </div>
      </div>
    </button>
  )
}
