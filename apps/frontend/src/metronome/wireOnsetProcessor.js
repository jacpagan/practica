import { ONSET_ANALYSER_FFT, ONSET_REFRACTORY_S } from './constants.js'
import { createOnsetDetectorState, detectOnsetInBuffer } from './onsetDetectorCore.js'

/**
 * Run onset detection on the audio thread (ScriptProcessor) so hits are not
 * delayed by requestAnimationFrame.
 */
export function wireOnsetProcessor(audioContext, micGainNode, onOnset) {
  if (!audioContext || !micGainNode || typeof onOnset !== 'function') return null
  if (typeof audioContext.createScriptProcessor !== 'function') return null

  const bufferSize = ONSET_ANALYSER_FFT
  const state = createOnsetDetectorState()
  const sampleRate = audioContext.sampleRate || 48000
  const processor = audioContext.createScriptProcessor(bufferSize, 1, 1)

  processor.onaudioprocess = (event) => {
    const input = event.inputBuffer.getChannelData(0)
    const onset = detectOnsetInBuffer(input, audioContext.currentTime, state, sampleRate)
    if (onset) onOnset(onset)
    const output = event.outputBuffer.getChannelData(0)
    output.set(input)
  }

  micGainNode.connect(processor)

  const reset = () => {
    state.envelope = 0
    state.lastPeak = 0
    state.lastHitAt = -ONSET_REFRACTORY_S
    state.noiseFloor = 0.015
  }

  return { processor, reset }
}
