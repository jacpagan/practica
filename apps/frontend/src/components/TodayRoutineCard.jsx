import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { reportClientEvent, toLocalDateKey } from '../utils'

const normalizeListPayload = (data) => {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.results)) return data.results
  return []
}

const entryTypeForCategory = (category = '') => {
  const normalized = String(category).trim().toLowerCase()
  if (normalized === 'food') return 'meal'
  if (normalized === 'learning') return 'lesson_note'
  if (normalized === 'dental') return 'habit'
  if (normalized === 'therapy') return 'therapy'
  return 'fitness'
}

export default function TodayRoutineCard({ token, sessions = [], onOpenJournal, onRecord }) {
  const [routine, setRoutine] = useState(null)
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [savingItemId, setSavingItemId] = useState(null)
  const [error, setError] = useState('')
  const today = useMemo(() => toLocalDateKey(new Date()), [])
  const authHeaders = useMemo(() => ({ Authorization: `Token ${token}` }), [token])

  const loadToday = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError('')
    try {
      const [routineResponse, entryResponse] = await Promise.all([
        fetch('/api/routines/?today=1', { headers: authHeaders }),
        fetch(`/api/journal-entries/?start_date=${today}&end_date=${today}`, { headers: authHeaders }),
      ])
      const routineData = await routineResponse.json().catch(() => ({}))
      const entryData = await entryResponse.json().catch(() => ({}))
      if (!routineResponse.ok) throw new Error(routineData?.detail || 'Could not load today’s routine')
      if (!entryResponse.ok) throw new Error(entryData?.detail || 'Could not load today’s proof')
      const selectedRoutine = normalizeListPayload(routineData)[0] || null
      setRoutine(selectedRoutine)
      setEntries(normalizeListPayload(entryData))
      if (selectedRoutine) {
        reportClientEvent('today_routine_viewed', {
          action: 'today_routine_viewed',
          routine_id: selectedRoutine.id,
          category: selectedRoutine.category,
        })
      }
    } catch (loadError) {
      setError(loadError?.message || 'Could not load today’s routine')
    } finally {
      setLoading(false)
    }
  }, [authHeaders, today, token])

  useEffect(() => {
    loadToday()
  }, [loadToday])

  const countsByItem = useMemo(() => entries.reduce((counts, entry) => {
    if (!entry?.routine_item) return counts
    counts[entry.routine_item] = (counts[entry.routine_item] || 0) + 1
    return counts
  }, {}), [entries])

  const videoCountsByItem = useMemo(() => {
    if (!routine) return {}
    return sessions.reduce((counts, session) => {
      if (toLocalDateKey(session?.recorded_at || session?.created_at) !== today) return counts
      if (String(session?.practice_series || '').trim() !== routine.name) return counts
      const matchingItem = (routine.items || []).find((item) => item.name === String(session?.description || '').trim())
      if (matchingItem) counts[matchingItem.id] = (counts[matchingItem.id] || 0) + 1
      return counts
    }, {})
  }, [routine, sessions, today])

  const logItem = async (item) => {
    if (!routine || savingItemId) return
    setSavingItemId(item.id)
    setError('')
    try {
      const payload = {
        routine: routine.id,
        routine_item: item.id,
        entry_type: entryTypeForCategory(routine.category),
        title: item.name,
        category: routine.category || '',
        metric_name: item.name,
        unit: item.default_unit || '',
      }
      if (item.default_target_quantity !== null && item.default_target_quantity !== '') {
        payload.quantity = item.default_target_quantity
      } else if (item.default_unit === 'times') {
        payload.quantity = 1
      }
      const response = await fetch('/api/journal-entries/', {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data?.detail || 'Could not save proof')
      setEntries((current) => [data, ...current])
    } catch (saveError) {
      setError(saveError?.message || 'Could not save proof')
    } finally {
      setSavingItemId(null)
    }
  }

  if (loading) {
    return <div className="min-h-48 rounded-lg border border-gray-200 bg-white p-5 text-sm text-gray-500">Loading today’s routine</div>
  }

  if (!routine) {
    return (
      <section className="rounded-lg border border-dashed border-gray-300 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-950">Choose what matters today</h2>
        <p className="mt-1 text-sm text-gray-500">Pick one of your routines or create your own.</p>
        <button type="button" onClick={onOpenJournal} className="mt-4 rounded-full bg-gray-950 px-4 py-2 text-sm font-medium text-white">
          Open routines
        </button>
      </section>
    )
  }

  const completedCount = (routine.items || []).filter((item) => countsByItem[item.id] || videoCountsByItem[item.id]).length

  return (
    <section className="overflow-hidden rounded-lg border border-gray-200 bg-gray-950 text-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-white/10 px-5 py-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-emerald-300">Today’s routine</p>
          <h2 className="mt-1 text-2xl font-semibold">{routine.name}</h2>
          {routine.learned_from ? <p className="mt-1 text-sm text-white/60">Learned from {routine.learned_from}</p> : null}
          {routine.purpose ? <p className="mt-3 max-w-2xl text-sm text-white/70">{routine.purpose}</p> : null}
        </div>
        <button type="button" onClick={onOpenJournal} className="self-start rounded-full border border-white/20 px-3 py-1.5 text-xs font-medium text-white/80 hover:bg-white/10">
          Change
        </button>
      </div>

      {error ? <div className="border-b border-red-300/20 bg-red-400/10 px-5 py-3 text-sm text-red-100">{error}</div> : null}

      <div className="divide-y divide-white/10">
        {(routine.items || []).map((item) => {
          const proofCount = (countsByItem[item.id] || 0) + (videoCountsByItem[item.id] || 0)
          return (
            <div key={item.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-white">{item.name}</p>
                  {proofCount ? <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-xs font-medium text-emerald-200">Logged {proofCount}x</span> : null}
                </div>
                {item.default_target_quantity || item.default_unit ? (
                  <p className="mt-1 text-xs text-white/50">{item.default_target_quantity || ''} {item.default_unit || ''}</p>
                ) : null}
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => logItem(item)}
                  disabled={Boolean(savingItemId)}
                  className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-gray-950 disabled:opacity-50"
                >
                  {savingItemId === item.id ? 'Saving' : 'Log'}
                </button>
                <button
                  type="button"
                  onClick={() => onRecord?.(routine, item)}
                  className="rounded-full border border-white/25 px-4 py-2 text-xs font-semibold text-white hover:bg-white/10"
                >
                  Record
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex items-center justify-between bg-white/5 px-5 py-3 text-xs text-white/55">
        <span>{completedCount} of {(routine.items || []).length} actions logged today</span>
        <span>Private by default</span>
      </div>
    </section>
  )
}
