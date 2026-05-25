import assert from 'node:assert/strict'
import test from 'node:test'

import {
  countCompletedToday,
  firstIncompleteSkill,
  hasProofTodayForSkill,
  toLocalDateKey,
} from './dailyStack.js'

test('hasProofTodayForSkill matches case-insensitive skill names', () => {
  const today = toLocalDateKey(new Date('2099-06-01T12:00:00'))
  const sessions = [{
    practice_series: 'Drumming',
    recorded_at: '2099-06-01T08:00:00Z',
  }]
  assert.equal(hasProofTodayForSkill(sessions, 'drumming', today), true)
  assert.equal(hasProofTodayForSkill(sessions, 'Flossing', today), false)
})

test('firstIncompleteSkill returns first stack item without proof today', () => {
  const today = toLocalDateKey(new Date('2099-06-01T12:00:00'))
  const stack = ['Brushing teeth', 'Drumming', 'Flossing']
  const sessions = [{
    practice_series: 'Brushing teeth',
    recorded_at: '2099-06-01T08:00:00Z',
  }]
  assert.equal(firstIncompleteSkill(stack, sessions, today), 'Drumming')
  assert.equal(countCompletedToday(stack, sessions, today), 1)
})
