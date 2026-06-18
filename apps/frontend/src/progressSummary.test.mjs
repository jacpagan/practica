import assert from 'node:assert/strict'
import test from 'node:test'

globalThis.window = {
  location: { hostname: 'localhost' },
}

const { calculatePracticeProgress } = await import('./utils.js')

test('calculatePracticeProgress marks when a proof was recorded today', () => {
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)

  const summary = calculatePracticeProgress([
    { practice_series: 'Drums', recorded_at: today.toISOString() },
    { practice_series: 'Drums', recorded_at: yesterday.toISOString() },
  ])

  assert.equal(summary.proofRecordedToday, true)
  assert.equal(summary.proofCount, 2)
  assert.equal(summary.uniqueDayCount, 2)
  assert.equal(summary.activeSkill, 'Drums')
})

test('calculatePracticeProgress stays false when there is no proof today', () => {
  const twoDaysAgo = new Date()
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)

  const summary = calculatePracticeProgress([
    { practice_series: 'Piano', recorded_at: twoDaysAgo.toISOString() },
  ])

  assert.equal(summary.proofRecordedToday, false)
  assert.equal(summary.latestProofAt, twoDaysAgo.toISOString())
})
