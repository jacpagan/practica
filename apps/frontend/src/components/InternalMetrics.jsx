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

function InsightStrip({ children }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {children}
      </div>
    </div>
  )
}

function InsightItem({ label, value, detail }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-1 text-xl font-semibold tracking-tight text-gray-950">{value}</p>
      <p className="mt-1 text-xs text-gray-500">{detail}</p>
    </div>
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
  const activationBase = data.smart?.activation?.signups || 0
  const repeatBase = data.smart?.repeat?.activated_users || 0
  const uploadStarted = data.uploads_30d?.started || 0
  const uploadSucceeded = data.uploads_30d?.succeeded || 0
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
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-gray-950">SMART Product Metrics</h1>
            <p className="mt-1 text-sm text-gray-500">
              User activation, repeat behavior, proof frequency, and upload friction. No AWS access required.
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
            <InsightStrip>
              <InsightItem
                label="Activation"
                value={formatPercent(data.smart?.activation?.activated_users, activationBase)}
                detail={`${formatNumber(data.smart?.activation?.activated_users)} of ${formatNumber(activationBase)} users saved proof`}
              />
              <InsightItem
                label="Repeat"
                value={formatPercent(data.smart?.repeat?.repeat_users, repeatBase)}
                detail={`${formatNumber(data.smart?.repeat?.repeat_users)} users saved 2+ proofs`}
              />
              <InsightItem
                label="Frequency"
                value={formatNumber(data.smart?.frequency?.proofs_30d)}
                detail={`${formatNumber(data.smart?.frequency?.proof_active_30d)} proof-active users in 30d`}
              />
              <InsightItem
                label="Upload Reliability"
                value={formatPercent(uploadSucceeded, uploadStarted)}
                detail={`${formatNumber(uploadSucceeded)} succeeded, ${formatNumber(data.uploads_30d?.failed)} failed in 30d`}
              />
            </InsightStrip>

            <Section title="Users">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <StatCard label="Total users" value={formatNumber(data.people?.total_users)} detail={`${formatNumber(data.people?.staff_users)} staff/admin`} />
                <StatCard label="Not activated" value={formatNumber(data.people?.zero_proof_users)} detail="Signed up, no proof saved" />
                <StatCard label="Dormant" value={formatNumber(data.people?.dormant_users)} detail="Saved proof, none in 30d" />
              </div>
              <MiniTable
                rows={data.users || []}
                columns={[
                  { key: 'username', label: 'User' },
                  { key: 'status', label: 'Status' },
                  { key: 'proof_count', label: 'Proofs', render: (row) => formatNumber(row.proof_count) },
                  { key: 'skill_count', label: 'Skills', render: (row) => formatNumber(row.skill_count) },
                  { key: 'primary_skill', label: 'Primary skill', render: (row) => row.primary_skill || 'None yet' },
                  { key: 'latest_proof_at', label: 'Latest proof', render: (row) => row.latest_proof_at ? formatDateTime(row.latest_proof_at) : 'None' },
                ]}
                empty="No users yet."
              />
            </Section>

            <Section title="Core Loop Quality">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <StatCard label="Avg days to first proof" value={`${formatNumber(data.smart?.activation?.avg_days_to_first_proof)}d`} detail="Signup to first saved proof" />
                <StatCard label="Avg proofs per activated user" value={formatNumber(data.smart?.frequency?.avg_proofs_per_activated_user)} detail={proofReadyDetail} />
                <StatCard label="Repeat within 7d" value={formatPercent(data.smart?.repeat?.repeat_within_7d, repeatBase)} detail={`${formatNumber(data.smart?.repeat?.repeat_within_7d)} users`} />
              </div>
            </Section>

            <Section title="Signup Cohorts">
              <MiniTable
                rows={data.cohorts || []}
                columns={[
                  { key: 'cohort', label: 'Month' },
                  { key: 'users', label: 'Users', render: (row) => formatNumber(row.users) },
                  { key: 'activated_users', label: 'Activated', render: (row) => `${formatNumber(row.activated_users)} (${formatPercent(row.activated_users, row.users)})` },
                  { key: 'repeat_users', label: 'Repeat', render: (row) => `${formatNumber(row.repeat_users)} (${formatPercent(row.repeat_users, row.activated_users)})` },
                  { key: 'proofs', label: 'Proofs', render: (row) => formatNumber(row.proofs) },
                ]}
                empty="No signup cohorts yet."
              />
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
                  { key: 'user_count', label: 'Users', render: (row) => formatNumber(row.user_count) },
                  { key: 'latest_recorded_at', label: 'Latest', render: (row) => row.latest_recorded_at ? formatDateTime(row.latest_recorded_at) : '' },
                ]}
                empty="No tagged skills yet."
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
          </>
        ) : null}
      </div>
    </div>
  )
}
