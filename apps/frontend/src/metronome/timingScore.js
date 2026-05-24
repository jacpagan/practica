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
  let score = null
  if (landed > 0) {
    score = Math.round((perfect * 100 + good * 90) / landed)
  }

  const context = { perfect, good, landed, streak, maxStreak, score }

  return {
    perfect,
    good,
    off,
    landed,
    total: landed + off,
    streak,
    maxStreak,
    score,
    encouragement: getEncouragementMessage(context),
    liveCheer: getLiveCheer(context),
  }
}

export function getEncouragementMessage({ landed, streak, maxStreak }) {
  if (!landed) return 'You showed up — that already counts. Stay with the click when you are ready.'
  if (maxStreak >= 6 || streak >= 5) return 'Lovely flow. You and the beat are moving together.'
  if (landed >= 6) return 'A warm take. Plenty of moments where you met the pulse.'
  if (maxStreak >= 3) return 'You found a little groove there. That is worth keeping.'
  if (landed >= 2) return 'Gentle progress. Each tap with the beat is practice that sticks.'
  return 'Nice work starting. The habit grows one easy rep at a time.'
}

export function getLiveCheer({ landed, streak, maxStreak }) {
  if (streak >= 5) return 'Flowing together'
  if (streak >= 3) return 'Staying with the beat'
  if (landed >= 1 && landed <= 2) return 'There you go'
  if (landed > 2) return 'With the pulse'
  return ''
}

export function getHitLabel() {
  return 'With the beat'
}

export { PERFECT_MS, GOOD_MS }
