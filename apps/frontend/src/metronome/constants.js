export const MIN_BPM = 40
export const MAX_BPM = 240

export const clampBpm = (value) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 80
  return Math.max(MIN_BPM, Math.min(MAX_BPM, Math.round(parsed)))
}

export const beatPeriodSeconds = (bpm) => 60 / Math.max(30, Math.min(260, clampBpm(bpm)))
