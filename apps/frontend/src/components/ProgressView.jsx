import React, { useCallback, useMemo, useState } from 'react'
import SessionListItem from './SessionListItem'
import SkillPickerModal from './SkillPickerModal'
import ActivityCalendar from './ActivityCalendar'
import SkillSummaryCard from './SkillSummaryCard'
import { buildSkillSummaries } from '../progressActivity'
import { calculatePracticeProgress, fmtDate } from '../utils'
import { useToast } from './Toast'


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
  const [renamingSkillName, setRenamingSkillName] = useState('')
  const [saving, setSaving] = useState(false)

  const overview = useMemo(() => calculatePracticeProgress(sessions), [sessions])
  const skillSummaries = useMemo(() => buildSkillSummaries(sessions), [sessions])
  const taggedSummaries = useMemo(() => skillSummaries.filter((item) => !item.isUngrouped), [skillSummaries])
  const ungroupedSummary = useMemo(() => skillSummaries.find((item) => item.isUngrouped) || null, [skillSummaries])

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

  const closeSkillRename = useCallback(() => {
    if (saving) return
    setRenamingSkillName('')
  }, [saving])

  const saveSkillRename = useCallback(async (nextName) => {
    if (!token || !renamingSkillName) return
    const newName = String(nextName || '').trim()
    if (!newName) {
      toast.error('Enter a skill name')
      return
    }
    if (newName === renamingSkillName) {
      setRenamingSkillName('')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/sessions/threads/rename/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Token ${token}`,
        },
        body: JSON.stringify({
          old_practice_series: renamingSkillName,
          new_practice_series: newName,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Could not rename skill')
      try {
        window.dispatchEvent(new CustomEvent('practica:skill-renamed', {
          detail: { oldSeriesName: renamingSkillName, newSeriesName: newName },
        }))
      } catch {}
      toast.success('Skill renamed')
      setRenamingSkillName('')
    } catch (error) {
      toast.error(error?.message || 'Could not rename skill')
    } finally {
      setSaving(false)
    }
  }, [renamingSkillName, toast, token])


  if (sessionsLoading) {
    return (
      <div className="px-4 sm:px-6 py-6">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="h-7 w-28 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-72 bg-gray-100 rounded animate-pulse" />
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
    <div className="px-4 sm:px-6 py-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="space-y-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Progress</p>
            <h2 className="text-2xl font-semibold text-gray-900 tracking-tight mt-1">Your proof archive</h2>
            <p className="text-sm text-gray-500 mt-2">Lifetime effort across skills — tap a skill for its full timeline.</p>
          </div>
        </div>

        {sessions.length > 0 ? (
          <>
            <section className="rounded-2xl border border-gray-200 bg-white px-4 py-4">
              <p className="text-xs uppercase tracking-wide text-gray-500">Overall</p>
              <p className="text-sm font-medium text-gray-900 mt-1">{overviewParts.join(' · ')}</p>
              {overview.latestProofAt ? (
                <p className="text-xs text-gray-500 mt-1">Latest proof {fmtDate(overview.latestProofAt)}</p>
              ) : null}
              {ungroupedCount > 0 ? (
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mt-3">
                  {ungroupedCount} {ungroupedCount === 1 ? 'proof is' : 'proofs are'} not tagged to a skill yet.
                </p>
              ) : null}
            </section>

            <ActivityCalendar sessions={sessions} />
          </>
        ) : null}

        {sessions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-10 text-center">
            <p className="text-sm text-gray-700">No proofs yet.</p>
            <p className="text-xs text-gray-500 mt-1">Use Record to add or upload a proof. It will show up here as soon as it is saved.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {taggedSummaries.length > 0 ? (
              <div className="space-y-3">
                <p className="text-xs uppercase tracking-wide text-gray-500">Skills</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {taggedSummaries.map((summary) => (
                    <SkillSummaryCard
                      key={summary.skillKey}
                      summary={summary}
                      onOpenSkill={onOpenSkill}
                      onRenameSkill={setRenamingSkillName}
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
                <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
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
      <SkillPickerModal
        open={Boolean(renamingSkillName)}
        title="Edit skill name"
        initialValue={renamingSkillName}
        options={skillOptions}
        saving={saving}
        onClose={closeSkillRename}
        onSave={saveSkillRename}
      />

    </div>
  )
}
