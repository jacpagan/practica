import React, { useEffect, useMemo, useRef, useState } from 'react'
import { sessionVideoSources } from '../utils'

function VideoThumbnail({ session, className = '' }) {
  const videoRef = useRef(null)
  const [frameReady, setFrameReady] = useState(false)
  const [failed, setFailed] = useState(false)
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

  if (!source || failed || session?.processing_status !== 'ready') {
    return (
      <div className={`bg-gray-100 flex items-center justify-center text-[11px] uppercase tracking-wide text-gray-400 ${className}`}>
        No preview
      </div>
    )
  }

  return (
    <div className={`relative bg-black overflow-hidden ${className}`}>
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

export default VideoThumbnail
