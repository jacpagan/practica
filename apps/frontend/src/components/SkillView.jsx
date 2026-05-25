import React, { useEffect, useMemo, useRef, useState } from 'react'
import { fmtDate } from '../utils'
import VideoThumbnail from './VideoThumbnail'
import SessionListItem from './SessionListItem'
import SkillPickerModal from './SkillPickerModal'
import { useToast } from './Toast'

const formatCompactDateTime = (value) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const dayPart = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  const timePart = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  return `${dayPart} · ${timePart}`
}

function SkillView({ skillName = '', sessions = [], sessionsLoading = false, token = '', onBack, onOpenSession, onRecordProof }) {
  const [renamingSkill, setRenamingSkill] = useState('')
  const [skillMenuOpen, setSkillMenuOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const skillMenuRef = useRef(null)
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
    const filtered = sessions
      .filter((session) => session.can_edit && String(session.practice_series || '').trim() === String(skillName || '').trim())
      .sort((left, right) => new Date(left.recorded_at || left.created_at) - new Date(right.recorded_at || right.created_at))

    return filtered.map((session, index) => ({
      ...session,
      takeNumber: index + 1,
    }))
  }, [skillName, sessions])

  const latestSession = skillSessions[skillSessions.length - 1] || null
  const previousSession = skillSessions.length > 1 ? skillSessions[skillSessions.length - 2] : null
  useEffect(() => {
    if (!skillMenuOpen) return undefined
    const handlePointerDown = (event) => {
      const node = skillMenuRef.current
      if (!node || node.contains(event.target)) return
      setSkillMenuOpen(false)
    }
    window.addEventListener('pointerdown', handlePointerDown)
    return () => window.removeEventListener('pointerdown', handlePointerDown)
  }, [skillMenuOpen])
  if (sessionsLoading) {
    return (
      <div className="px-4 sm:px-6 py-6">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Skill</p>
              <div className="h-6 w-48 bg-gray-200 rounded animate-pulse mt-1" />
              <div className="h-4 w-32 bg-gray-100 rounded animate-pulse mt-2" />
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="h-10 w-28 bg-gray-200 rounded animate-pulse" />
              <div className="h-10 w-28 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>
          <div className="space-y-3">
            <div className="h-24 w-full bg-gray-100 rounded-2xl animate-pulse" />
            <div className="h-24 w-full bg-gray-100 rounded-2xl animate-pulse" />
            <div className="h-24 w-full bg-gray-100 rounded-2xl animate-pulse" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 sm:px-6 py-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="space-y-3">
          <button type="button" onClick={onBack} className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
            ← Back to progress
          </button>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Skill</p>
              <h2 className="text-2xl font-semibold text-gray-900 tracking-tight mt-1">{skillName}</h2>
              <p className="text-sm text-gray-500 mt-2">{latestSession ? `Latest ${formatCompactDateTime(latestSession.recorded_at || latestSession.created_at)}` : 'No proofs yet'}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onRecordProof?.()}
                className="rounded-full bg-gray-900 text-white px-4 py-2.5 text-sm font-medium hover:bg-gray-800 transition-colors"
              >
                Record proof
              </button>
              {latestSession ? (
                <button
                  type="button"
                  onClick={() => onOpenSession?.(latestSession, { view: 'skill', sessionId: null, seriesName: skillName })}
                  className="rounded-full border border-gray-200 bg-white text-gray-900 px-4 py-2.5 text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Open latest proof
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {skillSessions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-10 text-center">
            <p className="text-sm text-gray-700">No proofs in this skill yet.</p>
            <p className="text-xs text-gray-500 mt-1">Use Record above, then choose this skill when you save.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">Latest proof</p>
                  <h3 className="text-lg font-semibold text-gray-900 mt-1">{latestSession?.title}</h3>
                  <p className="text-sm text-gray-500 mt-1">{latestSession ? formatCompactDateTime(latestSession.recorded_at || latestSession.created_at) : ''}</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] uppercase tracking-wide bg-gray-100 text-gray-700 px-2 py-1 rounded-full">Proof {latestSession?.takeNumber}</span>
                  {latestSession?.processing_status === 'ready' ? <span className="text-[11px] uppercase tracking-wide bg-gray-100 text-gray-600 px-2 py-1 rounded-full">Ready</span> : null}
                  {latestSession?.processing_status === 'processing' ? <span className="text-[11px] uppercase tracking-wide bg-amber-100 text-amber-800 px-2 py-1 rounded-full">Processing</span> : null}
                </div>
              </div>
              <div className="p-4 space-y-4">
                <VideoThumbnail session={latestSession} className="relative w-full max-w-xl aspect-video rounded-2xl overflow-hidden bg-black" />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenSession?.(latestSession, { view: 'skill', sessionId: null, seriesName: skillName })}
                    className="rounded-full bg-gray-900 text-white px-4 py-2.5 text-sm font-medium hover:bg-gray-800 transition-colors"
                  >
                    Open latest proof
                  </button>
                </div>
              </div>
            </div>

            {previousSession ? (
              <div className="rounded-2xl border border-gray-200 bg-white px-4 py-4 space-y-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">Previous proof</p>
                  <p className="text-sm font-medium text-gray-900 mt-1">{previousSession.title}</p>
                  <p className="text-xs text-gray-500 mt-1">{fmtDate(previousSession.recorded_at || previousSession.created_at)}</p>
                </div>
                <button type="button" onClick={() => onOpenSession?.(previousSession, { view: 'skill', sessionId: null, seriesName: skillName })} className="text-sm text-gray-700 border border-gray-200 rounded-lg px-4 py-2.5 hover:bg-gray-50 transition-colors">
                  Open previous proof
                </button>
              </div>
            ) : null}

            <div className="rounded-2xl border border-gray-200 bg-white px-4 py-4 space-y-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Proof timeline</p>
                  <p className="text-xs text-gray-500 mt-1">Oldest to newest, so the next proof has a clear place to land.</p>
                </div>
                <div className="relative" ref={skillMenuRef}>
                  <button
                    type="button"
                    onClick={() => setSkillMenuOpen((open) => !open)}
                    className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                    aria-expanded={skillMenuOpen ? 'true' : 'false'}
                    aria-haspopup="menu"
                  >
                    •••
                  </button>
                  {skillMenuOpen ? (
                    <div className="absolute right-0 mt-2 w-44 rounded-xl border border-gray-200 bg-white p-1.5 shadow-lg z-10" role="menu">
                      <button
                        type="button"
                        onClick={() => {
                          setSkillMenuOpen(false)
                          setRenamingSkill(skillName)
                        }}
                        className="w-full text-left rounded-lg px-2.5 py-2 text-xs text-gray-700 hover:bg-gray-50"
                        role="menuitem"
                      >
                        Rename skill
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="space-y-3">
                {skillSessions.map((session) => (
                  <SessionListItem
                    key={session.id}
                    session={session}
                    onOpen={() => onOpenSession?.(session, { view: 'skill', sessionId: null, seriesName: skillName })}
                    minimal
                  />
                ))}
              </div>
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
        )}
      </div>
    </div>
  )
}

export default SkillView
