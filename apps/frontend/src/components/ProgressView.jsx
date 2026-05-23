import React, { useCallback, useMemo, useState } from 'react'
import SessionListItem from './SessionListItem'
import SkillPickerModal from './SkillPickerModal'
import { useToast } from './Toast'

const UNGROUPED_KEY = '__ungrouped__'

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
  onSessionUpdate,
}) {
  const toast = useToast()
  const [editingSession, setEditingSession] = useState(null)
  const [draftSkill, setDraftSkill] = useState('')
  const [saving, setSaving] = useState(false)

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

  const totalSkills = skillGroups.length
  const totalProofs = sessions.length
  const ungroupedCount = sessions.filter((item) => !String(item?.practice_series || '').trim()).length

  return (
    <div className="px-4 sm:px-6 py-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="space-y-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Progress</p>
            <h2 className="text-2xl font-semibold text-gray-900 tracking-tight mt-1">Skill timelines</h2>
            <p className="text-sm text-gray-500 mt-2">Each skill is a simple timeline of proofs. Add the next proof to the right skill, move it when needed, or leave it ungrouped if it stands alone.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="text-[11px] uppercase tracking-wide bg-gray-100 text-gray-700 px-2.5 py-1.5 rounded-full">{totalSkills} {totalSkills === 1 ? 'skill' : 'skills'}</span>
            <span className="text-[11px] uppercase tracking-wide bg-gray-100 text-gray-700 px-2.5 py-1.5 rounded-full">{totalProofs} {totalProofs === 1 ? 'proof' : 'proofs'}</span>
            <span className="text-[11px] uppercase tracking-wide bg-gray-100 text-gray-700 px-2.5 py-1.5 rounded-full">{ungroupedCount} ungrouped</span>
          </div>
        </div>

        {sessions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-10 text-center">
              <p className="text-sm text-gray-700">No proofs yet.</p>
            <p className="text-xs text-gray-500 mt-1">Use Record above to add or upload a proof. It will show up here as soon as it is saved.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {skillGroups.map((group) => {
              const skillName = group.skillName === UNGROUPED_KEY ? 'Ungrouped' : group.skillName
              const latest = group.latest
              return (
                <section key={group.skillName} className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
                  <div className="border-b border-gray-100 px-4 py-4 flex items-start justify-between gap-4 flex-wrap">
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-wide text-gray-500">Skill</p>
                      <h3 className="text-lg font-semibold text-gray-900 mt-1 truncate">{skillName}</h3>
                      <p className="text-sm text-gray-500 mt-1">
                        {group.items.length} {group.items.length === 1 ? 'proof' : 'proofs'}
                        {latest ? ` · latest ${formatCompactDateTime(latest.recorded_at || latest.created_at)}` : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {latest ? (
                        <button
                          type="button"
                          onClick={() => onOpenSession?.(latest, { view: 'progress', sessionId: null, seriesName: '' })}
                          className="rounded-full border border-gray-200 bg-white text-gray-900 px-4 py-2.5 text-sm font-medium hover:bg-gray-50 transition-colors"
                        >
                          Open latest
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
    </div>
  )
}
