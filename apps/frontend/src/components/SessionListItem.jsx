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

export default function SessionListItem({ session, onOpen, showSeries = false, highlight = false, latestLabel = '', onChangeSkill = null, prefetch = true, minimal = false }) {
  const prefetchSession = usePrefetchSession()
  if (!session) return null
  const recordedAt = new Date(session.recorded_at || session.created_at)
  const durationSeconds = Number(session.duration_seconds)
  const hasDuration = Number.isFinite(durationSeconds) && durationSeconds > 0
  const recordedAtLabel = formatCompactDateTime(recordedAt)
  const metadataLabel = hasDuration ? `${recordedAtLabel} • ${fmtTimer(durationSeconds)}` : recordedAtLabel
  return (
    <button
      type="button"
      onClick={onOpen}
      onMouseEnter={() => { if (prefetch) prefetchSession(session.id) }}
      className={`w-full text-left rounded-2xl border px-4 py-4 hover:bg-gray-50 transition-colors ${highlight ? 'border-gray-900 bg-gray-50/50' : 'border-gray-200'}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <VideoThumbnail session={session} variant="poster" className="relative w-24 h-16 rounded-xl shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {latestLabel ? (
                <span className="text-[11px] font-medium uppercase tracking-wide bg-gray-900 text-white px-2 py-1 rounded-full">{latestLabel}</span>
              ) : null}
              {session.processing_status === 'processing' ? (
                <span className="text-[11px] uppercase tracking-wide bg-amber-100 text-amber-800 px-2 py-1 rounded-full">Processing</span>
              ) : null}
              {session.processing_status === 'failed' ? (
                <span className="text-[11px] uppercase tracking-wide bg-rose-100 text-rose-800 px-2 py-1 rounded-full">Needs retry</span>
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
