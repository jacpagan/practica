import React, { useEffect, useMemo, useRef, useState } from 'react'
import { parseTimingMetadata } from '../metronome/timingMetadata'
import TimingScoreSummary from './TimingScoreSummary'

export default function TimingPlaybackOverlay({ timingMetadata, videoRef, durationSeconds }) {
  const meta = useMemo(() => parseTimingMetadata(timingMetadata), [timingMetadata])
  const hits = (meta?.hits || []).filter((hit) => hit.tier === 'perfect' || hit.tier === 'good')
  const [playbackFlash, setPlaybackFlash] = useState(false)
  const firedRef = useRef(new Set())

  useEffect(() => {
    firedRef.current = new Set()
    setPlaybackFlash(false)
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
        setPlaybackFlash(true)
        window.setTimeout(() => setPlaybackFlash(false), 600)
      })
    }

    video.addEventListener('timeupdate', onTimeUpdate)
    return () => video.removeEventListener('timeupdate', onTimeUpdate)
  }, [hits, videoRef])

  if (!meta) return null

  const duration = Number(durationSeconds) > 0
    ? Number(durationSeconds)
    : Number(videoRef?.current?.duration) || 0

  return (
    <div className="pointer-events-none absolute inset-0 z-[12]">
      {duration > 0 && hits.length ? (
        <div className="absolute inset-x-4 bottom-[max(5.5rem,env(safe-area-inset-bottom))] flex h-1 overflow-hidden rounded-full bg-white/10">
          {hits.map((hit, index) => {
            const left = Math.min(100, Math.max(0, (Number(hit.t) / duration) * 100))
            return (
              <span
                key={`${index}-${hit.t}`}
                className="absolute top-0 h-full w-1 rounded-full bg-white/35"
                style={{ left: `calc(${left}% - 2px)` }}
              />
            )
          })}
        </div>
      ) : null}
      {meta.encouragement || hits.length ? (
        <div className="absolute top-[max(3.5rem,env(safe-area-inset-top))] right-4 max-w-[220px]">
          <TimingScoreSummary timingMetadata={meta} compact />
        </div>
      ) : null}
      {playbackFlash ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="rounded-full bg-white/10 px-4 py-2 text-sm text-white/85 backdrop-blur-sm">
            With the beat
          </p>
        </div>
      ) : null}
    </div>
  )
}
