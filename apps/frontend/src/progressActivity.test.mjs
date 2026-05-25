import assert from 'node:assert/strict'
import test from 'node:test'

import { buildActivityWeeks, buildProofCountByDay, buildSkillSummaries } from './progressActivity.js'

test('buildProofCountByDay aggregates proofs per local day', () => {
  const sessions = [
    { recorded_at: '2099-06-01T10:00:00' },
    { recorded_at: '2099-06-01T18:00:00' },
    { recorded_at: '2099-06-02T10:00:00' },
  ]
  const counts = buildProofCountByDay(sessions)
  assert.equal(counts.get('2099-06-01'), 2)
  assert.equal(counts.get('2099-06-02'), 1)
})

test('buildSkillSummaries sorts skills by latest proof and keeps ungrouped last', () => {
  const sessions = [
    { practice_series: 'Drums', recorded_at: '2099-01-02T10:00:00' },
    { practice_series: 'Floss', recorded_at: '2099-01-03T10:00:00' },
    { practice_series: '', recorded_at: '2099-01-01T10:00:00' },
  ]
  const summaries = buildSkillSummaries(sessions)
  assert.equal(summaries[0].skillName, 'Floss')
  assert.equal(summaries[summaries.length - 1].isUngrouped, true)
})

test('buildActivityWeeks returns fixed week columns', () => {
  const weeks = buildActivityWeeks([{ recorded_at: '2099-06-01T10:00:00' }], 4)
  assert.equal(weeks.length, 4)
  assert.equal(weeks[0].length, 7)
})
