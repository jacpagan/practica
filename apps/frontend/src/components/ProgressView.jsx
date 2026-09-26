import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import SessionListItem from './SessionListItem'
import ActivityCalendar from './ActivityCalendar'
import SkillSummaryCard from './SkillSummaryCard'
import VideoThumbnail from './VideoThumbnail'
import SkillField from './SkillField'
import TodayRoutineCard from './TodayRoutineCard'
import { useToast } from './Toast'
import { buildSkillSummaries } from '../progressActivity'
import { consumeProgressScrollRestore, readArchiveCleanupOpen, saveArchiveCleanupOpen } from '../progressReturnState'
import { buildProgressShareText, calculatePracticeProgress, fmtDate, reportClientEvent, toLocalDateKey } from '../utils'

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
  surface = 'today',
  highlightSession = null,
  onOpenSession,
  onOpenSkill,
  onOpenJournal,
  onOpenProgress,
  onRecordRoutineItem,
  onSessionUpdate,
}) {
  const toast = useToast()
  const isProgressSurface = surface === 'progress'
  const highlightRef = useRef(null)
  const restoreAttemptRef = useRef(false)
  const [shareStatus, setShareStatus] = useState('')
  const [archiveOpen, setArchiveOpen] = useState(() => readArchiveCleanupOpen())
  const [pendingScrollRestore, setPendingScrollRestore] = useState(null)
  const [skillDraft, setSkillDraft] = useState({ session: null, value: '', saving: false })

  const overview = useMemo(() => calculatePracticeProgress(sessions), [sessions])
  const skillSummaries = useMemo(() => buildSkillSummaries(sessions), [sessions])
  const taggedSummaries = useMemo(() => skillSummaries.filter((item) => !item.isUngrouped), [skillSummaries])
  const ungroupedSummary = useMemo(() => skillSummaries.find((item) => item.isUngrouped) || null, [skillSummaries])
  const skillOptions = useMemo(() => (
    Array.from(new Set(taggedSummaries.map((item) => String(item.skillName || '').trim()).filter(Boolean)))
  ), [taggedSummaries])
  const ungroupedItems = ungroupedSummary?.items || []
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

  const shareText = useMemo(() => buildProgressShareText({
    overview,
    session: justSavedSession || todayLatest || latestSession,
  }), [justSavedSession, latestSession, overview, todayLatest])

  const handleShareProgressCard = async () => {
    const shareUrl = (() => {
      try {
        return window.location.origin || 'https://practica.jpagan.com'
      } catch {
        return 'https://practica.jpagan.com'
      }
    })()
    const textWithUrl = `${shareText}\n${shareUrl}`
    setShareStatus('')
    reportClientEvent('progress_card_share_started', {
      action: 'progress_card_share_started',
      session_id: justSavedSession?.id || '',
      proof_count: overview.proofCount,
      proof_days: overview.uniqueDayCount,
    })
    try {
      if (navigator?.share) {
        await navigator.share({
          title: 'Practica progress',
          text: shareText,
          url: shareUrl,
        })
        setShareStatus('Shared')
        reportClientEvent('progress_card_shared', {
          action: 'progress_card_shared',
          channel: 'native_share',
          session_id: justSavedSession?.id || '',
        })
        return
      }
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(textWithUrl)
        setShareStatus('Copied')
        reportClientEvent('progress_card_shared', {
          action: 'progress_card_shared',
          channel: 'clipboard',
          session_id: justSavedSession?.id || '',
        })
        return
      }
      throw new Error('Sharing is not available in this browser')
    } catch (error) {
      if (error?.name === 'AbortError') {
        setShareStatus('')
        return
      }
      setShareStatus('Could not share')
      reportClientEvent('progress_card_share_failed', {
        action: 'progress_card_share_failed',
        reason: error?.message || 'unknown',
        session_id: justSavedSession?.id || '',
      })
    }
  }

  const progressReturnRoute = () => ({
    view: isProgressSurface ? 'archive' : 'progress',
    sessionId: null,
    seriesName: '',
    scrollY: (() => {
      try { return window.scrollY || 0 } catch { return 0 }
    })(),
    archiveOpen,
  })

  const saveArchiveCleanupState = (nextOpen = archiveOpen) => {
    saveArchiveCleanupOpen(nextOpen)
  }

  const openSkillDraft = (session) => {
    setSkillDraft({ session, value: session?.practice_series || '', saving: false })
  }

  const closeSkillDraft = () => {
    if (skillDraft.saving) return
    setSkillDraft({ session: null, value: '', saving: false })
  }

  const saveSkillDraft = async () => {
    const session = skillDraft.session
    if (!token || !session?.id) return
    const nextSkill = String(skillDraft.value || '').trim()
    if (!nextSkill) {
      toast.error('Add a skill name first')
      return
    }
    setSkillDraft((current) => ({ ...current, saving: true }))
    try {
      const res = await fetch(`/api/sessions/${session.id}/`, {
        method: 'PATCH',
        headers: {
          Authorization: `Token ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: session.title || 'Proof',
          practice_series: nextSkill,
          description: session.description || '',
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Could not update skill')
      onSessionUpdate?.(data)
      setSkillDraft({ session: null, value: '', saving: false })
      toast.success(`Added to ${nextSkill}`)
    } catch (error) {
      setSkillDraft((current) => ({ ...current, saving: false }))
      toast.error(error?.message || 'Could not update skill')
    }
  }

  useEffect(() => {
    if (!justSavedSession || !highlightRef.current) return
    highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [justSavedSession?.id])

  useEffect(() => {
    if (sessionsLoading || restoreAttemptRef.current) return
    const pendingRestore = consumeProgressScrollRestore()
    if (!pendingRestore) return
    restoreAttemptRef.current = true
    setArchiveOpen(pendingRestore.archiveOpen)
    saveArchiveCleanupOpen(pendingRestore.archiveOpen)
    setPendingScrollRestore(pendingRestore)
  }, [sessionsLoading, sessions.length])

  useLayoutEffect(() => {
    if (!pendingScrollRestore) return undefined
    let cancelled = false
    let attempts = 0
    const targetScrollY = Math.max(0, Number(pendingScrollRestore.scrollY) || 0)

    const restore = () => {
      if (cancelled) return
      attempts += 1
      try {
        const doc = document.documentElement
        const maxScrollY = Math.max(0, doc.scrollHeight - window.innerHeight)
        const nextScrollY = Math.min(targetScrollY, maxScrollY)
        window.scrollTo({ top: nextScrollY, behavior: 'auto' })
        const currentScrollY = window.scrollY || doc.scrollTop || 0
        const needsMoreHeight = maxScrollY < targetScrollY
        const missedTarget = Math.abs(currentScrollY - nextScrollY) > 8
        if ((needsMoreHeight || missedTarget) && attempts < 30) {
          window.setTimeout(restore, 50)
          return
        }
      } catch {}
      setPendingScrollRestore(null)
    }

    const frameId = window.requestAnimationFrame(restore)
    return () => {
      cancelled = true
      window.cancelAnimationFrame(frameId)
    }
  }, [pendingScrollRestore, archiveOpen, sessions.length])

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

  const renderProofCard = (session, label, { highlighted = false } = {}) => (
    <button
      key={session.id}
      ref={highlighted ? highlightRef : null}
      type="button"
      onClick={() => {
        saveArchiveCleanupState()
        onOpenSession?.(session, progressReturnRoute())
      }}
      className={`w-full overflow-hidden rounded-lg border text-left transition-colors ${
        highlighted
          ? 'border-emerald-400 bg-emerald-50/70 ring-2 ring-emerald-200 hover:bg-emerald-50'
          : 'border-gray-900 bg-gray-50/40 hover:bg-gray-50'
      }`}
    >
      <div className="flex items-stretch gap-0 sm:gap-4">
        <VideoThumbnail session={session} variant="poster" className="relative w-28 shrink-0 bg-black sm:w-40" />
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
    <div className="px-4 py-8 pb-28 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-3xl space-y-10">
        {isProgressSurface ? (
          <>
            <header className="border-b border-gray-200 pb-6">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-gray-400">Private archive</p>
              <h1 className="mt-2 text-3xl font-semibold text-gray-950">Progress</h1>
              <p className="mt-2 text-sm text-gray-500">Evidence collected through practice, not performance.</p>
            </header>

            <section className="grid grid-cols-3 border-b border-gray-200 pb-8 text-center sm:text-left">
              <div><p className="text-2xl font-semibold text-gray-950">{overview.proofCount}</p><p className="mt-1 text-xs text-gray-400">Proofs</p></div>
              <div><p className="text-2xl font-semibold text-gray-950">{overview.uniqueDayCount}</p><p className="mt-1 text-xs text-gray-400">Practice days</p></div>
              <div><p className="text-2xl font-semibold text-gray-950">{overview.skillCount}</p><p className="mt-1 text-xs text-gray-400">Skills</p></div>
            </section>

            {sessions.length ? <ActivityCalendar sessions={sessions} /> : null}

            {taggedSummaries.length ? (
              <section className="space-y-4">
                <div><h2 className="text-lg font-semibold text-gray-950">Skills</h2><p className="mt-1 text-sm text-gray-500">Open a thread to see how the work has changed.</p></div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {taggedSummaries.map((summary) => <SkillSummaryCard key={summary.skillKey} summary={summary} onOpenSkill={onOpenSkill} />)}
                </div>
              </section>
            ) : null}

            <section className="space-y-4">
              <div className="flex items-end justify-between gap-4 border-b border-gray-200 pb-3">
                <div><h2 className="text-lg font-semibold text-gray-950">Proof archive</h2>{overview.latestProofAt ? <p className="mt-1 text-xs text-gray-400">Latest {fmtDate(overview.latestProofAt)}</p> : null}</div>
                {ungroupedItems.length ? <p className="text-xs text-gray-400">{ungroupedItems.length} uncategorized</p> : null}
              </div>
              {sessions.length ? (
                <div className="divide-y divide-gray-100">
                  {sessions.map((session) => (
                    <div key={session.id} className="py-3">
                      <SessionListItem session={session} showSeries onOpen={() => onOpenSession?.(session, progressReturnRoute())} onChangeSkill={() => openSkillDraft(session)} prefetch minimal />
                    </div>
                  ))}
                </div>
              ) : <p className="py-8 text-sm text-gray-500">Your private archive begins with one proof.</p>}
            </section>
          </>
        ) : (
          <>
            <header>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-gray-400">Your practice</p>
              <h1 className="mt-2 text-3xl font-semibold text-gray-950">Today</h1>
              <p className="mt-2 text-sm text-gray-500">{justSavedSession ? 'Proof saved. You showed up today.' : overview.proofRecordedToday ? 'You showed up today.' : 'Begin with the next useful action.'}</p>
            </header>

            <TodayRoutineCard token={token} sessions={sessions} onOpenJournal={onOpenJournal} onRecord={onRecordRoutineItem} />

            {justSavedSession ? (
              <div className="flex flex-col gap-3 border-l-2 border-emerald-600 pl-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-gray-600">Your proof is safely in the archive.</p>
                <div className="flex items-center gap-3">{shareStatus ? <span className="text-xs text-gray-500">{shareStatus}</span> : null}<button type="button" onClick={handleShareProgressCard} className="text-sm font-medium text-gray-950 underline decoration-gray-300 underline-offset-4">Share summary</button></div>
              </div>
            ) : null}

            {sessions.length === 0 ? (
              <p className="border-t border-gray-200 py-8 text-sm text-gray-500">Record your first proof whenever you are ready.</p>
            ) : (
              <section className="space-y-4">
                <div className="flex items-center justify-between border-b border-gray-200 pb-3"><h2 className="text-sm font-medium text-gray-950">Recent proof</h2><button type="button" onClick={onOpenProgress} className="text-xs text-gray-500 hover:text-gray-950">View progress</button></div>
                {todayLatest ? renderProofCard(todayLatest, justSavedSession?.id === todayLatest.id ? 'Just saved' : "Today's proof", { highlighted: justSavedSession?.id === todayLatest.id }) : null}
                {justSavedSession && (!todayLatest || todayLatest.id !== justSavedSession.id) ? renderProofCard(justSavedSession, 'Just saved', { highlighted: true }) : null}
                {!overview.proofRecordedToday && latestSession ? renderProofCard(latestSession, 'Last proof') : null}
                {todaySessions.length > 1 ? <div className="divide-y divide-gray-100">{todaySessions.slice(1).map((session) => <div key={session.id} className="py-2"><SessionListItem session={session} onOpen={() => onOpenSession?.(session, progressReturnRoute())} prefetch minimal /></div>)}</div> : null}
              </section>
            )}
          </>
        )}
      </div>

      {skillDraft.session ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 px-4 py-4 sm:items-center" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-lg bg-white p-4 shadow-xl">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Assign skill</p>
              <h3 className="mt-1 text-lg font-semibold text-gray-950">{skillDraft.session.title || 'Proof'}</h3>
              <p className="mt-1 text-sm text-gray-500">Add this proof to a skill so it stops showing in Uncategorized.</p>
            </div>
            <div className="mt-4">
              <SkillField
                value={skillDraft.value}
                onChange={(value) => setSkillDraft((current) => ({ ...current, value }))}
                options={skillOptions}
                disabled={skillDraft.saving}
                placeholder="Type or choose a skill"
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeSkillDraft}
                disabled={skillDraft.saving}
                className="rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveSkillDraft}
                disabled={skillDraft.saving}
                className="rounded-full bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
              >
                {skillDraft.saving ? 'Saving' : 'Save skill'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
