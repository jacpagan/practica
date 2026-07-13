import React, { useMemo, useState } from 'react'
import SkillField from './SkillField'
import {
  DEFAULT_FIRST_PROOF_SKILLS,
  canStartFirstProof,
  normalizeFirstProofSkill,
} from '../firstProofOnboarding'
import { reportClientEvent } from '../utils'

export default function FirstProofOnboarding({
  user = null,
  skillOptions = [],
  onStartFirstProof,
}) {
  const [skillDraft, setSkillDraft] = useState('')
  const suggestedSkills = useMemo(() => (
    Array.from(new Set([
      ...DEFAULT_FIRST_PROOF_SKILLS,
      ...(skillOptions || []),
    ].map((item) => String(item || '').trim()).filter(Boolean))).slice(0, 8)
  ), [skillOptions])

  const start = (value = skillDraft) => {
    const skillName = normalizeFirstProofSkill(value)
    if (!canStartFirstProof(skillName)) return
    reportClientEvent('first_proof_onboarding_started', {
      action: 'first_proof_onboarding_started',
      skill_name: skillName,
    })
    onStartFirstProof?.(skillName)
  }

  return (
    <div className="px-4 py-6 pb-28 sm:px-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">First proof</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-950">What are you practicing?</h1>
          <p className="mt-2 text-sm leading-6 text-gray-500">
            Pick one skill, record a short baseline, then come back with the next proof.
          </p>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {suggestedSkills.map((skill) => (
              <button
                key={skill}
                type="button"
                onClick={() => start(skill)}
                className="rounded-lg border border-gray-200 bg-white px-3 py-3 text-left text-sm font-medium text-gray-900 transition-colors hover:border-gray-900 hover:bg-gray-50"
              >
                {skill}
              </button>
            ))}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <label className="mb-2 block text-sm font-medium text-gray-900">Or type your own</label>
            <SkillField
              value={skillDraft}
              onChange={setSkillDraft}
              options={skillOptions}
              placeholder="Basketball shooting, Spanish, mobility..."
            />
            <button
              type="button"
              onClick={() => start()}
              disabled={!canStartFirstProof(skillDraft)}
              className="mt-4 w-full rounded-lg bg-gray-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Save first proof
            </button>
          </div>
        </div>

        <div className="grid gap-3 border-t border-gray-100 pt-5 text-sm text-gray-500 sm:grid-cols-3">
          <p><span className="font-medium text-gray-900">1.</span> Pick one skill.</p>
          <p><span className="font-medium text-gray-900">2.</span> Record a short proof.</p>
          <p><span className="font-medium text-gray-900">3.</span> Compare with the next one.</p>
        </div>

        {user?.username ? (
          <p className="text-xs text-gray-400">Signed in as {user.display_name || user.username}</p>
        ) : null}
      </div>
    </div>
  )
}
