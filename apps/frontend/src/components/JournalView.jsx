import React, { useCallback, useEffect, useMemo, useState } from 'react'

const ENTRY_TYPES = [
  ['fitness', 'Fitness'], ['meal', 'Meal'], ['recipe', 'Recipe'], ['therapy', 'Therapy'],
  ['class_note', 'Class'], ['lesson_note', 'Lesson'], ['habit', 'Habit'],
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
  entry_type: 'fitness', title: 'Fitness proof', category: 'Fitness', routine: '', routine_item: '',
  metric_name: '', quantity: '', unit: 'reps', notes: '',
}
const emptyRoutine = { name: '', category: '', purpose: '', learnedFrom: '', itemsText: '', makeToday: true }
const emptyEditor = {
  id: null, name: '', category: '', purpose: '', learnedFrom: '', items: [],
  newItemName: '', newItemUnit: '', newItemTarget: '',
}
const fieldClass = 'mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none'

function normalizeListPayload(data) {
  if (Array.isArray(data)) return data
  return Array.isArray(data?.results) ? data.results : []
}

function formatDateTime(value) {
  if (!value) return ''
  try {
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value))
  } catch {
    return value
  }
}

function routineToEditor(routine) {
  return {
    id: routine.id,
    name: routine.name || '',
    category: routine.category || '',
    purpose: routine.purpose || '',
    learnedFrom: routine.learned_from || '',
    items: [...(routine.items || [])].sort((a, b) => a.sort_order - b.sort_order),
    newItemName: '', newItemUnit: '', newItemTarget: '',
  }
}

