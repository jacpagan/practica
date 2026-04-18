import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react'
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
const UNTHREADED_KEY = '__unthreaded__'

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
  needs_new_take: {
    label: 'Needs new take',
    dayTone: 'bg-orange-100 text-orange-800',
    panelTone: 'bg-orange-100 text-orange-800',
  },
  wrong_take: {
    label: 'Wrong take',
    dayTone: 'bg-rose-100 text-rose-800',
    panelTone: 'bg-rose-100 text-rose-800',
  },
}

const requestSignalKey = (status = '') => {
  const normalized = String(status || '').trim().toLowerCase()
  if (normalized === 'needs_resubmission') return 'needs_new_take'
  if (normalized === 'declined_unrelated') return 'wrong_take'
  if (['responded', 'viewed'].includes(normalized)) return 'feedback_ready'
  if (['requested', 'opened', 'resubmitted'].includes(normalized)) return 'awaiting_review'
  return ''
}

const requestSignalPriority = (status = '') => {
  const signal = requestSignalKey(status)
  if (signal === 'needs_new_take' || signal === 'wrong_take') return 3
  if (signal === 'feedback_ready') return 2
  if (signal === 'awaiting_review') return 1
  return 0
}

const requestStatusRank = (status = '') => {
  const normalized = String(status || '').trim().toLowerCase()
  if (['needs_resubmission', 'declined_unrelated'].includes(normalized)) return 4
  if (['responded', 'viewed'].includes(normalized)) return 3
  if (normalized === 'resubmitted') return 2
  if (['requested', 'opened'].includes(normalized)) return 1
  return 0
}

const sessionReviewChipStatus = (status = '') => {
  const signal = requestSignalKey(status)
  return signal || ''
}

