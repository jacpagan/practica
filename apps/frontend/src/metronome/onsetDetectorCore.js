import { ONSET_REFRACTORY_S } from './constants.js'

export function createOnsetDetectorState() {
  return {
    envelope: 0,
    lastPeak: 0,
    lastHitAt: -ONSET_REFRACTORY_S,
    noiseFloor: 0.015,
  }
}

/**
 * Scan one time-domain buffer; audioTimeAtEnd is the clock time of the last sample.
 * Returns { onsetTime, strength } or null.
 */
export function detectOnsetInBuffer(buffer, audioTimeAtEnd, state, sampleRate = 48000) {
  const now = Number(audioTimeAtEnd)
  if (!Number.isFinite(now) || !buffer?.length) return null

  const sr = Number(sampleRate) || 48000
  let peak = 0
  let peakIdx = 0
  let sumSq = 0
  for (let i = 0; i < buffer.length; i += 1) {
    const v = buffer[i]
    const a = Math.abs(v)
    if (a > peak) {
      peak = a
      peakIdx = i
    }
    sumSq += v * v
  }
  const rms = Math.sqrt(sumSq / buffer.length)

  const attack = 0.55
  const release = 0.88
  state.envelope = peak > state.envelope
    ? attack * peak + (1 - attack) * state.envelope
    : release * state.envelope + (1 - release) * peak

  state.noiseFloor = Math.min(0.12, Math.max(0.01, state.noiseFloor * 0.985 + rms * 0.015))
  const hitThreshold = Math.max(0.035, state.noiseFloor * 2.8)
  const aboveFloor = peak > hitThreshold
  const rising = peak > state.lastPeak * 1.15 || state.envelope > hitThreshold * 1.35
  const strong = aboveFloor && (rising || peak > hitThreshold * 1.65)
  state.lastPeak = peak

  if (!strong || now - state.lastHitAt < ONSET_REFRACTORY_S) return null

  let onsetIdx = peakIdx
  for (let i = 0; i <= peakIdx; i += 1) {
    if (Math.abs(buffer[i]) >= hitThreshold) {
      onsetIdx = i
      break
    }
  }
  const samplesAgo = buffer.length - 1 - onsetIdx
  const onsetTime = now - samplesAgo / sr

  state.lastHitAt = now
  return { onsetTime, strength: peak }
}
