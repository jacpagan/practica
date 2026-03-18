import React, { useState, useRef, useEffect, useCallback } from 'react'
import { pickRecorderMimeType } from '../utils'

const STATES = {
  IDLE: 'idle',
  REQUESTING: 'requesting',
  PREVIEWING: 'previewing',
  RECORDING: 'recording',
  RECORDED: 'recorded',
}

const METRONOME_SYNC_KEY = 'practica.metronome.syncOffsetMs.v1'

const readSyncOffsetMs = () => {
  try {
    const raw = window.localStorage.getItem(METRONOME_SYNC_KEY)
    const parsed = Number(raw)
    if (Number.isFinite(parsed)) return Math.max(-120, Math.min(180, parsed))
  } catch {}
  return 0
}

function VideoRecorder({ onRecorded, onCancel, maxDuration = 60 }) {
  const [state, setState] = useState(STATES.IDLE)
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState(null)
  const [bpm, setBpm] = useState(80)
  const [metronomeEnabled, setMetronomeEnabled] = useState(false)
  const [isMetronomeRunning, setIsMetronomeRunning] = useState(false)
  const [beatsPerBar, setBeatsPerBar] = useState(4)
  const [syncOffsetMs, setSyncOffsetMs] = useState(readSyncOffsetMs)
  const [showTimingTools, setShowTimingTools] = useState(false)
  const [countInRemaining, setCountInRemaining] = useState(null)

  const liveRef = useRef(null)
  const playbackRef = useRef(null)
  const streamRef = useRef(null)
  const mixedStreamRef = useRef(null)
  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const metronomeTimerRef = useRef(null)
  const countInIntervalRef = useRef(null)
  const countInTimeoutRef = useRef(null)
  const blobUrlRef = useRef(null)
  const audioContextRef = useRef(null)
  const audioDestinationRef = useRef(null)
  const beatRef = useRef(0)
  const [recordedFile, setRecordedFile] = useState(null)
  const isCaptureMode = state === STATES.PREVIEWING || state === STATES.RECORDING || state === STATES.RECORDED

  const metronomeRecordDelaySeconds = useCallback(() => {
    const ctx = audioContextRef.current
    if (!ctx) return 0.06
    const outputLatency = Number(ctx.outputLatency || 0)
    const baseLatency = Number(ctx.baseLatency || 0)
    const inferred = Math.max(outputLatency, baseLatency, 0.06)
    const adjusted = inferred + (syncOffsetMs / 1000)
    return Math.min(Math.max(adjusted, 0), 0.25)
  }, [syncOffsetMs])

  // ── Cleanup ──

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    mixedStreamRef.current = null
  }, [])

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }, [])

  const cancelCountIn = useCallback(() => {
    if (countInIntervalRef.current) {
      clearInterval(countInIntervalRef.current)
      countInIntervalRef.current = null
    }
    if (countInTimeoutRef.current) {
      clearTimeout(countInTimeoutRef.current)
      countInTimeoutRef.current = null
    }
    setCountInRemaining(null)
  }, [])

  const stopMetronome = useCallback(() => {
    if (metronomeTimerRef.current) {
      clearInterval(metronomeTimerRef.current)
      metronomeTimerRef.current = null
    }
    setIsMetronomeRunning(false)
  }, [])

  const closeAudioContext = useCallback(() => {
    const ctx = audioContextRef.current
    audioContextRef.current = null
    audioDestinationRef.current = null
    if (!ctx) return
    try { ctx.close() } catch {}
  }, [])

  const cleanup = useCallback(() => {
    stopTimer()
    cancelCountIn()
    stopMetronome()
    stopStream()
    closeAudioContext()
    if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null }
  }, [cancelCountIn, closeAudioContext, stopMetronome, stopTimer, stopStream])

  useEffect(() => cleanup, [cleanup])

  useEffect(() => {
    try {
      window.localStorage.setItem(METRONOME_SYNC_KEY, String(syncOffsetMs))
    } catch {}
  }, [syncOffsetMs])

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

  const ensureAudioMix = useCallback(async (stream) => {
    if (typeof window === 'undefined') return null
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) return null

    let audioContext = audioContextRef.current
    let destination = audioDestinationRef.current
    if (!audioContext || !destination) {
      audioContext = new AudioContextClass()
      destination = audioContext.createMediaStreamDestination()
      audioContextRef.current = audioContext
      audioDestinationRef.current = destination

      const audioTracks = stream?.getAudioTracks?.() || []
      if (audioTracks.length) {
        const micStream = new MediaStream(audioTracks)
        const micSource = audioContext.createMediaStreamSource(micStream)
        const micGain = audioContext.createGain()
        micGain.gain.value = 1
        micSource.connect(micGain)
        micGain.connect(destination)
      }
    }

    if (audioContext.state === 'suspended') {
      try { await audioContext.resume() } catch {}
    }

    const tracks = [...(stream?.getVideoTracks?.() || [])]
    const mixedAudioTrack = destination.stream.getAudioTracks()[0]
    if (mixedAudioTrack) tracks.push(mixedAudioTrack)
    mixedStreamRef.current = new MediaStream(tracks)
    return mixedStreamRef.current
  }, [])

  const playTick = useCallback(async () => {
    const audioContext = audioContextRef.current
    const destination = audioDestinationRef.current
    if (!audioContext || !destination) return
    if (audioContext.state === 'suspended') {
      try { await audioContext.resume() } catch {}
    }

    const isAccent = beatRef.current % beatsPerBar === 0
    beatRef.current += 1
    const oscillator = audioContext.createOscillator()
    const gain = audioContext.createGain()
    const recordDelay = audioContext.createDelay(1)
    oscillator.type = 'square'
    oscillator.frequency.value = isAccent ? 1568 : 988
    gain.gain.setValueAtTime(isAccent ? 0.16 : 0.11, audioContext.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.05)
    recordDelay.delayTime.value = metronomeRecordDelaySeconds()
    oscillator.connect(gain)
    gain.connect(audioContext.destination)
    gain.connect(recordDelay)
    recordDelay.connect(destination)
    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.055)
  }, [beatsPerBar, metronomeRecordDelaySeconds])

  const startMetronome = useCallback(async () => {
    if (!streamRef.current) return
    await ensureAudioMix(streamRef.current)
    stopMetronome()
    beatRef.current = 0
    await playTick()
    metronomeTimerRef.current = setInterval(() => {
      playTick()
    }, Math.max(150, Math.round((60_000) / Math.max(30, Math.min(260, bpm)))))
    setIsMetronomeRunning(true)
  }, [bpm, ensureAudioMix, playTick, stopMetronome])

  const toggleMetronome = useCallback(() => {
    setMetronomeEnabled((current) => !current)
  }, [])

  useEffect(() => {
    const captureActive = state === STATES.PREVIEWING || state === STATES.RECORDING
    if (!captureActive) {
      stopMetronome()
      return undefined
    }
    if (!metronomeEnabled) {
      stopMetronome()
      return undefined
    }

    startMetronome()
    return () => stopMetronome()
  }, [bpm, metronomeEnabled, startMetronome, state, stopMetronome])

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
      await ensureAudioMix(stream)
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

  const startActualRecording = () => {
    if (!streamRef.current) return

    if (!audioDestinationRef.current) {
      ensureAudioMix(streamRef.current)
    }

    const mimeType = pickRecorderMimeType()
    const recorderStream = mixedStreamRef.current || streamRef.current
    const recorder = mimeType
      ? new MediaRecorder(recorderStream, { mimeType })
      : new MediaRecorder(recorderStream)
    recorderRef.current = recorder
    chunksRef.current = []
    setElapsed(0)

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }

    recorder.onstop = () => {
      const outputType = mimeType || recorder.mimeType || 'video/webm'
      const blob = new Blob(chunksRef.current, { type: outputType })
      const ext = outputType.includes('mp4') ? 'mp4' : 'webm'
      const file = new File([blob], `reply-${Date.now()}.${ext}`, { type: outputType })

      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
      blobUrlRef.current = URL.createObjectURL(blob)
      setRecordedFile(file)
      cancelCountIn()
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

  const startRecording = () => {
    if (!streamRef.current) return
    if (!metronomeEnabled) {
      startActualRecording()
      return
    }

    cancelCountIn()
    stopMetronome()
    const beatDurationMs = Math.max(150, Math.round((60_000) / Math.max(30, Math.min(260, bpm))))
    setCountInRemaining(beatsPerBar)
    startMetronome()

    countInIntervalRef.current = setInterval(() => {
      setCountInRemaining((current) => {
        if (current === null) return null
        const next = current - 1
        return next > 0 ? next : null
      })
    }, beatDurationMs)

    countInTimeoutRef.current = setTimeout(() => {
      cancelCountIn()
      startActualRecording()
    }, beatDurationMs * beatsPerBar)
  }

  const stopRecording = () => {
    stopTimer()
    cancelCountIn()
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
    cancelCountIn()
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
    <div className={`overflow-hidden bg-gray-950 relative ${isCaptureMode ? 'rounded-[28px] shadow-2xl' : 'rounded-2xl'}`}>
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
        <div className="bg-gray-950">
          <video
            ref={setLiveRef}
            autoPlay
            muted
            playsInline
            className="w-full aspect-video object-cover"
            style={{ transform: 'scaleX(-1)' }}
          />

          <div className="p-4 bg-gray-950 space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="rounded-full bg-white/10 px-3 py-1.5 text-xs text-white/90">
                  {countInRemaining ? `Starting in ${countInRemaining}` : state === STATES.RECORDING ? 'Recording' : 'Camera ready'}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowTimingTools((current) => !current)}
                  className="rounded-full px-3 py-1.5 text-xs transition-colors bg-white/10 text-white/80 hover:bg-white/20"
                >
                  Timing tools
                </button>
                <div className="rounded-full bg-white/10 px-3 py-1.5 text-xs text-white/70">
                  {state === STATES.RECORDING ? fmtTimer(elapsed) : `Max ${fmtTimer(maxDuration)}`}
                </div>
              </div>
            </div>

            {showTimingTools ? (
              <div className="space-y-3">
                <div className="rounded-2xl bg-white/5 px-3 py-3 flex items-center gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-wide text-white/60">Tempo</p>
                    <p className="text-sm font-medium text-white">{bpm} BPM</p>
                  </div>
                  <input
                    type="range"
                    min="40"
                    max="240"
                    step="1"
                    value={bpm}
                    onChange={(e) => setBpm(Number(e.target.value))}
                    className="flex-1"
                  />
                  <select
                    value={beatsPerBar}
                    onChange={(e) => setBeatsPerBar(Number(e.target.value))}
                    className="bg-white/10 text-white text-sm rounded-lg px-2 py-2 border border-white/10"
                  >
                    {[2, 3, 4, 6].map((beats) => (
                      <option key={beats} value={beats} className="text-gray-900">{beats}/4</option>
                    ))}
                  </select>
                </div>

                <div className="rounded-2xl bg-white/5 px-3 py-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-white/60">Metronome</p>
                    <p className="text-sm font-medium text-white">{metronomeEnabled ? 'On' : 'Off'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={toggleMetronome}
                    className={`rounded-xl px-4 py-2 text-sm transition-colors ${metronomeEnabled ? 'bg-emerald-500 text-white' : 'bg-white/10 text-white/80 hover:bg-white/20'}`}
                  >
                    {metronomeEnabled ? 'Turn off' : 'Turn on'}
                  </button>
                </div>

                <div className="rounded-2xl bg-white/5 px-3 py-3 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-white/60">Sync recorded click</p>
                      <p className="text-sm font-medium text-white">{syncOffsetMs > 0 ? '+' : ''}{syncOffsetMs} ms</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSyncOffsetMs(0)}
                      className="text-xs text-white/70 border border-white/10 rounded-lg px-3 py-2 hover:bg-white/10 transition-colors"
                    >
                      Reset
                    </button>
                  </div>
                  <input
                    type="range"
                    min="-120"
                    max="180"
                    step="5"
                    value={syncOffsetMs}
                    onChange={(e) => setSyncOffsetMs(Number(e.target.value))}
                    className="w-full"
                  />
                  <p className="text-[11px] text-white/55">If playback sounds late, move this left. If playback sounds early, move it right.</p>
                </div>

                <p className="text-[11px] text-white/55">Timing tools are optional. When the metronome is on, recording starts after a one-bar count-in. Headphones give the cleanest result.</p>
              </div>
            ) : null}

            {state === STATES.RECORDING ? (
              <div>
                <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-500 transition-all duration-300 ease-linear"
                    style={{ width: `${timerProgress * 100}%` }}
                  />
                </div>
              </div>
            ) : null}

            <div className="flex items-center justify-center gap-3">
              {state === STATES.PREVIEWING ? (
                <>
                  <button onClick={handleCancel}
                    className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                  <button onClick={startRecording}
                    disabled={Boolean(countInRemaining)}
                    className="w-20 h-20 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-90 shadow-lg shadow-red-500/30 border-4 border-white/20 disabled:opacity-60 disabled:scale-100">
                    <div className="w-8 h-8 bg-white rounded-full" />
                  </button>
                  <div className="w-12" />
                </>
              ) : (
                <button onClick={stopRecording}
                  className="w-20 h-20 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-90 shadow-lg shadow-red-500/30 border-4 border-white/20">
                  <div className="w-7 h-7 bg-white rounded-sm" />
                </button>
              )}
            </div>
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
          <div className="p-4 bg-gray-900 space-y-3">
            <div>
              <p className="text-sm font-medium text-white">Recording ready</p>
              <p className="text-xs text-white/50 mt-1">{fmtTimer(elapsed)} · {(recordedFile.size / 1024 / 1024).toFixed(1)} MB</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleReRecord}
                className="flex-1 text-sm text-white/70 hover:text-white px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all">
                Re-record
              </button>
              <button onClick={handleCancel}
                className="flex-1 text-sm text-white/70 hover:text-white px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all">
                Discard
              </button>
              <button onClick={handleUse}
                className="flex-1 text-sm font-medium text-gray-900 bg-white hover:bg-gray-100 px-4 py-3 rounded-xl transition-all active:scale-95">
                Use this video
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default VideoRecorder
