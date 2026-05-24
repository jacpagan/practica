import { MAX_TIMING_HITS, TIMING_METADATA_VERSION } from './constants'
import { computeTimingStats } from './timingScore'

export function summarizeTimingHits(hits = []) {
  const summary = { on_beat: 0, close: 0, off: 0 }
  hits.forEach((hit) => {
    if (hit.tier === 'perfect') summary.on_beat += 1
    else if (hit.tier === 'good') summary.close += 1
    else summary.off += 1
  })
  return summary
}

export function buildTimingMetadata({
  bpm,
  beatsPerBar,
  syncOffsetMs,
  hits,
  metronomeEnabled,
}) {
  if (!metronomeEnabled) return null
  const trimmed = (hits || []).slice(0, MAX_TIMING_HITS).map((hit) => ({
    t: Number(hit.t),
    delta_ms: hit.deltaMs,
    tier: hit.tier,
    beat: hit.beatIndex,
  })).filter((hit) => Number.isFinite(hit.t))

  const stats = computeTimingStats(trimmed.map((hit) => ({
    tier: hit.tier,
    deltaMs: hit.delta_ms,
  })))

  return {
    version: TIMING_METADATA_VERSION,
    bpm: Number(bpm),
    beats_per_bar: Number(beatsPerBar) || 4,
    sync_offset_ms: Number(syncOffsetMs) || 0,
    hits: trimmed,
    summary: summarizeTimingHits(trimmed),
    score: stats.score,
    grade: stats.grade,
    max_streak: stats.maxStreak,
  }
}

export function parseTimingMetadata(raw) {
  if (!raw) return null
  if (typeof raw === 'object') return raw
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  }
  return null
}
