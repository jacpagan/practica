import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import SessionListItem from './SessionListItem'
import SkillPickerModal from './SkillPickerModal'
import ActivityCalendar from './ActivityCalendar'
import SkillSummaryCard from './SkillSummaryCard'
import VideoThumbnail from './VideoThumbnail'
import { buildSkillSummaries } from '../progressActivity'
import { calculatePracticeProgress, fmtDate, toLocalDateKey } from '../utils'
import { useToast } from './Toast'

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
  const [editingSession, setEditingSession] = useState(null)
  const [draftSkill, setDraftSkill] = useState('')
  const [saving, setSaving] = useState(false)

  const overview = useMemo(() => calculatePracticeProgress(sessions), [sessions])
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

  const skillOptions = useMemo(() => {
    const byCanonicalName = new Map()
    sessions.forEach((item) => {
      const rawName = String(item?.practice_series || '').trim()
      if (!rawName) return
      const canonicalName = rawName.toLocaleLowerCase()
      if (byCanonicalName.has(canonicalName)) return
      byCanonicalName.set(canonicalName, rawName)
    })
    return Array.from(byCanonicalName.values()).sort((left, right) => left.localeCompare(right))
  }, [sessions])

  const openSkillEditor = useCallback((session) => {
    if (!session?.id) return
    setEditingSession(session)
    setDraftSkill(session.practice_series || '')
  }, [])

  const closeSkillEditor = useCallback(() => {
    if (saving) return
    setEditingSession(null)
    setDraftSkill('')
  }, [saving])

  const saveSkill = useCallback(async (nextSkill) => {
    if (!token || !editingSession?.id) return
    setSaving(true)
    try {
      const res = await fetch(`/api/sessions/${editingSession.id}/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Token ${token}`,
        },
        body: JSON.stringify({
          practice_series: String(nextSkill || '').trim(),
        }),
      })
      if (!res.ok) throw new Error('skill')
      const data = await res.json()
      const next = { ...data, local_preview_url: editingSession.local_preview_url || '' }
      onSessionUpdate?.(next)
      toast.success(nextSkill ? 'Skill updated' : 'Removed from skill')
      setEditingSession(null)
      setDraftSkill('')
    } catch {
      toast.error('Could not update the skill')
    } finally {
      setSaving(false)
    }
  }, [editingSession?.id, editingSession?.local_preview_url, onSessionUpdate, toast, token])

  const clearSkill = useCallback(() => saveSkill(''), [saveSkill])

  const justSavedSession = useMemo(() => {
    if (!highlightSession?.id) return null
    return sessions.find((session) => session?.id === highlightSession.id) || highlightSession
  }, [highlightSession, sessions])

  useEffect(() => {
    if (!justSavedSession || !highlightRef.current) return
    highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [justSavedSession?.id])

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

  const ungroupedCount = ungroupedSummary?.proofCount || 0
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
                  ? 'No proof yet today. Tap Record when you are ready.'
                  : 'Tap Record above when you are ready to practice.'}
          </p>
        </div>

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
            <p className="text-sm text-gray-700">Your proof archive starts with one take.</p>
            <p className="text-xs text-gray-500 mt-1">Tap Record above to add your first proof.</p>
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
                <p className="text-sm font-medium text-gray-900">Skills</p>
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
                {ungroupedCount > 0 ? ` · ${ungroupedCount} untagged` : ''}
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
                    <SkillSummaryCard
                      summary={ungroupedSummary}
                      onOpenSession={(session) => onOpenSession?.(session, { view: 'progress', sessionId: null, seriesName: '' })}
                    />
                    <div className="space-y-3">
                      {ungroupedSummary.items.map((session) => (
                        <SessionListItem
                          key={session.id}
                          session={session}
                          onOpen={() => onOpenSession?.(session, { view: 'progress', sessionId: null, seriesName: '' })}
                          onChangeSkill={() => openSkillEditor(session)}
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

      <SkillPickerModal
        open={Boolean(editingSession)}
        title={editingSession?.practice_series ? 'Move proof' : 'Add to skill'}
        initialValue={draftSkill}
        options={skillOptions}
        saving={saving}
        onClose={closeSkillEditor}
        onSave={saveSkill}
        onClear={editingSession?.practice_series ? clearSkill : null}
        clearLabel="Remove from skill"
      />
    </div>
  )
}
