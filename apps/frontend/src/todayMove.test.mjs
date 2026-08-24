import test from 'node:test'
import assert from 'node:assert/strict'
import { MOBILITY_MOVES, MOBILITY_PROGRAM_NAME, getProgramMove, getTodayMove, localDateStamp, mobilityPracticeDraft } from './todayMove.js'

test('today move is deterministic for the same local calendar day', () => {
  const morning = getTodayMove(new Date(2026, 7, 22, 8, 0))
  const evening = getTodayMove(new Date(2026, 7, 22, 22, 0))
  assert.equal(morning.slug, evening.slug)
})

test('today move advances on the following day', () => {
  const today = getTodayMove(new Date(2026, 7, 22, 12, 0))
  const tomorrow = getTodayMove(new Date(2026, 7, 23, 12, 0))
  const currentIndex = MOBILITY_MOVES.findIndex((move) => move.slug === today.slug)
  assert.equal(tomorrow.slug, MOBILITY_MOVES[(currentIndex + 1) % MOBILITY_MOVES.length].slug)
})

test('mobility draft groups the program while preserving the daily prompt', () => {
  assert.deepEqual(mobilityPracticeDraft({ title: 'Cat–cow' }), {
    skillName: MOBILITY_PROGRAM_NAME,
    practicePrompt: 'Cat–cow',
  })
})

test('a new program starts on day one and advances with the member', () => {
  const start = new Date(2026, 7, 22, 12, 0)
  assert.equal(getProgramMove('2026-08-22', start).dayNumber, 1)
  assert.equal(getProgramMove('2026-08-22', new Date(2026, 7, 23, 12, 0)).dayNumber, 2)
  assert.equal(localDateStamp(start), '2026-08-22')
})
