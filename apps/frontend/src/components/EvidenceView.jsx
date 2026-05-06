import React, { useCallback, useMemo, useState } from 'react'
import SessionListItem from './SessionListItem'
import ThreadPickerModal from './ThreadPickerModal'
import { useToast } from './Toast'

const UNGROUPED_KEY = '__ungrouped__'

const formatCompactDateTime = (value) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const dayPart = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  const timePart = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  return `${dayPart} · ${timePart}`
}

export default function EvidenceView({
  sessions = [],
  sessionsLoading = false,
  token = '',
  onOpenSession,
  onCreateVideo,
  onSessionUpdate,
}) {
  const toast = useToast()
  const [editingSession, setEditingSession] = useState(null)
  const [draftThread, setDraftThread] = useState('')
  const [saving, setSaving] = useState(false)

  const routineOptions = useMemo(() => Array.from(new Set(
    sessions
      .filter((item) => item?.can_edit)
      .map((item) => String(item?.practice_series || '').trim())
      .filter(Boolean),
  )).sort((left, right) => left.localeCompare(right)), [sessions])

  const routineGroups = useMemo(() => {
    const grouped = new Map()
    sessions.forEach((session) => {
      const key = String(session?.practice_series || '').trim() || UNGROUPED_KEY
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key).push(session)
    })

    return Array.from(grouped.entries())
      .map(([seriesName, items]) => {
        const sortedItems = items
          .slice()
          .sort((left, right) => new Date(right.recorded_at || right.created_at) - new Date(left.recorded_at || left.created_at))
        return {
          seriesName,
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

  const openRoutineEditor = useCallback((session) => {
    if (!session?.id) return
    setEditingSession(session)
    setDraftThread(session.practice_series || '')
  }, [])

  const closeThreadEditor = useCallback(() => {
    if (saving) return
    setEditingSession(null)
    setDraftThread('')
  }, [saving])

  const saveRoutine = useCallback(async (nextThread) => {
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
          practice_series: String(nextThread || '').trim(),
        }),
      })
      if (!res.ok) throw new Error('routine')
      const data = await res.json()
      const next = { ...data, local_preview_url: editingSession.local_preview_url || '' }
      onSessionUpdate?.(next)
      toast.success(nextThread ? 'Routine updated' : 'Removed from routine')
      setEditingSession(null)
      setDraftThread('')
    } catch {
      toast.error('Could not update the routine')
    } finally {
      setSaving(false)
    }
  }, [editingSession?.id, editingSession?.local_preview_url, onSessionUpdate, toast, token])

  const clearRoutine = useCallback(() => saveRoutine(''), [saveRoutine])

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

  const totalRoutines = routineGroups.length
  const totalVideos = sessions.length
  const ungroupedCount = sessions.filter((item) => !String(item?.practice_series || '').trim()).length

  return (
    <div className="px-4 sm:px-6 py-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="space-y-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Private archive</p>
            <h2 className="text-2xl font-semibold text-gray-900 tracking-tight mt-1">Evidence archive</h2>
            <p className="text-sm text-gray-500 mt-2">Keep each take grouped by routine or topic. Move a take when it belongs somewhere else, or leave it ungrouped if it stands alone.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="text-[11px] uppercase tracking-wide bg-gray-100 text-gray-700 px-2.5 py-1.5 rounded-full">{totalRoutines} {totalRoutines === 1 ? 'routine' : 'routines'}</span>
            <span className="text-[11px] uppercase tracking-wide bg-gray-100 text-gray-700 px-2.5 py-1.5 rounded-full">{totalVideos} {totalVideos === 1 ? 'video' : 'videos'}</span>
            <span className="text-[11px] uppercase tracking-wide bg-gray-100 text-gray-700 px-2.5 py-1.5 rounded-full">{ungroupedCount} ungrouped</span>
          </div>
        </div>

        {sessions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-10 text-center">
            <p className="text-sm text-gray-700">No takes yet.</p>
            <p className="text-xs text-gray-500 mt-1">Record or upload a first take, then group it into a routine.</p>
            <div className="mt-4">
              <button type="button" onClick={() => onCreateVideo?.('')} className="rounded-full bg-gray-900 text-white px-4 py-2.5 text-sm font-medium hover:bg-gray-800 transition-colors">
                Add first take
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {routineGroups.map((group) => {
              const routineName = group.seriesName === UNGROUPED_KEY ? 'Ungrouped' : group.seriesName
              const latest = group.latest
              return (
                <section key={group.seriesName} className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
                  <div className="border-b border-gray-100 px-4 py-4 flex items-start justify-between gap-4 flex-wrap">
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-wide text-gray-500">Routine</p>
                      <h3 className="text-lg font-semibold text-gray-900 mt-1 truncate">{routineName}</h3>
                      <p className="text-sm text-gray-500 mt-1">
                        {group.items.length} {group.items.length === 1 ? 'take' : 'takes'}
                        {latest ? ` · latest ${formatCompactDateTime(latest.recorded_at || latest.created_at)}` : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => onCreateVideo?.(group.seriesName === UNGROUPED_KEY ? '' : group.seriesName)}
                        className="rounded-full bg-gray-900 text-white px-4 py-2.5 text-sm font-medium hover:bg-gray-800 transition-colors"
                      >
                        {group.seriesName === UNGROUPED_KEY ? 'Add take' : 'Add to routine'}
                      </button>
                      {latest ? (
                      <button
                        type="button"
                        onClick={() => onOpenSession?.(latest, { view: 'evidence', sessionId: null, seriesName: group.seriesName === UNGROUPED_KEY ? '' : group.seriesName })}
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
                        onOpen={() => onOpenSession?.(session, { view: 'evidence', sessionId: null, seriesName: group.seriesName === UNGROUPED_KEY ? '' : group.seriesName })}
                        onChangeThread={() => openRoutineEditor(session)}
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

      <ThreadPickerModal
        open={Boolean(editingSession)}
        title={editingSession?.practice_series ? 'Move take' : 'Add to routine'}
        initialValue={draftThread}
        options={routineOptions}
        saving={saving}
        onClose={closeThreadEditor}
        onSave={saveRoutine}
        onClear={editingSession?.practice_series ? clearRoutine : null}
        clearLabel="Remove from routine"
      />
    </div>
  )
}
