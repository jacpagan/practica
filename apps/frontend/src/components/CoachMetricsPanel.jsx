import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchCoachMetricsSummary } from '../utils'

const WINDOW_OPTIONS = [7, 30]

const KPI_CONFIG = [
  {
    key: 'active_students_30d',
    label: 'Active students (30d)',
    format: (value) => String(value ?? 0),
  },
  {
    key: 'coach_comments_7d',
    label: 'Coach comments (7d)',
    format: (value) => String(value ?? 0),
  },
  {
    key: 'median_time_to_first_coach_comment_hours_30d',
    label: 'Median time to first coach comment',
    format: (value) => (value == null ? '—' : `${Number(value).toFixed(1)}h`),
  },
  {
    key: 'estimated_time_saved_hours_30d',
    label: 'Estimated time saved',
    format: (value) => `${Number(value || 0).toFixed(1)}h`,
  },
]

function Sparkline({ points }) {
  const numeric = (points || [])
    .map((point, index) => ({ index, value: point?.value }))
    .filter((point) => typeof point.value === 'number')

  if (!numeric.length) {
    return <div className="h-8 w-full rounded bg-gray-100" />
  }

  const width = 120
  const height = 32
  const values = numeric.map((p) => p.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1

  const polyline = numeric
    .map((point, i) => {
      const x = numeric.length === 1 ? 0 : (i / (numeric.length - 1)) * width
      const y = height - ((point.value - min) / span) * height
      return `${x},${y}`
    })
    .join(' ')

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-8 w-full">
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={polyline}
        className="text-gray-700"
      />
    </svg>
  )
}

function CoachMetricsPanel({ token }) {
  const [windowDays, setWindowDays] = useState(30)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [disabled, setDisabled] = useState(false)
  const [payload, setPayload] = useState(null)

  const load = useCallback(async (targetWindowDays) => {
    setLoading(true)
    setError('')
    const response = await fetchCoachMetricsSummary(token, targetWindowDays)
    if (response.status === 404) {
      setDisabled(true)
      setLoading(false)
      return
    }
    if (!response.ok) {
      setPayload(null)
      setError(response?.data?.error || 'Could not load coach metrics')
      setLoading(false)
      return
    }
    setDisabled(false)
    setPayload(response.data)
    setLoading(false)
  }, [token])

  useEffect(() => {
    load(windowDays)
  }, [windowDays, load])

  const summary = payload?.summary || {
    active_students_30d: 0,
    coach_comments_7d: 0,
    median_time_to_first_coach_comment_hours_30d: null,
    estimated_time_saved_hours_30d: 0,
  }

  const hasAnyTrend = useMemo(
    () => Object.values(payload?.trends || {}).some((series) => Array.isArray(series) && series.length > 0),
    [payload]
  )

  if (disabled) return null

  return (
    <section className="px-4 sm:px-6 pt-4">
      <div className="border border-gray-200 rounded-2xl p-4 sm:p-5 bg-white">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Coach ROI Metrics</h2>
            <p className="text-xs text-gray-500">Internal self-view from daily aggregates.</p>
          </div>
          <div className="flex items-center gap-1">
            {WINDOW_OPTIONS.map((days) => (
              <button
                key={days}
                onClick={() => setWindowDays(days)}
                className={`text-xs px-2.5 py-1.5 rounded-lg transition-colors ${
                  windowDays === days
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {days}d
              </button>
            ))}
          </div>
        </div>

        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 animate-pulse">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="border border-gray-200 rounded-xl p-3 space-y-2">
                <div className="h-3 w-28 bg-gray-100 rounded" />
                <div className="h-5 w-16 bg-gray-100 rounded" />
                <div className="h-8 w-full bg-gray-100 rounded" />
              </div>
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="mt-4 border border-red-100 bg-red-50 rounded-xl p-3 flex items-center justify-between gap-3">
            <p className="text-sm text-red-700">{error}</p>
            <button
              onClick={() => load(windowDays)}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-red-200 text-red-700 hover:bg-red-100"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && !hasAnyTrend && (
          <div className="mt-4 border border-gray-200 rounded-xl p-4">
            <p className="text-sm text-gray-600">No coach telemetry yet. Upload sessions and post comments to populate this panel.</p>
          </div>
        )}

        {!loading && !error && hasAnyTrend && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
            {KPI_CONFIG.map((kpi) => (
              <article key={kpi.key} className="border border-gray-200 rounded-xl p-3">
                <p className="text-xs text-gray-500">{kpi.label}</p>
                <p className="text-xl font-semibold text-gray-900 mt-1">{kpi.format(summary[kpi.key])}</p>
                <div className="mt-2">
                  <Sparkline points={payload?.trends?.[kpi.key] || []} />
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

export default CoachMetricsPanel
