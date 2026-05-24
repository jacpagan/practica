import React from 'react'
import { computeTimingStats } from '../metronome/timingScore'
import { parseTimingMetadata } from '../metronome/timingMetadata'

export default function TimingScoreSummary({ timingMetadata, compact = false }) {
  const meta = parseTimingMetadata(timingMetadata)
  if (!meta?.hits?.length && !meta?.encouragement) return null

  const stats = computeTimingStats(
    (meta.hits || []).map((hit) => ({
      tier: hit.tier,
      deltaMs: hit.delta_ms,
    })),
  )
  const landed = stats.landed || stats.perfect + stats.good
  const encouragement = meta.encouragement || stats.encouragement

  if (!encouragement && !landed) return null

  if (compact) {
    return (
      <div className="rounded-xl bg-white/10 px-3 py-2 text-xs text-white/85 backdrop-blur-sm border border-white/15">
        {encouragement || 'Nice take'}
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-white/15 bg-white/8 backdrop-blur-sm px-4 py-4 space-y-2">
      <p className="text-[11px] uppercase tracking-wide text-white/45">After this take</p>
      <p className="text-base leading-relaxed text-white/90">{encouragement}</p>
      {landed > 0 ? (
        <p className="text-xs text-white/50">You met the beat {landed} {landed === 1 ? 'time' : 'times'}. Every one counts.</p>
      ) : null}
    </div>
  )
}
