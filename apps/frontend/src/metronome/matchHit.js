import { GOOD_MS, PERFECT_MS } from './constants.js'

export function matchOnsetToBeat({
  onsetTime,
  epoch,
  period,
  beatsPerBar,
  latencyCompensationMs = 0,
}) {
  const compensatedOnset =
    Number(onsetTime) - (Number(latencyCompensationMs) || 0) / 1000
  const t = compensatedOnset - Number(epoch)
  if (!Number.isFinite(t) || t < 0 || !Number.isFinite(period) || period <= 0) return null

  const nearestBeat = Math.round(t / period)
  const beatTime = Number(epoch) + nearestBeat * period
  const deltaMs = Math.round((compensatedOnset - beatTime) * 1000)
  const abs = Math.abs(deltaMs)
  const tier = abs <= PERFECT_MS ? 'perfect' : abs <= GOOD_MS ? 'good' : 'off'

  return {
    beatIndex: nearestBeat,
    beatInBar: ((nearestBeat % beatsPerBar) + beatsPerBar) % beatsPerBar,
    deltaMs,
    tier,
  }
}
