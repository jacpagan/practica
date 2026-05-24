import { ONSET_REFRACTORY_S } from './constants'

export function createOnsetDetector(analyser) {
  const buffer = new Float32Array(analyser.fftSize)
  const sampleRate = analyser.context?.sampleRate || 48000
  let envelope = 0
  let lastPeak = 0
  let lastHitAt = -ONSET_REFRACTORY_S
  let noiseFloor = 0.015

  const tick = (audioTime) => {
    const now = Number(audioTime)
    if (!Number.isFinite(now)) return null

    analyser.getFloatTimeDomainData(buffer)
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

    const attack = 0.5
    const release = 0.9
    envelope = peak > envelope
      ? attack * peak + (1 - attack) * envelope
      : release * envelope + (1 - release) * peak

    noiseFloor = Math.min(0.12, Math.max(0.012, noiseFloor * 0.98 + rms * 0.02))
    const hitThreshold = Math.max(0.04, noiseFloor * 3)
    const aboveFloor = peak > hitThreshold
    const rising = peak > lastPeak * 1.2 || envelope > hitThreshold * 1.4
    const strong = aboveFloor && (rising || peak > hitThreshold * 1.8)
    lastPeak = peak

    if (!strong || now - lastHitAt < ONSET_REFRACTORY_S) return null

    // Backdate to the first sample in this window that crosses the hit threshold
    // (attack onset), not the peak — peaks arrive after you actually tap/clap.
    let onsetIdx = peakIdx
    for (let i = 0; i <= peakIdx; i += 1) {
      if (Math.abs(buffer[i]) >= hitThreshold) {
        onsetIdx = i
        break
      }
    }
    const samplesAgo = buffer.length - 1 - onsetIdx
    const onsetTime = now - samplesAgo / sampleRate

    lastHitAt = now
    return { onsetTime, strength: peak }
  }

  const reset = () => {
    envelope = 0
    lastPeak = 0
    lastHitAt = -ONSET_REFRACTORY_S
    noiseFloor = 0.015
  }

  return { tick, reset }
}
