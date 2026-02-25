import React, { useState, useEffect } from 'react'
import SegmentPlayer from './SegmentPlayer'
import { authHeaders } from '../auth'

const fmtTime = (s) => `${Math.floor(s / 60)}:${(Math.floor(s % 60)).toString().padStart(2, '0')}`
const fmtDate = (d) => new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
const videoUrl = (path) => path?.startsWith('/media/') ? `http://localhost:8000${path}` : path

const fmtDuration = (start, end) => {
  if (end == null) return null
  const d = end - start
  if (d <= 0) return null
  if (d < 60) return `${d}s`
  return `${Math.floor(d / 60)}m ${d % 60}s`
}

function ProgressView({ exercise, token, onBack }) {
  const [data, setData] = useState(null)
  const [compareLeft, setCompareLeft] = useState(null)
  const [compareRight, setCompareRight] = useState(null)

  useEffect(() => {
    fetch(`/api/exercises/${exercise.id}/progress/`, { headers: authHeaders(token) })
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
  }, [exercise.id])

  if (!data) return <div className="px-4 py-8 text-center text-sm text-gray-400">Loading...</div>

  const chapters = data.chapters || []

  const handleChapterClick = (chapter) => {
    if (!compareLeft) {
      setCompareLeft(chapter)
    } else if (compareLeft.id === chapter.id) {
      setCompareLeft(null)
    } else if (!compareRight) {
      setCompareRight(chapter)
    } else if (compareRight.id === chapter.id) {
      setCompareRight(null)
    } else {
      setCompareLeft(compareRight)
      setCompareRight(chapter)
    }
  }

  const isComparing = compareLeft && compareRight

  return (
    <div className="px-4 sm:px-6 py-4">
      <div className="mb-5">
        <h1 className="text-lg font-semibold text-gray-900">{data.exercise.name}</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {chapters.length} {chapters.length === 1 ? 'entry' : 'entries'} across sessions
        </p>
      </div>

      {/* Comparison viewer */}
      {isComparing && (
        <div className="mb-6 border border-gray-100 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-900">Comparing</h3>
            <button onClick={() => { setCompareLeft(null); setCompareRight(null) }}
              className="text-xs text-gray-400 hover:text-gray-600">Clear</button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[compareLeft, compareRight].map((ch, i) => (
              <div key={i}>
                <div className="aspect-video bg-black rounded-lg overflow-hidden">
                  <SegmentPlayer
                    src={videoUrl(ch.session_video)}
                    start={ch.timestamp_seconds}
                    end={ch.end_seconds}
                    className="w-full h-full"
                  />
                </div>
                <div className="mt-1.5">
                  <p className="text-xs font-medium text-gray-700">{ch.session_title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-400">{fmtDate(ch.session_date)}</span>
                    <span className="text-xs text-gray-300 font-mono">
                      {fmtTime(ch.timestamp_seconds)}
                      {ch.end_seconds && ` – ${fmtTime(ch.end_seconds)}`}
                    </span>
                  </div>
                  {ch.notes && <p className="text-xs text-gray-500 mt-1 italic">"{ch.notes}"</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hint */}
      {chapters.length >= 2 && !isComparing && (
        <p className="text-xs text-gray-400 mb-3">
          {compareLeft
            ? `Selected "${compareLeft.session_title}" — tap another to compare`
            : 'Tap any two entries to compare side by side'}
        </p>
      )}

      {/* Chronological entries */}
      <div className="space-y-2">
        {chapters.map((chapter) => {
          const isSelected = compareLeft?.id === chapter.id || compareRight?.id === chapter.id
          return (
            <div
              key={chapter.id}
              onClick={() => handleChapterClick(chapter)}
              className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all group ${
                isSelected ? 'bg-gray-100 ring-1 ring-gray-300' : 'hover:bg-gray-50'
              }`}
            >
              {/* Thumbnail */}
              <div className="w-20 h-14 sm:w-24 sm:h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 relative">
                <video
                  src={`${videoUrl(chapter.session_video)}#t=${chapter.timestamp_seconds}`}
                  className="w-full h-full object-cover"
                  muted preload="metadata"
                />
                {chapter.end_seconds && (
                  <div className="absolute bottom-0.5 right-0.5 bg-black/60 text-white text-[9px] font-mono px-1 py-0.5 rounded">
                    {fmtDuration(chapter.timestamp_seconds, chapter.end_seconds)}
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0 py-0.5">
                <h4 className="text-sm font-medium text-gray-900 truncate">{chapter.session_title}</h4>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-gray-400">{fmtDate(chapter.session_date)}</span>
                  <span className="text-xs text-gray-300 font-mono">
                    {fmtTime(chapter.timestamp_seconds)}
                    {chapter.end_seconds && ` – ${fmtTime(chapter.end_seconds)}`}
                  </span>
                </div>
                {chapter.notes && (
                  <p className="text-xs text-gray-500 mt-1 line-clamp-1 italic">"{chapter.notes}"</p>
                )}
              </div>

              {isSelected && <span className="w-2 h-2 bg-gray-900 rounded-full flex-shrink-0 mt-2" />}
            </div>
          )
        })}
      </div>

      {chapters.length === 0 && (
        <div className="text-center py-12">
          <p className="text-sm text-gray-400">No entries yet for this exercise</p>
        </div>
      )}
    </div>
  )
}

export default ProgressView
