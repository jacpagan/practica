import React from 'react'

const LABELS = {
  requested: 'Open',
  opened: 'Open',
  responded: 'Waiting on you',
  viewed: 'Waiting on you',
  resubmitted: 'Waiting on reviewer',
  closed: 'Resolved',
  revoked: 'Turned off',
}

const STYLES = {
  requested: 'bg-amber-100 text-amber-800',
  opened: 'bg-amber-100 text-amber-800',
  responded: 'bg-blue-100 text-blue-800',
  viewed: 'bg-blue-100 text-blue-800',
  resubmitted: 'bg-indigo-100 text-indigo-800',
  closed: 'bg-emerald-100 text-emerald-800',
  revoked: 'bg-gray-200 text-gray-700',
}

export default function StatusChip({ status = '' }) {
  const key = String(status || '').trim().toLowerCase()
  const label = LABELS[key] || '—'
  const cls = STYLES[key] || 'bg-gray-100 text-gray-700'
  return (
    <span className={`text-[11px] uppercase tracking-wide px-2 py-1 rounded-full ${cls}`}>{label}</span>
  )
}

