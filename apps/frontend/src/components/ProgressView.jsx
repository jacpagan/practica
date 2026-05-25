import React, { useCallback, useMemo, useState } from 'react'
import SessionListItem from './SessionListItem'
import SkillPickerModal from './SkillPickerModal'
import VideoThumbnail from './VideoThumbnail'
import { calculatePracticeProgress, fmtDate } from '../utils'
import { useToast } from './Toast'

const UNGROUPED_KEY = '__ungrouped__'


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

  const skillGroups = useMemo(() => {
    const grouped = new Map()
    sessions.forEach((session) => {
      const key = String(session?.practice_series || '').trim() || UNGROUPED_KEY
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key).push(session)
    })

    return Array.from(grouped.entries())
      .map(([skillName, items]) => {
        const sortedItems = items
          .slice()
          .sort((left, right) => new Date(right.recorded_at || right.created_at) - new Date(left.recorded_at || left.created_at))
        return {
          skillName,
          items: sortedItems,
          latest: sortedItems[0] || null,
        }
      })
      .sort((left, right) => {
        const leftTime = new Date(left.latest?.recorded_at || left.latest?.created_at || 0).getTime() || 0
        const rightTime = new Date(right.latest?.recorded_at || right.latest?.created_at || 0).getTime() || 0
        return rightTime - leftTime
      })
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
          <div className="space-y-3">
            <div className="h-28 w-full bg-gray-100 rounded-2xl animate-pulse" />
            <div className="h-28 w-full bg-gray-100 rounded-2xl animate-pulse" />
            <div className="h-28 w-full bg-gray-100 rounded-2xl animate-pulse" />
          </div>
        </div>
      </div>
    )
  }

  const ungroupedCount = sessions.filter((item) => !String(item?.practice_series || '').trim()).length
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
            <p className="text-sm text-gray-500 mt-2">Everything you have shown up for, grouped by skill.</p>
          </div>
        </div>

        {sessions.length > 0 ? (
          <section className="rounded-2xl border border-gray-200 bg-white px-4 py-4 space-y-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Overall</p>
              <p className="text-sm font-medium text-gray-900 mt-1">{overviewParts.join(' · ')}</p>
              {overview.latestProofAt ? (
                <p className="text-xs text-gray-500 mt-1">
                  Latest proof {fmtDate(overview.latestProofAt)}
                </p>
              ) : null}
            </div>
            {overview.recentProofs.length > 0 ? (
              <div>
                <p className="text-xs text-gray-500 mb-2">Recent across all skills</p>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {overview.recentProofs.slice(0, 6).map((session) => (
                    <button
                      key={session.id}
                      type="button"
                      onClick={() => onOpenSession?.(session, { view: 'progress', sessionId: null, seriesName: '' })}
                      className="shrink-0 w-28 text-left"
                    >
                      <VideoThumbnail session={session} className="w-28 aspect-video rounded-xl overflow-hidden bg-black" />
                      <p className="text-[11px] text-gray-700 mt-1 truncate">{session.practice_series || session.title}</p>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {ungroupedCount > 0 ? (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                {ungroupedCount} {ungroupedCount === 1 ? 'proof is' : 'proofs are'} not tagged to a skill yet.
              </p>
            ) : null}
          </section>
        ) : null}

        {sessions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-10 text-center">
              <p className="text-sm text-gray-700">No proofs yet.</p>
            <p className="text-xs text-gray-500 mt-1">Use Record to add or upload a proof. It will show up here as soon as it is saved.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {skillGroups.map((group) => {
              const skillName = group.skillName === UNGROUPED_KEY ? 'Ungrouped' : group.skillName
              const canOpenSkill = group.skillName !== UNGROUPED_KEY && onOpenSkill
              const lastLabel = group.latest
                ? fmtDate(group.latest.recorded_at || group.latest.created_at)
                : ''
              return (
                <section key={group.skillName} className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
                  <div className="border-b border-gray-100 px-4 py-4">
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-wide text-gray-500">Skill</p>
                      <div className="mt-1 flex items-baseline gap-2 min-w-0 flex-wrap">
                        {canOpenSkill ? (
                          <button
                            type="button"
                            onClick={() => onOpenSkill(group.skillName)}
                            className="text-lg font-semibold text-gray-900 truncate text-left hover:text-gray-700 transition-colors"
                          >
                            {skillName}
                          </button>
                        ) : (
                          <h3 className="text-lg font-semibold text-gray-900 truncate">{skillName}</h3>
                        )}
                        {group.skillName !== UNGROUPED_KEY ? (
                          <button
                            type="button"
                            onClick={() => setRenamingSkillName(group.skillName)}
                            className="text-sm text-gray-500 hover:text-gray-900 shrink-0 transition-colors"
                          >
                            Edit name
                          </button>
                        ) : null}
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        {group.items.length} {group.items.length === 1 ? 'proof' : 'proofs'}
                        {lastLabel ? ` · last ${lastLabel}` : ''}
                      </p>
                      {canOpenSkill ? (
                        <button
                          type="button"
                          onClick={() => onOpenSkill(group.skillName)}
                          className="text-xs text-gray-500 hover:text-gray-900 mt-2 transition-colors"
                        >
                          Open skill timeline
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className="p-4 space-y-3">
                    {group.items.map((session) => (
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
                </section>
              )
            })}
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
