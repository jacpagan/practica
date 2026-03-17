import React, { useEffect, useState } from 'react'

function ProgressPage({ token }) {
  const [points, setPoints] = useState([])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const headers = token ? { Authorization: `Token ${token}` } : {}
        const res = await fetch('/api/v1/analytics/me/weekly', { headers })
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled) setPoints(Array.isArray(data.points) ? data.points : [])
      } catch {}
    }
    load()
    return () => { cancelled = true }
  }, [token])

  const max = Math.max(...points.map((p) => p.practice_minutes), 1)

  return (
    <div className="px-4 sm:px-6 py-6 space-y-5">
      <h2 className="text-xl font-semibold text-gray-900">Weekly progress</h2>
      <div className="rounded-xl border border-gray-200 p-4">
        {points.length === 0 ? (
          <p className="text-sm text-gray-500">No progress data yet.</p>
        ) : (
          <div className="space-y-3">
            {points.map((point) => (
              <div key={point.date}>
                <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                  <span>{point.date}</span>
                  <span>{point.practice_minutes} min</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-gray-900" style={{ width: `${Math.round((point.practice_minutes / max) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default ProgressPage