function CalendarView({ sessions = [], sessionsLoading = false, routeDateKey = '', reviewRequests = [], onOpenSession, onOpenSeries, onMonthChange, onOpenListDate, onQuickRecord }) {
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
  const [pendingFollowUpTarget, setPendingFollowUpTarget] = useState(null)
  const [highlightedGroupName, setHighlightedGroupName] = useState('')
  const groupRefs = useRef(new Map())
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
        map.set(key, { count: 0, seriesMap: new Map(), followUpStatus: '', followUpSeriesName: '', followUpUpdatedAt: 0 })
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
      const requestUpdatedAt = new Date(activeRequestBySessionId.get(Number(session.id))?.updated_at || activeRequestBySessionId.get(Number(session.id))?.created_at || when).getTime() || 0
      const nextRank = requestStatusRank(requestStatus)
      const currentRank = requestStatusRank(entry.followUpStatus)
      if (nextRank > currentRank || (nextRank === currentRank && requestUpdatedAt > entry.followUpUpdatedAt)) {
        entry.followUpStatus = requestStatus
        entry.followUpSeriesName = seriesName
        entry.followUpUpdatedAt = requestUpdatedAt
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
        followUpSignal: requestSignalKey(value.followUpStatus),
        followUpSeriesName: value.followUpSeriesName,
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
      const key = String(s.practice_series || '').trim() || UNTHREADED_KEY
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

  const monthStats = useMemo(() => ({
    feedbackReadyDays: Array.from(daySummaries.values()).filter((item) => item.followUpSignal === 'feedback_ready').length,
    awaitingReviewDays: Array.from(daySummaries.values()).filter((item) => item.followUpSignal === 'awaiting_review').length,
  }), [daySummaries])

  const smartFollowUpTarget = useMemo(() => {
    let best = null
    sessions.forEach((session) => {
      const requestItem = activeRequestBySessionId.get(Number(session.id))
      const status = String(requestItem?.status || '').trim().toLowerCase()
      const rank = requestStatusRank(status)
      if (!rank) return
      const updatedAt = new Date(requestItem?.updated_at || requestItem?.created_at || session.recorded_at || session.created_at).getTime() || 0
      const candidate = {
        dateKey: formatKey(startOfDay(new Date(session.recorded_at || session.created_at))),
        signal: requestSignalKey(status),
        seriesName: String(session.practice_series || '').trim() || UNTHREADED_KEY,
        status,
        rank,
        updatedAt,
      }
      if (!best || candidate.rank > best.rank || (candidate.rank === best.rank && candidate.updatedAt > best.updatedAt)) {
        best = candidate
      }
    })
    return best
  }, [activeRequestBySessionId, sessions])

  const smartFollowUpLabel = useMemo(() => {
    if (!smartFollowUpTarget) return ''
    if (['needs_resubmission', 'declined_unrelated'].includes(smartFollowUpTarget.status)) return 'Record next take'
    if (smartFollowUpTarget.signal === 'feedback_ready') return 'Review feedback'
    return 'Open latest thread'
  }, [smartFollowUpTarget])

  const selectedThreadCount = sessionsByThread.filter((group) => group.seriesName !== UNTHREADED_KEY).length
  const hasUnthreadedGroup = sessionsByThread.some((group) => group.seriesName === UNTHREADED_KEY)

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

  const openDate = useCallback((dateKey, followUpTarget = null) => {
    setSelectedDateKey(dateKey)
    setShowDayModal(true)
    setPendingFollowUpTarget(followUpTarget)
    onOpenListDate?.(dateKey)
  }, [onOpenListDate])

  const closeDayModal = useCallback(() => {
    setShowDayModal(false)
    setPendingFollowUpTarget(null)
    setHighlightedGroupName('')
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

  useEffect(() => {
    if (!showDayModal || !pendingFollowUpTarget) return
    const targetGroup = sessionsByThread.find((group) => {
      if (pendingFollowUpTarget.seriesName && group.seriesName === pendingFollowUpTarget.seriesName) return true
      return requestSignalKey(group.activeRequest?.status) === pendingFollowUpTarget.signal
    })
    if (!targetGroup?.seriesName) return
    setHighlightedGroupName(targetGroup.seriesName)
    const frameId = requestAnimationFrame(() => {
      groupRefs.current.get(targetGroup.seriesName)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setPendingFollowUpTarget(null)
    })
    const timerId = window.setTimeout(() => setHighlightedGroupName(''), 1800)
    return () => {
      cancelAnimationFrame(frameId)
      window.clearTimeout(timerId)
    }
  }, [pendingFollowUpTarget, sessionsByThread, showDayModal])

  return (
    <div className="px-4 sm:px-6 py-6">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <p className="text-sm text-gray-500 mt-1">Review your private takes day by day.</p>
            {smartFollowUpTarget ? (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => openDate(smartFollowUpTarget.dateKey, smartFollowUpTarget)}
                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${requestSignalMeta[smartFollowUpTarget.signal]?.dayTone || 'bg-gray-100 text-gray-700'}`}
                  title={smartFollowUpTarget.seriesName ? `${smartFollowUpLabel} in ${smartFollowUpTarget.seriesName}` : smartFollowUpLabel}
                >
                  {smartFollowUpLabel}
                  <span className="ml-2 opacity-75">
                    {smartFollowUpTarget.signal === 'feedback_ready' ? monthStats.feedbackReadyDays : monthStats.awaitingReviewDays}
                  </span>
                </button>
              </div>
            ) : null}
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
              const followUpMeta = requestSignalMeta[d.summary.followUpSignal]
              return (
                <div key={d.key} className={`relative h-[58px] sm:h-[70px] rounded-xl overflow-hidden ${d.inMonth ? '' : 'opacity-35'}`}>
                  <button
                    type="button"
                    onClick={() => openDate(d.key)}
                    aria-pressed={isSelected}
                    aria-label={`${dayLabel(d.date)}${has ? `, ${d.count} ${d.count === 1 ? 'take' : 'takes'}` : ''}`}
                    className={`absolute inset-0 rounded-xl border text-left p-2 sm:p-2.5 transition-all ${
                      isSelected
                        ? 'border-gray-300 bg-gray-100 text-gray-900 shadow-sm'
                        : has
                          ? 'border-gray-150 bg-white hover:border-gray-200 hover:bg-gray-50'
                          : 'border-gray-100 bg-white hover:bg-gray-50'
                    }`}
                  />
                  <div className="pointer-events-none relative z-10 flex h-full flex-col justify-between p-2 sm:p-2.5">
                    <div className="flex items-start justify-between text-xs">
                      <span className={`text-xs sm:text-sm font-medium ${isSelected ? 'text-gray-900' : 'text-gray-800'}`}>{d.date.getDate()}</span>
                      {isToday ? (
                        <span className={`h-1.5 w-1.5 rounded-full ${isSelected ? 'bg-gray-900' : 'bg-gray-900'}`} />
                      ) : null}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {has ? (
                        <span className={`h-1.5 w-1.5 rounded-full ${isSelected ? 'bg-gray-500' : 'bg-gray-300'}`} />
                      ) : null}
                      {followUpMeta ? (
                        <span className={`h-1.5 w-1.5 rounded-full ${isSelected ? 'bg-gray-900' : 'bg-gray-900'}`} title={followUpMeta.label} />
                      ) : null}
                    </div>
                  </div>
                </div>
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
                    {selectedThreadCount > 0 ? (
                      <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-700">
                        {selectedThreadCount} {selectedThreadCount === 1 ? 'thread' : 'threads'}
                      </span>
                    ) : null}
                    {hasUnthreadedGroup ? (
                      <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-700">
                        {UNTHREADED_LABEL}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:flex-wrap sm:justify-end">
                  <button
                    type="button"
                    onClick={() => onQuickRecord?.(selectedDateKey)}
                    className="rounded-lg bg-gray-900 px-2.5 py-2 text-xs font-medium text-white hover:bg-gray-800"
                  >
                    Record
                  </button>
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
              <div className="p-4 overflow-y-auto pb-6 sm:pb-4" aria-busy={sessionsLoading ? 'true' : 'false'}>
                {sessionsLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, idx) => (
                      <div key={idx} className="rounded-2xl border border-gray-200 bg-white p-3">
                        <div className="h-4 bg-gray-100 rounded w-32 animate-pulse" />
                        <div className="h-3 bg-gray-100 rounded w-48 mt-2 animate-pulse" />
                        <div className="h-24 bg-gray-50 rounded-xl mt-3 animate-pulse" />
                      </div>
                    ))}
                  </div>
                ) : sessionsByThread.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center">
                    <p className="text-sm font-medium text-gray-700">No takes on this day.</p>
                    <p className="text-xs text-gray-500 mt-1">Pick another day or jump back to today.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {sessionsByThread.map((group) => (
                      <div
                        key={group.seriesName}
                        ref={(node) => {
                          if (node) groupRefs.current.set(group.seriesName, node)
                          else groupRefs.current.delete(group.seriesName)
                        }}
                        className={`space-y-3 rounded-2xl border bg-gray-50/70 p-3 transition-all ${highlightedGroupName === group.seriesName ? 'border-emerald-400 ring-2 ring-emerald-200' : 'border-gray-200'}`}
                      >
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="min-w-0">
                            <p className="text-xs uppercase tracking-wide text-gray-500">{group.seriesName === UNTHREADED_KEY ? UNTHREADED_LABEL : group.seriesName}</p>
                            <p className="text-xs text-gray-500 mt-1">{group.items.length} {group.items.length === 1 ? 'take' : 'takes'}{group.seriesName === UNTHREADED_KEY ? '' : ' in this thread'}</p>
                          </div>
                          {group.seriesName !== UNTHREADED_KEY && (
                            <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center sm:flex-wrap">
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
                            <SessionListItem
                              key={session.id}
                              session={session}
                              status={sessionReviewChipStatus(activeRequestBySessionId.get(Number(session.id))?.status)}
                              requestItem={activeRequestBySessionId.get(Number(session.id)) || null}
                              onOpen={() => onOpenSession?.(session, { view: 'calendar', date: selectedDateKey })}
                              onChangeThread={() => setEditing(session)}
                            />
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
