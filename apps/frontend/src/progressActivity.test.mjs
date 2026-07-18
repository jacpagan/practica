import assert from 'node:assert/strict'
import test from 'node:test'

import { buildActivityWeeks, buildDrillSummaries, buildLatestSkillComparison, buildProofCountByDay, buildRecommendedNextSkill, buildSkillSummaries, buildTodayLoopState } from './progressActivity.js'

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
  assert.equal(summaries[0].proofDayCount, 1)
})

test('buildActivityWeeks returns fixed week columns', () => {
  const weeks = buildActivityWeeks([{ recorded_at: '2099-06-01T10:00:00' }], 4)
  assert.equal(weeks.length, 4)
  assert.equal(weeks[0].length, 7)
})

test('buildRecommendedNextSkill selects the most recent tagged skill', () => {
  const recommended = buildRecommendedNextSkill([
    { practice_series: 'Guitar', recorded_at: '2099-01-01T09:00:00Z' },
    { practice_series: '', recorded_at: '2099-01-04T09:00:00Z' },
    { practice_series: 'Drumming', recorded_at: '2099-01-03T09:00:00Z' },
    { practice_series: 'Drumming', recorded_at: '2099-01-02T09:00:00Z' },
  ])

  assert.equal(recommended.skillName, 'Drumming')
  assert.equal(recommended.proofCount, 2)
  assert.equal(recommended.proofDayCount, 2)
})

test('buildLatestSkillComparison returns latest and previous proofs with days apart', () => {
  const comparison = buildLatestSkillComparison([
    { id: 1, recorded_at: '2099-01-01T09:00:00Z' },
    { id: 2, recorded_at: '2099-01-04T09:00:00Z' },
    { id: 3, recorded_at: '2099-01-03T09:00:00Z' },
  ])

  assert.equal(comparison.hasComparison, true)
  assert.equal(comparison.latest.id, 2)
  assert.equal(comparison.previous.id, 3)
  assert.equal(comparison.daysApart, 1)
})

test('buildLatestSkillComparison handles a first proof without comparison', () => {
  const comparison = buildLatestSkillComparison([
    { id: 1, recorded_at: '2099-01-01T09:00:00Z' },
  ])

  assert.equal(comparison.hasComparison, false)
  assert.equal(comparison.latest.id, 1)
  assert.equal(comparison.previous, null)
})

test('buildDrillSummaries returns best proof per drill', () => {
  const summaries = buildDrillSummaries([
    {
      id: 1,
      recorded_at: '2099-01-01T09:00:00Z',
      proof_result: { drill_name: '120 single stroke rolls', metric_name: 'clean reps', value: '72.00', unit: 'reps', ranking_direction: 'higher' },
    },
    {
      id: 2,
      recorded_at: '2099-01-02T09:00:00Z',
      proof_result: { drill_name: '120 single stroke rolls', metric_name: 'clean reps', value: '84.00', unit: 'reps', ranking_direction: 'higher' },
    },
    {
      id: 3,
      recorded_at: '2099-01-03T09:00:00Z',
      proof_result: { drill_name: 'incline pushups', metric_name: 'time', value: '41.00', unit: 'seconds', ranking_direction: 'lower' },
    },
    {
      id: 4,
      recorded_at: '2099-01-04T09:00:00Z',
      proof_result: { drill_name: 'incline pushups', metric_name: 'time', value: '38.00', unit: 'seconds', ranking_direction: 'lower' },
    },
  ])

  assert.equal(summaries.length, 2)
  assert.equal(summaries[0].drillName, 'incline pushups')
  assert.equal(summaries[0].best.id, 4)
  assert.equal(summaries[1].drillName, '120 single stroke rolls')
  assert.equal(summaries[1].best.id, 2)
  assert.equal(summaries[1].proofCount, 2)
})

test('buildTodayLoopState describes the empty first-proof state', () => {
  const state = buildTodayLoopState([], new Date('2099-01-03T12:00:00'))

  assert.equal(state.status, 'empty')
  assert.equal(state.proofRecordedToday, false)
  assert.equal(state.totalProofCount, 0)
  assert.equal(state.nextSkillName, '')
})

test('buildTodayLoopState points back to the latest skill when no proof exists today', () => {
  const state = buildTodayLoopState([
    { id: 1, practice_series: 'Breathing', recorded_at: '2099-01-01T09:00:00' },
    { id: 2, practice_series: 'Drumming', recorded_at: '2099-01-02T09:00:00' },
  ], new Date('2099-01-03T12:00:00'))

  assert.equal(state.status, 'ready_today')
  assert.equal(state.proofRecordedToday, false)
  assert.equal(state.nextSkillName, 'Drumming')
  assert.equal(state.proofDayCount, 2)
})

test('buildTodayLoopState marks today complete without adding streak pressure', () => {
  const state = buildTodayLoopState([
    { id: 1, practice_series: 'Breathing', recorded_at: '2099-01-02T09:00:00' },
    { id: 2, practice_series: 'Breathing', recorded_at: '2099-01-03T09:00:00' },
  ], new Date('2099-01-03T12:00:00'))

  assert.equal(state.status, 'done_today')
  assert.equal(state.proofRecordedToday, true)
  assert.equal(state.todayProofCount, 1)
  assert.equal(state.nextSkillName, 'Breathing')
})
