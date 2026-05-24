import { ONSET_REFRACTORY_S } from './constants'

export function createOnsetDetector(analyser) {
  const buffer = new Float32Array(analyser.fftSize)
  let envelope = 0
  let lastHitAt = -ONSET_REFRACTORY_S
  let noiseFloor = 0.02

  const tick = (audioTime) => {
    const now = Number(audioTime)
    if (!Number.isFinite(now)) return null

    analyser.getFloatTimeDomainData(buffer)
    let peak = 0
    for (let i = 0; i < buffer.length; i += 1) {
      const v = Math.abs(buffer[i])
      if (v > peak) peak = v
    }

    const attack = 0.4
    const release = 0.92
    envelope = peak > envelope
      ? attack * peak + (1 - attack) * envelope
      : release * envelope + (1 - release) * peak

    noiseFloor = Math.min(0.14, Math.max(0.02, noiseFloor * 0.995 + envelope * 0.005))
    const threshold = noiseFloor + 0.045
    const strong = peak > threshold * 1.35 && envelope > threshold

    if (!strong || now - lastHitAt < ONSET_REFRACTORY_S) return null

    lastHitAt = now
    return { onsetTime: now, strength: peak }
  }

  const reset = () => {
    envelope = 0
    lastHitAt = -ONSET_REFRACTORY_S
    noiseFloor = 0.02
  }

  return { tick, reset }
}
