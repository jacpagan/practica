import React, { useMemo, useState, useCallback } from 'react'
import VideoThumbnail from './VideoThumbnail'

const monthLabel = (date) => date.toLocaleString(undefined, { month: 'long', year: 'numeric' })

const startOfDay = (d) => {
  const nd = new Date(d)
  nd.setHours(0, 0, 0, 0)
  return nd
}

const formatKey = (d) => {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function CalendarView({ sessions = [], sessionsLoading = false, onOpenSession }) {
  const today = startOfDay(new Date())
  const [activeMonth, setActiveMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedDateKey, setSelectedDateKey] = useState(formatKey(today))

  const monthBounds = useMemo(() => {
    const firstOfMonth = new Date(activeMonth.getFullYear(), activeMonth.getMonth(), 1)
    const firstDay = firstOfMonth.getDay() // 0=Sun
    const gridStart = new Date(firstOfMonth)
    gridStart.setDate(firstOfMonth.getDate() - firstDay)

    const lastOfMonth = new Date(activeMonth.getFullYear(), activeMonth.getMonth() + 1, 0)
    const lastDay = lastOfMonth.getDay()
    const gridEnd = new Date(lastOfMonth)
    gridEnd.setDate(lastOfMonth.getDate() + (6 - lastDay))
    return { gridStart: startOfDay(gridStart), gridEnd: startOfDay(gridEnd) }
  }, [activeMonth])

  const sessionsByDate = useMemo(() => {
    const map = new Map()
    sessions.forEach((s) => {
      const when = new Date(s.recorded_at || s.created_at)
      const key = formatKey(startOfDay(when))
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(s)
    })
    return map
  }, [sessions])

  const days = useMemo(() => {
    const items = []
    const d = new Date(monthBounds.gridStart)
    while (d <= monthBounds.gridEnd) {
      const key = formatKey(d)
      const inMonth = d.getMonth() === activeMonth.getMonth()
      items.push({ key, date: new Date(d), inMonth, count: (sessionsByDate.get(key) || []).length })
      d.setDate(d.getDate() + 1)
    }
    return items
  }, [activeMonth, monthBounds.gridEnd, monthBounds.gridStart, sessionsByDate])

  const selectedSessions = useMemo(() => sessionsByDate.get(selectedDateKey) || [], [sessionsByDate, selectedDateKey])

  const gotoPrevMonth = useCallback(() => {
    setActiveMonth((cur) => new Date(cur.getFullYear(), cur.getMonth() - 1, 1))
  }, [])
  const gotoNextMonth = useCallback(() => {
    setActiveMonth((cur) => new Date(cur.getFullYear(), cur.getMonth() + 1, 1))
  }, [])

  const weekLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div className="px-4 sm:px-6 py-6">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900 tracking-tight">Calendar</h2>
            <p className="text-sm text-gray-500 mt-1">View your takes by day.</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={gotoPrevMonth} className="rounded-full border border-gray-200 bg-white text-gray-900 px-3 py-1.5 text-sm hover:bg-gray-50">Prev</button>
            <div className="text-sm font-medium text-gray-900">{monthLabel(activeMonth)}</div>
            <button type="button" onClick={gotoNextMonth} className="rounded-full border border-gray-200 bg-white text-gray-900 px-3 py-1.5 text-sm hover:bg-gray-50">Next</button>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <div className="grid grid-cols-7 gap-2 text-[11px] text-gray-500 mb-2">
            {weekLabels.map((w) => (<div key={w} className="text-center uppercase tracking-wide">{w}</div>))}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {days.map((d) => {
              const isToday = formatKey(d.date) === formatKey(new Date())
              const isSelected = d.key === selectedDateKey
              const has = d.count > 0
              return (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => setSelectedDateKey(d.key)}
                  className={`h-20 rounded-xl border text-left p-2 transition-colors ${
                    isSelected ? 'border-gray-900 bg-gray-900/5' : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                  } ${d.inMonth ? '' : 'opacity-50'}`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-700">{d.date.getDate()}</span>
                    {isToday ? <span className="text-[10px] text-gray-500">Today</span> : null}
                  </div>
                  {has ? (
                    <div className="mt-3">
                      <span className="text-[11px] uppercase tracking-wide bg-gray-100 text-gray-700 px-2 py-1 rounded-full">
                        {d.count} {d.count === 1 ? 'take' : 'takes'}
                      </span>
                    </div>
                  ) : null}
                </button>
              )
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white px-4 py-4 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-sm font-semibold text-gray-900">{selectedDateKey}</p>
              <p className="text-xs text-gray-500 mt-1">{selectedSessions.length} {selectedSessions.length === 1 ? 'take' : 'takes'}</p>
            </div>
          </div>

          {sessionsLoading ? (
            <div className="rounded-xl bg-gray-50 px-4 py-4 text-sm text-gray-500">Loading…</div>
          ) : selectedSessions.length === 0 ? (
            <p className="text-sm text-gray-500">No takes on this day.</p>
          ) : (
            <div className="space-y-3">
              {selectedSessions
                .slice()
                .sort((a, b) => new Date(a.recorded_at || a.created_at) - new Date(b.recorded_at || b.created_at))
                .map((session) => (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => onOpenSession?.(session, { view: 'calendar' })}
                  className="w-full text-left rounded-2xl border border-gray-200 px-4 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <VideoThumbnail session={session} className="relative w-24 h-16 rounded-xl shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 line-clamp-1">{session.title || 'Untitled'}</p>
                      <p className="text-xs text-gray-500 mt-1">{new Date(session.recorded_at || session.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</p>
                      {session.video_feedback_count ? (
                        <p className="text-[11px] text-gray-500 mt-1">{session.video_feedback_count} {session.video_feedback_count === 1 ? 'reply' : 'replies'}</p>
                      ) : null}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default CalendarView

