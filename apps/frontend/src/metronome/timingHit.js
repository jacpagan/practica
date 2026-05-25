import { GOOD_MS, PERFECT_MS, SPEAKER_CLICK_BLEED_MS } from './constants.js'
import { matchOnsetToBeat } from './matchHit.js'
import { estimateTapLatencyMs } from './tapLatency.js'

/** Reject metronome click bleed; keep loud on-beat drum hits in the same window. */
export function shouldRejectClickBleed({ onsetTime, strength }, lastClick, speakerPractice) {
  if (!lastClick || lastClick.gain <= 0.02) return false
  const msSinceClick = (Number(onsetTime) - lastClick.audioTime) * 1000
  const bleedMs = speakerPractice ? SPEAKER_CLICK_BLEED_MS : 50
  if (msSinceClick < 0 || msSinceClick > bleedMs) return false
  const minDrumStrength = Math.max(0.12, lastClick.gain * (speakerPractice ? 2.6 : 1.75))
  return strength < minDrumStrength
}

export function resolveTimingHit({
  hit,
  epoch,
  period,
  beatsPerBar,
  speakerPractice,
  syncOffsetMs,
  audioContext,
  analyserFftSize,
  visualLagSeconds = 0,
}) {
  const detectionMs = estimateTapLatencyMs(audioContext, analyserFftSize, { speakerPractice })
  const visualMs = Math.max(0, Number(visualLagSeconds) || 0) * 1000
  const latencyCompensationMs = detectionMs + visualMs + (Number(syncOffsetMs) || 0)

  const match = matchOnsetToBeat({
    onsetTime: hit.onsetTime,
    epoch,
    period,
    beatsPerBar,
    latencyCompensationMs,
  })
  if (!match) return null

  return { match, latencyCompensationMs }
}

export function isAcceptableTier(tier) {
  return tier === 'perfect' || tier === 'good'
}

export function tierFromDeltaMs(deltaMs) {
  const abs = Math.abs(Number(deltaMs) || 0)
  if (abs <= PERFECT_MS) return 'perfect'
  if (abs <= GOOD_MS) return 'good'
  return 'off'
}
