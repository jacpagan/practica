import React, { useEffect, useMemo, useRef } from 'react'
import SessionListItem from './SessionListItem'
import ActivityCalendar from './ActivityCalendar'
import SkillSummaryCard from './SkillSummaryCard'
import VideoThumbnail from './VideoThumbnail'
import { buildSkillSummaries, buildTodayLoopState } from '../progressActivity'
import { calculatePracticeProgress, fmtDate, reportClientEvent, toLocalDateKey } from '../utils'

const formatCompactDateTime = (value) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const dayPart = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  const timePart = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  return `${dayPart} · ${timePart}`
}

export default function ProgressView({
  sessions = [],
  sessionsLoading = false,
  token = '',
  highlightSession = null,
  onOpenSession,
  onOpenSkill,
  onRecord,
}) {
  const highlightRef = useRef(null)

  const overview = useMemo(() => calculatePracticeProgress(sessions), [sessions])
  const todayLoop = useMemo(() => buildTodayLoopState(sessions), [sessions])
  const skillSummaries = useMemo(() => buildSkillSummaries(sessions), [sessions])
  const taggedSummaries = useMemo(() => skillSummaries.filter((item) => !item.isUngrouped), [skillSummaries])
  const ungroupedSummary = useMemo(() => skillSummaries.find((item) => item.isUngrouped) || null, [skillSummaries])
  const todayKey = useMemo(() => toLocalDateKey(new Date()), [])
  const todaySessions = useMemo(() => (
    sessions
      .filter((session) => session?.id && toLocalDateKey(session.recorded_at || session.created_at) === todayKey)
      .sort((left, right) => {
        const leftTime = new Date(left.recorded_at || left.created_at || 0).getTime() || 0
        const rightTime = new Date(right.recorded_at || right.created_at || 0).getTime() || 0
        return rightTime - leftTime
      })
  ), [sessions, todayKey])
  const todayLatest = todaySessions[0] || null
  const latestSession = useMemo(() => {
    const sorted = [...sessions]
      .filter((session) => session?.id)
      .sort((left, right) => {
        const leftTime = new Date(left.recorded_at || left.created_at || 0).getTime() || 0
        const rightTime = new Date(right.recorded_at || right.created_at || 0).getTime() || 0
        return rightTime - leftTime
      })
    return sorted[0] || null
  }, [sessions])

  const justSavedSession = useMemo(() => {
    if (!highlightSession?.id) return null
    return sessions.find((session) => session?.id === highlightSession.id) || highlightSession
  }, [highlightSession, sessions])

  const nextSkillName = todayLoop.nextSkillName
  const primaryActionLabel = todayLoop.proofRecordedToday
    ? 'Record another proof'
    : (nextSkillName ? `Record ${nextSkillName} today` : 'Record today\'s proof')
  const primaryActionDetail = todayLoop.proofRecordedToday
    ? (todayLoop.todayProofCount > 1 ? `${todayLoop.todayProofCount} proofs saved today.` : 'Your proof is saved for today.')
    : (nextSkillName
        ? `${todayLoop.recommendedSkill?.proofCount || 0} ${todayLoop.recommendedSkill?.proofCount === 1 ? 'proof' : 'proofs'} already in this skill.`
        : (todayLoop.totalProofCount > 0 ? 'Start with one tiny take and label it after recording.' : 'Your private archive starts with one tiny take.'))

  const handlePrimaryRecord = () => {
    onRecord?.({ skillName: nextSkillName })
  }

  useEffect(() => {
    if (!justSavedSession || !highlightRef.current) return
    highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [justSavedSession?.id])

  useEffect(() => {
    if (sessionsLoading || !token) return
    const todayKey = toLocalDateKey(new Date())
    const storageKey = `practica.loop.today_viewed.${todayKey}`
    try {
      if (window.localStorage.getItem(storageKey)) return
      window.localStorage.setItem(storageKey, '1')
    } catch {
      // Ignore storage failures; still attempt one event this mount.
    }
    reportClientEvent('today_viewed', { action: 'today_viewed' })
  }, [sessionsLoading, token])

  if (sessionsLoading) {
    return (
      <div className="px-4 sm:px-6 py-6">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="h-7 w-28 bg-gray-200 rounded animate-pulse" />
          <div className="h-24 w-full bg-gray-100 rounded-2xl animate-pulse" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="h-48 bg-gray-100 rounded-2xl animate-pulse" />
            <div className="h-48 bg-gray-100 rounded-2xl animate-pulse" />
          </div>
        </div>
      </div>
    )
  }

  const overviewParts = []
  if (overview.proofCount > 0) {
    overviewParts.push(`${overview.proofCount} ${overview.proofCount === 1 ? 'proof' : 'proofs'}`)
    overviewParts.push(`${overview.uniqueDayCount} ${overview.uniqueDayCount === 1 ? 'day' : 'days'} with proof`)
    if (overview.skillCount > 0) {
      overviewParts.push(`${overview.skillCount} ${overview.skillCount === 1 ? 'skill' : 'skills'}`)
    }
  }

  const renderProofCard = (session, label, { highlighted = false } = {}) => (
    <button
      key={session.id}
      ref={highlighted ? highlightRef : null}
      type="button"
      onClick={() => onOpenSession?.(session, { view: 'progress', sessionId: null, seriesName: '' })}
      className={`w-full rounded-2xl border overflow-hidden text-left transition-colors ${
        highlighted
          ? 'border-emerald-400 bg-emerald-50/70 ring-2 ring-emerald-200 hover:bg-emerald-50'
          : 'border-gray-900 bg-gray-50/40 hover:bg-gray-50'
      }`}
    >
      <div className="flex items-stretch gap-0 sm:gap-4">
        <VideoThumbnail session={session} variant="poster" className="relative w-28 shrink-0 bg-black sm:w-40 sm:rounded-l-2xl" />
        <div className="flex min-w-0 flex-1 flex-col justify-center px-4 py-4">
          <p className={`text-[11px] font-medium uppercase tracking-wide ${highlighted ? 'text-emerald-700' : 'text-gray-500'}`}>{label}</p>
          <p className="mt-1 truncate text-base font-semibold text-gray-900">{session.title || 'Proof'}</p>
          <p className="mt-1 text-sm text-gray-500">
            {formatCompactDateTime(session.recorded_at || session.created_at)}
            {session.practice_series ? ` · ${session.practice_series}` : ''}
          </p>
        </div>
      </div>
    </button>
  )

  return (
    <div className="px-4 sm:px-6 py-6 pb-28">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 tracking-tight">Today</h2>
          <p className="text-sm text-gray-500 mt-1">
            {justSavedSession
              ? 'Proof saved. You showed up today.'
              : overview.proofRecordedToday
                ? (todaySessions.length > 1
                  ? `${todaySessions.length} proofs logged today.`
                  : 'You showed up today.')
                : sessions.length > 0
                  ? 'Ready when you are.'
                  : 'Your archive starts with one take.'}
          </p>
        </div>

        <section className="rounded-2xl border border-gray-900 bg-gray-950 p-4 text-white shadow-sm sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-white/55">Next tiny proof</p>
              <h3 className="mt-1 text-xl font-semibold tracking-tight">
                {todayLoop.proofRecordedToday
                  ? 'You showed up today.'
                  : (nextSkillName ? `Continue ${nextSkillName}` : 'Capture one small rep')}
              </h3>
              <p className="mt-2 text-sm text-white/70">{primaryActionDetail}</p>
            </div>
            <button
              type="button"
              onClick={handlePrimaryRecord}
              className="inline-flex w-full items-center justify-center rounded-xl bg-white px-4 py-3 text-sm font-semibold text-gray-950 transition-colors hover:bg-gray-100 sm:w-auto"
            >
              {primaryActionLabel}
            </button>
          </div>
          {overview.proofCount > 0 ? (
            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/10 pt-4 text-center">
              <div>
                <p className="text-lg font-semibold">{overview.proofCount}</p>
                <p className="text-[11px] text-white/55">proofs</p>
              </div>
              <div>
                <p className="text-lg font-semibold">{overview.uniqueDayCount}</p>
                <p className="text-[11px] text-white/55">proof days</p>
              </div>
              <div>
                <p className="text-lg font-semibold">{overview.proofsLast7Days}</p>
                <p className="text-[11px] text-white/55">recent</p>
              </div>
            </div>
          ) : null}
        </section>

        {justSavedSession ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <p className="text-sm font-medium text-emerald-900">Done for today?</p>
            <p className="mt-1 text-sm text-emerald-800">
              Your proof is saved. Tap it to watch, or come back tomorrow for another take.
            </p>
          </div>
        ) : null}

        {sessions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-10 text-center">
            <p className="text-sm text-gray-700">Record your first proof whenever you are ready.</p>
          </div>
        ) : (
          <>
            {todayLatest ? renderProofCard(
              todayLatest,
              justSavedSession?.id === todayLatest.id ? 'Just saved' : "Today's proof",
              { highlighted: justSavedSession?.id === todayLatest.id },
            ) : null}

            {justSavedSession && (!todayLatest || todayLatest.id !== justSavedSession.id) ? (
              renderProofCard(justSavedSession, 'Just saved', { highlighted: true })
            ) : null}

            {!overview.proofRecordedToday && latestSession ? (
              <button
                type="button"
                onClick={() => onOpenSession?.(latestSession, { view: 'progress', sessionId: null, seriesName: '' })}
                className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-left hover:bg-gray-50 transition-colors"
              >
                <p className="text-xs text-gray-500">Last proof</p>
                <p className="mt-1 text-sm font-medium text-gray-900 truncate">{latestSession.title || 'Proof'}</p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {formatCompactDateTime(latestSession.recorded_at || latestSession.created_at)}
                  {latestSession.practice_series ? ` · ${latestSession.practice_series}` : ''}
                </p>
              </button>
            ) : null}

            {todaySessions.length > 1 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-900">Earlier today</p>
                {todaySessions.slice(1).map((session) => (
                  <SessionListItem
                    key={session.id}
                    session={session}
                    onOpen={() => onOpenSession?.(session, { view: 'progress', sessionId: null, seriesName: '' })}
                    prefetch
                    minimal
                  />
                ))}
              </div>
            ) : null}

            {taggedSummaries.length > 0 ? (
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">Skills</p>
                  <p className="mt-0.5 text-xs text-gray-500">Pick up where your latest proofs left off.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {taggedSummaries.map((summary) => (
                    <SkillSummaryCard
                      key={summary.skillKey}
                      summary={summary}
                      onOpenSkill={onOpenSkill}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            <details className="rounded-2xl border border-gray-200 bg-white px-4 py-3">
              <summary className="cursor-pointer list-none text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors">
                Full archive
              </summary>
              <div className="mt-4 space-y-4 border-t border-gray-100 pt-4">
                {overviewParts.length > 0 ? (
                  <p className="text-sm text-gray-600">{overviewParts.join(' · ')}</p>
                ) : null}
                {overview.latestProofAt ? (
                  <p className="text-xs text-gray-500">Latest proof {fmtDate(overview.latestProofAt)}</p>
                ) : null}
                <ActivityCalendar sessions={sessions} />

                {ungroupedSummary ? (
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-gray-900">Other proofs</p>
                    <div className="space-y-3">
                      {ungroupedSummary.items.map((session) => (
                        <SessionListItem
                          key={session.id}
                          session={session}
                          onOpen={() => onOpenSession?.(session, { view: 'progress', sessionId: null, seriesName: '' })}
                          prefetch
                          minimal
                        />
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </details>
          </>
        )}
      </div>
    </div>
  )
}
