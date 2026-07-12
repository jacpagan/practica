import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import SessionListItem from './SessionListItem'
import ActivityCalendar from './ActivityCalendar'
import SkillSummaryCard from './SkillSummaryCard'
import VideoThumbnail from './VideoThumbnail'
import SkillField from './SkillField'
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
  highlightSession = null,
  onOpenSession,
  onOpenSkill,
  onSessionUpdate,
}) {
  const toast = useToast()
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
    view: 'progress',
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

  const updateArchiveOpen = (nextOpen) => {
    setArchiveOpen(nextOpen)
    saveArchiveCleanupState(nextOpen)
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
      onClick={() => {
        saveArchiveCleanupState()
        onOpenSession?.(session, progressReturnRoute())
      }}
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

        {justSavedSession ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-emerald-900">Done for today?</p>
                <p className="mt-1 text-sm text-emerald-800">
                  Your proof is saved. Tap it to watch, or record another skill when useful.
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {shareStatus ? (
                  <span className="text-xs font-medium text-emerald-800">{shareStatus}</span>
                ) : null}
                <button
                  type="button"
                  onClick={handleShareProgressCard}
                  className="inline-flex items-center justify-center rounded-full border border-emerald-700/20 bg-white px-3 py-2 text-xs font-semibold text-emerald-950 transition-colors hover:bg-emerald-100"
                >
                  Share progress card
                </button>
              </div>
            </div>
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
                onClick={() => onOpenSession?.(latestSession, progressReturnRoute())}
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
                    onOpen={() => onOpenSession?.(session, progressReturnRoute())}
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
                  <p className="mt-0.5 text-xs text-gray-500">Open one when you want continuity, or record something different.</p>
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

            <details
              open={archiveOpen}
              onToggle={(event) => updateArchiveOpen(event.currentTarget.open)}
              className="rounded-2xl border border-gray-200 bg-white px-4 py-3"
            >
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

                {ungroupedItems.length ? (
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">Uncategorized proofs</p>
                    </div>
                    <div className="space-y-3">
                      {ungroupedItems.map((session) => (
                        <SessionListItem
                          key={session.id}
                          session={session}
                          onOpen={() => {
                            saveArchiveCleanupState()
                            onOpenSession?.(session, progressReturnRoute())
                          }}
                          onChangeSkill={() => openSkillDraft(session)}
                          prefetch
                          minimal
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-gray-900">All proofs</p>
                    <div className="space-y-3">
                      {sessions.map((session) => (
                        <SessionListItem
                          key={session.id}
                          session={session}
                          showSeries
                          onOpen={() => {
                            saveArchiveCleanupState()
                            onOpenSession?.(session, progressReturnRoute())
                          }}
                          onChangeSkill={() => openSkillDraft(session)}
                          prefetch
                          minimal
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </details>
          </>
        )}
      </div>

      {skillDraft.session ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 px-4 py-4 sm:items-center" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-xl">
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
