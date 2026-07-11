import React, { useMemo, useState } from 'react'
import SessionListItem from './SessionListItem'
import SkillPickerModal from './SkillPickerModal'
import { useToast } from './Toast'
import { buildSkillShareText, reportClientEvent, toLocalDateKey } from '../utils'

const formatCompactDateTime = (value) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const dayPart = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  const timePart = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  return `${dayPart} · ${timePart}`
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
    const shareUrl = (() => {
      try {
        return window.location.href || window.location.origin || 'https://practica.jpagan.com'
      } catch {
        return 'https://practica.jpagan.com'
      }
    })()
    const textWithUrl = `${skillShareText}\n${shareUrl}`
    setShareStatus('')
    reportClientEvent('skill_card_share_started', {
      action: 'skill_card_share_started',
      skill_name: skillName,
      proof_count: skillSessions.length,
      proof_days: skillProofDays,
    })
    try {
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
