import React, { useEffect, useMemo, useRef, useState } from 'react'
import { parseTimingMetadata } from '../metronome/timingMetadata'
import TimingScoreSummary from './TimingScoreSummary'

const tierClass = {
  perfect: 'bg-emerald-400',
  good: 'bg-amber-400',
  off: 'bg-white/40',
}

export default function TimingPlaybackOverlay({ timingMetadata, videoRef, durationSeconds }) {
  const meta = useMemo(() => parseTimingMetadata(timingMetadata), [timingMetadata])
  const hits = meta?.hits || []
  const [playbackFlash, setPlaybackFlash] = useState(null)
  const firedRef = useRef(new Set())

  useEffect(() => {
    firedRef.current = new Set()
    setPlaybackFlash(null)
  }, [meta, videoRef])

  useEffect(() => {
    const video = videoRef?.current
    if (!video || !hits.length) return undefined

    const onTimeUpdate = () => {
      const t = Number(video.currentTime)
      if (!Number.isFinite(t)) return
      hits.forEach((hit, index) => {
        const key = `${index}:${hit.t}`
        if (firedRef.current.has(key)) return
        if (Math.abs(t - Number(hit.t)) > 0.08) return
        firedRef.current.add(key)
        if (hit.tier === 'perfect' || hit.tier === 'good') {
          setPlaybackFlash({ tier: hit.tier, deltaMs: hit.delta_ms, at: performance.now() })
          window.setTimeout(() => setPlaybackFlash(null), 420)
        }
      })
    }

    video.addEventListener('timeupdate', onTimeUpdate)
    return () => video.removeEventListener('timeupdate', onTimeUpdate)
  }, [hits, videoRef])

  if (!meta) return null

  const duration = Number(durationSeconds) > 0
    ? Number(durationSeconds)
    : Number(videoRef?.current?.duration) || 0
  const summary = meta.summary || {}

  return (
    <div className="pointer-events-none absolute inset-0 z-[12]">
      {duration > 0 && hits.length ? (
        <div className="absolute inset-x-4 bottom-[max(5.5rem,env(safe-area-inset-bottom))] flex h-1.5 overflow-hidden rounded-full bg-white/15">
          {hits.map((hit, index) => {
            const left = Math.min(100, Math.max(0, (Number(hit.t) / duration) * 100))
            return (
              <span
                key={`${index}-${hit.t}`}
                className={`absolute top-0 h-full w-1 rounded-full ${tierClass[hit.tier] || tierClass.off}`}
                style={{ left: `calc(${left}% - 2px)` }}
              />
            )
          })}
        </div>
      ) : null}
      {meta.score != null ? (
        <div className="absolute top-[max(3.5rem,env(safe-area-inset-top))] right-4 max-w-[200px]">
          <TimingScoreSummary timingMetadata={meta} compact />
        </div>
      ) : (summary.on_beat || summary.close) ? (
        <div className="absolute top-[max(3.5rem,env(safe-area-inset-top))] right-4 rounded-full bg-black/50 px-3 py-1.5 text-[11px] text-white/85 backdrop-blur">
          {summary.on_beat || 0} on beat · {summary.close || 0} close
        </div>
      ) : null}
      {playbackFlash ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className={`w-24 h-24 rounded-full border-2 animate-hit-burst ${
              playbackFlash.tier === 'perfect'
                ? 'border-emerald-300/90 bg-emerald-400/20'
                : 'border-amber-300/90 bg-amber-400/15'
            }`}
          />
          <p className={`relative text-sm font-semibold ${playbackFlash.tier === 'perfect' ? 'text-emerald-200' : 'text-amber-100'}`}>
            {playbackFlash.tier === 'perfect' ? 'On beat' : `${playbackFlash.deltaMs > 0 ? '+' : ''}${playbackFlash.deltaMs} ms`}
          </p>
        </div>
      ) : null}
      <style>{`
        @keyframes hit-burst-keyframes {
          0% { transform: scale(0.35); opacity: 0.95; }
          100% { transform: scale(1.65); opacity: 0; }
        }
        .animate-hit-burst { animation: hit-burst-keyframes 420ms ease-out forwards; }
      `}</style>
    </div>
  )
}
