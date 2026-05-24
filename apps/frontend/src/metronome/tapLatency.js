/** Estimate how late mic onset detection runs vs the moment you hit. */
export function estimateTapLatencyMs(audioContext, fftSize = 256, { speakerPractice = false } = {}) {
  if (!audioContext) return speakerPractice ? 100 : 45

  const sampleRate = audioContext.sampleRate || 48000
  const bufferMs = (Math.max(256, Number(fftSize) || 256) / sampleRate) * 1000
  const rafMs = 8
  const inputMs = Math.max(0, Number(audioContext.baseLatency) || 0) * 1000
  const outputMs = Math.max(0, Number(audioContext.outputLatency) || 0) * 1000
  const speakerExtra = speakerPractice ? outputMs + 65 : 0

  return Math.round(
    Math.min(175, Math.max(28, bufferMs * 0.55 + rafMs + inputMs * 0.3 + speakerExtra)),
  )
}

/** Shift note highway so beats reach the line when you hear the speaker click. */
export function speakerVisualLagSeconds(audioContext, speakerPractice) {
  if (!speakerPractice || !audioContext) return 0
  return Math.max(0, Number(audioContext.outputLatency) || 0)
}
