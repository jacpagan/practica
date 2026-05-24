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
  const score = meta.score ?? stats.score
  if (score == null && stats.total === 0) return null

  const grade = meta.grade || stats.grade

  if (compact) {
    return (
      <div className="rounded-xl bg-black/55 px-3 py-2 text-xs text-white/90 backdrop-blur border border-white/10">
        <span className="font-semibold text-white">{score}</span>
        <span className="text-white/60"> timing · </span>
        <span>{stats.perfect} on beat</span>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-white/15 bg-black/60 backdrop-blur px-4 py-3 space-y-2">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-white/55">Timing score</p>
          <p className="text-3xl font-semibold text-white tabular-nums">{score}</p>
        </div>
        {grade ? (
          <div className="rounded-xl bg-white/10 px-3 py-2 text-center">
            <p className="text-[10px] uppercase tracking-wide text-white/50">Grade</p>
            <p className="text-xl font-bold text-white">{grade}</p>
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-white/75">
        <span><span className="text-emerald-300 font-medium">{stats.perfect}</span> on beat</span>
        <span><span className="text-amber-300 font-medium">{stats.good}</span> close</span>
        {stats.off > 0 ? (
          <span><span className="text-red-300 font-medium">{stats.off}</span> off</span>
        ) : null}
        {stats.maxStreak > 1 ? (
          <span>Best streak <span className="text-white font-medium">{stats.maxStreak}</span></span>
        ) : null}
      </div>
      {meta.bpm ? (
        <p className="text-[11px] text-white/45">{meta.bpm} BPM · {meta.beats_per_bar || 4}/4</p>
      ) : null}
    </div>
  )
}
