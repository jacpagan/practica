import React from 'react'

const LABELS = {
  needs_new_take: 'Needs new take',
  wrong_take: 'Wrong take',
  requested: 'Open',
  opened: 'Open',
  responded: 'Ready',
  viewed: 'Ready',
  resubmitted: 'Ready',
  closed: 'Complete',
  revoked: 'Hidden',
}

const STYLES = {
  needs_new_take: 'bg-orange-100 text-orange-800',
  wrong_take: 'bg-rose-100 text-rose-800',
  requested: 'bg-amber-100 text-amber-800',
  opened: 'bg-amber-100 text-amber-800',
  responded: 'bg-emerald-100 text-emerald-800',
  viewed: 'bg-emerald-100 text-emerald-800',
  resubmitted: 'bg-emerald-100 text-emerald-800',
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
