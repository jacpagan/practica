import React, { useCallback, useEffect, useMemo, useState } from 'react'

const ENTRY_TYPES = [
  { value: 'fitness', label: 'Fitness' },
  { value: 'meal', label: 'Meal' },
  { value: 'recipe', label: 'Recipe' },
  { value: 'therapy', label: 'Therapy' },
  { value: 'class_note', label: 'Class' },
  { value: 'lesson_note', label: 'Lesson' },
  { value: 'habit', label: 'Habit' },
]

const TYPE_DEFAULTS = {
  fitness: { title: 'Fitness proof', category: 'Fitness', metric_name: '', unit: 'reps' },
  meal: { title: 'Meal photo', category: 'Food', metric_name: '', unit: '' },
  recipe: { title: 'Recipe', category: 'Food', metric_name: '', unit: '' },
  therapy: { title: 'Therapy notes', category: 'Therapy', metric_name: '', unit: '' },
  class_note: { title: 'Class notes', category: 'Learning', metric_name: '', unit: '' },
  lesson_note: { title: 'Lesson notes', category: 'Learning', metric_name: '', unit: '' },
  habit: { title: 'Habit proof', category: 'Habit', metric_name: '', unit: 'times' },
}

const emptyEntry = {
  entry_type: 'fitness',
  title: TYPE_DEFAULTS.fitness.title,
  category: TYPE_DEFAULTS.fitness.category,
  routine: '',
  routine_item: '',
  metric_name: '',
  quantity: '',
  unit: TYPE_DEFAULTS.fitness.unit,
  notes: '',
}

const emptyRoutine = {
  name: '',
  category: '',
  purpose: '',
  learnedFrom: '',
  itemsText: '',
  makeToday: true,
}

function normalizeListPayload(data) {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.results)) return data.results
  return []
}

function formatDateTime(value) {
  if (!value) return ''
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value))
  } catch {
    return value
  }
}

function parseRoutineItems(itemsText) {
  return String(itemsText || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [name, unit = '', target = ''] = line.split('|').map((part) => part.trim())
      return {
        name,
        default_unit: unit,
        default_target_quantity: target || null,
        sort_order: index,
      }
    })
    .filter((item) => item.name)
}

