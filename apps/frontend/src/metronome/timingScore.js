import { GOOD_MS, PERFECT_MS } from './constants'

export function computeTimingStats(hits = []) {
  const list = Array.isArray(hits) ? hits : []
  let perfect = 0
  let good = 0
  let off = 0
  let streak = 0
  let maxStreak = 0

  list.forEach((hit) => {
    const tier = hit.tier
    if (tier === 'perfect') {
      perfect += 1
      streak += 1
      if (streak > maxStreak) maxStreak = streak
    } else if (tier === 'good') {
      good += 1
      streak += 1
      if (streak > maxStreak) maxStreak = streak
    } else {
      off += 1
      streak = 0
    }
  })

  const landed = perfect + good
  const total = landed + off
  let score = null
  if (landed > 0) {
    const weighted = perfect * 100 + good * 85
    score = Math.round(weighted / landed)
  }

  return {
    perfect,
    good,
    off,
    landed,
    total,
    streak,
    maxStreak,
    score,
    encouragement: getEncouragementMessage({ perfect, good, landed, streak, maxStreak, score }),
    liveCheer: getLiveCheer({ perfect, good, landed, streak, maxStreak }),
  }
}

export function getEncouragementMessage({ perfect, good, landed, streak, maxStreak, score }) {
  if (!landed) return 'Stay with the click — every rep builds your groove.'
  if (maxStreak >= 8 || streak >= 6) return 'You are locked in. Keep that flow going.'
  if (perfect >= 8) return 'Beautiful rhythm. Those on-beat hits really landed.'
  if (maxStreak >= 4) return 'Nice streak. You are finding the pocket.'
  if (landed >= 6 && score != null && score >= 85) return 'Strong groove on this take.'
  if (good >= 3 && perfect >= 2) return 'Close hits count — your timing is tightening.'
  if (landed >= 3) return 'Good momentum. Ride the metronome and keep going.'
  return 'Great start. Each on-beat tap is proof you are building the habit.'
}

export function getLiveCheer({ perfect, good, landed, streak, maxStreak }) {
  if (streak >= 5) return `On fire · ${streak} in a row`
  if (streak >= 3) return `Streak ${streak}`
  if (landed > 0) return `${landed} locked in`
  return 'Ride the beat'
}

export function getHitLabel(tier, deltaMs) {
  if (tier === 'perfect') return 'Locked in!'
  if (tier === 'good') {
    const ms = Math.abs(Number(deltaMs) || 0)
    if (ms <= 12) return 'So close!'
    return 'Nice groove'
  }
  return ''
}

export function puckOffsetPx(deltaMs) {
  const ms = Number(deltaMs) || 0
  const clamped = Math.max(-GOOD_MS, Math.min(GOOD_MS, ms))
  return (clamped / GOOD_MS) * 18
}

export { PERFECT_MS, GOOD_MS }
