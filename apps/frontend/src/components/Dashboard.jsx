import React, { useEffect, useState } from 'react'

function Dashboard({ token, onOpenSession, onNewUpload }) {
  const [sessions, setSessions] = useState([])
  const [summary, setSummary] = useState(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const headers = token ? { Authorization: `Token ${token}` } : {}
        const [sessionsRes, summaryRes] = await Promise.all([
          fetch('/api/v1/sessions', { headers }),
          fetch('/api/v1/analytics/me/summary', { headers }),
        ])
        if (!cancelled && sessionsRes.ok) setSessions(await sessionsRes.json())
        if (!cancelled && summaryRes.ok) setSummary(await summaryRes.json())
      } catch {}
    }
    load()
    return () => { cancelled = true }
  }, [token])

  return (
    <div className="px-4 sm:px-6 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Dashboard</h2>
        <button onClick={onNewUpload} className="text-sm font-medium text-white bg-gray-900 rounded-lg px-4 py-2.5 hover:bg-gray-800">
          New upload
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Sessions this week</p>
          <p className="text-2xl font-semibold text-gray-900 mt-1">{summary?.sessions_this_week ?? 0}</p>
        </div>
        <div className="rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Practice minutes</p>
          <p className="text-2xl font-semibold text-gray-900 mt-1">{summary?.total_minutes_practiced ?? 0}</p>
        </div>
        <div className="rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Comments received</p>
          <p className="text-2xl font-semibold text-gray-900 mt-1">{summary?.comments_received ?? 0}</p>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Recent sessions</p>
        {sessions.length === 0 ? (
          <p className="text-sm text-gray-500">No sessions yet.</p>
        ) : (
          <div className="space-y-2">
            {sessions.slice(0, 8).map((session) => (
              <button
                key={session.id}
                type="button"
                onClick={() => onOpenSession(session)}
                className="w-full text-left rounded-xl border border-gray-200 px-4 py-3 hover:bg-gray-50"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-gray-900">{session.title}</p>
                  <span className="text-xs text-gray-500">{session.status}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">{new Date(session.created_at).toLocaleString()}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Dashboard
