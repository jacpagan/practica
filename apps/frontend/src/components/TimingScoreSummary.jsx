import React from 'react'
import { computeTimingStats } from '../metronome/timingScore'
import { parseTimingMetadata } from '../metronome/timingMetadata'

export default function TimingScoreSummary({ timingMetadata, compact = false }) {
  const meta = parseTimingMetadata(timingMetadata)
  if (!meta?.hits?.length && meta?.score == null) return null

  const stats = computeTimingStats(
    (meta.hits || []).map((hit) => ({
      tier: hit.tier,
      deltaMs: hit.delta_ms,
    })),
  )
  const landed = stats.landed || stats.perfect + stats.good
  if (!landed && stats.score == null) return null

  const encouragement = meta.encouragement || stats.encouragement

  if (compact) {
    return (
      <div className="rounded-xl bg-emerald-950/60 px-3 py-2 text-xs text-emerald-50 backdrop-blur border border-emerald-400/25">
        <span className="font-semibold">{landed} locked in</span>
        {stats.maxStreak > 1 ? <span className="text-emerald-200/80"> · best streak {stats.maxStreak}</span> : null}
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-emerald-400/25 bg-emerald-950/50 backdrop-blur px-4 py-3 space-y-3">
      <div>
        <p className="text-[11px] uppercase tracking-wide text-emerald-200/70">Your groove this take</p>
        <p className="mt-1 text-3xl font-semibold text-white tabular-nums">{landed}</p>
        <p className="text-sm text-emerald-100/90">on-beat moments</p>
      </div>
      {encouragement ? (
        <p className="text-sm leading-snug text-emerald-50/95">{encouragement}</p>
      ) : null}
      <div className="flex flex-wrap gap-3 text-xs text-emerald-100/85">
        {stats.perfect > 0 ? (
          <span><span className="font-semibold text-white">{stats.perfect}</span> locked in</span>
        ) : null}
        {stats.good > 0 ? (
          <span><span className="font-semibold text-white">{stats.good}</span> close (still counts)</span>
        ) : null}
        {stats.maxStreak > 1 ? (
          <span>Best streak <span className="font-semibold text-white">{stats.maxStreak}</span></span>
        ) : null}
      </div>
      {meta.bpm ? (
        <p className="text-[11px] text-emerald-200/50">{meta.bpm} BPM · {meta.beats_per_bar || 4}/4</p>
      ) : null}
    </div>
  )
}
