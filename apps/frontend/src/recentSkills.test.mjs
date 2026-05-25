import test from 'node:test'
import assert from 'node:assert/strict'

import { buildRecentSkills } from './recentSkills.js'

test('buildRecentSkills prefers stored recents then session activity order', () => {
  const sessions = [
    { practice_series: 'Drumming', recorded_at: '2099-01-03T09:00:00Z' },
    { practice_series: 'Breathing', recorded_at: '2099-01-03T08:45:00Z' },
    { practice_series: 'Drumming', recorded_at: '2099-01-02T09:00:00Z' },
    { practice_series: 'Guitar', recorded_at: '2099-01-01T09:00:00Z' },
  ]

  const recent = buildRecentSkills({
    sessions,
    limit: 5,
  })

  assert.deepEqual(recent.slice(0, 3), ['Drumming', 'Breathing', 'Guitar'])
})

test('buildRecentSkills skips empty skill names', () => {
  const recent = buildRecentSkills({
    sessions: [{ practice_series: '', recorded_at: '2099-01-01T09:00:00Z' }],
    limit: 5,
  })
  assert.equal(recent.length, 0)
})
