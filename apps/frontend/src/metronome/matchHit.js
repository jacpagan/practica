import { GOOD_MS, PERFECT_MS } from './constants'

export function matchOnsetToBeat({ onsetTime, epoch, period, beatsPerBar }) {
  const t = Number(onsetTime) - Number(epoch)
  if (!Number.isFinite(t) || t < 0 || !Number.isFinite(period) || period <= 0) return null

  const nearestBeat = Math.round(t / period)
  const beatTime = Number(epoch) + nearestBeat * period
  const deltaMs = Math.round((Number(onsetTime) - beatTime) * 1000)
  const abs = Math.abs(deltaMs)
  const tier = abs <= PERFECT_MS ? 'perfect' : abs <= GOOD_MS ? 'good' : 'off'

  return {
    beatIndex: nearestBeat,
    beatInBar: ((nearestBeat % beatsPerBar) + beatsPerBar) % beatsPerBar,
    deltaMs,
    tier,
  }
}
