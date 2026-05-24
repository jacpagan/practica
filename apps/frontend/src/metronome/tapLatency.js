/** Estimate how late mic onset detection runs vs the moment you tap/clap. */
export function estimateTapLatencyMs(audioContext, fftSize = 512, { speakerPractice = false } = {}) {
  if (!audioContext) return speakerPractice ? 95 : 48

  const sampleRate = audioContext.sampleRate || 48000
  const bufferMs = (Math.max(256, Number(fftSize) || 512) / sampleRate) * 1000
  const rafMs = 10
  const inputMs = Math.max(0, Number(audioContext.baseLatency) || 0) * 1000
  const outputMs = Math.max(0, Number(audioContext.outputLatency) || 0) * 1000
  // Without headphones the speaker click reaches the mic after output latency;
  // drumming on top of that grid still needs extra shift vs the visual line.
  const speakerExtra = speakerPractice ? outputMs + 55 : 0

  return Math.round(
    Math.min(165, Math.max(32, bufferMs * 0.65 + rafMs + inputMs * 0.35 + speakerExtra)),
  )
}

/** Screen touch maps directly to the audio clock — no analyser delay. */
export const screenTapLatencyMs = () => 0
