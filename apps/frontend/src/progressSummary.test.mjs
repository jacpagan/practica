import assert from 'node:assert/strict'
import test from 'node:test'

globalThis.window = {
  location: { hostname: 'localhost' },
}

const { buildPracticeProgressInsight, buildProgressShareText, buildProofShareText, buildSkillShareText, calculatePracticeProgress } = await import('./utils.js')

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
  assert.equal(summary.proofsLast7Days, 2)
  assert.deepEqual(summary.skillProofCounts, [{ skillName: 'Drums', count: 2 }])
})

test('calculatePracticeProgress stays false when there is no proof today', () => {
  const twoDaysAgo = new Date()
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)

  const summary = calculatePracticeProgress([
    { practice_series: 'Piano', recorded_at: twoDaysAgo.toISOString() },
  ])

  assert.equal(summary.proofRecordedToday, false)
  assert.equal(summary.latestProofAt, twoDaysAgo.toISOString())
  assert.equal(summary.proofsLast7Days, 1)
})

test('calculatePracticeProgress sorts skill proof counts without streak scoring', () => {
  const today = new Date()
  const summary = calculatePracticeProgress([
    { practice_series: 'Guitar', recorded_at: today.toISOString() },
    { practice_series: 'Drums', recorded_at: today.toISOString() },
    { practice_series: 'Drums', recorded_at: today.toISOString() },
  ])

  assert.deepEqual(summary.skillProofCounts, [
    { skillName: 'Drums', count: 2 },
    { skillName: 'Guitar', count: 1 },
  ])
})

test('calculatePracticeProgress explains broad skill rotation as signal', () => {
  const today = new Date()
  const summary = calculatePracticeProgress([
    { practice_series: 'Drums', recorded_at: today.toISOString() },
    { practice_series: 'Guitar', recorded_at: today.toISOString() },
    { practice_series: 'Piano', recorded_at: today.toISOString() },
  ])

  assert.equal(summary.skillCount, 3)
  assert.equal(summary.progressInsight.label, 'Wide skill mix')
  assert.match(summary.progressInsight.detail, /rotation across interests/)
})

test('buildPracticeProgressInsight prioritizes untagged proofs when signal quality is low', () => {
  const insight = buildPracticeProgressInsight({
    proofCount: 4,
    taggedProofCount: 1,
    untaggedProofCount: 3,
    skillCount: 1,
    topSkill: { skillName: 'Drums', count: 1 },
    topSkillShare: 1,
  })

  assert.equal(insight.label, 'Improve the signal')
  assert.match(insight.detail, /3 proofs are untagged/)
})

test('buildProgressShareText summarizes progress without exposing private media', () => {
  const text = buildProgressShareText({
    overview: {
      proofCount: 12,
      uniqueDayCount: 5,
      proofsLast7Days: 3,
      activeSkill: 'Hack Squat',
    },
    session: { practice_series: 'Hack Squat', video: '/private/proof.mp4' },
  })

  assert.match(text, /Logged a proof for Hack Squat/)
  assert.match(text, /12 proofs across 5 proof days/)
  assert.match(text, /3 proofs in the last 7 days/)
  assert.match(text, /private video proof/)
  assert.doesNotMatch(text, /private\/proof\.mp4/)
})

test('buildSkillShareText summarizes a skill without exposing proof media', () => {
  const text = buildSkillShareText({
    skillName: 'Hack Squat',
    proofCount: 14,
    proofDays: 6,
    latestProofAt: '2026-07-10T12:00:00Z',
  })

  assert.match(text, /Hack Squat: 14 proofs across 6 proof days/)
  assert.match(text, /Latest proof:/)
  assert.match(text, /private video proof/)
  assert.doesNotMatch(text, /mp4|media|processed/)
})

test('buildProofShareText summarizes one proof without exposing private media', () => {
  const text = buildProofShareText({
    session: {
      title: 'Top set',
      practice_series: 'Hack Squat',
      recorded_at: '2026-07-10T12:00:00Z',
      video_file: '/media/private/proof.mp4',
    },
  })

  assert.match(text, /Logged "Top set" for Hack Squat/)
  assert.match(text, /private video proof/)
  assert.doesNotMatch(text, /media\/private|proof\.mp4/)
})
