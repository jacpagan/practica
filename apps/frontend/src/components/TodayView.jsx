import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { authHeaders } from '../auth'
import { useToast } from './Toast'
import PlanEditor from './PlanEditor'
import { writeReferenceAttemptDraft } from '../utils'

const STATUS_OPTIONS = [
  { value: 'complete', label: 'Complete' },
  { value: 'partial', label: 'Partial' },
  { value: 'skipped', label: 'Skipped' },
  { value: 'missed', label: 'Missed' },
]

const buildCheckinState = (planItems, checkin) => {
  const existingItems = new Map((checkin?.items || []).map((item) => [item.plan_item, item]))
  const items = {}
  planItems.forEach((planItem) => {
    const existing = existingItems.get(planItem.id)
    items[planItem.id] = {
      completed: Boolean(existing?.completed),
      minutes: existing?.minutes ?? '',
      reps: existing?.reps ?? '',
      notes: existing?.notes || '',
    }
  })

  return {
    status: checkin?.status || 'partial',
    totalMinutes: checkin?.total_minutes ?? '',
    notes: checkin?.notes || '',
    linkedSessionId: checkin?.linked_session_id || '',
    items,
  }
}

function TodayView({
  token,
  user,
  spaces = [],
  initialSpaceId = null,
  exercises = [],
  onOpenSession,
  onUploadProof,
  onQuickRecordProof,
  onScreenRecordProof,
}) {
  const toast = useToast()
  const [selectedSpaceId, setSelectedSpaceId] = useState(initialSpaceId || spaces[0]?.id || null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [bundle, setBundle] = useState(null)
  const [plan, setPlan] = useState(null)
  const [planItems, setPlanItems] = useState([])
  const [checkinState, setCheckinState] = useState(buildCheckinState([], null))
  const [recentSessions, setRecentSessions] = useState([])
  const [showCoachTools, setShowCoachTools] = useState(false)
  const [coachSummaryLoading, setCoachSummaryLoading] = useState(false)
  const [coachSummary, setCoachSummary] = useState(null)
  const [referenceTitleDraft, setReferenceTitleDraft] = useState('')
  const [referenceUrlDraft, setReferenceUrlDraft] = useState('')

  useEffect(() => {
    if (!spaces.length) {
      setSelectedSpaceId(null)
      return
    }
    if (!selectedSpaceId || !spaces.some((space) => space.id === selectedSpaceId)) {
      setSelectedSpaceId(initialSpaceId || spaces[0].id)
    }
  }, [spaces, selectedSpaceId, initialSpaceId])

  const selectedSpace = useMemo(
    () => spaces.find((space) => space.id === selectedSpaceId) || null,
    [spaces, selectedSpaceId],
  )
  const selectedSpaceIsOwner = Boolean(selectedSpace?.is_owner)

  const recentOwnSessions = useMemo(
    () => recentSessions.filter((session) => session.owner_id === user?.id),
    [recentSessions, user?.id],
  )

  const loadToday = useCallback(async () => {
    if (!selectedSpaceId) return
    setLoading(true)
    try {
      const [todayRes, sessionsRes] = await Promise.all([
        fetch(`/api/spaces/${selectedSpaceId}/checkins/today/`, { headers: authHeaders(token) }),
        fetch(`/api/sessions/?space=${selectedSpaceId}`, { headers: authHeaders(token) }),
      ])
      if (!todayRes.ok) throw new Error('today')
      const todayData = await todayRes.json()
      const sessionsData = sessionsRes.ok ? await sessionsRes.json() : []
      const nextPlan = todayData?.plan || null
      const nextItems = Array.isArray(todayData?.plan_items) ? todayData.plan_items : []
      const nextCheckin = todayData?.checkin || null
      setBundle(todayData)
      setPlan(nextPlan)
      setPlanItems(nextItems)
      setCheckinState(buildCheckinState(nextItems, nextCheckin))
      setRecentSessions(Array.isArray(sessionsData?.results) ? sessionsData.results : Array.isArray(sessionsData) ? sessionsData : [])
    } catch {
      toast.error('Could not load today’s checklist')
    } finally {
      setLoading(false)
    }
  }, [selectedSpaceId, token, toast])

  useEffect(() => {
    if (selectedSpaceId) loadToday()
  }, [selectedSpaceId, loadToday])

  const loadCoachSummary = useCallback(async () => {
    if (!selectedSpaceId || !selectedSpaceIsOwner) {
      setCoachSummary(null)
      return
    }
    setCoachSummaryLoading(true)
    try {
      const res = await fetch(`/api/spaces/${selectedSpaceId}/adherence/?window_days=7`, { headers: authHeaders(token) })
      if (!res.ok) throw new Error('adherence')
      const data = await res.json()
      setCoachSummary(data)
    } catch {
      toast.error('Could not load student accountability snapshot')
    } finally {
      setCoachSummaryLoading(false)
    }
  }, [selectedSpaceId, selectedSpaceIsOwner, token, toast])

  useEffect(() => {
    loadCoachSummary()
  }, [loadCoachSummary])

  const updateItem = (itemId, field, value) => {
    setCheckinState((current) => ({
      ...current,
      items: {
        ...current.items,
        [itemId]: {
          ...(current.items[itemId] || {}),
          [field]: value,
        },
      },
    }))
  }

  const launchReferenceAttempt = (launcher) => {
    const url = referenceUrlDraft.trim()
    if (!url) {
      toast.error('Paste a YouTube or teacher video URL first')
      return
    }
    writeReferenceAttemptDraft({
      reference_title: referenceTitleDraft.trim(),
      reference_url: url,
      space_id: selectedSpaceId || null,
    })
    launcher?.(selectedSpaceId)
  }

  const submitCheckin = async () => {
    if (!selectedSpaceId) return
    setSaving(true)
    try {
      const itemsPayload = planItems.map((item) => ({
        plan_item_id: item.id,
        completed: Boolean(checkinState.items[item.id]?.completed),
        minutes: checkinState.items[item.id]?.minutes === '' ? null : Number(checkinState.items[item.id]?.minutes),
        reps: checkinState.items[item.id]?.reps === '' ? null : Number(checkinState.items[item.id]?.reps),
        notes: (checkinState.items[item.id]?.notes || '').trim(),
      }))

      const res = await fetch(`/api/spaces/${selectedSpaceId}/checkins/upsert/`, {
        method: 'POST',
        headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: bundle?.date,
          status: checkinState.status,
          total_minutes: checkinState.totalMinutes === '' ? null : Number(checkinState.totalMinutes),
          notes: checkinState.notes.trim(),
          linked_session_id: checkinState.linkedSessionId || null,
          items: itemsPayload,
        }),
      })
      if (!res.ok) throw new Error('save')
      toast.success('Check-in saved')
      await loadToday()
    } catch {
      toast.error('Could not save check-in')
    } finally {
      setSaving(false)
    }
  }

  if (!spaces.length) {
    return (
      <div className="px-4 sm:px-6 pt-6">
        <div className="rounded-2xl border border-dashed border-gray-200 p-6 text-center">
          <h2 className="text-sm font-semibold text-gray-900">No spaces yet</h2>
          <p className="text-sm text-gray-500 mt-2">Join or create a space before using daily check-ins.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 sm:px-6 pt-4 space-y-4">
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {spaces.map((space) => (
          <button
            key={space.id}
            onClick={() => setSelectedSpaceId(space.id)}
            className={`text-xs px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${selectedSpaceId === space.id ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            {space.name}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-400">Today</p>
            <h2 className="text-lg font-semibold text-gray-900 mt-1">{selectedSpace?.name}</h2>
            <p className="text-sm text-gray-500 mt-1">
              {bundle?.date ? `Check in for ${bundle.date}` : 'Your daily accountability checklist'}
            </p>
          </div>
          {selectedSpaceIsOwner ? (
            <button
              onClick={() => setShowCoachTools((current) => !current)}
              className="text-xs font-medium text-gray-700 border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-50 transition-colors"
            >
              {showCoachTools ? 'Hide coach tools' : 'Coach tools'}
            </button>
          ) : null}
        </div>

        {selectedSpaceIsOwner ? (
          <div className="mt-4 rounded-2xl border border-gray-200 p-4 space-y-4 bg-white">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">Coach view</p>
                <p className="text-sm text-gray-500 mt-1">Set the plan and scan student follow-through without leaving Today.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCoachTools((current) => !current)}
                className="text-xs font-medium text-gray-700 border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-50 transition-colors"
              >
                {showCoachTools ? 'Hide editor' : 'Edit active plan'}
              </button>
            </div>

            {showCoachTools ? (
              <PlanEditor token={token} space={selectedSpace} exercises={exercises} onPlanChange={() => { loadToday(); loadCoachSummary() }} />
            ) : null}

            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Student snapshot</p>
              {coachSummaryLoading ? (
                <p className="text-sm text-gray-400">Loading student check-ins…</p>
              ) : (coachSummary?.members || []).length === 0 ? (
                <p className="text-sm text-gray-500">Invite a student from Spaces to start the accountability loop.</p>
              ) : (
                <div className="space-y-2">
                  {coachSummary.members.map((member) => (
                    <div key={member.user_id} className="rounded-xl bg-gray-50 px-3 py-3 flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900">{member.display_name}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {member.last_checkin_date ? `Last check-in ${member.last_checkin_date}` : 'No check-ins yet'}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 text-[11px]">
                        <span className="bg-gray-200 text-gray-700 px-2 py-1 rounded-full">{Math.round((member.completion_rate || 0) * 100)}% complete</span>
                        <span className="bg-gray-200 text-gray-700 px-2 py-1 rounded-full">Streak {member.streak_current}</span>
                        <span className="bg-amber-50 text-amber-700 px-2 py-1 rounded-full">{member.missed_dates.length} missed</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}

        {loading ? (
          <div className="py-12 text-center text-sm text-gray-400">Loading today’s plan…</div>
        ) : !plan ? (
          <div className="mt-4 rounded-xl border border-dashed border-gray-200 px-4 py-5 text-sm text-gray-500">
            <p>No active practice plan for this space yet.</p>
            {selectedSpaceIsOwner ? (
              <button
                type="button"
                onClick={() => setShowCoachTools(true)}
                className="mt-3 text-xs font-medium text-gray-700 border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-50 transition-colors"
              >
                Set up a plan
              </button>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onQuickRecordProof?.(selectedSpaceId)}
                className="text-xs font-medium text-white bg-gray-900 rounded-lg px-3 py-2 hover:bg-gray-800 transition-colors"
              >
                Record attempt anyway
              </button>
              <button
                type="button"
                onClick={() => onUploadProof?.(selectedSpaceId)}
                className="text-xs font-medium text-gray-700 border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-50 transition-colors"
              >
                Upload attempt
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-3">No plan is required — you can still record a practice attempt and attach a reference video when saving.</p>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="rounded-xl bg-gray-50 px-4 py-3">
              <p className="text-sm font-medium text-gray-900">{plan.name}</p>
              {plan.description ? <p className="text-sm text-gray-600 mt-1">{plan.description}</p> : null}
              <p className="text-xs text-gray-400 mt-2">Timezone: {plan.timezone}</p>
            </div>

            <div className="space-y-3">
              {planItems.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 px-4 py-5 text-sm text-gray-500">
                  Nothing is scheduled for today.
                </div>
              ) : (
                planItems.map((item) => {
                  const state = checkinState.items[item.id] || {}
                  return (
                    <div key={item.id} className="rounded-2xl border border-gray-200 p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{item.exercise_name}</p>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {item.target_minutes ? <span className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{item.target_minutes} min</span> : null}
                            {item.target_reps ? <span className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{item.target_reps} reps</span> : null}
                          </div>
                        </div>
                        <label className="flex items-center gap-2 text-sm text-gray-700">
                          <input
                            type="checkbox"
                            checked={Boolean(state.completed)}
                            onChange={(e) => updateItem(item.id, 'completed', e.target.checked)}
                            className="rounded border-gray-300"
                          />
                          Done
                        </label>
                      </div>

                      {item.notes ? <p className="text-sm text-gray-600">{item.notes}</p> : null}
                      {item.reference_clip_detail?.watch_url_with_start ? (
                        <a
                          href={item.reference_clip_detail.watch_url_with_start}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex text-xs text-blue-600 hover:text-blue-700"
                        >
                          {item.reference_clip_detail.title || 'Open reference clip'}
                        </a>
                      ) : null}

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <label className="block">
                          <span className="text-xs text-gray-500">Minutes</span>
                          <input
                            type="number"
                            min="0"
                            value={state.minutes ?? ''}
                            onChange={(e) => updateItem(item.id, 'minutes', e.target.value)}
                            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
                          />
                        </label>
                        <label className="block">
                          <span className="text-xs text-gray-500">Reps</span>
                          <input
                            type="number"
                            min="0"
                            value={state.reps ?? ''}
                            onChange={(e) => updateItem(item.id, 'reps', e.target.value)}
                            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
                          />
                        </label>
                        <label className="block sm:col-span-1">
                          <span className="text-xs text-gray-500">Quick note</span>
                          <input
                            type="text"
                            value={state.notes || ''}
                            onChange={(e) => updateItem(item.id, 'notes', e.target.value)}
                            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
                            placeholder="How it felt"
                          />
                        </label>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            <div className="rounded-2xl border border-gray-200 p-4 space-y-4">
              <div>
                <p className="text-sm font-semibold text-gray-900">Optional proof video</p>
                <p className="text-sm text-gray-500 mt-1">Best flow: paste the teacher video you are following, then record your attempt against it.</p>
              </div>

              <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 space-y-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">Start from a YouTube reference</p>
                  <p className="text-xs text-gray-500 mt-1">Example: Dorothy Fitzer qigong follow-alongs. This keeps the source video attached to your attempt for teacher review.</p>
                </div>
                <input
                  type="text"
                  value={referenceTitleDraft}
                  onChange={(e) => setReferenceTitleDraft(e.target.value)}
                  placeholder="Dorothy Fitzer — 8 Brocades"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 bg-white"
                />
                <input
                  type="url"
                  value={referenceUrlDraft}
                  onChange={(e) => setReferenceUrlDraft(e.target.value)}
                  placeholder="https://www.youtube.com/watch?..."
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 bg-white"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => launchReferenceAttempt(onQuickRecordProof)}
                    className="text-xs font-medium text-white bg-gray-900 rounded-lg px-3 py-2 hover:bg-gray-800 transition-colors"
                  >
                    Record attempt
                  </button>
                  <button
                    type="button"
                    onClick={() => launchReferenceAttempt(onUploadProof)}
                    className="text-xs font-medium text-gray-700 border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-50 transition-colors"
                  >
                    Upload attempt
                  </button>
                  {onScreenRecordProof ? (
                    <button
                      type="button"
                      onClick={() => launchReferenceAttempt(onScreenRecordProof)}
                      className="text-xs font-medium text-gray-700 border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-50 transition-colors"
                    >
                      Screen-record attempt
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onQuickRecordProof?.(selectedSpaceId)}
                  className="text-xs font-medium text-white bg-gray-900 rounded-lg px-3 py-2 hover:bg-gray-800 transition-colors"
                >
                  Quick record
                </button>
                <button
                  type="button"
                  onClick={() => onUploadProof?.(selectedSpaceId)}
                  className="text-xs font-medium text-gray-700 border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-50 transition-colors"
                >
                  Upload video
                </button>
                {onScreenRecordProof ? (
                  <button
                    type="button"
                    onClick={() => onScreenRecordProof(selectedSpaceId)}
                    className="text-xs font-medium text-gray-700 border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-50 transition-colors"
                  >
                    Screen record
                  </button>
                ) : null}
              </div>

              {recentOwnSessions.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Recent proof sessions</p>
                  {recentOwnSessions.slice(0, 4).map((session) => (
                    <div key={session.id} className="rounded-xl bg-gray-50 px-3 py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{session.title}</p>
                        <p className="text-xs text-gray-500 mt-1">{session.description || 'Recorded proof video'}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onOpenSession?.(session)}
                        className="text-xs text-gray-600 hover:text-gray-900 flex-shrink-0"
                      >
                        Review
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-gray-200 p-4 space-y-4">
              <div>
                <p className="text-sm font-semibold text-gray-900">Daily summary</p>
                <p className="text-sm text-gray-500 mt-1">Capture how today went, even if it was partial.</p>
              </div>

              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setCheckinState((current) => ({ ...current, status: option.value }))}
                    className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${checkinState.status === option.value ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs text-gray-500">Total minutes</span>
                  <input
                    type="number"
                    min="0"
                    value={checkinState.totalMinutes}
                    onChange={(e) => setCheckinState((current) => ({ ...current, totalMinutes: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
                  />
                </label>

                <label className="block">
                  <span className="text-xs text-gray-500">Optional proof session</span>
                  <select
                    value={checkinState.linkedSessionId}
                    onChange={(e) => setCheckinState((current) => ({ ...current, linkedSessionId: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:border-gray-400"
                  >
                    <option value="">No linked session</option>
                    {recentOwnSessions.map((session) => (
                      <option key={session.id} value={session.id}>{session.title}</option>
                    ))}
                  </select>
                </label>

                <label className="block sm:col-span-2">
                  <span className="text-xs text-gray-500">Notes</span>
                  <textarea
                    value={checkinState.notes}
                    onChange={(e) => setCheckinState((current) => ({ ...current, notes: e.target.value }))}
                    rows={3}
                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm resize-none focus:outline-none focus:border-gray-400"
                    placeholder="Anything your coach should know?"
                  />
                </label>
              </div>

              <button
                type="button"
                onClick={submitCheckin}
                disabled={saving}
                className="text-sm font-medium text-white bg-gray-900 rounded-xl px-4 py-2.5 hover:bg-gray-800 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving…' : 'Save today’s check-in'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default TodayView
