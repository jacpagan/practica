import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { authHeaders } from '../auth'
import { useToast } from './Toast'

const WEEK_DAYS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 7, label: 'Sun' },
]

const emptyPlanForm = {
  name: '',
  description: '',
  timezone: 'America/Los_Angeles',
  start_date: '',
  end_date: '',
  is_active: true,
}

const emptyItemForm = {
  exercise: '',
  sort_order: 0,
  target_minutes: '',
  target_reps: '',
  notes: '',
  reference_clip: '',
  schedule_type: 'daily',
  schedule_days: [1, 3, 5],
}

const planToForm = (plan) => ({
  name: plan?.name || '',
  description: plan?.description || '',
  timezone: plan?.timezone || 'America/Los_Angeles',
  start_date: plan?.start_date || '',
  end_date: plan?.end_date || '',
  is_active: plan?.is_active ?? true,
})

const itemToForm = (item) => ({
  exercise: item?.exercise || '',
  sort_order: item?.sort_order ?? 0,
  target_minutes: item?.target_minutes ?? '',
  target_reps: item?.target_reps ?? '',
  notes: item?.notes || '',
  reference_clip: item?.reference_clip || '',
  schedule_type: item?.schedule_json?.type || 'daily',
  schedule_days: Array.isArray(item?.schedule_json?.days) ? item.schedule_json.days : [1, 3, 5],
})

