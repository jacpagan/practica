import React, { useMemo } from 'react'
import SessionListItem from './SessionListItem'

const formatActivityDate = (value) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default function TodayView({
  sessions = [],
  sessionsLoading = false,
  onRecord,
  onUpload,
  onOpenSession,
  onOpenSkill,
}) {
  const stats = useMemo(() => {
    const skillNames = new Set()
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)

    let thisWeek = 0
    sessions.forEach((session) => {
      const skill = String(session?.practice_series || '').trim()
      if (skill) skillNames.add(skill.toLocaleLowerCase())
      const recordedAt = new Date(session?.recorded_at || session?.created_at)
      if (!Number.isNaN(recordedAt.getTime()) && recordedAt >= weekAgo) thisWeek += 1
    })

    return {
      totalProofs: sessions.length,
      totalSkills: skillNames.size,
      thisWeek,
    }
  }, [sessions])

  const latestProof = sessions[0] || null
  const recentSkills = useMemo(() => {
    const byName = new Map()
    sessions.forEach((session) => {
      const skill = String(session?.practice_series || '').trim()
      if (!skill) return
      const key = skill.toLocaleLowerCase()
      if (byName.has(key)) return
      byName.set(key, {
        name: skill,
        latestAt: session.recorded_at || session.created_at,
      })
    })
    return Array.from(byName.values()).slice(0, 6)
  }, [sessions])

  if (sessionsLoading) {
    return (
      <div className="px-4 sm:px-6 py-6">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="h-40 rounded-[2rem] bg-gray-100 animate-pulse" />
          <div className="grid grid-cols-3 gap-3">
            <div className="h-20 rounded-2xl bg-gray-100 animate-pulse" />
            <div className="h-20 rounded-2xl bg-gray-100 animate-pulse" />
            <div className="h-20 rounded-2xl bg-gray-100 animate-pulse" />
          </div>
          <div className="h-28 rounded-2xl bg-gray-100 animate-pulse" />
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 sm:px-6 py-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <section className="rounded-[2rem] border border-gray-200 bg-gradient-to-br from-gray-950 to-gray-800 px-5 py-6 text-white shadow-sm sm:px-8 sm:py-8">
          <div className="max-w-2xl space-y-4">
            <p className="text-xs uppercase tracking-[0.2em] text-white/55">Today</p>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Record private proof of any skill.</h1>
              <p className="text-sm leading-6 text-white/70 sm:text-base">
                Capture what you practiced, tag the skill if it helps, and let each proof build your private archive.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={onRecord}
                className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-gray-950 hover:bg-gray-100 transition-colors"
              >
                Record proof
              </button>
              <button
                type="button"
                onClick={onUpload}
                className="rounded-full border border-white/20 px-5 py-3 text-sm font-medium text-white hover:bg-white/10 transition-colors"
              >
                Upload video
              </button>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl border border-gray-200 bg-white px-4 py-4">
            <p className="text-2xl font-semibold text-gray-900">{stats.totalProofs}</p>
            <p className="text-xs text-gray-500 mt-1">proofs</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white px-4 py-4">
            <p className="text-2xl font-semibold text-gray-900">{stats.totalSkills}</p>
            <p className="text-xs text-gray-500 mt-1">skills</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white px-4 py-4">
            <p className="text-2xl font-semibold text-gray-900">{stats.thisWeek}</p>
            <p className="text-xs text-gray-500 mt-1">this week</p>
          </div>
        </section>

        {recentSkills.length > 0 ? (
          <section className="rounded-2xl border border-gray-200 bg-white px-4 py-4 space-y-3">
            <div>
              <p className="text-sm font-semibold text-gray-900">Recent skills</p>
              <p className="text-xs text-gray-500 mt-1">Jump back into anything you have been practicing.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {recentSkills.map((skill) => (
                <button
                  key={skill.name}
                  type="button"
                  onClick={() => onOpenSkill?.(skill.name)}
                  className="rounded-full border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                >
                  {skill.name}
                  {skill.latestAt ? <span className="ml-2 text-xs text-gray-400">{formatActivityDate(skill.latestAt)}</span> : null}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <section className="rounded-2xl border border-gray-200 bg-white px-4 py-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-gray-900">Latest proof</p>
              <p className="text-xs text-gray-500 mt-1">Your newest private capture is always one tap away.</p>
            </div>
          </div>
          {latestProof ? (
            <SessionListItem
              session={latestProof}
              onOpen={() => onOpenSession?.(latestProof, { view: 'today', sessionId: null, seriesName: '' })}
              showSeries
              minimal
            />
          ) : (
            <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-8 text-center">
              <p className="text-sm text-gray-700">No proofs yet.</p>
              <p className="text-xs text-gray-500 mt-1">Start with one short recording. You can organize it later.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
