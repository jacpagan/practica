import React, { useRef, useEffect, useState } from 'react'

const fmtTime = (s) => `${Math.floor(s / 60)}:${(Math.floor(s % 60)).toString().padStart(2, '0')}`

function SegmentPlayer({ src, start = 0, end = null, className = '' }) {
  const ref = useRef(null)
  const [ready, setReady] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)

  const duration = end && end > start ? end - start : null

  useEffect(() => {
    const v = ref.current
    if (!v) return

    const onLoaded = () => {
      v.currentTime = start
      setReady(true)
    }

    const onTimeUpdate = () => {
      const t = v.currentTime
      if (duration) {
        const pct = Math.min((t - start) / duration, 1)
        setProgress(pct)
      }
      if (end && t >= end) {
        v.pause()
        v.currentTime = start
        setPlaying(false)
        setProgress(0)
      }
    }

    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onEnded = () => { setPlaying(false); setProgress(0); v.currentTime = start }

    v.addEventListener('loadedmetadata', onLoaded)
    v.addEventListener('timeupdate', onTimeUpdate)
    v.addEventListener('play', onPlay)
    v.addEventListener('pause', onPause)
    v.addEventListener('ended', onEnded)

    if (v.readyState >= 1) onLoaded()

    return () => {
      v.removeEventListener('loadedmetadata', onLoaded)
      v.removeEventListener('timeupdate', onTimeUpdate)
      v.removeEventListener('play', onPlay)
      v.removeEventListener('pause', onPause)
      v.removeEventListener('ended', onEnded)
    }
  }, [src, start, end])

  const togglePlay = () => {
    const v = ref.current
    if (!v) return
    if (playing) {
      v.pause()
    } else {
      if (end && v.currentTime >= end) v.currentTime = start
      if (v.currentTime < start) v.currentTime = start
      v.play()
    }
  }

  return (
    <div className={`relative group ${className}`}>
      <video
        ref={ref}
        src={src}
        className="w-full h-full object-cover"
        playsInline
        preload="metadata"
        muted={false}
      />

      {/* Play/pause overlay */}
      <button
        onClick={togglePlay}
        className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/10 transition-all"
      >
        {!playing && ready && (
          <div className="w-10 h-10 rounded-full bg-white/90 shadow-lg flex items-center justify-center opacity-80 group-hover:opacity-100 transition-opacity">
            <svg className="w-4 h-4 text-gray-900 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        )}
      </button>

      {/* Segment progress bar */}
      {duration && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/20">
          <div className="h-full bg-white/80 transition-all duration-200" style={{ width: `${progress * 100}%` }} />
        </div>
      )}

      {/* Time badge */}
      {duration && (
        <div className="absolute top-1.5 right-1.5 bg-black/50 text-white text-[10px] font-mono px-1.5 py-0.5 rounded">
          {fmtTime(duration)}
        </div>
      )}
    </div>
  )
}

export default SegmentPlayer
