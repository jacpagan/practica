import React, { useCallback, useMemo, useState } from 'react'
import SessionListItem from './SessionListItem'
import SkillPickerModal from './SkillPickerModal'
import ActivityCalendar from './ActivityCalendar'
import SkillSummaryCard from './SkillSummaryCard'
import VideoThumbnail from './VideoThumbnail'
import { buildSkillSummaries } from '../progressActivity'
import { calculatePracticeProgress, fmtDate } from '../utils'
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
  onOpenSession,
  onOpenSkill,
  onSessionUpdate,
}) {
  const toast = useToast()
  const [editingSession, setEditingSession] = useState(null)
  const [draftSkill, setDraftSkill] = useState('')
  const [saving, setSaving] = useState(false)

  const overview = useMemo(() => calculatePracticeProgress(sessions), [sessions])
  const skillSummaries = useMemo(() => buildSkillSummaries(sessions), [sessions])
  const taggedSummaries = useMemo(() => skillSummaries.filter((item) => !item.isUngrouped), [skillSummaries])
  const ungroupedSummary = useMemo(() => skillSummaries.find((item) => item.isUngrouped) || null, [skillSummaries])
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

  return (
    <div className="px-4 sm:px-6 py-6 pb-28">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 tracking-tight">Your archive</h2>
          <p className="text-sm text-gray-500 mt-1">Tap a skill or your latest proof to keep going.</p>
        </div>

        {sessions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-10 text-center">
            <p className="text-sm text-gray-700">No proofs yet.</p>
            <p className="text-xs text-gray-500 mt-1">Tap Record above to add your first proof.</p>
          </div>
        ) : (
          <>
            {latestSession ? (
              <button
                type="button"
                onClick={() => onOpenSession?.(latestSession, { view: 'progress', sessionId: null, seriesName: '' })}
                className="w-full rounded-2xl border border-gray-900 bg-gray-50/40 overflow-hidden text-left hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-stretch gap-0 sm:gap-4">
                  <VideoThumbnail session={latestSession} variant="poster" className="relative w-28 shrink-0 bg-black sm:w-40 sm:rounded-l-2xl" />
                  <div className="flex min-w-0 flex-1 flex-col justify-center px-4 py-4">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Latest proof</p>
                    <p className="mt-1 truncate text-base font-semibold text-gray-900">{latestSession.title || 'Proof'}</p>
                    <p className="mt-1 text-sm text-gray-500">
                      {formatCompactDateTime(latestSession.recorded_at || latestSession.created_at)}
                      {latestSession.practice_series ? ` · ${latestSession.practice_series}` : ''}
                    </p>
                  </div>
                </div>
              </button>
            ) : null}

            {ungroupedCount > 0 ? (
              <p className="text-sm text-amber-900 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                {ungroupedCount} {ungroupedCount === 1 ? 'proof needs' : 'proofs need'} a skill tag.
              </p>
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

            <details className="rounded-2xl border border-gray-200 bg-white px-4 py-3">
              <summary className="cursor-pointer list-none text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors">
                Activity & overview
              </summary>
              <div className="mt-4 space-y-4 border-t border-gray-100 pt-4">
                {overviewParts.length > 0 ? (
                  <p className="text-sm text-gray-600">{overviewParts.join(' · ')}</p>
                ) : null}
                {overview.latestProofAt ? (
                  <p className="text-xs text-gray-500">Latest proof {fmtDate(overview.latestProofAt)}</p>
                ) : null}
                <ActivityCalendar sessions={sessions} />
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
