import React, { useMemo, useState } from 'react'
import SessionListItem from './SessionListItem'
import SkillPickerModal from './SkillPickerModal'
import ActivityCalendar from './ActivityCalendar'
import VideoThumbnail from './VideoThumbnail'
import { useToast } from './Toast'
import { buildDrillSummaries, buildLatestSkillComparison } from '../progressActivity'
import { buildSkillShareText, reportClientEvent, toLocalDateKey } from '../utils'

const formatCompactDateTime = (value) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const dayPart = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  const timePart = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  return `${dayPart} · ${timePart}`
}

const formatResultValue = (value) => {
  const number = Number(value)
  if (!Number.isFinite(number)) return ''
  return Number.isInteger(number) ? String(number) : number.toFixed(2).replace(/\.?0+$/, '')
}

function CompareProofCard({ label, session, onOpen }) {
  if (!session) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
        <p className="mt-8 text-sm text-gray-500">No proof yet</p>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => onOpen?.(session)}
      className="overflow-hidden rounded-xl border border-gray-200 bg-white text-left transition-colors hover:border-gray-300"
    >
      <VideoThumbnail session={session} variant="poster" className="aspect-video w-full bg-black" />
      <div className="p-3">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
        <p className="mt-1 truncate text-sm font-semibold text-gray-950">{session.title || 'Proof'}</p>
        <p className="mt-1 text-xs text-gray-500">{formatCompactDateTime(session.recorded_at || session.created_at)}</p>
      </div>
    </button>
  )
}

