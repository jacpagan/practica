/** Mic/analysis delay only — speaker visual lag is applied separately. */
export function estimateTapLatencyMs(audioContext, fftSize = 256, { speakerPractice = false } = {}) {
  if (!audioContext) return speakerPractice ? 38 : 32

  const sampleRate = audioContext.sampleRate || 48000
  const bufferMs = (Math.max(256, Number(fftSize) || 256) / sampleRate) * 1000
  const processorMs = 3
  const inputMs = Math.max(0, Number(audioContext.baseLatency) || 0) * 1000

  return Math.round(
    Math.min(90, Math.max(22, bufferMs * 0.45 + processorMs + inputMs * 0.25)),
  )
}

export function speakerVisualLagSeconds(audioContext, speakerPractice) {
  if (!speakerPractice || !audioContext) return 0
  return Math.max(0, Number(audioContext.outputLatency) || 0)
}
