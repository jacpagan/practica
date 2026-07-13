import assert from 'node:assert/strict'
import test from 'node:test'

import {
  DEFAULT_FIRST_PROOF_SKILLS,
  canStartFirstProof,
  normalizeFirstProofSkill,
} from './firstProofOnboarding.js'

test('first proof suggestions keep the first action concrete', () => {
  assert.ok(DEFAULT_FIRST_PROOF_SKILLS.includes('Pushups'))
  assert.ok(DEFAULT_FIRST_PROOF_SKILLS.includes('Guitar'))
  assert.ok(DEFAULT_FIRST_PROOF_SKILLS.length >= 6)
})

test('first proof skill normalization trims custom input', () => {
  assert.equal(normalizeFirstProofSkill('  Boxing footwork  '), 'Boxing footwork')
  assert.equal(canStartFirstProof('  '), false)
  assert.equal(canStartFirstProof('Pushups'), true)
})
