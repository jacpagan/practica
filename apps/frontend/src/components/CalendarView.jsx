import React, { useMemo, useState, useCallback } from 'react'
import VideoThumbnail from './VideoThumbnail'
import SessionListItem from './SessionListItem'

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

function CalendarView({ sessions = [], sessionsLoading = false, onOpenSession, onOpenSeries, onMonthChange, onOpenListDate }) {
  const today = startOfDay(new Date())
  const [activeMonth, setActiveMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedDateKey, setSelectedDateKey] = useState(formatKey(today))
  const [showDayModal, setShowDayModal] = useState(false)
  const SORT_KEY = 'practica.sort.newestFirst.v1'
  const readSort = () => {
    try { return (window.localStorage.getItem(SORT_KEY) || 'true') === 'true' } catch { return true }
  }
  const [newestFirst, setNewestFirst] = useState(readSort)
  useEffect(() => {
    try { window.localStorage.setItem(SORT_KEY, String(Boolean(newestFirst))) } catch {}
  }, [newestFirst])

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

  const sessionsByThread = useMemo(() => {
    const groups = new Map()
    selectedSessions.forEach((s) => {
      const key = String(s.practice_series || '').trim() || '(no thread)'
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(s)
    })
    const groupArray = Array.from(groups.entries()).map(([seriesName, items]) => {
      const sortedItems = items
        .slice()
        .sort((a, b) => {
          const ta = new Date(a.recorded_at || a.created_at)
          const tb = new Date(b.recorded_at || b.created_at)
          return newestFirst ? (tb - ta) : (ta - tb)
        })
      return { seriesName, items: sortedItems }
    })
    // Sort groups by their first item's timestamp
    groupArray.sort((ga, gb) => {
      const fa = ga.items[0]
      const fb = gb.items[0]
      const ta = fa ? new Date(fa.recorded_at || fa.created_at) : 0
      const tb = fb ? new Date(fb.recorded_at || fb.created_at) : 0
      return newestFirst ? (tb - ta) : (ta - tb)
    })
    return groupArray
  }, [newestFirst, selectedSessions])

  const gotoPrevMonth = useCallback(() => {
    setActiveMonth((cur) => new Date(cur.getFullYear(), cur.getMonth() - 1, 1))
  }, [])
  const gotoNextMonth = useCallback(() => {
    setActiveMonth((cur) => new Date(cur.getFullYear(), cur.getMonth() + 1, 1))
  }, [])

  const weekLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  // Notify parent when month changes so it can load month-bounded data
  React.useEffect(() => {
    try { onMonthChange?.(new Date(activeMonth)) } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMonth])

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
                  onClick={() => { setSelectedDateKey(d.key); setShowDayModal(true) }}
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

        {/* Day modal: groups by practice thread and lists sessions */}
        {showDayModal ? (
          <div className="fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/30" onClick={() => setShowDayModal(false)} />
            <div className="absolute inset-x-4 sm:inset-x-auto sm:right-6 sm:w-[520px] top-10 bottom-10 rounded-2xl bg-white shadow-xl border border-gray-200 flex flex-col">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{selectedDateKey}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{selectedSessions.length} {selectedSessions.length === 1 ? 'take' : 'takes'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setNewestFirst((v) => !v)}
                    className={`text-[11px] rounded-full px-2.5 py-1 border ${newestFirst ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
                    title="Toggle sort order"
                  >
                    {newestFirst ? 'Newest first' : 'Oldest first'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { try { window.localStorage.setItem('practica.filter.date.v1', selectedDateKey) } catch {} ; onOpenListDate?.(selectedDateKey) }}
                    className="text-[11px] rounded-full px-2.5 py-1 border bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                  >
                    Open in list
                  </button>
                  <button type="button" onClick={() => setShowDayModal(false)} className="text-xs text-gray-500 hover:text-gray-900 rounded-lg border border-gray-200 px-2 py-1">Close</button>
                </div>
              </div>
              <div className="p-4 overflow-y-auto">
                {sessionsLoading ? (
                  <div className="rounded-xl bg-gray-50 px-4 py-4 text-sm text-gray-500">Loading…</div>
                ) : sessionsByThread.length === 0 ? (
                  <p className="text-sm text-gray-500">No takes on this day.</p>
                ) : (
                  <div className="space-y-4">
                    {sessionsByThread.map((group) => (
                      <div key={group.seriesName} className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs uppercase tracking-wide text-gray-500">{group.seriesName}</p>
                          {group.seriesName !== '(no thread)' && (
                            <button
                              type="button"
                              onClick={() => onOpenSeries?.(group.seriesName)}
                              className="text-xs text-gray-600 hover:text-gray-900"
                            >
                              Open thread
                            </button>
                          )}
                        </div>
                        <div className="space-y-2">
                          {group.items.map((session) => (
                            <SessionListItem key={session.id} session={session} onOpen={() => onOpenSession?.(session, { view: 'calendar' })} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default CalendarView
