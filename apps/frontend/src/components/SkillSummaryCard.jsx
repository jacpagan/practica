import React from 'react'
import VideoThumbnail from './VideoThumbnail'
import { fmtDate } from '../utils'

const formatSpan = (earliest, latest) => {
  if (!earliest || !latest) return ''
  const start = fmtDate(earliest.recorded_at || earliest.created_at)
  const end = fmtDate(latest.recorded_at || latest.created_at)
  if (!start || !end) return ''
  if (start === end) return start
  return `${start} → ${end}`
}

export default function SkillSummaryCard({
  summary,
  onOpenSkill,
  onOpenSession,
  onRenameSkill,
}) {
  const { skillName, isUngrouped, proofCount, latest, earliest } = summary
  const spanLabel = formatSpan(earliest, latest)

  if (isUngrouped) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-4 space-y-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500">Ungrouped</p>
          <p className="text-sm font-medium text-gray-900 mt-1">
            {proofCount} {proofCount === 1 ? 'proof' : 'proofs'} without a skill tag
          </p>
          <p className="text-xs text-gray-500 mt-1">Tag these so they show up in a skill timeline.</p>
        </div>
        <div className="space-y-2">
          {summary.items.slice(0, 3).map((session) => (
            <button
              key={session.id}
              type="button"
              onClick={() => onOpenSession?.(session)}
              className="w-full text-left text-sm text-gray-700 hover:text-gray-900 truncate"
            >
              {session.title || 'Proof'}
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => onOpenSkill?.(summary.skillKey)}
      className="w-full rounded-2xl border border-gray-200 bg-white overflow-hidden text-left hover:border-gray-300 transition-colors"
    >
      <div className="aspect-video bg-black">
        {latest ? (
          <VideoThumbnail session={latest} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gray-100" />
        )}
      </div>
      <div className="p-4 space-y-1">
        <p className="text-base font-semibold text-gray-900 truncate">{skillName}</p>
        <p className="text-sm text-gray-500">
          {proofCount} {proofCount === 1 ? 'proof' : 'proofs'}
          {spanLabel ? ` · ${spanLabel}` : ''}
        </p>
        {latest ? (
          <p className="text-xs text-gray-500">Latest {fmtDate(latest.recorded_at || latest.created_at)}</p>
        ) : null}
        <p className="text-xs text-gray-500 pt-1">Open skill timeline →</p>
      </div>
      {onRenameSkill ? (
        <div className="px-4 pb-4 -mt-2">
          <span
            role="button"
            tabIndex={0}
            onClick={(event) => {
              event.stopPropagation()
              onRenameSkill(summary.skillKey)
            }}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return
              event.preventDefault()
              event.stopPropagation()
              onRenameSkill(summary.skillKey)
            }}
            className="text-xs text-gray-500 hover:text-gray-900"
          >
            Edit name
          </span>
        </div>
      ) : null}
    </button>
  )
}