function PlanEditor({ token, space, exercises = [], onPlanChange }) {
  const toast = useToast()
  const headers = useMemo(() => ({ ...authHeaders(token), 'Content-Type': 'application/json' }), [token])
  const [loading, setLoading] = useState(false)
  const [savingPlan, setSavingPlan] = useState(false)
  const [savingItem, setSavingItem] = useState(false)
  const [plan, setPlan] = useState(null)
  const [planForm, setPlanForm] = useState(emptyPlanForm)
  const [itemForm, setItemForm] = useState(emptyItemForm)
  const [editingItemId, setEditingItemId] = useState(null)
  const [referenceClips, setReferenceClips] = useState([])

  const resetItemForm = useCallback(() => {
    setEditingItemId(null)
    setItemForm(emptyItemForm)
  }, [])

  const loadPlan = useCallback(async () => {
    if (!space?.id) return
    setLoading(true)
    try {
      const res = await fetch(`/api/spaces/${space.id}/plan/active/`, { headers: authHeaders(token) })
      if (!res.ok) throw new Error('plan')
      const data = await res.json()
      setPlan(data)
      setPlanForm(planToForm(data))
      if (!data) resetItemForm()
      onPlanChange?.(data)
    } catch {
      toast.error('Could not load practice plan')
    } finally {
      setLoading(false)
    }
  }, [space?.id, token, toast, resetItemForm, onPlanChange])

  useEffect(() => {
    setPlan(null)
    setPlanForm(emptyPlanForm)
    resetItemForm()
    setReferenceClips([])
    if (space?.id) loadPlan()
  }, [space?.id, loadPlan, resetItemForm])

  useEffect(() => {
    const exerciseId = itemForm.exercise
    if (!exerciseId) {
      setReferenceClips([])
      return
    }

    let cancelled = false
    const fetchClips = async () => {
      try {
        const res = await fetch(`/api/exercises/${exerciseId}/reference-clips/`, { headers: authHeaders(token) })
        if (!res.ok) throw new Error('clips')
        const data = await res.json()
        if (!cancelled) setReferenceClips(Array.isArray(data) ? data : [])
      } catch {
        if (!cancelled) setReferenceClips([])
      }
    }

    fetchClips()
    return () => { cancelled = true }
  }, [itemForm.exercise, token])

  const buildScheduleJson = () => {
    if (itemForm.schedule_type === 'days_of_week') {
      return {
        type: 'days_of_week',
        days: [...itemForm.schedule_days].sort((a, b) => a - b),
      }
    }
    return { type: 'daily' }
  }

  const planPayload = () => ({
    name: planForm.name.trim(),
    description: planForm.description.trim(),
    timezone: planForm.timezone.trim() || 'America/Los_Angeles',
    start_date: planForm.start_date || null,
    end_date: planForm.end_date || null,
    is_active: Boolean(planForm.is_active),
  })

  const itemPayload = () => ({
    exercise: Number(itemForm.exercise),
    sort_order: Number(itemForm.sort_order || 0),
    target_minutes: itemForm.target_minutes === '' ? null : Number(itemForm.target_minutes),
    target_reps: itemForm.target_reps === '' ? null : Number(itemForm.target_reps),
    notes: itemForm.notes.trim(),
    reference_clip: itemForm.reference_clip || null,
    schedule_json: buildScheduleJson(),
  })

  const savePlan = async () => {
    if (!space?.id) return null
    if (!planForm.name.trim()) {
      toast.error('Plan name is required')
      return null
    }
    setSavingPlan(true)
    try {
      const url = plan?.id ? `/api/spaces/${space.id}/plan/${plan.id}/` : `/api/spaces/${space.id}/plan/`
      const method = plan?.id ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(planPayload()),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.detail || 'save-plan')
      setPlan(data)
      setPlanForm(planToForm(data))
      onPlanChange?.(data)
      toast.success(plan?.id ? 'Plan updated' : 'Plan created')
      return data
    } catch {
      toast.error('Could not save plan')
      return null
    } finally {
      setSavingPlan(false)
    }
  }

  const saveItem = async () => {
    if (!space?.id) return
    if (!itemForm.exercise) {
      toast.error('Choose an exercise first')
      return
    }
    if (itemForm.schedule_type === 'days_of_week' && itemForm.schedule_days.length === 0) {
      toast.error('Choose at least one day')
      return
    }

    let activePlan = plan
    if (!activePlan?.id) {
      activePlan = await savePlan()
      if (!activePlan?.id) return
    }

    setSavingItem(true)
    try {
      const url = editingItemId
        ? `/api/spaces/${space.id}/plan/items/${editingItemId}/`
        : `/api/spaces/${space.id}/plan/${activePlan.id}/items/`
      const method = editingItemId ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(itemPayload()),
      })
      if (!res.ok) throw new Error('save-item')
      await loadPlan()
      resetItemForm()
      toast.success(editingItemId ? 'Plan item updated' : 'Plan item added')
    } catch {
      toast.error('Could not save plan item')
    } finally {
      setSavingItem(false)
    }
  }

  const removeItem = async (itemId) => {
    try {
      const res = await fetch(`/api/spaces/${space.id}/plan/items/${itemId}/`, {
        method: 'DELETE',
        headers: authHeaders(token),
      })
      if (!res.ok) throw new Error('delete-item')
      await loadPlan()
      if (editingItemId === itemId) resetItemForm()
      toast.success('Plan item removed')
    } catch {
      toast.error('Could not remove plan item')
    }
  }

  if (!space) {
    return <div className="rounded-xl border border-gray-200 p-4 text-sm text-gray-500">Choose a space to edit a plan.</div>
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Practice plan</h3>
            <p className="text-xs text-gray-500 mt-1">Define the daily checklist and guidance for {space.name}.</p>
          </div>
          {loading && <span className="text-xs text-gray-400">Loading…</span>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs text-gray-500">Plan name</span>
            <input
              type="text"
              value={planForm.name}
              onChange={(e) => setPlanForm((current) => ({ ...current, name: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
              placeholder="Daily qigong plan"
            />
          </label>
          <label className="block">
            <span className="text-xs text-gray-500">Timezone</span>
            <input
              type="text"
              value={planForm.timezone}
              onChange={(e) => setPlanForm((current) => ({ ...current, timezone: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
              placeholder="America/Los_Angeles"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs text-gray-500">Description</span>
            <textarea
              value={planForm.description}
              onChange={(e) => setPlanForm((current) => ({ ...current, description: e.target.value }))}
              rows={2}
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-gray-400 resize-none"
              placeholder="Supportive framing, goals, and practice context"
            />
          </label>
          <label className="block">
            <span className="text-xs text-gray-500">Start date</span>
            <input
              type="date"
              value={planForm.start_date}
              onChange={(e) => setPlanForm((current) => ({ ...current, start_date: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
            />
          </label>
          <label className="block">
            <span className="text-xs text-gray-500">End date</span>
            <input
              type="date"
              value={planForm.end_date}
              onChange={(e) => setPlanForm((current) => ({ ...current, end_date: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
            />
          </label>
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={planForm.is_active}
            onChange={(e) => setPlanForm((current) => ({ ...current, is_active: e.target.checked }))}
            className="rounded border-gray-300"
          />
          Active plan for this space
        </label>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={savePlan}
            disabled={savingPlan}
            className="text-sm font-medium text-white bg-gray-900 rounded-xl px-4 py-2.5 hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            {savingPlan ? 'Saving…' : plan?.id ? 'Save plan' : 'Create plan'}
          </button>
          {plan?.updated_at && <span className="text-xs text-gray-400">Updated recently</span>}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-4">
        <div>
          <h4 className="text-sm font-semibold text-gray-900">Plan items</h4>
          <p className="text-xs text-gray-500 mt-1">Build the checklist members will see each day.</p>
        </div>

        {(plan?.items || []).length > 0 ? (
          <div className="space-y-2">
            {plan.items.map((item) => (
              <div key={item.id} className="rounded-xl border border-gray-100 px-3 py-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">{item.exercise_name}</p>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {item.target_minutes ? <span className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{item.target_minutes} min</span> : null}
                    {item.target_reps ? <span className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{item.target_reps} reps</span> : null}
                    <span className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">#{item.sort_order}</span>
                  </div>
                  {item.notes ? <p className="text-xs text-gray-500 mt-2">{item.notes}</p> : null}
                  {item.reference_clip_detail?.watch_url_with_start ? (
                    <a
                      href={item.reference_clip_detail.watch_url_with_start}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex mt-2 text-xs text-blue-600 hover:text-blue-700"
                    >
                      {item.reference_clip_detail.title || 'Reference clip'}
                    </a>
                  ) : null}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingItemId(item.id)
                      setItemForm(itemToForm(item))
                    }}
                    className="text-xs text-gray-500 hover:text-gray-900"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="text-xs text-gray-400 hover:text-red-500"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-500">
            No plan items yet. Add the first exercise below.
          </div>
        )}

        <div className="border-t border-gray-100 pt-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h5 className="text-sm font-medium text-gray-900">{editingItemId ? 'Edit plan item' : 'Add plan item'}</h5>
            {editingItemId ? (
              <button type="button" onClick={resetItemForm} className="text-xs text-gray-400 hover:text-gray-600">Cancel edit</button>
            ) : null}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block sm:col-span-2">
              <span className="text-xs text-gray-500">Exercise</span>
              <select
                value={itemForm.exercise}
                onChange={(e) => setItemForm((current) => ({ ...current, exercise: e.target.value, reference_clip: '' }))}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:border-gray-400"
              >
                <option value="">Select an exercise</option>
                {exercises.map((exercise) => (
                  <option key={exercise.id} value={exercise.id}>{exercise.name}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs text-gray-500">Target minutes</span>
              <input
                type="number"
                min="0"
                value={itemForm.target_minutes}
                onChange={(e) => setItemForm((current) => ({ ...current, target_minutes: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
              />
            </label>

            <label className="block">
              <span className="text-xs text-gray-500">Target reps</span>
              <input
                type="number"
                min="0"
                value={itemForm.target_reps}
                onChange={(e) => setItemForm((current) => ({ ...current, target_reps: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
              />
            </label>

            <label className="block">
              <span className="text-xs text-gray-500">Sort order</span>
              <input
                type="number"
                value={itemForm.sort_order}
                onChange={(e) => setItemForm((current) => ({ ...current, sort_order: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
              />
            </label>

            <label className="block">
              <span className="text-xs text-gray-500">Reference clip</span>
              <select
                value={itemForm.reference_clip}
                onChange={(e) => setItemForm((current) => ({ ...current, reference_clip: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:border-gray-400"
              >
                <option value="">No reference clip</option>
                {referenceClips.map((clip) => (
                  <option key={clip.id} value={clip.id}>{clip.title}</option>
                ))}
              </select>
            </label>

            <label className="block sm:col-span-2">
              <span className="text-xs text-gray-500">Coach notes</span>
              <textarea
                value={itemForm.notes}
                onChange={(e) => setItemForm((current) => ({ ...current, notes: e.target.value }))}
                rows={2}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm resize-none focus:outline-none focus:border-gray-400"
                placeholder="Soft knees, slow breath, stay relaxed"
              />
            </label>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setItemForm((current) => ({ ...current, schedule_type: 'daily' }))}
                className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${itemForm.schedule_type === 'daily' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}
              >
                Daily
              </button>
              <button
                type="button"
                onClick={() => setItemForm((current) => ({ ...current, schedule_type: 'days_of_week' }))}
                className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${itemForm.schedule_type === 'days_of_week' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}
              >
                Days of week
              </button>
            </div>

            {itemForm.schedule_type === 'days_of_week' ? (
              <div className="flex flex-wrap gap-2">
                {WEEK_DAYS.map((day) => {
                  const active = itemForm.schedule_days.includes(day.value)
                  return (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => setItemForm((current) => ({
                        ...current,
                        schedule_days: active
                          ? current.schedule_days.filter((value) => value !== day.value)
                          : [...current.schedule_days, day.value],
                      }))}
                      className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${active ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}
                    >
                      {day.label}
                    </button>
                  )
                })}
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={saveItem}
            disabled={savingItem}
            className="text-sm font-medium text-white bg-gray-900 rounded-xl px-4 py-2.5 hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            {savingItem ? 'Saving…' : editingItemId ? 'Update item' : 'Add item'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default PlanEditor