function SkillView({ skillName = '', sessions = [], sessionsLoading = false, token = '', onBack, onOpenSession, onRecord }) {
  const [renamingSkill, setRenamingSkill] = useState('')
  const [saving, setSaving] = useState(false)
  const [shareStatus, setShareStatus] = useState('')
  const toast = useToast()
  const skillOptions = useMemo(() => {
    const byCanonicalName = new Map()
    sessions.forEach((session) => {
      const rawName = String(session?.practice_series || '').trim()
      if (!rawName) return
      const canonicalName = rawName.toLocaleLowerCase()
      if (byCanonicalName.has(canonicalName)) return
      byCanonicalName.set(canonicalName, rawName)
    })
    return Array.from(byCanonicalName.values()).sort((left, right) => left.localeCompare(right))
  }, [sessions])
  const skillSessions = useMemo(() => {
    return sessions
      .filter((session) => session.can_edit && String(session.practice_series || '').trim() === String(skillName || '').trim())
      .sort((left, right) => new Date(right.recorded_at || right.created_at) - new Date(left.recorded_at || left.created_at))
      .map((session, index, items) => ({
        ...session,
        takeNumber: items.length - index,
        isLatest: index === 0,
      }))
  }, [skillName, sessions])

  const latestSession = skillSessions[0] || null
  const comparison = useMemo(() => buildLatestSkillComparison(skillSessions), [skillSessions])
  const drillSummaries = useMemo(() => buildDrillSummaries(skillSessions), [skillSessions])
  const skillProofDays = useMemo(() => {
    const days = new Set()
    skillSessions.forEach((session) => {
      const key = toLocalDateKey(session.recorded_at || session.created_at)
      if (key) days.add(key)
    })
    return days.size
  }, [skillSessions])
  const skillShareText = useMemo(() => buildSkillShareText({
    skillName,
    proofCount: skillSessions.length,
    proofDays: skillProofDays,
    latestProofAt: latestSession?.recorded_at || latestSession?.created_at || '',
  }), [latestSession, skillName, skillProofDays, skillSessions.length])

  const handleShareSkill = async () => {
    setShareStatus('')
    reportClientEvent('skill_card_share_started', {
      action: 'skill_card_share_started',
      skill_name: skillName,
      proof_count: skillSessions.length,
      proof_days: skillProofDays,
    })
    try {
      setShareStatus('Preparing link')
      const response = await fetch('/api/sessions/skill-shares/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Token ${token}` } : {}),
        },
        body: JSON.stringify({ practice_series: skillName }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data?.error || 'Could not create a share link')
      }
      const shareUrl = data?.url || (() => {
        try {
          return `${window.location.origin}/s/${data?.token || ''}`
        } catch {
          return `https://practica.jpagan.com/s/${data?.token || ''}`
        }
      })()
      const textWithUrl = `${skillShareText}\n${shareUrl}`
      setShareStatus('')
      if (navigator?.share) {
        await navigator.share({
          title: `${skillName || 'Skill'} progress`,
          text: skillShareText,
          url: shareUrl,
        })
        setShareStatus('Shared')
        reportClientEvent('skill_card_shared', {
          action: 'skill_card_shared',
          channel: 'native_share',
          skill_name: skillName,
        })
        return
      }
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(textWithUrl)
        setShareStatus('Copied')
        reportClientEvent('skill_card_shared', {
          action: 'skill_card_shared',
          channel: 'clipboard',
          skill_name: skillName,
        })
        return
      }
      throw new Error('Sharing is not available in this browser')
    } catch (error) {
      if (error?.name === 'AbortError') {
        setShareStatus('')
        return
      }
      setShareStatus('Could not share')
      reportClientEvent('skill_card_share_failed', {
        action: 'skill_card_share_failed',
        reason: error?.message || 'unknown',
        skill_name: skillName,
      })
    }
  }

  if (sessionsLoading) {
    return (
      <div className="px-4 sm:px-6 py-6">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="h-6 w-48 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-32 bg-gray-100 rounded animate-pulse mt-2" />
          <div className="space-y-3 mt-6">
            <div className="h-24 w-full bg-gray-100 rounded-2xl animate-pulse" />
            <div className="h-24 w-full bg-gray-100 rounded-2xl animate-pulse" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 sm:px-6 py-6 pb-28">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="space-y-3">
          <button type="button" onClick={onBack} className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
            ← Back to archive
          </button>
          <div>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="text-2xl font-semibold text-gray-900 tracking-tight">{skillName}</h2>
              <button
                type="button"
                onClick={() => setRenamingSkill(skillName)}
                className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
              >
                Rename
              </button>
            </div>
            <p className="text-sm text-gray-500 mt-2">
              {latestSession
                ? `${skillSessions.length} ${skillSessions.length === 1 ? 'proof' : 'proofs'} · latest ${formatCompactDateTime(latestSession.recorded_at || latestSession.created_at)}`
                : 'No proofs yet'}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => onRecord?.(skillName)}
              className="inline-flex w-full items-center justify-center rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-800 sm:w-auto"
            >
              Record for this skill
            </button>
            {skillSessions.length > 0 ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleShareSkill}
                  className="inline-flex w-full items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900 transition-colors hover:bg-gray-50 sm:w-auto"
                >
                  Share skill card
                </button>
                {shareStatus ? <span className="text-xs font-medium text-gray-500">{shareStatus}</span> : null}
              </div>
            ) : null}
          </div>
        </div>

        {skillSessions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-10 text-center">
            <p className="text-sm text-gray-700">Start this skill with one tiny proof.</p>
            <p className="text-xs text-gray-500 mt-1">Record now, then Practica will keep it in your private archive.</p>
          </div>
        ) : (
          <>
            <ActivityCalendar sessions={skillSessions} />

            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-950">Latest vs previous</p>
                  <p className="mt-1 text-sm text-gray-500">
                    {comparison.hasComparison
                      ? `${comparison.daysApart} ${comparison.daysApart === 1 ? 'day' : 'days'} between these proofs.`
                      : 'Your next proof will create the first comparison.'}
                  </p>
                </div>
                {comparison.hasComparison ? (
                  <p className="text-xs text-gray-400">What changed?</p>
                ) : null}
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <CompareProofCard
                  label="Latest"
                  session={comparison.latest}
                  onOpen={(session) => onOpenSession?.(session, { view: 'skill', sessionId: null, seriesName: skillName })}
                />
                <CompareProofCard
                  label="Previous"
                  session={comparison.previous}
                  onOpen={(session) => onOpenSession?.(session, { view: 'skill', sessionId: null, seriesName: skillName })}
                />
              </div>
            </div>

            {drillSummaries.length ? (
              <section className="rounded-2xl border border-gray-200 bg-white p-4">
                <div>
                  <p className="text-sm font-semibold text-gray-950">Drills</p>
                  <p className="mt-1 text-sm text-gray-500">Best proof per drill from your saved results.</p>
                </div>
                <div className="mt-4 divide-y divide-gray-100">
                  {drillSummaries.map((drill) => {
                    const bestResult = drill.best?.proof_result || {}
                    const value = formatResultValue(bestResult.value)
                    const unit = String(bestResult.unit || drill.unit || '').trim()
                    const metric = String(bestResult.metric_name || drill.metricName || '').trim()
                    return (
                      <button
                        type="button"
                        key={drill.drillName}
                        onClick={() => onOpenSession?.(drill.best, { view: 'skill', sessionId: null, seriesName: skillName })}
                        className="flex w-full items-center justify-between gap-3 py-3 text-left transition-colors hover:bg-gray-50"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-gray-950">{drill.drillName}</span>
                          <span className="mt-1 block text-xs text-gray-500">
                            {drill.proofCount} {drill.proofCount === 1 ? 'proof' : 'proofs'}
                            {drill.latest ? ` · latest ${formatCompactDateTime(drill.latest.recorded_at || drill.latest.created_at)}` : ''}
                          </span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="block text-sm font-semibold text-gray-950">
                            {value ? `${value}${unit ? ` ${unit}` : ''}` : 'Best proof'}
                          </span>
                          <span className="mt-1 block text-xs text-gray-500">{metric || 'Result'}</span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              </section>
            ) : null}

            <div className="space-y-3">
              {skillSessions.map((session) => (
                <SessionListItem
                  key={session.id}
                  session={session}
                  onOpen={() => onOpenSession?.(session, { view: 'skill', sessionId: null, seriesName: skillName })}
                  highlight={session.isLatest}
                  latestLabel={session.isLatest ? 'Latest' : ''}
                  minimal
                />
              ))}
            </div>
          </>
        )}

        <SkillPickerModal
          open={Boolean(renamingSkill)}
          title="Rename skill"
          initialValue={renamingSkill || ''}
          options={skillOptions}
          saving={saving}
          onClose={() => setRenamingSkill('')}
          onSave={async (val) => {
            if (!renamingSkill || !token) return
            setSaving(true)
            try {
              const res = await fetch('/api/sessions/threads/rename/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Token ${token}` } : {}) },
                body: JSON.stringify({ old_practice_series: renamingSkill, new_practice_series: val }),
              })
              const data = await res.json().catch(() => ({}))
              if (!res.ok) throw new Error(data?.error || 'Could not rename skill')
              try { window.dispatchEvent(new CustomEvent('practica:skill-renamed', { detail: { oldSeriesName: renamingSkill, newSeriesName: val } })) } catch {}
              toast.success('Skill renamed')
              setRenamingSkill('')
            } catch (e) {
              toast.error(e?.message || 'Could not rename skill')
            } finally {
              setSaving(false)
            }
          }}
        />
      </div>
    </div>
  )
}

export default SkillView
