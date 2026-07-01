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
}) {
  const { skillName, isUngrouped, proofCount, proofDayCount, latest, earliest } = summary
  const spanLabel = formatSpan(earliest, latest)

  if (isUngrouped) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
        <div>
          <p className="text-sm font-medium text-gray-900">
            {proofCount} {proofCount === 1 ? 'proof' : 'proofs'}
          </p>
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
        <p className="text-sm text-gray-600">
          {proofCount} {proofCount === 1 ? 'proof' : 'proofs'}
          {proofDayCount ? ` · ${proofDayCount} ${proofDayCount === 1 ? 'proof day' : 'proof days'}` : ''}
        </p>
        {latest ? (
          <p className="text-xs text-gray-500">Latest {fmtDate(latest.recorded_at || latest.created_at)}</p>
        ) : null}
        {earliest && latest && earliest !== latest ? (
          <p className="text-xs text-gray-500">First proof {fmtDate(earliest.recorded_at || earliest.created_at)}</p>
        ) : spanLabel ? (
          <p className="text-xs text-gray-500">Started {spanLabel}</p>
        ) : null}
      </div>
    </button>
  )
}
