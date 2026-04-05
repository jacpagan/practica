import React, { useMemo, useState, useCallback, useEffect } from 'react'
import VideoThumbnail from './VideoThumbnail'
import SessionListItem from './SessionListItem'
import ThreadPickerModal from './ThreadPickerModal'
import { useAuth } from '../auth'
import { useToast } from './Toast'

const monthLabel = (date) => date.toLocaleString(undefined, { month: 'long', year: 'numeric' })
const dayLabel = (date) => date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
const TODAY_KEY = (() => {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
})()
const UNTHREADED_LABEL = 'Unthreaded'

const startOfDay = (d) => {
  const nd = new Date(d)
  nd.setHours(0, 0, 0, 0)
  return nd
}

const parseDateKey = (key) => {
  const raw = String(key || '').trim()
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return startOfDay(new Date())
  const [, year, month, day] = match
  return new Date(Number(year), Number(month) - 1, Number(day))
}

const formatKey = (d) => {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

const ACTIVE_REQUEST_STATUSES = new Set([
  'requested',
  'opened',
  'responded',
  'viewed',
  'needs_resubmission',
  'declined_unrelated',
  'resubmitted',
])

const requestSignalMeta = {
  feedback_ready: {
    label: 'Feedback ready',
    dayTone: 'bg-emerald-100 text-emerald-800',
    panelTone: 'bg-emerald-100 text-emerald-800',
  },
  awaiting_review: {
    label: 'Awaiting review',
    dayTone: 'bg-amber-100 text-amber-800',
    panelTone: 'bg-amber-100 text-amber-800',
  },
}

const requestSignalKey = (status = '') => {
  const normalized = String(status || '').trim().toLowerCase()
  if (['responded', 'viewed', 'needs_resubmission', 'declined_unrelated'].includes(normalized)) return 'feedback_ready'
  if (['requested', 'opened', 'resubmitted'].includes(normalized)) return 'awaiting_review'
  return ''
}

const requestSignalPriority = (status = '') => {
  const signal = requestSignalKey(status)
  if (signal === 'feedback_ready') return 2
  if (signal === 'awaiting_review') return 1
  return 0
}

function CalendarView({ sessions = [], sessionsLoading = false, routeDateKey = '', reviewRequests = [], onOpenSession, onOpenSeries, onMonthChange, onOpenListDate, onContinueThread }) {
  const today = startOfDay(new Date())
  const initialMonthDate = routeDateKey ? parseDateKey(routeDateKey) : today
  const [activeMonth, setActiveMonth] = useState(new Date(initialMonthDate.getFullYear(), initialMonthDate.getMonth(), 1))
  const DATE_FILTER_KEY = 'practica.filter.date.v1'
  const initialSelected = (() => {
    if (routeDateKey) return routeDateKey
    try { return window.localStorage.getItem(DATE_FILTER_KEY) || formatKey(today) } catch { return formatKey(today) }
  })()
  const [selectedDateKey, setSelectedDateKey] = useState(initialSelected)
  const [showDayModal, setShowDayModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [renamingThread, setRenamingThread] = useState('')
  const [saving, setSaving] = useState(false)
  const threadOptions = useMemo(() => Array.from(new Set(sessions.map(s => String(s.practice_series || '').trim()).filter(Boolean))).sort(), [sessions])
  const { token } = useAuth()
  const toast = useToast()
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

  const activeRequestBySessionId = useMemo(() => {
    const requestMap = new Map()
    ;[...reviewRequests]
      .sort((left, right) => new Date(right.updated_at || right.created_at) - new Date(left.updated_at || left.created_at))
      .forEach((requestItem) => {
        const status = String(requestItem?.status || '').trim().toLowerCase()
        if (!ACTIVE_REQUEST_STATUSES.has(status)) return
        const sessionId = Number(requestItem?.session?.id || requestItem?.session_id || 0)
        if (!sessionId || requestMap.has(sessionId)) return
        requestMap.set(sessionId, requestItem)
      })
    return requestMap
  }, [reviewRequests])

  const daySummaries = useMemo(() => {
    const map = new Map()
    sessions.forEach((session) => {
      const when = new Date(session.recorded_at || session.created_at)
      const key = formatKey(startOfDay(when))
      if (!map.has(key)) {
        map.set(key, { count: 0, seriesMap: new Map(), followUpSignal: '' })
      }
      const entry = map.get(key)
      entry.count += 1
      const seriesName = String(session.practice_series || '').trim() || UNTHREADED_LABEL
      const current = entry.seriesMap.get(seriesName) || { count: 0, latestAt: 0 }
      entry.seriesMap.set(seriesName, {
        count: current.count + 1,
        latestAt: Math.max(current.latestAt, when.getTime() || 0),
      })

      const requestStatus = String(activeRequestBySessionId.get(Number(session.id))?.status || '').trim().toLowerCase()
      if (requestSignalPriority(requestStatus) > requestSignalPriority(entry.followUpSignal)) {
        entry.followUpSignal = requestStatus
      }
    })

    return new Map(Array.from(map.entries()).map(([key, value]) => {
      const rankedSeries = Array.from(value.seriesMap.entries())
        .sort((left, right) => {
          if (right[1].count !== left[1].count) return right[1].count - left[1].count
          return right[1].latestAt - left[1].latestAt
        })
        .map(([seriesName]) => seriesName)
      return [key, {
        count: value.count,
        topSeriesNames: rankedSeries.slice(0, 2),
        extraSeriesCount: Math.max(0, rankedSeries.length - 2),
        followUpSignal: requestSignalKey(value.followUpSignal),
      }]
    }))
  }, [activeRequestBySessionId, sessions])

  const days = useMemo(() => {
    const items = []
    const d = new Date(monthBounds.gridStart)
    while (d <= monthBounds.gridEnd) {
      const key = formatKey(d)
      const inMonth = d.getMonth() === activeMonth.getMonth()
      const summary = daySummaries.get(key) || { count: 0, topSeriesNames: [], extraSeriesCount: 0 }
      items.push({ key, date: new Date(d), inMonth, count: summary.count, summary })
      d.setDate(d.getDate() + 1)
    }
    return items
  }, [activeMonth, daySummaries, monthBounds.gridEnd, monthBounds.gridStart])

  const selectedSessions = useMemo(() => sessionsByDate.get(selectedDateKey) || [], [sessionsByDate, selectedDateKey])
  const selectedDate = useMemo(() => parseDateKey(selectedDateKey), [selectedDateKey])

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
      const activeRequest = sortedItems
        .map((item) => activeRequestBySessionId.get(Number(item.id)) || null)
        .find(Boolean) || null
      return { seriesName, items: sortedItems, activeRequest }
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
  }, [activeRequestBySessionId, newestFirst, selectedSessions])

  const monthStats = useMemo(() => {
    const totalTakes = sessions.length
    const activeDays = Array.from(daySummaries.values()).filter((item) => item.count > 0).length
    const seriesCounts = new Map()
    sessions.forEach((session) => {
      const seriesName = String(session.practice_series || '').trim()
      if (!seriesName) return
      seriesCounts.set(seriesName, (seriesCounts.get(seriesName) || 0) + 1)
    })
    const topThread = Array.from(seriesCounts.entries()).sort((left, right) => right[1] - left[1])[0] || null
    return {
      totalTakes,
      activeDays,
      topThreadName: topThread?.[0] || '',
      topThreadCount: topThread?.[1] || 0,
      followUpDays: Array.from(daySummaries.values()).filter((item) => item.followUpSignal === 'feedback_ready').length,
    }
  }, [daySummaries, sessions])

  const selectedThreadCount = sessionsByThread.length

  const gotoPrevMonth = useCallback(() => {
    setActiveMonth((cur) => new Date(cur.getFullYear(), cur.getMonth() - 1, 1))
  }, [])
  const gotoNextMonth = useCallback(() => {
    setActiveMonth((cur) => new Date(cur.getFullYear(), cur.getMonth() + 1, 1))
  }, [])
  const gotoToday = useCallback(() => {
    const todayDate = parseDateKey(TODAY_KEY)
    setActiveMonth(new Date(todayDate.getFullYear(), todayDate.getMonth(), 1))
    setSelectedDateKey(TODAY_KEY)
  }, [])

  const openDate = useCallback((dateKey) => {
    setSelectedDateKey(dateKey)
    setShowDayModal(true)
    onOpenListDate?.(dateKey)
  }, [onOpenListDate])

  const closeDayModal = useCallback(() => {
    setShowDayModal(false)
    onOpenListDate?.('')
  }, [onOpenListDate])

  const moveSelectedDay = useCallback((deltaDays) => {
    const nextDate = parseDateKey(selectedDateKey)
    nextDate.setDate(nextDate.getDate() + deltaDays)
    const nextKey = formatKey(nextDate)
    setSelectedDateKey(nextKey)
    setActiveMonth(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1))
    setShowDayModal(true)
    onOpenListDate?.(nextKey)
  }, [onOpenListDate, selectedDateKey])

  const weekLabels = [
    { short: 'S', full: 'Sun' },
    { short: 'M', full: 'Mon' },
    { short: 'T', full: 'Tue' },
    { short: 'W', full: 'Wed' },
    { short: 'T', full: 'Thu' },
    { short: 'F', full: 'Fri' },
    { short: 'S', full: 'Sat' },
  ]

  // Notify parent when month changes so it can load month-bounded data
  React.useEffect(() => {
    try { onMonthChange?.(new Date(activeMonth)) } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMonth])

  useEffect(() => {
    try { window.localStorage.setItem(DATE_FILTER_KEY, selectedDateKey) } catch {}
  }, [DATE_FILTER_KEY, selectedDateKey])

  useEffect(() => {
    if (!routeDateKey) {
      setShowDayModal(false)
      return
    }
    const routeDate = parseDateKey(routeDateKey)
    setSelectedDateKey(routeDateKey)
    setActiveMonth(new Date(routeDate.getFullYear(), routeDate.getMonth(), 1))
    setShowDayModal(true)
  }, [routeDateKey])

  return (
    <div className="px-4 sm:px-6 py-6">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold text-gray-900 tracking-tight">Calendar</h2>
            <p className="text-sm text-gray-500 mt-1">View your takes by day.</p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                {monthStats.totalTakes} {monthStats.totalTakes === 1 ? 'take' : 'takes'} this month
              </span>
              <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                {monthStats.activeDays} active {monthStats.activeDays === 1 ? 'day' : 'days'}
              </span>
              {monthStats.followUpDays > 0 ? (
                <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800">
                  {monthStats.followUpDays} follow-up {monthStats.followUpDays === 1 ? 'day' : 'days'}
                </span>
              ) : null}
              {monthStats.topThreadName ? (
                <span className="hidden sm:inline-flex items-center rounded-full bg-white border border-gray-200 px-3 py-1 text-xs font-medium text-gray-700">
                  Top thread: {monthStats.topThreadName} · {monthStats.topThreadCount}
                </span>
              ) : null}
            </div>
          </div>
          <div className="w-full sm:w-auto">
            <div className="flex items-center gap-1 rounded-2xl border border-gray-200 bg-white p-1 shadow-sm sm:gap-2">
              <button type="button" onClick={gotoPrevMonth} className="rounded-xl px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900">Prev</button>
              <div className="flex-1 min-w-0 text-center text-sm font-medium text-gray-900 sm:min-w-[140px]">{monthLabel(activeMonth)}</div>
              <button type="button" onClick={gotoNextMonth} className="rounded-xl px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900">Next</button>
              <button type="button" onClick={gotoToday} className="rounded-xl bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800">Today</button>
            </div>
          </div>
        </div>

        <div className="relative rounded-3xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5" aria-busy={sessionsLoading ? 'true' : 'false'}>
          {sessionsLoading ? (
            <div className="absolute right-4 top-4 z-20 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white/95 px-3 py-1.5 text-[11px] text-gray-600 shadow-sm backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-gray-900 animate-pulse" />
              Loading month…
            </div>
          ) : null}
          <div className="grid grid-cols-7 gap-2 text-[11px] text-gray-500 mb-3">
            {weekLabels.map((w) => (
              <div key={w.full} className="text-center uppercase tracking-wide">
                <span className="sm:hidden">{w.short}</span>
                <span className="hidden sm:inline">{w.full}</span>
              </div>
            ))}
          </div>
          <div className={`grid grid-cols-7 gap-2 transition-opacity ${sessionsLoading ? 'opacity-75' : 'opacity-100'}`}>
            {days.map((d) => {
              const isToday = formatKey(d.date) === formatKey(new Date())
              const isSelected = d.key === selectedDateKey
              const has = d.count > 0
              const topSeriesNames = d.summary.topSeriesNames || []
              const followUpMeta = requestSignalMeta[d.summary.followUpSignal]
              const intensityClass = d.count >= 4
                ? 'bg-gray-900/10'
                : d.count >= 2
                  ? 'bg-gray-900/5'
                  : 'bg-transparent'
              return (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => openDate(d.key)}
                  aria-pressed={isSelected}
                  className={`relative h-[78px] sm:h-24 rounded-2xl border text-left p-1.5 sm:p-2.5 transition-all ${
                    isSelected
                      ? 'border-gray-900 bg-gray-900 text-white shadow-md'
                      : has
                        ? 'border-gray-300 bg-white hover:border-gray-400 hover:shadow-sm'
                        : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                  } ${d.inMonth ? '' : 'opacity-50'} overflow-hidden`}
                >
                  {!isSelected && has ? <div className={`absolute inset-x-0 top-0 h-1 ${intensityClass}`} /> : null}
                  <div className="flex items-center justify-between text-xs relative z-10">
                    <span className={`text-xs sm:text-sm ${isSelected ? 'text-white' : 'text-gray-700'}`}>{d.date.getDate()}</span>
                    {isToday ? (
                      <span className={`rounded-full px-1 py-0.5 text-[9px] sm:px-1.5 sm:text-[10px] ${isSelected ? 'bg-white/15 text-white' : 'bg-gray-900/5 text-gray-600'}`}>
                        Today
                      </span>
                    ) : null}
                  </div>
                  {has ? (
                    <div className="mt-1.5 sm:mt-2 space-y-1 sm:space-y-1.5 relative z-10">
                      <span className={`inline-flex text-[10px] sm:text-[11px] uppercase tracking-wide px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full ${isSelected ? 'bg-white/15 text-white' : 'bg-gray-100 text-gray-700'}`}>
                        {d.count} {d.count === 1 ? 'take' : 'takes'}
                      </span>
                      {followUpMeta ? (
                        <span className={`inline-flex text-[10px] sm:text-[11px] px-1.5 sm:px-2 py-0.5 rounded-full ${isSelected ? 'bg-white/15 text-white' : followUpMeta.dayTone}`}>
                          {followUpMeta.label}
                        </span>
                      ) : null}
                      <div className="flex items-center gap-1">
                        {Array.from({ length: Math.min(4, d.count) }).map((_, index) => (
                          <span key={`${d.key}-dot-${index}`} className={`h-1.5 w-1.5 rounded-full ${isSelected ? 'bg-white/80' : 'bg-gray-400'}`} />
                        ))}
                      </div>
                      {topSeriesNames.length ? (
                        <div className="hidden sm:block space-y-0.5">
                          {topSeriesNames.map((seriesName) => (
                            <p key={seriesName} className={`text-[10px] leading-tight truncate ${isSelected ? 'text-white/80' : 'text-gray-500'}`}>
                              {seriesName}
                            </p>
                          ))}
                          {d.summary.extraSeriesCount > 0 ? (
                            <p className={`text-[10px] leading-tight ${isSelected ? 'text-white/60' : 'text-gray-400'}`}>+{d.summary.extraSeriesCount} more</p>
                          ) : null}
                        </div>
                      ) : null}
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
            <div className="absolute inset-0 bg-black/30" onClick={closeDayModal} />
            <div className="absolute inset-x-0 bottom-0 top-20 rounded-t-3xl rounded-b-none bg-white shadow-2xl border border-gray-200 flex flex-col overflow-hidden sm:inset-x-auto sm:right-6 sm:w-[560px] sm:top-10 sm:bottom-10 sm:rounded-3xl">
              <div className="px-4 py-4 border-b border-gray-100 flex flex-col items-stretch justify-between gap-3 bg-white/95 backdrop-blur sm:flex-row sm:items-start">
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-gray-900">{dayLabel(selectedDate)}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-700">
                      {selectedSessions.length} {selectedSessions.length === 1 ? 'take' : 'takes'}
                    </span>
                    <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-700">
                      {selectedThreadCount} {selectedThreadCount === 1 ? 'thread' : 'threads'}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:flex-wrap sm:justify-end">
                  <button
                    type="button"
                    onClick={() => moveSelectedDay(-1)}
                    className="text-xs text-gray-500 hover:text-gray-900 rounded-lg border border-gray-200 px-2 py-2"
                  >
                    Prev day
                  </button>
                  <button
                    type="button"
                    onClick={() => moveSelectedDay(1)}
                    className="text-xs text-gray-500 hover:text-gray-900 rounded-lg border border-gray-200 px-2 py-2"
                  >
                    Next day
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewestFirst((v) => !v)}
                    className={`col-span-2 text-[11px] rounded-xl px-2.5 py-2 border sm:col-span-1 sm:rounded-full sm:py-1 ${newestFirst ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
                    title="Toggle sort order"
                  >
                    {newestFirst ? 'Newest first' : 'Oldest first'}
                  </button>
                  <button type="button" onClick={closeDayModal} className="col-span-2 text-xs text-gray-500 hover:text-gray-900 rounded-lg border border-gray-200 px-2 py-2 sm:col-span-1 sm:px-2 sm:py-1">Close</button>
                </div>
              </div>
              <div className="p-4 overflow-y-auto pb-6 sm:pb-4">
                {sessionsLoading ? (
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-500">Loading…</div>
                ) : sessionsByThread.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center">
                    <p className="text-sm font-medium text-gray-700">No takes on this day.</p>
                    <p className="text-xs text-gray-500 mt-1">Pick another day or jump back to today.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {sessionsByThread.map((group) => (
                      <div key={group.seriesName} className="space-y-3 rounded-2xl border border-gray-200 bg-gray-50/70 p-3">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="min-w-0">
                            <p className="text-xs uppercase tracking-wide text-gray-500">{group.seriesName}</p>
                            <p className="text-xs text-gray-500 mt-1">{group.items.length} {group.items.length === 1 ? 'take' : 'takes'} in this thread</p>
                            {requestSignalMeta[requestSignalKey(group.activeRequest?.status)] ? (
                              <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${requestSignalMeta[requestSignalKey(group.activeRequest?.status)].panelTone}`}>
                                {requestSignalMeta[requestSignalKey(group.activeRequest?.status)].label}
                              </span>
                            ) : null}
                          </div>
                          {group.seriesName !== '(no thread)' && (
                            <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center sm:flex-wrap">
                              <button
                                type="button"
                                onClick={() => onContinueThread?.(group.seriesName, selectedDateKey)}
                                className="col-span-2 rounded-xl bg-gray-900 px-3 py-2 text-xs font-medium text-white hover:bg-gray-800 sm:col-span-1"
                              >
                                Continue thread
                              </button>
                              <button
                                type="button"
                                onClick={() => onOpenSeries?.(group.seriesName)}
                                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
                              >
                                Open thread
                              </button>
                              <button
                                type="button"
                                onClick={() => setRenamingThread(group.seriesName)}
                                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
                              >
                                Rename thread
                              </button>
                            </div>
                          )}
                        </div>
                        <div className="space-y-2">
                          {group.items.map((session) => (
                            <SessionListItem key={session.id} session={session} onOpen={() => onOpenSession?.(session, { view: 'calendar', date: selectedDateKey })} onChangeThread={() => setEditing(session)} />
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
        <ThreadPickerModal
          open={Boolean(editing)}
          title={`${editing?.practice_series ? 'Change' : 'Add to'} thread`}
          initialValue={editing?.practice_series || ''}
          options={threadOptions}
          saving={saving}
          onClose={() => setEditing(null)}
          onSave={async (val) => {
            if (!editing?.id || !token) return
            setSaving(true)
            try {
              const res = await fetch(`/api/sessions/${editing.id}/`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Authorization: `Token ${token}` },
                body: JSON.stringify({ practice_series: val }),
              })
              const data = await res.json().catch(() => ({}))
              if (!res.ok) throw new Error(data?.error || 'Could not update')
              try { window.dispatchEvent(new CustomEvent('practica:session-updated', { detail: { id: editing.id } })) } catch {}
              toast.success(val ? 'Moved to thread' : 'Removed from thread')
            } catch (e) { toast.error(e?.message || 'Could not update thread') }
            setSaving(false)
            setEditing(null)
          }}
        />
        <ThreadPickerModal
          open={Boolean(renamingThread)}
          title="Rename thread"
          initialValue={renamingThread || ''}
          options={threadOptions}
          saving={saving}
          onClose={() => setRenamingThread('')}
          onSave={async (val) => {
            if (!renamingThread || !token) return
            setSaving(true)
            try {
              const res = await fetch('/api/sessions/threads/rename/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Token ${token}` },
                body: JSON.stringify({ old_practice_series: renamingThread, new_practice_series: val }),
              })
              const data = await res.json().catch(() => ({}))
              if (!res.ok) throw new Error(data?.error || 'Could not rename thread')
              try { window.dispatchEvent(new CustomEvent('practica:thread-renamed', { detail: { oldSeriesName: renamingThread, newSeriesName: val } })) } catch {}
              toast.success(
                data?.affected_count === 1
                  ? `Renamed “${renamingThread}” to “${val}” on 1 take`
                  : `Renamed “${renamingThread}” to “${val}” on ${data?.affected_count || 0} takes`
              )
            } catch (e) {
              toast.error(e?.message || 'Could not rename thread')
            }
            setSaving(false)
            setRenamingThread('')
          }}
        />
      </div>
    </div>
  )
}

export default CalendarView
