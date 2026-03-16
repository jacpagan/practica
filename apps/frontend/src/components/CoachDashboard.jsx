import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { authHeaders } from '../auth'
import { useToast } from './Toast'
import PlanEditor from './PlanEditor'

const formatDateLabel = (value) => {
  if (!value) return 'Unknown date'
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function CoachDashboard({ token, spaces = [], spaceId, exercises = [], onOpenSpaceDashboard }) {
  const toast = useToast()
  const [windowDays, setWindowDays] = useState(30)
  const [loading, setLoading] = useState(false)
  const [adherence, setAdherence] = useState(null)
  const [selectedMemberId, setSelectedMemberId] = useState(null)
  const [memberHistory, setMemberHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [showPlanEditor, setShowPlanEditor] = useState(true)

  const ownedSpaces = useMemo(() => spaces.filter((space) => space.is_owner), [spaces])
  const space = useMemo(() => ownedSpaces.find((entry) => entry.id === spaceId) || null, [ownedSpaces, spaceId])
  const selectedMember = useMemo(
    () => adherence?.members?.find((member) => member.user_id === selectedMemberId) || null,
    [adherence, selectedMemberId],
  )

  const loadAdherence = useCallback(async () => {
    if (!space?.id) return
    setLoading(true)
    try {
      const res = await fetch(`/api/spaces/${space.id}/adherence/?window_days=${windowDays}`, { headers: authHeaders(token) })
      if (!res.ok) throw new Error('adherence')
      const data = await res.json()
      setAdherence(data)
      setSelectedMemberId((current) => {
        if (current && data.members?.some((member) => member.user_id === current)) return current
        return data.members?.[0]?.user_id || null
      })
    } catch {
      toast.error('Could not load coach dashboard')
    } finally {
      setLoading(false)
    }
  }, [space?.id, token, windowDays, toast])

  const loadHistory = useCallback(async () => {
    if (!space?.id || !selectedMemberId || !adherence?.from || !adherence?.to) return
    setHistoryLoading(true)
    try {
      const res = await fetch(
        `/api/spaces/${space.id}/checkins/?user=${selectedMemberId}&from=${adherence.from}&to=${adherence.to}`,
        { headers: authHeaders(token) },
      )
      if (!res.ok) throw new Error('history')
      const data = await res.json()
      setMemberHistory(Array.isArray(data) ? data : [])
    } catch {
      toast.error('Could not load member history')
    } finally {
      setHistoryLoading(false)
    }
  }, [space?.id, selectedMemberId, adherence?.from, adherence?.to, token, toast])

  useEffect(() => {
    loadAdherence()
  }, [loadAdherence])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  if (!ownedSpaces.length) {
    return (
      <div className="px-4 sm:px-6 pt-6">
        <div className="rounded-2xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">
          You do not own any spaces yet.
        </div>
      </div>
    )
  }

  if (!space) {
    return (
      <div className="px-4 sm:px-6 pt-6">
        <div className="rounded-2xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">
          Choose one of your spaces to view adherence.
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 sm:px-6 pt-4 space-y-4">
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {ownedSpaces.map((ownedSpace) => (
          <button
            key={ownedSpace.id}
            onClick={() => onOpenSpaceDashboard?.(ownedSpace.id)}
            className={`text-xs px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${space.id === ownedSpace.id ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            {ownedSpace.name}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-400">Coach dashboard</p>
            <h2 className="text-lg font-semibold text-gray-900 mt-1">{space.name}</h2>
            <p className="text-sm text-gray-500 mt-1">Track completion, streaks, and missed days.</p>
          </div>
          <div className="flex items-center gap-2">
            {[7, 30].map((days) => (
              <button
                key={days}
                onClick={() => setWindowDays(days)}
                className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${windowDays === days ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {days} days
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-gray-400">Loading adherence…</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-4">
            <div className="space-y-3">
              {(adherence?.members || []).length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 px-4 py-5 text-sm text-gray-500">
                  No members have joined this space yet.
                </div>
              ) : (
                adherence.members.map((member) => {
                  const percent = member.completion_rate == null ? 0 : Math.round(member.completion_rate * 100)
                  return (
                    <button
                      key={member.user_id}
                      onClick={() => setSelectedMemberId(member.user_id)}
                      className={`w-full text-left rounded-2xl border p-4 transition-colors ${selectedMemberId === member.user_id ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-300'}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{member.display_name}</p>
                          <p className="text-xs text-gray-500 mt-1">Current streak {member.streak_current} · Best {member.streak_best}</p>
                        </div>
                        <span className="text-sm font-medium text-gray-700">{percent}%</span>
                      </div>
                      <div className="mt-3 h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div className="h-full bg-gray-900 transition-all" style={{ width: `${percent}%` }} />
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {member.missed_dates.slice(0, 5).map((missedDate) => (
                          <span key={missedDate} className="text-[11px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">
                            Missed {missedDate.slice(5)}
                          </span>
                        ))}
                        {member.missed_dates.length > 5 ? (
                          <span className="text-[11px] text-gray-400">+{member.missed_dates.length - 5} more</span>
                        ) : null}
                      </div>
                    </button>
                  )
                })
              )}
            </div>

            <div className="rounded-2xl border border-gray-200 p-4">
              {selectedMember ? (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">{selectedMember.display_name}</h3>
                      <p className="text-xs text-gray-500 mt-1">Last check-in {selectedMember.last_checkin_date || 'none yet'}</p>
                    </div>
                    <span className="text-xs text-gray-400">{adherence?.from} → {adherence?.to}</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-4">
                    <div className="rounded-xl bg-gray-50 px-3 py-3">
                      <p className="text-[11px] uppercase tracking-wide text-gray-400">Completion</p>
                      <p className="text-lg font-semibold text-gray-900 mt-1">{selectedMember.completion_rate == null ? '—' : `${Math.round(selectedMember.completion_rate * 100)}%`}</p>
                    </div>
                    <div className="rounded-xl bg-gray-50 px-3 py-3">
                      <p className="text-[11px] uppercase tracking-wide text-gray-400">Current streak</p>
                      <p className="text-lg font-semibold text-gray-900 mt-1">{selectedMember.streak_current}</p>
                    </div>
                    <div className="rounded-xl bg-gray-50 px-3 py-3">
                      <p className="text-[11px] uppercase tracking-wide text-gray-400">Best streak</p>
                      <p className="text-lg font-semibold text-gray-900 mt-1">{selectedMember.streak_best}</p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Last 7 days</p>
                    <div className="flex flex-wrap gap-2">
                      {(selectedMember.last_7_days_summary || []).map((entry) => (
                        <span
                          key={entry.date}
                          className={`text-[11px] px-2 py-1 rounded-full ${
                            entry.status === 'complete'
                              ? 'bg-green-50 text-green-700'
                              : entry.status === 'partial'
                                ? 'bg-blue-50 text-blue-700'
                                : entry.status === 'skipped'
                                  ? 'bg-gray-100 text-gray-600'
                                  : entry.status === 'missed'
                                    ? 'bg-amber-50 text-amber-700'
                                    : 'bg-gray-50 text-gray-400'
                          }`}
                        >
                          {entry.date.slice(5)} · {entry.status || 'off'}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 border-t border-gray-100 pt-4">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Check-in history</p>
                    {historyLoading ? (
                      <p className="text-sm text-gray-400">Loading history…</p>
                    ) : memberHistory.length === 0 ? (
                      <p className="text-sm text-gray-500">No check-ins in this window.</p>
                    ) : (
                      <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                        {memberHistory.map((checkin) => (
                          <div key={checkin.id} className="rounded-xl border border-gray-100 px-3 py-3">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium text-gray-900">{formatDateLabel(checkin.date)}</p>
                              <span className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{checkin.status}</span>
                            </div>
                            <div className="flex flex-wrap gap-2 mt-2 text-xs text-gray-500">
                              {checkin.total_minutes ? <span>{checkin.total_minutes} min</span> : null}
                              {checkin.linked_session_title ? <span>Proof: {checkin.linked_session_title}</span> : null}
                            </div>
                            {checkin.notes ? <p className="text-sm text-gray-600 mt-2">{checkin.notes}</p> : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-sm text-gray-500">Choose a member to inspect history.</p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Plan editor</h3>
            <p className="text-sm text-gray-500 mt-1">Adjust the active plan and item schedule for this space.</p>
          </div>
          <button
            onClick={() => setShowPlanEditor((current) => !current)}
            className="text-xs font-medium text-gray-600 border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-50 transition-colors"
          >
            {showPlanEditor ? 'Hide editor' : 'Show editor'}
          </button>
        </div>

        {showPlanEditor ? (
          <PlanEditor token={token} space={space} exercises={exercises} onPlanChange={() => loadAdherence()} />
        ) : null}
      </div>
    </div>
  )
}

export default CoachDashboard
