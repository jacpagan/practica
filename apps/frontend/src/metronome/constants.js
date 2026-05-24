export const TIMING_METADATA_VERSION = 2

export const MIN_BPM = 40
export const MAX_BPM = 240

export const PERFECT_MS = 25
export const GOOD_MS = 55
export const ONSET_REFRACTORY_S = 0.12
export const ONSET_ANALYSER_FFT = 512
export const MAX_TIMING_HITS = 200

export const clampBpm = (value) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 80
  return Math.max(MIN_BPM, Math.min(MAX_BPM, Math.round(parsed)))
}

export const beatPeriodSeconds = (bpm) => 60 / Math.max(30, Math.min(260, clampBpm(bpm)))
