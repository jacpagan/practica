import React, { useEffect, useMemo, useRef, useState } from 'react'
import { sessionPosterUrl, sessionVideoSources } from '../utils'

function PosterThumbnail({ className = '', session = null, eager = false }) {
  const posterUrl = sessionPosterUrl(session)
  if (posterUrl && session?.processing_status === 'ready') {
    return (
      <div className={`relative bg-gray-950 overflow-hidden ${className}`}>
        <img
          src={posterUrl}
          alt=""
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          className="h-full w-full object-cover"
        />
      </div>
    )
  }
  return (
    <div className={`relative bg-gray-950 overflow-hidden ${className}`}>
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-950 to-black" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/10">
          <svg className="h-4 w-4 text-white/80" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M8 6.82v10.36c0 .79.87 1.27 1.54.84l8.14-5.18a1 1 0 000-1.68L9.54 5.98A1 1 0 008 6.82z" />
          </svg>
        </div>
      </div>
    </div>
  )
}

function VideoFrameThumbnail({ session, className = '' }) {
  const videoRef = useRef(null)
  const wrapperRef = useRef(null)
  const [frameReady, setFrameReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [visible, setVisible] = useState(false)
  const sources = useMemo(() => sessionVideoSources(session), [session])
  const [sourceIndex, setSourceIndex] = useState(0)
  const source = sources[sourceIndex] || ''

  useEffect(() => {
    setFrameReady(false)
    setFailed(false)
    setSourceIndex(0)
  }, [session?.id, session?.video_file, JSON.stringify(session?.assets || [])])

  const handleLoadedMetadata = () => {
    const video = videoRef.current
    if (!video) return
    const duration = Number(video.duration || 0)
    if (!Number.isFinite(duration) || duration <= 0) {
      setFrameReady(true)
      return
    }
    const previewSecond = Math.min(0.1, Math.max(duration / 10, 0.01))
    try {
      video.currentTime = previewSecond
    } catch {
      setFrameReady(true)
    }
  }

  const handleSeeked = () => setFrameReady(true)

  const handleError = () => {
    if (sourceIndex < sources.length - 1) {
      setSourceIndex((current) => current + 1)
      return
    }
    setFailed(true)
  }

  // Lazy visibility observer to avoid decoding when off-screen
  useEffect(() => {
    const el = wrapperRef.current
    if (!el) return
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) { setVisible(true); io.disconnect(); break }
      }
    }, { rootMargin: '150px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  if (!source || failed || session?.processing_status !== 'ready' || !visible) {
    return (
      <div ref={wrapperRef} className={`bg-gray-100 flex items-center justify-center text-[11px] uppercase tracking-wide text-gray-400 ${className}`}>
        {visible ? 'No preview' : 'Loading'}
      </div>
    )
  }

  return (
    <div ref={wrapperRef} className={`relative bg-black overflow-hidden ${className}`}>
      <video
        key={source}
        ref={videoRef}
        src={source}
        muted
        playsInline
        preload="metadata"
        onLoadedMetadata={handleLoadedMetadata}
        onSeeked={handleSeeked}
        onError={handleError}
        className={`w-full h-full object-cover ${frameReady ? 'opacity-100' : 'opacity-0'} transition-opacity`}
      />
      {!frameReady ? (
        <div className="absolute inset-0 bg-gray-100 flex items-center justify-center text-[11px] uppercase tracking-wide text-gray-400">
          Loading
        </div>
      ) : null}
    </div>
  )
}

function VideoThumbnail({ session, className = '', variant = 'video' }) {
  const posterUrl = sessionPosterUrl(session)
  if (variant === 'poster') {
    return <PosterThumbnail className={className} session={session} />
  }

  if (posterUrl && session?.processing_status === 'ready') {
    return <PosterThumbnail className={className} session={session} eager />
  }

  return <VideoFrameThumbnail session={session} className={className} />
}

export default VideoThumbnail
