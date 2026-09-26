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
  const [notice, setNotice] = useState('')
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
    setNotice('')
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
      setNotice(`Saved · ${item.name}`)
    } catch (saveError) {
      setError(saveError?.message || 'Could not save proof')
    } finally {
      setSavingItemId(null)
    }
  }

  if (loading) {
    return <div className="min-h-48 border-y border-gray-200 py-6 text-sm text-gray-400">Loading today’s routine</div>
  }

  if (!routine) {
    return (
      <section className="border-y border-gray-200 py-8">
        <h2 className="text-lg font-semibold text-gray-950">Choose what matters today</h2>
        <p className="mt-1 text-sm text-gray-500">Pick one of your routines or create your own.</p>
        <button type="button" onClick={onOpenJournal} className="mt-4 bg-gray-950 px-4 py-2 text-sm font-medium text-white">
          Open routines
        </button>
      </section>
    )
  }

  const completedCount = (routine.items || []).filter((item) => countsByItem[item.id] || videoCountsByItem[item.id]).length
  const incompleteItems = (routine.items || []).filter((item) => !(countsByItem[item.id] || videoCountsByItem[item.id]))
  const completedItems = (routine.items || []).filter((item) => countsByItem[item.id] || videoCountsByItem[item.id])

  const renderRoutineItem = (item, completed = false) => {
    const proofCount = (countsByItem[item.id] || 0) + (videoCountsByItem[item.id] || 0)
    return (
      <div key={item.id} className={`flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between ${completed ? 'opacity-60' : ''}`}>
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full border ${completed ? 'border-emerald-700 bg-emerald-700' : 'border-gray-300'}`} aria-hidden="true" />
            <p className="font-medium text-gray-950">{item.name}</p>
          </div>
          {item.default_target_quantity || item.default_unit || proofCount ? (
            <p className="mt-1 pl-5 text-xs text-gray-400">
              {[item.default_target_quantity, item.default_unit, proofCount ? `${proofCount} today` : ''].filter(Boolean).join(' · ')}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 gap-4 pl-5 sm:pl-0">
          <button type="button" onClick={() => logItem(item)} disabled={Boolean(savingItemId)} className="text-sm font-medium text-gray-950 underline decoration-gray-300 underline-offset-4 disabled:opacity-40">
            {savingItemId === item.id ? 'Saving' : 'Log'}
          </button>
          <button type="button" onClick={() => onRecord?.(routine, item)} className="text-sm text-gray-500 hover:text-gray-950">Record</button>
        </div>
      </div>
    )
  }

  return (
    <section className="border-y border-gray-200">
      <div className="flex flex-col gap-4 py-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-gray-400">Today’s routine</p>
          <h2 className="mt-2 text-2xl font-semibold text-gray-950">{routine.name}</h2>
          {routine.learned_from ? <p className="mt-1 text-sm text-gray-500">Learned from {routine.learned_from}</p> : null}
          {routine.purpose ? <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600">{routine.purpose}</p> : null}
        </div>
        <button type="button" onClick={onOpenJournal} className="self-start text-xs text-gray-400 underline decoration-gray-200 underline-offset-4 hover:text-gray-950">
          Change routine
        </button>
      </div>

      {error ? <div className="border-t border-red-200 py-3 text-sm text-red-700">{error}</div> : null}
      {notice ? <div className="border-t border-emerald-100 py-3 text-sm text-emerald-800">{notice}</div> : null}

      <div className="divide-y divide-gray-100">{incompleteItems.map((item) => renderRoutineItem(item))}</div>
      {completedItems.length ? (
        <details className="border-t border-gray-200 py-4">
          <summary className="cursor-pointer list-none text-sm text-gray-500">Completed today · {completedCount}</summary>
          <div className="mt-2 divide-y divide-gray-100">{completedItems.map((item) => renderRoutineItem(item, true))}</div>
        </details>
      ) : null}

      <div className="flex items-center justify-between border-t border-gray-100 py-3 text-xs text-gray-400">
        <span>{completedCount} of {(routine.items || []).length} complete</span>
        <span>Private</span>
      </div>
    </section>
  )
}
