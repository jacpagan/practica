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
      streak = 0
    } else {
      off += 1
      streak = 0
    }
  })

  const total = perfect + good + off
  let score = null
  if (total > 0) {
    const weighted = perfect * 100 + good * 60 + off * 0
    score = Math.round(weighted / total)
  }

  const grade = score == null ? ''
    : score >= 92 ? 'A'
      : score >= 80 ? 'B'
        : score >= 65 ? 'C'
          : score >= 50 ? 'D'
            : 'F'

  return {
    perfect,
    good,
    off,
    total,
    streak,
    maxStreak,
    score,
    grade,
    accuracyLabel: total > 0 ? `${score}%` : '—',
  }
}

export function puckOffsetPx(deltaMs) {
  const ms = Number(deltaMs) || 0
  const clamped = Math.max(-GOOD_MS, Math.min(GOOD_MS, ms))
  return (clamped / GOOD_MS) * 22
}

export function tierColor(tier) {
  if (tier === 'perfect') return 'emerald'
  if (tier === 'good') return 'amber'
  if (tier === 'off') return 'red'
  return 'white'
}

export { PERFECT_MS, GOOD_MS }