export default function JournalView({ token }) {
  const [routines, setRoutines] = useState([])
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [savingEntry, setSavingEntry] = useState(false)
  const [savingRoutine, setSavingRoutine] = useState(false)
  const [entryForm, setEntryForm] = useState(emptyEntry)
  const [routineForm, setRoutineForm] = useState(emptyRoutine)
  const [attachment, setAttachment] = useState(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const authHeaders = useMemo(() => ({
    Authorization: `Token ${token}`,
  }), [token])

  const selectedRoutine = useMemo(() => (
    routines.find((routine) => String(routine.id) === String(entryForm.routine)) || null
  ), [entryForm.routine, routines])

  const selectedRoutineItems = selectedRoutine?.items || []

  const loadJournal = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError('')
    try {
      const [routineResponse, entryResponse] = await Promise.all([
        fetch('/api/routines/', { headers: authHeaders }),
        fetch('/api/journal-entries/', { headers: authHeaders }),
      ])
      const routineData = await routineResponse.json().catch(() => ({}))
      const entryData = await entryResponse.json().catch(() => ({}))
      if (!routineResponse.ok) throw new Error(routineData?.detail || 'Could not load routines')
      if (!entryResponse.ok) throw new Error(entryData?.detail || 'Could not load journal')
      setRoutines(normalizeListPayload(routineData))
      setEntries(normalizeListPayload(entryData))
    } catch (loadError) {
      setError(loadError?.message || 'Could not load journal')
    } finally {
      setLoading(false)
    }
  }, [authHeaders, token])

  useEffect(() => {
    loadJournal()
  }, [loadJournal])

  const updateEntryType = (entryType) => {
    const defaults = TYPE_DEFAULTS[entryType] || TYPE_DEFAULTS.habit
    setEntryForm((current) => ({
      ...current,
      entry_type: entryType,
      title: defaults.title,
      category: defaults.category,
      metric_name: defaults.metric_name,
      unit: defaults.unit,
    }))
  }

  const chooseRoutine = (routineId) => {
    const routine = routines.find((item) => String(item.id) === String(routineId))
    setEntryForm((current) => ({
      ...current,
      routine: routineId,
      routine_item: '',
      category: routine?.category || current.category,
    }))
  }

  const chooseRoutineItem = (routineItemId) => {
    const item = selectedRoutineItems.find((candidate) => String(candidate.id) === String(routineItemId))
    setEntryForm((current) => ({
      ...current,
      routine_item: routineItemId,
      title: item?.name || current.title,
      metric_name: item?.name || current.metric_name,
      unit: item?.default_unit || current.unit,
      quantity: item?.default_target_quantity || current.quantity,
    }))
  }

  const primeEntryFromItem = (routine, item) => {
    setEntryForm((current) => ({
      ...current,
      entry_type: routine.category === 'Food' ? 'meal' : routine.category === 'Learning' ? 'lesson_note' : routine.category === 'Dental' ? 'habit' : 'fitness',
      routine: routine.id,
      routine_item: item.id,
      title: item.name,
      category: routine.category || current.category,
      metric_name: item.name,
      quantity: item.default_target_quantity || '',
      unit: item.default_unit || '',
      notes: '',
    }))
    setMessage(`${item.name} is ready to log.`)
  }

  const submitEntry = async (event) => {
    event.preventDefault()
    setSavingEntry(true)
    setError('')
    setMessage('')
    try {
      const payload = {
        entry_type: entryForm.entry_type,
        title: entryForm.title.trim(),
        category: entryForm.category.trim(),
        metric_name: entryForm.metric_name.trim(),
        notes: entryForm.notes.trim(),
      }
      if (entryForm.routine) payload.routine = Number(entryForm.routine)
      if (entryForm.routine_item) payload.routine_item = Number(entryForm.routine_item)
      if (entryForm.quantity !== '') payload.quantity = entryForm.quantity
      if (entryForm.unit.trim()) payload.unit = entryForm.unit.trim()

      const response = await fetch('/api/journal-entries/', {
        method: 'POST',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data?.title?.[0] || data?.detail || 'Could not save entry')

      if (attachment) {
        const formData = new FormData()
        formData.append('file', attachment)
        const attachmentResponse = await fetch(`/api/journal-entries/${data.id}/attachments/`, {
          method: 'POST',
          headers: authHeaders,
          body: formData,
        })
        const attachmentData = await attachmentResponse.json().catch(() => ({}))
        if (!attachmentResponse.ok) throw new Error(attachmentData?.file?.[0] || attachmentData?.detail || 'Entry saved, but attachment failed')
      }

      setEntryForm((current) => ({
        ...emptyEntry,
        entry_type: current.entry_type,
        title: TYPE_DEFAULTS[current.entry_type]?.title || emptyEntry.title,
        category: TYPE_DEFAULTS[current.entry_type]?.category || emptyEntry.category,
        unit: TYPE_DEFAULTS[current.entry_type]?.unit || '',
      }))
      setAttachment(null)
      setMessage('Saved to your private proof archive.')
      await loadJournal()
    } catch (saveError) {
      setError(saveError?.message || 'Could not save entry')
    } finally {
      setSavingEntry(false)
    }
  }

  const submitRoutine = async (event) => {
    event.preventDefault()
    setSavingRoutine(true)
    setError('')
    setMessage('')
    try {
      const response = await fetch('/api/routines/', {
        method: 'POST',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: routineForm.name.trim(),
          category: routineForm.category.trim(),
          purpose: routineForm.purpose.trim(),
          learned_from: routineForm.learnedFrom.trim(),
        }),
      })
      const routine = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(routine?.name?.[0] || routine?.detail || 'Could not create routine')

      const items = parseRoutineItems(routineForm.itemsText)
      const itemResponses = await Promise.all(items.map((item) => fetch('/api/routine-items/', {
        method: 'POST',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...item, routine: routine.id }),
      })))
      if (itemResponses.some((itemResponse) => !itemResponse.ok)) {
        throw new Error('The routine was created, but one or more actions could not be saved.')
      }

      if (routineForm.makeToday) {
        const todayResponse = await fetch(`/api/routines/${routine.id}/select-today/`, {
          method: 'POST',
          headers: authHeaders,
        })
        if (!todayResponse.ok) throw new Error('The routine was created, but could not be selected for Today.')
      }

      setRoutineForm(emptyRoutine)
      setMessage(`${routine.name} is yours now. Build the proof loop around it.`)
      await loadJournal()
    } catch (saveError) {
      setError(saveError?.message || 'Could not create routine')
    } finally {
      setSavingRoutine(false)
    }
  }

  const selectTodayRoutine = async (routine) => {
    setError('')
    setMessage('')
    try {
      const response = await fetch(`/api/routines/${routine.id}/select-today/`, {
        method: 'POST',
        headers: authHeaders,
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data?.detail || data?.is_active?.[0] || 'Could not update Today')
      setMessage(`${routine.name} is now your Today routine.`)
      await loadJournal()
    } catch (selectError) {
      setError(selectError?.message || 'Could not update Today')
    }
  }

  return (
    <div className="px-4 py-8 sm:px-6">
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-500">Private journal</p>
          <h1 className="mt-2 text-3xl font-semibold text-gray-950">Build proof for future you</h1>
          <p className="mt-2 max-w-2xl text-sm text-gray-500">
            Meals, therapy notes, qigong class takeaways, drum reps, dental habits, stretches, and strength work all count.
          </p>
        </div>
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
          {entries.length} private entries
        </div>
      </div>

      {error ? <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {message ? <div className="mb-4 rounded-md border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">{message}</div> : null}

      <section className="mb-10 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <form onSubmit={submitEntry} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-950">Log proof</h2>
              <p className="text-sm text-gray-500">One entry is enough to keep the thread alive.</p>
            </div>
            <button
              type="submit"
              disabled={savingEntry || !entryForm.title.trim()}
              className="rounded-full bg-gray-950 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              {savingEntry ? 'Saving' : 'Save'}
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium text-gray-700">
              Type
              <select
                value={entryForm.entry_type}
                onChange={(event) => updateEntryType(event.target.value)}
                className="mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
              >
                {ENTRY_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium text-gray-700">
              Title
              <input
                value={entryForm.title}
                onChange={(event) => setEntryForm((current) => ({ ...current, title: event.target.value }))}
                className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
              />
            </label>
            <label className="text-sm font-medium text-gray-700">
              Routine
              <select
                value={entryForm.routine}
                onChange={(event) => chooseRoutine(event.target.value)}
                className="mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
              >
                <option value="">None</option>
                {routines.map((routine) => <option key={routine.id} value={routine.id}>{routine.name}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium text-gray-700">
              Action
              <select
                value={entryForm.routine_item}
                onChange={(event) => chooseRoutineItem(event.target.value)}
                className="mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
              >
                <option value="">None</option>
                {selectedRoutineItems.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium text-gray-700">
              Quantity
              <input
                type="number"
                step="0.01"
                value={entryForm.quantity}
                onChange={(event) => setEntryForm((current) => ({ ...current, quantity: event.target.value }))}
                className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
              />
            </label>
            <label className="text-sm font-medium text-gray-700">
              Unit
              <input
                value={entryForm.unit}
                onChange={(event) => setEntryForm((current) => ({ ...current, unit: event.target.value }))}
                className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
              />
            </label>
            <label className="text-sm font-medium text-gray-700">
              Category
              <input
                value={entryForm.category}
                onChange={(event) => setEntryForm((current) => ({ ...current, category: event.target.value }))}
                className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
              />
            </label>
            <label className="text-sm font-medium text-gray-700">
              Photo or file
              <input
                type="file"
                accept="image/*,video/*,.pdf,.txt"
                onChange={(event) => setAttachment(event.target.files?.[0] || null)}
                className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 file:mr-3 file:rounded-full file:border-0 file:bg-gray-100 file:px-3 file:py-1 file:text-xs file:font-medium file:text-gray-700 focus:border-gray-900 focus:outline-none"
              />
            </label>
          </div>

          <label className="mt-3 block text-sm font-medium text-gray-700">
            Notes
            <textarea
              value={entryForm.notes}
              onChange={(event) => setEntryForm((current) => ({ ...current, notes: event.target.value }))}
              rows={5}
              className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
            />
          </label>
        </form>

        <form onSubmit={submitRoutine} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-950">Create routine</h2>
              <p className="text-sm text-gray-500">Name the work so it becomes easier to repeat.</p>
            </div>
            <button
              type="submit"
              disabled={savingRoutine || !routineForm.name.trim()}
              className="rounded-full border border-gray-900 px-4 py-2 text-sm font-medium text-gray-950 transition-colors hover:bg-gray-950 hover:text-white disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-300"
            >
              {savingRoutine ? 'Creating' : 'Create'}
            </button>
          </div>
          <div className="grid gap-3">
            <input
              value={routineForm.name}
              onChange={(event) => setRoutineForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Routine name"
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
            />
            <input
              value={routineForm.category}
              onChange={(event) => setRoutineForm((current) => ({ ...current, category: event.target.value }))}
              placeholder="Category"
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
            />
            <input
              value={routineForm.learnedFrom}
              onChange={(event) => setRoutineForm((current) => ({ ...current, learnedFrom: event.target.value }))}
              placeholder="Learned from (optional, e.g. Dorothy or Jimmy)"
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
            />
            <textarea
              value={routineForm.purpose}
              onChange={(event) => setRoutineForm((current) => ({ ...current, purpose: event.target.value }))}
              placeholder="Why this matters"
              rows={3}
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
            />
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={routineForm.makeToday}
                onChange={(event) => setRoutineForm((current) => ({ ...current, makeToday: event.target.checked }))}
                className="h-4 w-4 rounded border-gray-300"
              />
              Use this routine on Today
            </label>
            <textarea
              value={routineForm.itemsText}
              onChange={(event) => setRoutineForm((current) => ({ ...current, itemsText: event.target.value }))}
              placeholder={'Pushups | reps | 20\nFlagpole stretch | minutes | 2'}
              rows={5}
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
            />
          </div>
        </form>
      </section>

      <section className="mb-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-950">Routines</h2>
          {loading ? <span className="text-xs text-gray-400">Loading</span> : null}
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {routines.map((routine) => (
            <article key={routine.id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-gray-950">{routine.name}</h3>
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-gray-400">{routine.category || 'Routine'}</p>
                </div>
                <div className="flex flex-wrap justify-end gap-1.5">
                  {routine.is_today ? <span className="rounded-full bg-gray-950 px-2.5 py-1 text-xs font-medium text-white">Today</span> : null}
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${routine.is_default ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800'}`}>
                    {routine.is_default ? 'Default' : 'Custom'}
                  </span>
                </div>
              </div>
              {routine.learned_from ? <p className="mb-2 text-xs font-medium text-gray-500">Learned from {routine.learned_from}</p> : null}
              {routine.purpose ? <p className="mb-3 text-sm text-gray-500">{routine.purpose}</p> : null}
              <div className="flex flex-wrap gap-2">
                {(routine.items || []).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => primeEntryFromItem(routine, item)}
                    className="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:border-gray-900 hover:text-gray-950"
                  >
                    {item.name}
                  </button>
                ))}
              </div>
              {!routine.is_today ? (
                <button
                  type="button"
                  onClick={() => selectTodayRoutine(routine)}
                  className="mt-4 rounded-full border border-gray-900 px-3 py-1.5 text-xs font-semibold text-gray-900 hover:bg-gray-950 hover:text-white"
                >
                  Use on Today
                </button>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-gray-950">Recent entries</h2>
        <div className="grid gap-3">
          {entries.length === 0 && !loading ? (
            <div className="rounded-lg border border-dashed border-gray-300 p-6 text-sm text-gray-500">
              No journal entries yet.
            </div>
          ) : null}
          {entries.map((entry) => (
            <article key={entry.id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-gray-950">{entry.title}</h3>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{entry.entry_type.replace('_', ' ')}</span>
                    {entry.category ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">{entry.category}</span> : null}
                  </div>
                  <p className="mt-1 text-xs text-gray-400">{formatDateTime(entry.occurred_at)}</p>
                  {entry.routine_name ? <p className="mt-2 text-sm text-gray-600">{entry.routine_name}{entry.routine_item_name ? ` / ${entry.routine_item_name}` : ''}</p> : null}
                  {entry.quantity ? <p className="mt-1 text-sm font-medium text-gray-950">{entry.quantity} {entry.unit}</p> : null}
                  {entry.notes ? <p className="mt-2 whitespace-pre-wrap text-sm text-gray-600">{entry.notes}</p> : null}
                </div>
                {(entry.attachments || []).length ? (
                  <div className="flex gap-2 sm:justify-end">
                    {entry.attachments.map((attachmentItem) => (
                      attachmentItem.media_type === 'image' ? (
                        <img
                          key={attachmentItem.id}
                          src={attachmentItem.url}
                          alt={attachmentItem.caption || entry.title}
                          className="h-20 w-20 rounded-md object-cover"
                        />
                      ) : (
                        <a
                          key={attachmentItem.id}
                          href={attachmentItem.url}
                          className="rounded-md border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:text-gray-950"
                        >
                          Attachment
                        </a>
                      )
                    ))}
                  </div>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
