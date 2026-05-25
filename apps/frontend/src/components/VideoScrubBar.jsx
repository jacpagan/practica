import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fmtTimer } from '../utils'

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function parseTimingHits(raw) {
  if (!raw) return []
  let meta = raw
  if (typeof raw === 'string') {
    try { meta = JSON.parse(raw) } catch { return [] }
  }
  if (!meta || typeof meta !== 'object') return []
  return (meta.hits || [])
    .filter((hit) => hit.tier === 'perfect' || hit.tier === 'good')
    .map((hit, index) => ({ id: `${index}-${hit.t}`, t: Number(hit.t) }))
    .filter((hit) => Number.isFinite(hit.t) && hit.t >= 0)
}

export default function VideoScrubBar({ videoRef, durationSeconds = 0, timingMetadata = null }) {
  const trackRef = useRef(null)
  const draggingRef = useRef(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(Number(durationSeconds) || 0)
  const [dragTime, setDragTime] = useState(null)

  const markers = useMemo(() => parseTimingHits(timingMetadata), [timingMetadata])

  useEffect(() => {
    setDuration(Number(durationSeconds) || 0)
  }, [durationSeconds])

  useEffect(() => {
    const video = videoRef?.current
    if (!video) return undefined

    const syncDuration = () => {
      if (Number.isFinite(video.duration) && video.duration > 0) {
        setDuration(video.duration)
      }
    }
    const syncTime = () => {
      if (!draggingRef.current) setCurrentTime(video.currentTime || 0)
    }

    video.addEventListener('loadedmetadata', syncDuration)
    video.addEventListener('durationchange', syncDuration)
    video.addEventListener('timeupdate', syncTime)
    syncDuration()
    syncTime()

    return () => {
      video.removeEventListener('loadedmetadata', syncDuration)
      video.removeEventListener('durationchange', syncDuration)
      video.removeEventListener('timeupdate', syncTime)
    }
  }, [videoRef])

  const seekTo = useCallback((seconds, { play = true } = {}) => {
    const video = videoRef?.current
    if (!video || !Number.isFinite(duration) || duration <= 0) return
    const next = clamp(Number(seconds) || 0, 0, duration)
    try {
      video.currentTime = next
      setCurrentTime(next)
      if (play) video.play?.().catch?.(() => {})
    } catch {}
  }, [duration, videoRef])

  const timeFromClientX = useCallback((clientX) => {
    const track = trackRef.current
    if (!track || !Number.isFinite(duration) || duration <= 0) return 0
    const rect = track.getBoundingClientRect()
    if (!rect.width) return 0
    const ratio = clamp((clientX - rect.left) / rect.width, 0, 1)
    return ratio * duration
  }, [duration])

  const finishDrag = useCallback((clientX) => {
    draggingRef.current = false
    const next = timeFromClientX(clientX)
    setDragTime(null)
    seekTo(next, { play: true })
  }, [seekTo, timeFromClientX])

  const handleTrackPointerDown = (event) => {
    event.stopPropagation()
    if (!Number.isFinite(duration) || duration <= 0) return
    draggingRef.current = true
    const next = timeFromClientX(event.clientX)
    setDragTime(next)
    try { event.currentTarget.setPointerCapture?.(event.pointerId) } catch {}
  }

  const handleTrackPointerMove = (event) => {
    if (!draggingRef.current) return
    event.stopPropagation()
    setDragTime(timeFromClientX(event.clientX))
  }

  const handleTrackPointerUp = (event) => {
    if (!draggingRef.current) return
    event.stopPropagation()
    try { event.currentTarget.releasePointerCapture?.(event.pointerId) } catch {}
    finishDrag(event.clientX)
  }

  const handleMarkerClick = (event, seconds) => {
    event.stopPropagation()
    event.preventDefault()
    seekTo(seconds, { play: true })
  }

  const stopBubble = (event) => {
    event.stopPropagation()
  }

  const shownTime = dragTime != null ? dragTime : currentTime
  const progress = duration > 0 ? clamp(shownTime / duration, 0, 1) : 0

  if (!Number.isFinite(duration) || duration <= 0) return null

  return (
    <div
      className="pointer-events-auto w-full px-3 py-2"
      onPointerDown={stopBubble}
      onClick={stopBubble}
    >
      <div
        ref={trackRef}
        role="slider"
        aria-label="Video timeline"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(shownTime)}
        className="relative h-8 flex items-center cursor-pointer touch-none select-none"
        onPointerDown={handleTrackPointerDown}
        onPointerMove={handleTrackPointerMove}
        onPointerUp={handleTrackPointerUp}
        onPointerCancel={handleTrackPointerUp}
      >
        <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-white/20 overflow-hidden">
          <div
            className="h-full rounded-full bg-white/85 transition-none"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        {markers.map((marker) => {
          const left = clamp((marker.t / duration) * 100, 0, 100)
          return (
            <button
              key={marker.id}
              type="button"
              aria-label={`Jump to ${fmtTimer(Math.round(marker.t))}`}
              className="absolute top-1/2 z-10 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/70 ring-2 ring-black/30 hover:bg-white hover:scale-125 transition-transform"
              style={{ left: `${left}%` }}
              onPointerDown={stopBubble}
              onClick={(event) => handleMarkerClick(event, marker.t)}
            />
          )
        })}
        <div
          className="absolute top-1/2 z-20 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-md ring-2 ring-black/25"
          style={{ left: `${progress * 100}%` }}
        />
      </div>
      <div className="mt-1 flex items-center justify-between text-[11px] tabular-nums text-white/75">
        <span>{fmtTimer(Math.floor(shownTime))}</span>
        <span>{fmtTimer(Math.floor(duration))}</span>
      </div>
    </div>
  )
}