export default function JournalView({ token }) {
  const [activeTab, setActiveTab] = useState('log')
  const [routines, setRoutines] = useState([])
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [savingEntry, setSavingEntry] = useState(false)
  const [savingRoutine, setSavingRoutine] = useState(false)
  const [savingEditor, setSavingEditor] = useState(false)
  const [entryForm, setEntryForm] = useState(emptyEntry)
  const [routineForm, setRoutineForm] = useState(emptyRoutine)
  const [editorForm, setEditorForm] = useState(emptyEditor)
  const [createRoutineOpen, setCreateRoutineOpen] = useState(false)
  const [attachment, setAttachment] = useState(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const authHeaders = useMemo(() => ({ Authorization: `Token ${token}` }), [token])
  const selectedRoutine = useMemo(() => routines.find((routine) => String(routine.id) === String(entryForm.routine)), [entryForm.routine, routines])

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

  useEffect(() => { loadJournal() }, [loadJournal])

  const updateEntryType = (entryType) => {
    setEntryForm((current) => ({ ...current, entry_type: entryType, ...(TYPE_DEFAULTS[entryType] || TYPE_DEFAULTS.habit) }))
  }

  const chooseRoutine = (routineId) => {
    const routine = routines.find((item) => String(item.id) === String(routineId))
    setEntryForm((current) => ({ ...current, routine: routineId, routine_item: '', category: routine?.category || current.category }))
  }

  const chooseRoutineItem = (routineItemId) => {
    const item = (selectedRoutine?.items || []).find((candidate) => String(candidate.id) === String(routineItemId))
    setEntryForm((current) => ({
      ...current, routine_item: routineItemId, title: item?.name || current.title,
      metric_name: item?.name || current.metric_name, unit: item?.default_unit || current.unit,
      quantity: item?.default_target_quantity || current.quantity,
    }))
  }

  const primeEntryFromItem = (routine, item) => {
    const entryType = routine.category === 'Food' ? 'meal' : routine.category === 'Learning' ? 'lesson_note' : routine.category === 'Dental' ? 'habit' : 'fitness'
    setEntryForm((current) => ({
      ...current, entry_type: entryType, routine: routine.id, routine_item: item.id, title: item.name,
      category: routine.category || current.category, metric_name: item.name,
      quantity: item.default_target_quantity || '', unit: item.default_unit || '', notes: '',
    }))
    setActiveTab('log')
    setMessage(`${item.name} is ready to log.`)
  }

  const submitEntry = async (event) => {
    event.preventDefault()
    setSavingEntry(true); setError(''); setMessage('')
    try {
      const payload = {
        entry_type: entryForm.entry_type, title: entryForm.title.trim(), category: entryForm.category.trim(),
        metric_name: entryForm.metric_name.trim(), notes: entryForm.notes.trim(),
      }
      if (entryForm.routine) payload.routine = Number(entryForm.routine)
      if (entryForm.routine_item) payload.routine_item = Number(entryForm.routine_item)
      if (entryForm.quantity !== '') payload.quantity = entryForm.quantity
      if (entryForm.unit.trim()) payload.unit = entryForm.unit.trim()
      const response = await fetch('/api/journal-entries/', {
        method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data?.title?.[0] || data?.detail || 'Could not save entry')
      if (attachment) {
        const formData = new FormData(); formData.append('file', attachment)
        const attachmentResponse = await fetch(`/api/journal-entries/${data.id}/attachments/`, { method: 'POST', headers: authHeaders, body: formData })
        const attachmentData = await attachmentResponse.json().catch(() => ({}))
        if (!attachmentResponse.ok) throw new Error(attachmentData?.file?.[0] || attachmentData?.detail || 'Entry saved, but attachment failed')
      }
      setEntryForm((current) => ({ ...emptyEntry, entry_type: current.entry_type, ...(TYPE_DEFAULTS[current.entry_type] || TYPE_DEFAULTS.fitness) }))
      setAttachment(null); setMessage('Saved to your private proof archive.')
      await loadJournal()
    } catch (saveError) {
      setError(saveError?.message || 'Could not save entry')
    } finally {
      setSavingEntry(false)
    }
  }

  const submitRoutine = async (event) => {
    event.preventDefault()
    setSavingRoutine(true); setError(''); setMessage('')
    try {
      const response = await fetch('/api/routines/', {
        method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: routineForm.name.trim(), category: routineForm.category.trim(), purpose: routineForm.purpose.trim(), learned_from: routineForm.learnedFrom.trim() }),
      })
      const routine = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(routine?.name?.[0] || routine?.detail || 'Could not create routine')
      const items = routineForm.itemsText.split('\n').map((name) => name.trim()).filter(Boolean)
      const itemResponses = await Promise.all(items.map((name, sortOrder) => fetch('/api/routine-items/', {
        method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ routine: routine.id, name, default_unit: '', default_target_quantity: null, sort_order: sortOrder }),
      })))
      if (itemResponses.some((itemResponse) => !itemResponse.ok)) throw new Error('The routine was created, but one or more actions could not be saved.')
      if (routineForm.makeToday) {
        const todayResponse = await fetch(`/api/routines/${routine.id}/select-today/`, { method: 'POST', headers: authHeaders })
        if (!todayResponse.ok) throw new Error('The routine was created, but could not be selected for Today.')
      }
      setRoutineForm(emptyRoutine); setCreateRoutineOpen(false); setActiveTab('routines')
      setMessage(`${routine.name} is ready to practice.`)
      await loadJournal()
    } catch (saveError) {
      setError(saveError?.message || 'Could not create routine')
    } finally {
      setSavingRoutine(false)
    }
  }

  const selectTodayRoutine = async (routine) => {
    setError(''); setMessage('')
    try {
      const response = await fetch(`/api/routines/${routine.id}/select-today/`, { method: 'POST', headers: authHeaders })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data?.detail || 'Could not update Today')
      setMessage(`${routine.name} is now your Today routine.`)
      await loadJournal()
    } catch (selectError) {
      setError(selectError?.message || 'Could not update Today')
    }
  }

  const updateEditorItem = (itemId, field, value) => {
    setEditorForm((current) => ({ ...current, items: current.items.map((item) => item.id === itemId ? { ...item, [field]: value } : item) }))
  }

  const moveEditorItem = (index, direction) => {
    setEditorForm((current) => {
      const destination = index + direction
      if (destination < 0 || destination >= current.items.length) return current
      const items = [...current.items]; const [item] = items.splice(index, 1); items.splice(destination, 0, item)
      return { ...current, items }
    })
  }

  const addEditorItem = async () => {
    if (!editorForm.newItemName.trim()) return
    setSavingEditor(true); setError('')
    try {
      const response = await fetch('/api/routine-items/', {
        method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ routine: editorForm.id, name: editorForm.newItemName.trim(), default_unit: editorForm.newItemUnit.trim(), default_target_quantity: editorForm.newItemTarget || null, sort_order: editorForm.items.length }),
      })
      const item = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(item?.name?.[0] || item?.detail || 'Could not add action')
      setEditorForm((current) => ({ ...current, items: [...current.items, item], newItemName: '', newItemUnit: '', newItemTarget: '' }))
    } catch (saveError) {
      setError(saveError?.message || 'Could not add action')
    } finally {
      setSavingEditor(false)
    }
  }

  const saveRoutineEditor = async (event) => {
    event.preventDefault()
    setSavingEditor(true); setError(''); setMessage('')
    try {
      const routineResponse = await fetch(`/api/routines/${editorForm.id}/`, {
        method: 'PATCH', headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editorForm.name.trim(), category: editorForm.category.trim(), purpose: editorForm.purpose.trim(), learned_from: editorForm.learnedFrom.trim() }),
      })
      const routineData = await routineResponse.json().catch(() => ({}))
      if (!routineResponse.ok) throw new Error(routineData?.name?.[0] || routineData?.detail || 'Could not update routine')
      const itemResponses = await Promise.all(editorForm.items.map((item, sortOrder) => fetch(`/api/routine-items/${item.id}/`, {
        method: 'PATCH', headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ routine: editorForm.id, name: item.name.trim(), default_unit: item.default_unit?.trim() || '', default_target_quantity: item.default_target_quantity || null, sort_order: sortOrder }),
      })))
      if (itemResponses.some((itemResponse) => !itemResponse.ok)) throw new Error('The routine was updated, but one or more actions could not be saved.')
      setEditorForm(emptyEditor); setMessage(`${routineData.name} was updated.`)
      await loadJournal()
    } catch (saveError) {
      setError(saveError?.message || 'Could not update routine')
    } finally {
      setSavingEditor(false)
    }
  }

  const renderEntryForm = () => (
    <form onSubmit={submitEntry} className="border-y border-gray-200 py-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div><h2 className="text-lg font-semibold text-gray-950">Log an entry</h2><p className="mt-1 text-sm text-gray-500">A photo, number, or short note is enough.</p></div>
        <button type="submit" disabled={savingEntry || !entryForm.title.trim()} className="bg-gray-950 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:bg-gray-300">{savingEntry ? 'Saving' : 'Save entry'}</button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium text-gray-700">Type<select value={entryForm.entry_type} onChange={(event) => updateEntryType(event.target.value)} className={fieldClass}>{ENTRY_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="text-sm font-medium text-gray-700">Title<input value={entryForm.title} onChange={(event) => setEntryForm((current) => ({ ...current, title: event.target.value }))} className={fieldClass} /></label>
        <label className="text-sm font-medium text-gray-700">Routine<select value={entryForm.routine} onChange={(event) => chooseRoutine(event.target.value)} className={fieldClass}><option value="">None</option>{routines.map((routine) => <option key={routine.id} value={routine.id}>{routine.name}</option>)}</select></label>
        <label className="text-sm font-medium text-gray-700">Action<select value={entryForm.routine_item} onChange={(event) => chooseRoutineItem(event.target.value)} className={fieldClass}><option value="">None</option>{(selectedRoutine?.items || []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="text-sm font-medium text-gray-700">Quantity<input type="number" step="0.01" value={entryForm.quantity} onChange={(event) => setEntryForm((current) => ({ ...current, quantity: event.target.value }))} className={fieldClass} /></label>
        <label className="text-sm font-medium text-gray-700">Unit<input value={entryForm.unit} onChange={(event) => setEntryForm((current) => ({ ...current, unit: event.target.value }))} className={fieldClass} /></label>
        <label className="text-sm font-medium text-gray-700">Category<input value={entryForm.category} onChange={(event) => setEntryForm((current) => ({ ...current, category: event.target.value }))} className={fieldClass} /></label>
        <label className="text-sm font-medium text-gray-700">Photo or file<input type="file" accept="image/*,video/*,.pdf,.txt" onChange={(event) => setAttachment(event.target.files?.[0] || null)} className={`${fieldClass} file:mr-3 file:border-0 file:bg-gray-100 file:px-3 file:py-1 file:text-xs file:font-medium`} /></label>
      </div>
      <label className="mt-4 block text-sm font-medium text-gray-700">Notes<textarea value={entryForm.notes} onChange={(event) => setEntryForm((current) => ({ ...current, notes: event.target.value }))} rows={6} className={fieldClass} /></label>
    </form>
  )

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="mb-7 border-b border-gray-200 pb-6">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-gray-400">Private journal</p>
        <h1 className="mt-2 text-3xl font-semibold text-gray-950">Journal</h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-gray-500">Log what you did, what you learned, and what you want to repeat.</p>
      </header>
      <div role="tablist" aria-label="Journal sections" className="mb-7 flex border-b border-gray-200">
        {[['log', 'Log'], ['entries', `Entries ${entries.length}`], ['routines', `Routines ${routines.length}`]].map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={activeTab === id} onClick={() => setActiveTab(id)} className={`border-b-2 px-4 py-3 text-sm font-medium ${activeTab === id ? 'border-gray-950 text-gray-950' : 'border-transparent text-gray-400 hover:text-gray-700'}`}>{label}</button>
        ))}
      </div>
      {error ? <div role="alert" className="mb-5 border-l-2 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {message ? <div role="status" className="mb-5 border-l-2 border-emerald-500 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{message}</div> : null}

      {activeTab === 'log' ? renderEntryForm() : null}

      {activeTab === 'entries' ? (
        <section aria-labelledby="entries-heading">
          <div className="mb-4 flex items-center justify-between"><h2 id="entries-heading" className="text-lg font-semibold text-gray-950">Entries</h2>{loading ? <span className="text-xs text-gray-400">Loading</span> : null}</div>
          {entries.length === 0 && !loading ? <p className="border-y border-gray-200 py-8 text-sm text-gray-500">No journal entries yet.</p> : null}
          <div className="divide-y divide-gray-200 border-y border-gray-200">
            {entries.map((entry) => (
              <article key={entry.id} className="py-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1"><h3 className="font-semibold text-gray-950">{entry.title}</h3><span className="text-xs capitalize text-gray-400">{entry.entry_type.replace('_', ' ')}</span>{entry.category ? <span className="text-xs text-gray-400">{entry.category}</span> : null}</div>
                    <p className="mt-1 text-xs text-gray-400">{formatDateTime(entry.occurred_at)}</p>
                    {entry.routine_name ? <p className="mt-3 text-sm text-gray-600">{entry.routine_name}{entry.routine_item_name ? ` / ${entry.routine_item_name}` : ''}</p> : null}
                    {entry.quantity ? <p className="mt-1 text-sm font-medium text-gray-950">{entry.quantity} {entry.unit}</p> : null}
                    {entry.notes ? <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-600">{entry.notes}</p> : null}
                  </div>
                  {(entry.attachments || []).length ? <div className="flex shrink-0 gap-2">{entry.attachments.map((item) => item.media_type === 'image' ? <img key={item.id} src={item.url} alt={item.caption || entry.title} className="h-24 w-24 object-cover" /> : <a key={item.id} href={item.url} className="border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600">Attachment</a>)}</div> : null}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {activeTab === 'routines' ? (
        <section aria-labelledby="routines-heading">
          <div className="mb-4 flex items-center justify-between gap-4"><div><h2 id="routines-heading" className="text-lg font-semibold text-gray-950">Routines</h2><p className="mt-1 text-sm text-gray-500">Choose the routine that deserves your attention today.</p></div><button type="button" onClick={() => setCreateRoutineOpen(true)} className="bg-gray-950 px-4 py-2 text-sm font-medium text-white">New routine</button></div>
          {loading ? <p className="py-6 text-sm text-gray-400">Loading</p> : null}
          <div className="divide-y divide-gray-200 border-y border-gray-200">
            {routines.map((routine) => (
              <article key={routine.id} className="py-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1"><h3 className="font-semibold text-gray-950">{routine.name}</h3><span className="text-xs text-gray-400">{routine.category || 'Routine'}</span>{routine.is_today ? <span className="text-xs font-medium text-emerald-700">Today</span> : null}</div>
                    {routine.learned_from ? <p className="mt-2 text-xs text-gray-500">Learned from {routine.learned_from}</p> : null}
                    {routine.purpose ? <p className="mt-2 max-w-xl text-sm leading-6 text-gray-500">{routine.purpose}</p> : null}
                    <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">{(routine.items || []).map((item) => <button key={item.id} type="button" onClick={() => primeEntryFromItem(routine, item)} className="text-left text-sm font-medium text-gray-700 underline decoration-gray-200 underline-offset-4">{item.name}</button>)}</div>
                  </div>
                  <div className="flex shrink-0 gap-3 text-sm">{!routine.is_today ? <button type="button" onClick={() => selectTodayRoutine(routine)} className="font-medium text-gray-600">Use today</button> : null}<button type="button" onClick={() => setEditorForm(routineToEditor(routine))} className="font-medium text-gray-600">Edit</button></div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {createRoutineOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="new-routine-heading">
          <form onSubmit={submitRoutine} className="max-h-[90vh] w-full max-w-xl overflow-y-auto bg-white p-5 sm:p-7">
            <div className="mb-6 flex items-start justify-between"><div><h2 id="new-routine-heading" className="text-xl font-semibold text-gray-950">New routine</h2><p className="mt-1 text-sm text-gray-500">Make the next useful action easy to see.</p></div><button type="button" onClick={() => setCreateRoutineOpen(false)} className="text-sm text-gray-500">Close</button></div>
            <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium text-gray-700">Name<input value={routineForm.name} onChange={(event) => setRoutineForm((current) => ({ ...current, name: event.target.value }))} className={fieldClass} autoFocus /></label><label className="text-sm font-medium text-gray-700">Category<input value={routineForm.category} onChange={(event) => setRoutineForm((current) => ({ ...current, category: event.target.value }))} className={fieldClass} /></label></div>
            <label className="mt-4 block text-sm font-medium text-gray-700">Learned from<input value={routineForm.learnedFrom} onChange={(event) => setRoutineForm((current) => ({ ...current, learnedFrom: event.target.value }))} placeholder="Dorothy, Jimmy, or yourself" className={fieldClass} /></label>
            <label className="mt-4 block text-sm font-medium text-gray-700">Why it matters<textarea value={routineForm.purpose} onChange={(event) => setRoutineForm((current) => ({ ...current, purpose: event.target.value }))} rows={3} className={fieldClass} /></label>
            <label className="mt-4 block text-sm font-medium text-gray-700">Actions, one per line<textarea value={routineForm.itemsText} onChange={(event) => setRoutineForm((current) => ({ ...current, itemsText: event.target.value }))} placeholder={'Pushups\nFlagpole stretch\nFront stretch'} rows={5} className={fieldClass} /></label>
            <label className="mt-4 flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={routineForm.makeToday} onChange={(event) => setRoutineForm((current) => ({ ...current, makeToday: event.target.checked }))} className="h-4 w-4" />Use this routine on Today</label>
            <div className="mt-7 flex justify-end gap-3 border-t border-gray-200 pt-5"><button type="button" onClick={() => setCreateRoutineOpen(false)} className="px-3 py-2 text-sm text-gray-500">Cancel</button><button type="submit" disabled={savingRoutine || !routineForm.name.trim()} className="bg-gray-950 px-4 py-2 text-sm font-medium text-white disabled:bg-gray-300">{savingRoutine ? 'Creating' : 'Create routine'}</button></div>
          </form>
        </div>
      ) : null}

      {editorForm.id ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="edit-routine-heading">
          <form onSubmit={saveRoutineEditor} className="max-h-[92vh] w-full max-w-2xl overflow-y-auto bg-white p-5 sm:p-7">
            <div className="mb-6 flex items-start justify-between"><div><h2 id="edit-routine-heading" className="text-xl font-semibold text-gray-950">Edit routine</h2><p className="mt-1 text-sm text-gray-500">Keep it specific enough to use without hesitation.</p></div><button type="button" onClick={() => setEditorForm(emptyEditor)} className="text-sm text-gray-500">Close</button></div>
            <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium text-gray-700">Name<input value={editorForm.name} onChange={(event) => setEditorForm((current) => ({ ...current, name: event.target.value }))} className={fieldClass} /></label><label className="text-sm font-medium text-gray-700">Category<input value={editorForm.category} onChange={(event) => setEditorForm((current) => ({ ...current, category: event.target.value }))} className={fieldClass} /></label></div>
            <label className="mt-4 block text-sm font-medium text-gray-700">Learned from<input value={editorForm.learnedFrom} onChange={(event) => setEditorForm((current) => ({ ...current, learnedFrom: event.target.value }))} className={fieldClass} /></label>
            <label className="mt-4 block text-sm font-medium text-gray-700">Why it matters<textarea value={editorForm.purpose} onChange={(event) => setEditorForm((current) => ({ ...current, purpose: event.target.value }))} rows={3} className={fieldClass} /></label>
            <div className="mt-7 border-t border-gray-200 pt-5"><h3 className="text-sm font-semibold text-gray-950">Actions</h3>
              <div className="mt-3 divide-y divide-gray-100 border-y border-gray-200">{editorForm.items.map((item, index) => (
                <div key={item.id} className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_8rem_7rem_auto] sm:items-end"><label className="text-xs font-medium text-gray-500">Action<input value={item.name} onChange={(event) => updateEditorItem(item.id, 'name', event.target.value)} className={fieldClass} /></label><label className="text-xs font-medium text-gray-500">Unit<input value={item.default_unit || ''} onChange={(event) => updateEditorItem(item.id, 'default_unit', event.target.value)} className={fieldClass} /></label><label className="text-xs font-medium text-gray-500">Target<input type="number" step="0.01" value={item.default_target_quantity || ''} onChange={(event) => updateEditorItem(item.id, 'default_target_quantity', event.target.value)} className={fieldClass} /></label><div className="flex h-10 items-center"><button type="button" onClick={() => moveEditorItem(index, -1)} disabled={index === 0} aria-label={`Move ${item.name} up`} title="Move up" className="px-2 text-lg text-gray-500 disabled:text-gray-200">↑</button><button type="button" onClick={() => moveEditorItem(index, 1)} disabled={index === editorForm.items.length - 1} aria-label={`Move ${item.name} down`} title="Move down" className="px-2 text-lg text-gray-500 disabled:text-gray-200">↓</button></div></div>
              ))}</div>
              <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_8rem_7rem_auto] sm:items-end"><label className="text-xs font-medium text-gray-500">New action<input value={editorForm.newItemName} onChange={(event) => setEditorForm((current) => ({ ...current, newItemName: event.target.value }))} className={fieldClass} /></label><label className="text-xs font-medium text-gray-500">Unit<input value={editorForm.newItemUnit} onChange={(event) => setEditorForm((current) => ({ ...current, newItemUnit: event.target.value }))} className={fieldClass} /></label><label className="text-xs font-medium text-gray-500">Target<input type="number" step="0.01" value={editorForm.newItemTarget} onChange={(event) => setEditorForm((current) => ({ ...current, newItemTarget: event.target.value }))} className={fieldClass} /></label><button type="button" onClick={addEditorItem} disabled={savingEditor || !editorForm.newItemName.trim()} className="h-10 border border-gray-900 px-3 text-sm font-medium disabled:border-gray-200 disabled:text-gray-300">Add</button></div>
            </div>
            <div className="mt-7 flex justify-end gap-3 border-t border-gray-200 pt-5"><button type="button" onClick={() => setEditorForm(emptyEditor)} className="px-3 py-2 text-sm text-gray-500">Cancel</button><button type="submit" disabled={savingEditor || !editorForm.name.trim()} className="bg-gray-950 px-4 py-2 text-sm font-medium text-white disabled:bg-gray-300">{savingEditor ? 'Saving' : 'Save changes'}</button></div>
          </form>
        </div>
      ) : null}
    </div>
  )
}
