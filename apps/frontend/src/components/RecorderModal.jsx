import React, { useEffect } from 'react'
import VideoRecorder from './VideoRecorder'
import { MAX_RECORDER_DURATION_SECONDS } from '../utils'

export default function RecorderModal({ onClose, onRecorded }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    document.body.classList.add('overflow-hidden')
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.classList.remove('overflow-hidden')
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[100]">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-3xl">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-white/80">Camera</div>
            <button type="button" onClick={onClose} className="text-xs text-white/80 hover:text-white">Close</button>
          </div>
          <div className="rounded-[28px] overflow-hidden shadow-2xl">
            <VideoRecorder
              onRecorded={(file, blobUrl) => { try { onRecorded?.(file, blobUrl) } finally { onClose?.() } }}
              onCancel={onClose}
              maxDuration={MAX_RECORDER_DURATION_SECONDS}
              autoUseOnStop={false}
              minAutoUseSeconds={0}
              autoOpenOnMount={true}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

