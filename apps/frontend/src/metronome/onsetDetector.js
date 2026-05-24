import { ONSET_REFRACTORY_S } from './constants'

export function createOnsetDetector(analyser) {
  const buffer = new Float32Array(analyser.fftSize)
  let envelope = 0
  let lastPeak = 0
  let lastHitAt = -ONSET_REFRACTORY_S
  let noiseFloor = 0.015

  const tick = (audioTime) => {
    const now = Number(audioTime)
    if (!Number.isFinite(now)) return null

    analyser.getFloatTimeDomainData(buffer)
    let peak = 0
    let sumSq = 0
    for (let i = 0; i < buffer.length; i += 1) {
      const v = buffer[i]
      const a = Math.abs(v)
      if (a > peak) peak = a
      sumSq += v * v
    }
    const rms = Math.sqrt(sumSq / buffer.length)

    const attack = 0.5
    const release = 0.9
    envelope = peak > envelope
      ? attack * peak + (1 - attack) * envelope
      : release * envelope + (1 - release) * peak

    noiseFloor = Math.min(0.12, Math.max(0.012, noiseFloor * 0.98 + rms * 0.02))
    const aboveFloor = peak > Math.max(0.05, noiseFloor * 3.5)
    const rising = peak > lastPeak * 1.35
    const strong = aboveFloor && rising
    lastPeak = peak

    if (!strong || now - lastHitAt < ONSET_REFRACTORY_S) return null

    lastHitAt = now
    return { onsetTime: now, strength: peak }
  }

  const reset = () => {
    envelope = 0
    lastPeak = 0
    lastHitAt = -ONSET_REFRACTORY_S
    noiseFloor = 0.015
  }

  return { tick, reset }
}
