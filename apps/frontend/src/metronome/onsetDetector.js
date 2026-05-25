import { createOnsetDetectorState, detectOnsetInBuffer } from './onsetDetectorCore.js'

export function createOnsetDetector(analyser) {
  const buffer = new Float32Array(analyser.fftSize)
  const sampleRate = analyser.context?.sampleRate || 48000
  const state = createOnsetDetectorState()

  const tick = (audioTime) => {
    analyser.getFloatTimeDomainData(buffer)
    return detectOnsetInBuffer(buffer, audioTime, state, sampleRate)
  }

  const reset = () => {
    state.envelope = 0
    state.lastPeak = 0
    state.lastHitAt = -1
    state.noiseFloor = 0.015
  }

  return { tick, reset, state, sampleRate }
}
