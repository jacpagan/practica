import React from 'react'

const codeTone = {
  processing: 'border-amber-200 bg-amber-50',
  ready_for_review: 'border-emerald-200 bg-emerald-50',
  playback_failed: 'border-amber-200 bg-amber-50',
  waiting_on_reviewer: 'border-amber-200 bg-amber-50',
  reviewer_opened: 'border-blue-200 bg-blue-50',
  respond_now: 'border-blue-200 bg-blue-50',
  feedback_ready: 'border-emerald-200 bg-emerald-50',
  waiting_on_creator: 'border-emerald-200 bg-emerald-50',
  waiting_on_owner: 'border-emerald-200 bg-emerald-50',
  creator_viewed: 'border-violet-200 bg-violet-50',
  owner_viewed: 'border-violet-200 bg-violet-50',
  record_next_take: 'border-violet-200 bg-violet-50',
  record_new_take: 'border-orange-200 bg-orange-50',
  record_matching_take: 'border-rose-200 bg-rose-50',
  loop_continuing: 'border-fuchsia-200 bg-fuchsia-50',
  flagged: 'border-red-200 bg-red-50',
  closed: 'border-gray-200 bg-gray-50',
  revoked: 'border-red-200 bg-red-50',
}

const phaseTone = {
  waiting: 'border-amber-200 bg-amber-50',
  action_required: 'border-emerald-200 bg-emerald-50',
  blocked: 'border-red-200 bg-red-50',
  complete: 'border-violet-200 bg-violet-50',
}

export const resolutionToneClasses = (resolution = null) => {
  const code = String(resolution?.code || '').trim().toLowerCase()
  const phase = String(resolution?.phase || '').trim().toLowerCase()
  return codeTone[code] || phaseTone[phase] || 'border-gray-200 bg-gray-50'
}

export const formatResolutionTimestamp = (resolution = null) => {
  const occurredAt = resolution?.occurred_at
  if (!occurredAt) return ''
  const label = String(resolution?.occurred_label || '').trim()
  try {
    const formatted = new Date(occurredAt).toLocaleString(undefined, { hour12: undefined })
    return label ? `${label} ${formatted}` : formatted
  } catch {
    return label ? `${label} ${occurredAt}` : String(occurredAt)
  }
}

export default function ResolutionBanner({ resolution = null, statusReason = '', statusNote = '', children = null, className = '' }) {
  if (!resolution) return null
  const timestampText = formatResolutionTimestamp(resolution)

  return (
    <div className={`rounded-xl border px-4 py-3 space-y-3 ${resolutionToneClasses(resolution)} ${className}`.trim()}>
      <div>
        <p className="text-sm font-semibold text-gray-900">{resolution.summary || 'Current status'}</p>
        {resolution.detail ? <p className="text-sm text-gray-700 mt-1">{resolution.detail}</p> : null}
        {timestampText ? <p className="text-xs text-gray-600 mt-2">{timestampText}</p> : null}
        {statusReason ? <p className="text-xs text-gray-600 mt-2">Reason: {statusReason}</p> : null}
        {statusNote ? <p className="text-xs text-gray-600 mt-1">Note: {statusNote}</p> : null}
      </div>
      {children ? <div className="flex flex-wrap gap-2">{children}</div> : null}
    </div>
  )
}
