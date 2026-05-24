/** Estimate how late mic onset detection runs vs the moment you tap/clap. */
export function estimateTapLatencyMs(audioContext, fftSize = 512) {
  if (!audioContext) return 48

  const sampleRate = audioContext.sampleRate || 48000
  const bufferMs = (Math.max(256, Number(fftSize) || 512) / sampleRate) * 1000
  const rafMs = 10
  const inputMs = Math.max(0, Number(audioContext.baseLatency) || 0) * 1000

  // Peaks are detected on the next animation frame; the analyser window adds
  // another ~half-buffer of group delay before we backdate the attack.
  return Math.round(Math.min(110, Math.max(32, bufferMs * 0.65 + rafMs + inputMs * 0.35)))
}
