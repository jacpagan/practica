import React, { useEffect, useMemo, useState } from 'react'

const numberFmt = new Intl.NumberFormat()

const formatNumber = (value) => numberFmt.format(Number(value || 0))

const formatPercent = (value, total) => {
  const numerator = Number(value || 0)
  const denominator = Number(total || 0)
  if (!denominator) return '0%'
  return `${Math.round((numerator / denominator) * 100)}%`
}

const formatBytes = (value) => {
  const bytes = Number(value || 0)
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = bytes
  let unitIndex = 0
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex += 1
  }
  return `${size >= 10 || unitIndex === 0 ? Math.round(size) : size.toFixed(1)} ${units[unitIndex]}`
}

const formatDuration = (value) => {
  const ms = Number(value || 0)
  if (!ms) return '0s'
  if (ms < 1000) return `${ms}ms`
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  return `${Math.round(seconds / 60)}m`
}

const formatDateTime = (value) => {
  const date = new Date(value || '')
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function StatCard({ label, value, detail = '' }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-gray-950">{value}</p>
      {detail ? <p className="mt-1 text-xs text-gray-500">{detail}</p> : null}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-gray-950">{title}</h2>
      {children}
    </section>
  )
}

function MiniTable({ rows = [], columns = [], empty = 'No data yet.' }) {
  if (!rows.length) {
    return <div className="rounded-xl border border-dashed border-gray-200 p-4 text-sm text-gray-500">{empty}</div>
  }
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <table className="min-w-full divide-y divide-gray-100 text-sm">
        <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-400">
          <tr>
            {columns.map((column) => (
              <th key={column.key} className="px-3 py-2 font-medium">{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row, rowIndex) => (
            <tr key={row.id || row.event_name || row.practice_series || rowIndex}>
              {columns.map((column) => (
                <td key={column.key} className="px-3 py-2 text-gray-700">
                  {column.render ? column.render(row) : row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function InternalMetrics({ token = '', user = null, onBack }) {
  const [state, setState] = useState({ loading: true, error: '', data: null })

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setState({ loading: true, error: '', data: null })
      try {
        const res = await fetch('/api/internal/metrics/', {
          headers: token ? { Authorization: `Token ${token}` } : {},
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data?.error || 'Could not load metrics')
        if (!cancelled) setState({ loading: false, error: '', data })
      } catch (error) {
        if (!cancelled) setState({ loading: false, error: error?.message || 'Could not load metrics', data: null })
      }
    }
    load()
    return () => { cancelled = true }
  }, [token])

  const data = state.data || {}
  const repeatBase = data.retention?.users_with_first_proof || 0
  const proofReadyDetail = useMemo(() => {
    const ready = data.proofs?.ready || 0
    const failed = data.proofs?.failed || 0
    return `${formatNumber(ready)} ready, ${formatNumber(failed)} failed`
  }, [data.proofs])

  if (!user?.is_staff) {
    return (
      <div className="px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-4xl rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-sm font-semibold text-gray-950">Metrics are staff-only.</p>
          <button type="button" onClick={onBack} className="mt-3 text-sm text-gray-500 hover:text-gray-900">Back to Today</button>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 py-6 pb-28 sm:px-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Internal</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-gray-950">Metrics</h1>
            <p className="mt-1 text-sm text-gray-500">
              Database-backed product metrics. No AWS access required.
            </p>
          </div>
          <button type="button" onClick={onBack} className="text-sm text-gray-500 hover:text-gray-900">Back to Today</button>
        </div>

        {state.loading ? (
          <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-500">Loading metrics</div>
        ) : null}

        {state.error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{state.error}</div>
        ) : null}

        {data.generated_at ? (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Total users" value={formatNumber(data.people?.total_users)} detail={`${formatNumber(data.people?.active_7d)} active 7d`} />
              <StatCard label="Proofs saved" value={formatNumber(data.proofs?.total)} detail={`${formatNumber(data.proofs?.last_7d)} in last 7d`} />
              <StatCard label="Upload success 30d" value={formatNumber(data.uploads_30d?.succeeded)} detail={`${formatNumber(data.uploads_30d?.failed)} failed`} />
              <StatCard label="Repeat within 7d" value={formatPercent(data.retention?.repeat_within_7d, repeatBase)} detail={`${formatNumber(data.retention?.repeat_within_7d)} of ${formatNumber(repeatBase)} users`} />
            </div>

            <Section title="People">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <StatCard label="Active 24h" value={formatNumber(data.people?.active_24h)} />
                <StatCard label="Active 30d" value={formatNumber(data.people?.active_30d)} />
                <StatCard label="Users with proofs" value={formatNumber(data.people?.users_with_proofs)} />
              </div>
            </Section>

            <Section title="Core Loop">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <StatCard label="Proofs 24h" value={formatNumber(data.proofs?.last_24h)} detail={proofReadyDetail} />
                <StatCard label="Proofs 30d" value={formatNumber(data.proofs?.last_30d)} />
                <StatCard label="Repeat within 1d" value={formatPercent(data.retention?.repeat_within_1d, repeatBase)} detail={`${formatNumber(data.retention?.repeat_within_1d)} users`} />
              </div>
            </Section>

            <Section title="Uploads">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <StatCard label="Started 30d" value={formatNumber(data.uploads_30d?.started)} />
                <StatCard label="Uploaded bytes" value={formatBytes(data.uploads_30d?.success_file_bytes)} />
                <StatCard label="Avg success time" value={formatDuration(data.uploads_30d?.avg_success_duration_ms)} />
              </div>
              <MiniTable
                rows={data.uploads_30d?.top_failure_codes || []}
                columns={[
                  { key: 'code', label: 'Failure code' },
                  { key: 'count', label: 'Count', render: (row) => formatNumber(row.count) },
                ]}
                empty="No upload failures in the last 30 days."
              />
            </Section>

            <Section title="Skills">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <StatCard label="Tagged proofs" value={formatNumber(data.skills?.tagged_proofs)} />
                <StatCard label="Untagged proofs" value={formatNumber(data.skills?.untagged_proofs)} />
              </div>
              <MiniTable
                rows={data.skills?.top || []}
                columns={[
                  { key: 'practice_series', label: 'Skill' },
                  { key: 'count', label: 'Proofs', render: (row) => formatNumber(row.count) },
                ]}
                empty="No tagged skills yet."
              />
            </Section>

            <Section title="Events">
              <MiniTable
                rows={data.events_30d?.top || []}
                columns={[
                  { key: 'event_name', label: 'Event' },
                  { key: 'count', label: 'Count', render: (row) => formatNumber(row.count) },
                ]}
                empty="No events in the last 30 days."
              />
            </Section>

            <Section title="Latest Proofs">
              <MiniTable
                rows={data.latest_proofs || []}
                columns={[
                  { key: 'title', label: 'Proof' },
                  { key: 'practice_series', label: 'Skill', render: (row) => row.practice_series || 'Untagged' },
                  { key: 'user__username', label: 'User' },
                  { key: 'recorded_at', label: 'Recorded', render: (row) => formatDateTime(row.recorded_at) },
                ]}
                empty="No proofs yet."
              />
            </Section>

            <Section title="Latest Events">
              <MiniTable
                rows={data.latest_events || []}
                columns={[
                  { key: 'event_name', label: 'Event' },
                  { key: 'user__username', label: 'User', render: (row) => row.user__username || 'Anonymous' },
                  { key: 'path', label: 'Path' },
                  { key: 'created_at', label: 'Time', render: (row) => formatDateTime(row.created_at) },
                ]}
                empty="No events yet."
              />
            </Section>
          </>
        ) : null}
      </div>
    </div>
  )
}
