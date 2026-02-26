import React, { useState, useRef, useEffect, useCallback } from 'react'

const STATES = {
  IDLE: 'idle',
  REQUESTING: 'requesting',
  PREVIEWING: 'previewing',
  RECORDING: 'recording',
  RECORDED: 'recorded',
}

function VideoRecorder({ onRecorded, onCancel, maxDuration = 60 }) {
  const [state, setState] = useState(STATES.IDLE)
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState(null)

  const liveRef = useRef(null)
  const playbackRef = useRef(null)
  const streamRef = useRef(null)
  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const blobUrlRef = useRef(null)
  const [recordedFile, setRecordedFile] = useState(null)

  // ── Cleanup ──

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }, [])

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }, [])

  const cleanup = useCallback(() => {
    stopTimer()
    stopStream()
    if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null }
  }, [stopTimer, stopStream])

  useEffect(() => cleanup, [cleanup])

  // Attach stream to video element whenever the ref or stream changes
  const attachStream = useCallback(() => {
    if (liveRef.current && streamRef.current) {
      liveRef.current.srcObject = streamRef.current
      liveRef.current.play().catch(() => {})
    }
  }, [])

  // Use callback ref for the live video — attach stream as soon as element mounts
  const setLiveRef = useCallback((el) => {
    liveRef.current = el
    if (el && streamRef.current) {
      el.srcObject = streamRef.current
      el.play().catch(() => {})
    }
  }, [])

  // ── Camera ──

  const openCamera = async () => {
    setState(STATES.REQUESTING)
    setError(null)
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera not supported')
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: true,
      })
      streamRef.current = stream
      setState(STATES.PREVIEWING)
      // Attach after state change triggers re-render with video element
      requestAnimationFrame(() => attachStream())
    } catch (e) {
      setError(e.name === 'NotAllowedError'
        ? 'Camera permission denied. Please allow access in your browser settings.'
        : 'Could not access camera. Please check your device.')
      setState(STATES.IDLE)
    }
  }

  // ── Recording ──

  const startRecording = () => {
    if (!streamRef.current) return

    let mimeType = 'video/webm;codecs=vp9'
    if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm;codecs=vp8'
    if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm'
    if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/mp4'

    const recorder = new MediaRecorder(streamRef.current, { mimeType })
    recorderRef.current = recorder
    chunksRef.current = []
    setElapsed(0)

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType })
      const ext = mimeType.includes('webm') ? 'webm' : 'mp4'
      const file = new File([blob], `reply-${Date.now()}.${ext}`, { type: mimeType })

      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
      blobUrlRef.current = URL.createObjectURL(blob)
      setRecordedFile(file)
      stopStream()
      setState(STATES.RECORDED)
    }

    recorder.start(500)
    setState(STATES.RECORDING)

    const startTime = Date.now()
    timerRef.current = setInterval(() => {
      const secs = Math.floor((Date.now() - startTime) / 1000)
      setElapsed(secs)
      if (secs >= maxDuration) stopRecording()
    }, 250)
  }

  const stopRecording = () => {
    stopTimer()
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
  }

  // ── Actions ──

  const handleUse = () => {
    if (recordedFile) onRecorded(recordedFile, blobUrlRef.current)
  }

  const handleReRecord = () => {
    setRecordedFile(null)
    if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null }
    setElapsed(0)
    openCamera()
  }

  const handleCancel = () => {
    cleanup()
    setState(STATES.IDLE)
    setRecordedFile(null)
    setElapsed(0)
    onCancel()
  }

  // ── Timer display ──

  const fmtTimer = (s) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  const timerProgress = maxDuration > 0 ? Math.min(elapsed / maxDuration, 1) : 0

  // ── Render ──

  return (
    <div className="rounded-2xl overflow-hidden bg-gray-950 relative">
      {/* ── IDLE STATE ── */}
      {state === STATES.IDLE && (
        <div className="aspect-video flex flex-col items-center justify-center gap-3 px-4">
          {error ? (
            <>
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
              </div>
              <p className="text-xs text-red-400 text-center max-w-[240px]">{error}</p>
              <button onClick={openCamera} className="text-xs text-white/60 hover:text-white underline transition-colors">
                Try again
              </button>
            </>
          ) : (
            <>
              <button
                onClick={openCamera}
                className="w-14 h-14 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95"
              >
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                </svg>
              </button>
              <p className="text-xs text-white/40">Tap to open camera</p>
            </>
          )}
        </div>
      )}

      {/* ── REQUESTING PERMISSION ── */}
      {state === STATES.REQUESTING && (
        <div className="aspect-video flex flex-col items-center justify-center gap-3">
          <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          <p className="text-xs text-white/50">Requesting camera access...</p>
        </div>
      )}

      {/* ── LIVE PREVIEW / RECORDING ── */}
      {(state === STATES.PREVIEWING || state === STATES.RECORDING) && (
        <div className="relative">
          <video
            ref={setLiveRef}
            autoPlay
            muted
            playsInline
            className="w-full aspect-video object-cover"
            style={{ transform: 'scaleX(-1)' }}
          />

          {/* Recording indicator */}
          {state === STATES.RECORDING && (
            <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/50 backdrop-blur-sm rounded-full px-3 py-1.5">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-xs text-white font-mono font-medium">{fmtTimer(elapsed)}</span>
            </div>
          )}

          {/* Duration progress bar */}
          {state === STATES.RECORDING && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
              <div
                className="h-full bg-red-500 transition-all duration-300 ease-linear"
                style={{ width: `${timerProgress * 100}%` }}
              />
            </div>
          )}

          {/* Controls overlay */}
          <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-3">
            {state === STATES.PREVIEWING && (
              <>
                <button onClick={handleCancel}
                  className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm hover:bg-black/60 flex items-center justify-center transition-all">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <button onClick={startRecording}
                  className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-90 shadow-lg shadow-red-500/30">
                  <div className="w-6 h-6 bg-white rounded-full" />
                </button>
                <div className="w-10" />
              </>
            )}

            {state === STATES.RECORDING && (
              <button onClick={stopRecording}
                className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-90 shadow-lg shadow-red-500/30">
                <div className="w-5 h-5 bg-white rounded-sm" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── RECORDED — PLAYBACK ── */}
      {state === STATES.RECORDED && recordedFile && (
        <div className="relative">
          <video
            ref={playbackRef}
            src={blobUrlRef.current}
            className="w-full aspect-video object-cover"
            controls
            playsInline
          />

          {/* Actions bar */}
          <div className="p-3 flex items-center justify-between bg-gray-900">
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/50 font-mono">{fmtTimer(elapsed)}</span>
              <span className="text-xs text-white/30">·</span>
              <span className="text-xs text-white/50">{(recordedFile.size / 1024 / 1024).toFixed(1)} MB</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleReRecord}
                className="text-xs text-white/50 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/10 transition-all">
                Re-record
              </button>
              <button onClick={handleCancel}
                className="text-xs text-white/50 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/10 transition-all">
                Discard
              </button>
              <button onClick={handleUse}
                className="text-xs font-medium text-gray-900 bg-white hover:bg-gray-100 px-4 py-1.5 rounded-lg transition-all active:scale-95">
                Use this
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default VideoRecorder
