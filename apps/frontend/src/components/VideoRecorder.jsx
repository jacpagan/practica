import React, { useState, useRef, useEffect, useCallback } from 'react'
import { pickRecorderMimeType } from '../utils'

const STATES = {
  IDLE: 'idle',
  REQUESTING: 'requesting',
  PREVIEWING: 'previewing',
  RECORDING: 'recording',
  RECORDED: 'recorded',
}

const MIN_BPM = 40
const MAX_BPM = 240
const BPM_PRESETS = [60, 72, 84, 96, 108, 120, 132, 144, 152, 160, 172, 184, 192, 200]

const METRONOME_SYNC_KEY = 'practica.metronome.syncOffsetMs.v1'
const CLICK_GAIN_STORAGE_KEY = 'practica.metronome.clickGain.v1'
const AUDIO_INPUT_STORAGE_KEY = 'practica.recorder.audioInputId.v1'
const VIDEO_INPUT_STORAGE_KEY = 'practica.recorder.videoInputId.v1'

const readSyncOffsetMs = () => {
  try {
    const raw = window.localStorage.getItem(METRONOME_SYNC_KEY)
    const parsed = Number(raw)
    if (Number.isFinite(parsed)) return Math.max(-120, Math.min(180, parsed))
  } catch {}
  return 0
}

const readStoredAudioInputId = () => {
  try {
    return window.localStorage.getItem(AUDIO_INPUT_STORAGE_KEY) || ''
  } catch {}
  return ''
}

const readStoredVideoInputId = () => {
  try {
    return window.localStorage.getItem(VIDEO_INPUT_STORAGE_KEY) || ''
  } catch {}
  return ''
}

const getAudioInputLabel = (device, index) => device.label || `Microphone ${index + 1}`
const getVideoInputLabel = (device, index) => device.label || `Camera ${index + 1}`

const clampBpm = (value) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 80
  return Math.max(MIN_BPM, Math.min(MAX_BPM, Math.round(parsed)))
}

function VideoRecorder({ onRecorded, onCancel, maxDuration = 60, autoUseOnStop = true, minAutoUseSeconds = 2, autoOpenOnMount = false }) {
  const [state, setState] = useState(STATES.IDLE)
  const [mode, setMode] = useState('camera') // 'camera' | 'screen_cam'
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState(null)
  const [warning, setWarning] = useState(null)
  const [bpm, setBpm] = useState(80)
  const [metronomeEnabled, setMetronomeEnabled] = useState(false)
  const [isMetronomeRunning, setIsMetronomeRunning] = useState(false)
  const [beatsPerBar, setBeatsPerBar] = useState(4)
  const [syncOffsetMs, setSyncOffsetMs] = useState(readSyncOffsetMs)
  const [clickGain, setClickGain] = useState(() => {
    try {
      const raw = window.localStorage.getItem(CLICK_GAIN_STORAGE_KEY)
      const parsed = Number(raw)
      if (Number.isFinite(parsed)) return Math.max(0, Math.min(2, parsed))
    } catch {}
    return 1
  })
  const [showTimingTools, setShowTimingTools] = useState(false)
  const [showPipControls, setShowPipControls] = useState(false)
  const [musicMode, setMusicMode] = useState(true)
  const [micGain, setMicGain] = useState(1)
  const [micLevel, setMicLevel] = useState(0)
  const [countInRemaining, setCountInRemaining] = useState(null)
  const [bpmInput, setBpmInput] = useState('80')
  const [showOptions, setShowOptions] = useState(false)
  const [audioInputs, setAudioInputs] = useState([])
  const [selectedAudioInputId, setSelectedAudioInputId] = useState(readStoredAudioInputId)
  const [videoInputs, setVideoInputs] = useState([])
  const [selectedVideoInputId, setSelectedVideoInputId] = useState(readStoredVideoInputId)
  const [requestingPermissionLabel, setRequestingPermissionLabel] = useState('camera')

  const liveRef = useRef(null)
  const playbackRef = useRef(null)
  const streamRef = useRef(null)
  const mixedStreamRef = useRef(null)
  const camStreamRef = useRef(null)
  const displayStreamRef = useRef(null)
  const displayAudioStreamRef = useRef(null)
  const compositeCanvasRef = useRef(null)
  const compositeRafRef = useRef(null)
  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const metronomeTimerRef = useRef(null)
  const countInIntervalRef = useRef(null)
  const countInTimeoutRef = useRef(null)
  const blobUrlRef = useRef(null)
  const audioContextRef = useRef(null)
  const audioDestinationRef = useRef(null)
  const micGainNodeRef = useRef(null)
  const analyserRef = useRef(null)
  const meterRafRef = useRef(null)
  const beatRef = useRef(0)
  const [recordedFile, setRecordedFile] = useState(null)
  // PiP controls (for screen+cam)
  const pipStateRef = useRef({ xFrac: 0.76, yFrac: 0.72, wFrac: 0.22, radiusFrac: 0.06, mirror: true })
  const canvasSizeRef = useRef({ width: 1280, height: 720 })
  const camAspectRef = useRef(9 / 16)
  const videoContainerRef = useRef(null)
  const draggingRef = useRef(null) // {type: 'move'|'resize', startX, startY, start}
  const isCaptureMode = state === STATES.PREVIEWING || state === STATES.RECORDING || state === STATES.RECORDED

  useEffect(() => {
    setBpmInput(String(bpm))
  }, [bpm])

  const refreshMediaDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const nextAudioInputs = devices.filter((device) => device.kind === 'audioinput')
      const nextVideoInputs = devices.filter((device) => device.kind === 'videoinput')
      setAudioInputs(nextAudioInputs)
      setVideoInputs(nextVideoInputs)
      setSelectedAudioInputId((current) => (
        current && nextAudioInputs.some((device) => device.deviceId === current)
          ? current
          : ''
      ))
      setSelectedVideoInputId((current) => (
        current && nextVideoInputs.some((device) => device.deviceId === current)
          ? current
          : ''
      ))
      return {
        audioInputs: nextAudioInputs,
        videoInputs: nextVideoInputs,
      }
    } catch {}
    return {
      audioInputs: [],
      videoInputs: [],
    }
  }, [])

  useEffect(() => {
    refreshMediaDevices()
    if (!navigator.mediaDevices?.addEventListener) return undefined
    const handleDeviceChange = () => {
      refreshMediaDevices()
    }
    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange)
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange)
    }
  }, [refreshMediaDevices])

  useEffect(() => {
    try {
      if (selectedAudioInputId) {
        window.localStorage.setItem(AUDIO_INPUT_STORAGE_KEY, selectedAudioInputId)
      } else {
        window.localStorage.removeItem(AUDIO_INPUT_STORAGE_KEY)
      }
    } catch {}
  }, [selectedAudioInputId])

  useEffect(() => {
    try {
      if (selectedVideoInputId) {
        window.localStorage.setItem(VIDEO_INPUT_STORAGE_KEY, selectedVideoInputId)
      } else {
        window.localStorage.removeItem(VIDEO_INPUT_STORAGE_KEY)
      }
    } catch {}
  }, [selectedVideoInputId])

  const updateBpm = useCallback((nextValue) => {
    setBpm(clampBpm(nextValue))
  }, [])

  const nudgeBpm = useCallback((delta) => {
    setBpm((current) => clampBpm(current + delta))
  }, [])

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
    if (compositeRafRef.current) { cancelAnimationFrame(compositeRafRef.current); compositeRafRef.current = null }
    streamRef.current?.getTracks().forEach(t => t.stop())
    mixedStreamRef.current?.getTracks().forEach(t => t.stop())
    camStreamRef.current?.getTracks().forEach(t => t.stop())
    displayStreamRef.current?.getTracks().forEach(t => t.stop())
    displayAudioStreamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    mixedStreamRef.current = null
    camStreamRef.current = null
    displayStreamRef.current = null
    displayAudioStreamRef.current = null
    compositeCanvasRef.current = null
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
    micGainNodeRef.current = null
    if (meterRafRef.current) { cancelAnimationFrame(meterRafRef.current); meterRafRef.current = null }
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

  // Auto-open camera on mount if requested
  useEffect(() => {
    if (!autoOpenOnMount) return
    if (state === STATES.IDLE) {
      // Best effort; ignore errors here and let the UI show any message
      openCamera()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(METRONOME_SYNC_KEY, String(syncOffsetMs))
    } catch {}
  }, [syncOffsetMs])

  useEffect(() => {
    try { window.localStorage.setItem(CLICK_GAIN_STORAGE_KEY, String(clickGain)) } catch {}
  }, [clickGain])

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

  const getAudioConstraints = useCallback((audioInputId = selectedAudioInputId) => {
    const constraints = musicMode
      ? { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
      : {}
    if (audioInputId) {
      constraints.deviceId = { exact: audioInputId }
    }
    return Object.keys(constraints).length ? constraints : true
  }, [musicMode, selectedAudioInputId])

  const getVideoConstraints = useCallback((size = 'default', videoInputId = selectedVideoInputId) => {
    const constraints = size === 'pip'
      ? { width: { ideal: 640 }, height: { ideal: 360 } }
      : { width: { ideal: 1280 }, height: { ideal: 720 } }

    if (videoInputId) {
      constraints.deviceId = { exact: videoInputId }
    } else {
      constraints.facingMode = 'user'
    }

    return constraints
  }, [selectedVideoInputId])

  const getCaptureErrorMessage = useCallback((e) => {
    if (e?.name === 'NotAllowedError') {
      return 'Camera permission denied. Please allow access in your browser settings.'
    }
    if (e?.name === 'NotReadableError' || e?.name === 'AbortError') {
      return 'Camera is busy or unavailable. Close other apps using it and try again.'
    }
    if ((e?.name === 'NotFoundError' || e?.name === 'OverconstrainedError') && selectedVideoInputId) {
      return 'Selected camera is unavailable. Reconnect it or choose another camera.'
    }
    if ((e?.name === 'NotFoundError' || e?.name === 'OverconstrainedError') && selectedAudioInputId) {
      return 'Selected microphone is unavailable. Reconnect your interface or choose another input.'
    }
    return 'Could not access camera. Please check your device.'
  }, [selectedAudioInputId, selectedVideoInputId])

  const getAudioErrorMessage = useCallback((e) => {
    if (!e?.name) return 'Microphone unavailable. Video preview is ready; choose another microphone if needed.'
    if (e.name === 'NotAllowedError') return 'Microphone permission denied. Video preview is ready; allow microphone access if you want audio.'
    if (e.name === 'NotReadableError' || e.name === 'AbortError') return 'Microphone is busy. Video preview is ready; close other apps using the mic and try again.'
    if ((e.name === 'NotFoundError' || e.name === 'OverconstrainedError') && selectedAudioInputId) {
      return 'Selected microphone is unavailable. Video preview is ready; choose another microphone if needed.'
    }
    return 'Microphone unavailable. Video preview is ready; choose another microphone if needed.'
  }, [selectedAudioInputId])

  const getUserMediaWithTimeout = useCallback((constraints, timeoutMs = 8000) => {
    let timeoutId = null
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = window.setTimeout(() => {
        const timeoutError = new Error('Timed out waiting for media device')
        timeoutError.name = 'AbortError'
        reject(timeoutError)
      }, timeoutMs)
    })

    return Promise.race([
      navigator.mediaDevices.getUserMedia(constraints),
      timeoutPromise,
    ]).finally(() => {
      if (timeoutId) window.clearTimeout(timeoutId)
    })
  }, [])

  const getDisplayMediaWithTimeout = useCallback((constraints, timeoutMs = 10000) => {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      const unsupportedError = new Error('Screen capture not supported in this browser')
      unsupportedError.name = 'NotSupportedError'
      throw unsupportedError
    }

    let timeoutId = null
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = window.setTimeout(() => {
        const timeoutError = new Error('Timed out waiting for screen capture')
        timeoutError.name = 'AbortError'
        reject(timeoutError)
      }, timeoutMs)
    })

    return Promise.race([
      navigator.mediaDevices.getDisplayMedia(constraints),
      timeoutPromise,
    ]).finally(() => {
      if (timeoutId) window.clearTimeout(timeoutId)
    })
  }, [])

  const mergeStreams = useCallback((videoStream, audioStream = null) => {
    const tracks = [
      ...(videoStream?.getVideoTracks?.() || []),
      ...(audioStream?.getAudioTracks?.() || []),
    ]
    return new MediaStream(tracks)
  }, [])

  const openUserMediaWithFallback = useCallback(async ({ size = 'default' } = {}) => {
    const devices = await refreshMediaDevices()

    let videoInputId = selectedVideoInputId
    let audioInputId = selectedAudioInputId

    if (videoInputId && !devices?.videoInputs?.some((device) => device.deviceId === videoInputId)) {
      videoInputId = ''
      setSelectedVideoInputId('')
    }

    if (audioInputId && !devices?.audioInputs?.some((device) => device.deviceId === audioInputId)) {
      audioInputId = ''
      setSelectedAudioInputId('')
    }

    const attempts = []
    const seen = new Set()
    const pushAttempt = (nextVideoInputId, nextAudioInputId) => {
      const key = `${nextVideoInputId || 'default-video'}::${nextAudioInputId || 'default-audio'}`
      if (seen.has(key)) return
      seen.add(key)
      attempts.push({ videoInputId: nextVideoInputId, audioInputId: nextAudioInputId })
    }

    pushAttempt(videoInputId, audioInputId)
    if (videoInputId) pushAttempt('', audioInputId)
    if (audioInputId) pushAttempt(videoInputId, '')
    if (videoInputId || audioInputId) pushAttempt('', '')

    let lastError = null

    for (const attempt of attempts) {
      try {
        const videoStream = await getUserMediaWithTimeout({
          video: getVideoConstraints(size, attempt.videoInputId),
          audio: false,
        }, 8000)

        let audioStream = null
        let audioWarning = ''
        try {
          audioStream = await getUserMediaWithTimeout({
            video: false,
            audio: getAudioConstraints(attempt.audioInputId),
          }, 5000)
        } catch (audioError) {
          audioWarning = getAudioErrorMessage(audioError)
        }

        const stream = mergeStreams(videoStream, audioStream)

        if (attempt.videoInputId !== selectedVideoInputId) {
          setSelectedVideoInputId(attempt.videoInputId)
        }
        if (attempt.audioInputId !== selectedAudioInputId) {
          setSelectedAudioInputId(attempt.audioInputId)
        }

        setWarning(audioWarning || null)

        return stream
      } catch (error) {
        lastError = error
        if (error?.name === 'NotAllowedError') {
          throw error
        }
        if (!['NotReadableError', 'AbortError', 'NotFoundError', 'OverconstrainedError'].includes(String(error?.name || ''))) {
          throw error
        }
      }
    }

    throw lastError || new Error('Could not access camera.')
  }, [getAudioConstraints, getVideoConstraints, refreshMediaDevices, selectedAudioInputId, selectedVideoInputId])

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
        const micGainNode = audioContext.createGain()
        micGainNode.gain.value = micGain
        micGainNodeRef.current = micGainNode
        const analyser = audioContext.createAnalyser()
        analyser.fftSize = 2048
        analyserRef.current = analyser
        micSource.connect(micGainNode)
        micGainNode.connect(analyser)
        analyser.connect(destination)
        if (!meterRafRef.current) {
          const data = new Float32Array(analyser.frequencyBinCount)
          const tick = () => {
            try {
              analyser.getFloatTimeDomainData(data)
              let peak = 0
              for (let i = 0; i < data.length; i++) {
                const v = Math.abs(data[i])
                if (v > peak) peak = v
              }
              setMicLevel(peak)
            } catch {}
            meterRafRef.current = requestAnimationFrame(tick)
          }
          meterRafRef.current = requestAnimationFrame(tick)
        }
      }
    }

    if (audioContext.state === 'suspended') {
      try { audioContext.resume().catch(() => {}) } catch {}
    }

    const tracks = [...(stream?.getVideoTracks?.() || [])]
    const mixedAudioTrack = destination.stream.getAudioTracks()[0]
    if (mixedAudioTrack) tracks.push(mixedAudioTrack)
    mixedStreamRef.current = new MediaStream(tracks)
    return mixedStreamRef.current
  }, [])

  // Mix audio from multiple input streams (e.g., mic + system audio)
  const ensureAudioMixForStreams = useCallback(async (streams) => {
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
    }

    if (audioContext.state === 'suspended') {
      try { audioContext.resume().catch(() => {}) } catch {}
    }

    streams.forEach((s, idx) => {
      const audioTracks = s?.getAudioTracks?.() || []
      if (audioTracks.length) {
        const input = new MediaStream(audioTracks)
        try {
          const source = audioContext.createMediaStreamSource(input)
          const gain = audioContext.createGain()
          if (idx === 0) {
            gain.gain.value = micGain
            micGainNodeRef.current = gain
            const analyser = audioContext.createAnalyser()
            analyser.fftSize = 2048
            analyserRef.current = analyser
            source.connect(gain)
            gain.connect(analyser)
            analyser.connect(destination)
            if (!meterRafRef.current) {
              const data = new Float32Array(analyser.frequencyBinCount)
              const tick = () => {
                try {
                  analyser.getFloatTimeDomainData(data)
                  let peak = 0
                  for (let i = 0; i < data.length; i++) {
                    const v = Math.abs(data[i])
                    if (v > peak) peak = v
                  }
                  setMicLevel(peak)
                } catch {}
                meterRafRef.current = requestAnimationFrame(tick)
              }
              meterRafRef.current = requestAnimationFrame(tick)
            }
          } else {
            // Slightly lower system audio
            gain.gain.value = 0.8
            source.connect(gain)
            gain.connect(destination)
          }
        } catch {}
      }
    })

    return destination.stream
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
    const base = isAccent ? 0.16 : 0.11
    const mult = Math.max(0, Math.min(2, Number(clickGain) || 0))
    gain.gain.setValueAtTime(base * mult, audioContext.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.05)
    recordDelay.delayTime.value = metronomeRecordDelaySeconds()
    oscillator.connect(gain)
    gain.connect(audioContext.destination)
    gain.connect(recordDelay)
    recordDelay.connect(destination)
    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.055)
  }, [beatsPerBar, metronomeRecordDelaySeconds, clickGain])

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
    cancelCountIn()
    stopTimer()
    stopMetronome()
    stopStream()
    closeAudioContext()
    setRequestingPermissionLabel('camera')
    setState(STATES.REQUESTING)
    setError(null)
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera not supported')
      setWarning(null)
      const stream = await openUserMediaWithFallback({ size: 'default' })
      camStreamRef.current = stream
      streamRef.current = stream
      await ensureAudioMix(stream)
      await refreshMediaDevices()
      setMode('camera')
      setState(STATES.PREVIEWING)
      // Attach after state change triggers re-render with video element
      requestAnimationFrame(() => attachStream())
    } catch (e) {
      setError(getCaptureErrorMessage(e))
      setState(STATES.IDLE)
    }
  }

  // Screen + Camera (PiP)
  const openScreenCam = async () => {
    cancelCountIn()
    stopTimer()
    stopMetronome()
    stopStream()
    closeAudioContext()
    setRequestingPermissionLabel('screen and camera')
    setState(STATES.REQUESTING)
    setError(null)
    try {
      if (!navigator.mediaDevices?.getDisplayMedia) throw new Error('Screen capture not supported in this browser')
      setWarning(null)
      const displayVideo = await getDisplayMediaWithTimeout({
        video: { frameRate: { ideal: 30 } },
        audio: false,
      }, 10000)

      let displayAudio = null
      let displayAudioWarning = ''
      try {
        displayAudio = await getDisplayMediaWithTimeout({
          video: true,
          audio: true,
        }, 7000)
      } catch (audioError) {
        const isBlockingError = ['NotAllowedError', 'NotFoundError', 'AbortError'].includes(String(audioError?.name || ''))
        if (isBlockingError) {
          displayAudioWarning = 'Screen audio was unavailable, so this recording will use your mic audio only.'
        }
      }

      displayStreamRef.current = displayVideo
      if (displayAudio) {
        const sourceAudioTracks = displayAudio.getAudioTracks()
        if (sourceAudioTracks.length) {
          displayAudioStreamRef.current = new MediaStream([sourceAudioTracks[0].clone()])
        } else if (!displayAudioWarning) {
          displayAudioWarning = 'Screen audio was unavailable, so this recording will use your mic audio only.'
        }
        displayAudio.getTracks().forEach((track) => track.stop())
      }

      const cam = await openUserMediaWithFallback({ size: 'pip' })
      camStreamRef.current = cam
      await refreshMediaDevices()

      const screenVideo = document.createElement('video')
      screenVideo.muted = true
      screenVideo.playsInline = true
      screenVideo.srcObject = displayVideo
      await screenVideo.play().catch(() => {})

      const camVideo = document.createElement('video')
      camVideo.muted = true
      camVideo.playsInline = true
      camVideo.srcObject = cam
      await camVideo.play().catch(() => {})

      const canvas = document.createElement('canvas')
      const screenTrack = displayVideo.getVideoTracks()[0]
      const screenSettings = screenTrack?.getSettings?.() || {}
      const width = Number(screenSettings.width || 1280)
      const height = Number(screenSettings.height || 720)
      canvas.width = width
      canvas.height = height
      canvasSizeRef.current = { width, height }
      compositeCanvasRef.current = canvas
      const ctx = canvas.getContext('2d')

      const updateCamAspect = () => {
        const vw = camVideo.videoWidth || 16
        const vh = camVideo.videoHeight || 9
        if (vw && vh) camAspectRef.current = vh / vw
      }
      camVideo.addEventListener('loadedmetadata', updateCamAspect, { once: true })
      updateCamAspect()

      const draw = () => {
        try {
          ctx.clearRect(0, 0, width, height)
          ctx.drawImage(screenVideo, 0, 0, width, height)
          const { xFrac, yFrac, wFrac, radiusFrac, mirror } = pipStateRef.current
          const pipW = Math.max(40, Math.round(width * Math.min(0.8, Math.max(0.08, wFrac))))
          const pipH = Math.max(30, Math.round(pipW * (camAspectRef.current || 9 / 16)))
          const maxX = width - pipW
          const maxY = height - pipH
          const x = Math.min(maxX, Math.max(0, Math.round(xFrac * width)))
          const y = Math.min(maxY, Math.max(0, Math.round(yFrac * height)))
          ctx.save()
          const r = Math.max(8, Math.round(pipW * Math.min(0.25, Math.max(0, radiusFrac))))
          ctx.beginPath()
          ctx.moveTo(x + r, y)
          ctx.arcTo(x + pipW, y, x + pipW, y + pipH, r)
          ctx.arcTo(x + pipW, y + pipH, x, y + pipH, r)
          ctx.arcTo(x, y + pipH, x, y, r)
          ctx.arcTo(x, y, x + pipW, y, r)
          ctx.closePath()
          ctx.clip()
          if (mirror) {
            ctx.save()
            ctx.translate(x + pipW, y)
            ctx.scale(-1, 1)
            ctx.drawImage(camVideo, 0, 0, pipW, pipH)
            ctx.restore()
          } else {
            ctx.drawImage(camVideo, x, y, pipW, pipH)
          }
          ctx.restore()
        } catch {}
        compositeRafRef.current = requestAnimationFrame(draw)
      }
      draw()

      const compositeVideoStream = canvas.captureStream(30)
      const audioMix = await ensureAudioMixForStreams([cam, displayVideo, displayAudioStreamRef.current])

      const finalTracks = []
      const cvt = compositeVideoStream.getVideoTracks()[0]
      if (cvt) finalTracks.push(cvt)
      const at = audioMix?.getAudioTracks?.()[0]
      if (at) finalTracks.push(at)
      const finalStream = new MediaStream(finalTracks)

      mixedStreamRef.current = finalStream
      streamRef.current = finalStream
      setWarning(displayAudioWarning || null)
      setMode('screen_cam')
      setState(STATES.PREVIEWING)
      requestAnimationFrame(() => attachStream())

      // If share is stopped via browser UI
      displayVideo.getVideoTracks().forEach((t) => {
        t.onended = () => {
          stopRecording()
          cleanup()
          setMode('camera')
          setState(STATES.IDLE)
        }
      })
    } catch (e) {
      const message = e?.name === 'NotAllowedError'
        ? 'Screen sharing was blocked. Allow screen access to use Screen + Cam, or use single-cam mode.'
        : e?.name === 'AbortError'
          ? 'Screen capture took too long to start. Try again, or switch to Single-cam first and then add screen.'
        : ((e?.name === 'NotFoundError' || e?.name === 'OverconstrainedError') && selectedVideoInputId)
            ? 'Selected camera is unavailable. Reconnect it or choose another camera.'
        : ((e?.name === 'NotFoundError' || e?.name === 'OverconstrainedError') && selectedAudioInputId)
            ? 'Selected microphone is unavailable. Reconnect your interface or choose another input.'
            : (e?.message || 'Could not start screen capture.')
      stopStream()
      closeAudioContext()
      setError(message)
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
      // Auto-select the recorded video for the parent (optional + guard for accidental short clips)
      const shouldAutoUse = Boolean(autoUseOnStop) && (Number(minAutoUseSeconds) <= 0 || Number(elapsed) >= Number(minAutoUseSeconds))
      if (shouldAutoUse) {
        try { onRecorded?.(file, blobUrlRef.current) } catch {}
      }
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

  // ── Music mode & mic controls ──
  useEffect(() => {
    if (micGainNodeRef.current) {
      try { micGainNodeRef.current.gain.value = micGain } catch {}
    }
  }, [micGain])

  const applyMicProcessing = useCallback(async (enabled) => {
    // Try to flip browser DSP on the mic track without restarting streams
    const track = camStreamRef.current?.getAudioTracks?.()[0]
    if (!track || !track.applyConstraints) return
    try {
      await track.applyConstraints({
        echoCancellation: !enabled,
        noiseSuppression: !enabled,
        autoGainControl: !enabled,
      })
    } catch {}
  }, [])

  useEffect(() => {
    applyMicProcessing(Boolean(musicMode))
  }, [applyMicProcessing, musicMode])

  useEffect(() => {
    if (error || warning) {
      setShowOptions(true)
    }
  }, [error, warning])

  // ── Actions ──

  const handleUse = () => {
    if (recordedFile) onRecorded(recordedFile, blobUrlRef.current)
  }

  const handleReRecord = () => {
    setRecordedFile(null)
    if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null }
    setElapsed(0)
    cancelCountIn()
    if (mode === 'screen_cam') {
      openScreenCam()
    } else {
      openCamera()
    }
  }

  const handleCancel = () => {
    cleanup()
    setState(STATES.IDLE)
    setRecordedFile(null)
    setElapsed(0)
    setWarning(null)
    onCancel()
  }

  // ── Timer display ──

  const fmtTimer = (s) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  const timerProgress = maxDuration > 0 ? Math.min(elapsed / maxDuration, 1) : 0
  const hasNamedAudioInputs = audioInputs.some((device) => device.label)
  const hasNamedVideoInputs = videoInputs.some((device) => device.label)
  const selectedVideoLabel = videoInputs.find((device) => device.deviceId === selectedVideoInputId)?.label || ''
  const selectedAudioLabel = audioInputs.find((device) => device.deviceId === selectedAudioInputId)?.label || ''
  const optionsSummary = `${selectedVideoLabel || 'Default camera'} · ${selectedAudioLabel || 'Default mic'}`

  const renderVideoInputPicker = (extraClassName = '') => (
    <div className={extraClassName}>
      <label className="block text-[11px] uppercase tracking-wide text-white/60 mb-2">Camera input</label>
      <select
        value={selectedVideoInputId}
        onChange={(e) => setSelectedVideoInputId(e.target.value)}
        disabled={state === STATES.RECORDING}
        className="w-full max-w-sm bg-white/10 text-white text-sm rounded-xl px-3 py-2 border border-white/10 disabled:opacity-60"
      >
        <option value="" className="text-gray-900">System default camera</option>
        {videoInputs.map((device, index) => (
          <option key={device.deviceId || `video-input-${index}`} value={device.deviceId} className="text-gray-900">
            {getVideoInputLabel(device, index)}
          </option>
        ))}
      </select>
      <p className="mt-2 text-[11px] text-white/55">
        Choose the camera you want to use for recorder preview and capture.
      </p>
      {!hasNamedVideoInputs ? (
        <p className="mt-1 text-[11px] text-white/45">Allow camera access once to reveal device names.</p>
      ) : null}
      {(state === STATES.PREVIEWING || state === STATES.RECORDED) ? (
        <p className="mt-1 text-[11px] text-white/45">If you switch cameras, close and reopen the recorder preview to apply it.</p>
      ) : null}
    </div>
  )

  const renderAudioInputPicker = (extraClassName = '') => (
    <div className={extraClassName}>
      <label className="block text-[11px] uppercase tracking-wide text-white/60 mb-2">Microphone input</label>
      <select
        value={selectedAudioInputId}
        onChange={(e) => setSelectedAudioInputId(e.target.value)}
        disabled={state === STATES.RECORDING}
        className="w-full max-w-sm bg-white/10 text-white text-sm rounded-xl px-3 py-2 border border-white/10 disabled:opacity-60"
      >
        <option value="" className="text-gray-900">System default microphone</option>
        {audioInputs.map((device, index) => (
          <option key={device.deviceId || `audio-input-${index}`} value={device.deviceId} className="text-gray-900">
            {getAudioInputLabel(device, index)}
          </option>
        ))}
      </select>
      <p className="mt-2 text-[11px] text-white/55">
        Choose your Scarlett or a loopback input here. Use Screen + Cam with shared audio to include browser or tab sound.
      </p>
      {!hasNamedAudioInputs ? (
        <p className="mt-1 text-[11px] text-white/45">Allow mic access once to reveal device names like Scarlett or Loopback.</p>
      ) : null}
      {(state === STATES.PREVIEWING || state === STATES.RECORDED) ? (
        <p className="mt-1 text-[11px] text-white/45">If you switch inputs, close and reopen the recorder preview to apply it.</p>
      ) : null}
    </div>
  )

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
              <div className="w-full max-w-3xl pt-2">
                <button
                  type="button"
                  onClick={() => setShowOptions((current) => !current)}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-left hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-white/60">Options</p>
                      <p className="mt-1 text-sm text-white/85">{optionsSummary}</p>
                    </div>
                    <span className="text-xs text-white/55">{showOptions ? 'Hide' : 'Show'}</span>
                  </div>
                </button>
                {showOptions ? (
                  <div className="grid gap-3 pt-3 md:grid-cols-2">
                    {renderVideoInputPicker()}
                    {renderAudioInputPicker()}
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <div className="w-full max-w-md space-y-3">
                <p className="text-center text-xs text-white/55">Start with single-cam for the fastest flow. Add screen only when needed.</p>
                <button
                  onClick={openCamera}
                  className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-4 hover:bg-white/15 transition-all duration-200"
                >
                  <div className="flex items-center gap-3 text-left">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">Single-cam</p>
                      <p className="mt-1 text-xs text-white/55">Record with camera and microphone.</p>
                    </div>
                  </div>
                </button>
                <button
                  onClick={openScreenCam}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-4 hover:bg-white/10 transition-all duration-200"
                  title="Record screen + camera"
                >
                  <div className="flex items-center gap-3 text-left">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10">
                      <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <rect x="3" y="5" width="14" height="10" rx="2" ry="2" strokeWidth="1.5"/>
                        <path d="M21 7l-4 3 4 3V7z" strokeWidth="1.5"/>
                        <circle cx="9" cy="15.5" r="2.5" fill="currentColor" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">Add screen (optional)</p>
                      <p className="mt-1 text-xs text-white/55">Share your screen while keeping yourself in frame.</p>
                    </div>
                  </div>
                </button>
              </div>
              <div className="w-full max-w-3xl pt-2">
                <button
                  type="button"
                  onClick={() => setShowOptions((current) => !current)}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-left hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-white/60">Options</p>
                      <p className="mt-1 text-sm text-white/85">{optionsSummary}</p>
                    </div>
                    <span className="text-xs text-white/55">{showOptions ? 'Hide' : 'Show'}</span>
                  </div>
                </button>
                {showOptions ? (
                  <div className="grid gap-3 pt-3 md:grid-cols-2">
                    {renderVideoInputPicker()}
                    {renderAudioInputPicker()}
                  </div>
                ) : null}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── REQUESTING PERMISSION ── */}
      {state === STATES.REQUESTING && (
        <div className="aspect-video flex flex-col items-center justify-center gap-3">
          <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          <p className="text-xs text-white/50">Requesting {requestingPermissionLabel} access...</p>
        </div>
      )}

      {/* ── LIVE PREVIEW / RECORDING ── */}
      {(state === STATES.PREVIEWING || state === STATES.RECORDING) && (
        <div className="bg-gray-950 relative" ref={videoContainerRef}>
          <video
            ref={setLiveRef}
            autoPlay
            muted
            playsInline
            className="w-full aspect-video object-cover"
            style={{ transform: mode === 'camera' ? 'scaleX(-1)' : 'none' }}
          />

          {mode === 'screen_cam' && (
            <PiPOverlay
              videoContainerRef={videoContainerRef}
              pipStateRef={pipStateRef}
              canvasSizeRef={canvasSizeRef}
              camAspectRef={camAspectRef}
              draggingRef={draggingRef}
            />
          )}

          <div className="p-4 bg-gray-950 space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="rounded-full bg-white/10 px-3 py-1.5 text-xs text-white/90">
                  {countInRemaining ? `Starting in ${countInRemaining}` : state === STATES.RECORDING ? 'Recording' : 'Camera ready'}
              </div>
              <div className="rounded-full bg-white/10 px-3 py-1.5 text-xs text-white/70">
                {state === STATES.RECORDING ? fmtTimer(elapsed) : `Max ${fmtTimer(maxDuration)}`}
              </div>
            </div>
            <div className="space-y-3">
              {state === STATES.PREVIEWING ? (
                <div className="flex flex-wrap gap-2">
                  {mode === 'camera' ? (
                    <button
                      type="button"
                      onClick={openScreenCam}
                      className="rounded-full px-3 py-1.5 text-xs transition-colors bg-white/10 text-white/80 hover:bg-white/20"
                    >
                      Add screen (optional)
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={openCamera}
                      className="rounded-full px-3 py-1.5 text-xs transition-colors bg-white/10 text-white/80 hover:bg-white/20"
                    >
                      Back to single-cam
                    </button>
                  )}
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => setShowOptions((current) => !current)}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-left hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-white/60">Options</p>
                    <p className="mt-1 text-sm text-white/85">{optionsSummary}</p>
                  </div>
                  <span className="text-xs text-white/55">{showOptions ? 'Hide' : 'Show'}</span>
                </div>
              </button>

              {showOptions ? (
                <div className="space-y-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    {renderVideoInputPicker('rounded-2xl bg-white/5 px-3 py-3')}
                    {renderAudioInputPicker('rounded-2xl bg-white/5 px-3 py-3')}
                  </div>

                  <div className="rounded-2xl bg-white/5 px-3 py-3 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-white/60">Audio</p>
                        <p className="text-sm text-white/85">{musicMode ? 'Music mode on' : 'Standard mode'}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setMusicMode((current) => !current)}
                        title="Music mode (disables noise suppression/AGC/echo cancel)"
                        className={`rounded-full px-3 py-1.5 text-xs transition-colors ${musicMode ? 'bg-emerald-500 text-white' : 'bg-white/10 text-white/80 hover:bg-white/20'}`}
                      >
                        {musicMode ? 'Music' : 'Standard'}
                      </button>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[11px] text-white/55">
                        <span>Mic level</span>
                        <span>{Math.min(100, Math.round((micLevel * 3) * 100))}%</span>
                      </div>
                      <div title="Mic level" className="h-1.5 rounded bg-white/10 overflow-hidden">
                        <div className="h-full bg-white/80" style={{ width: `${Math.min(100, Math.round((micLevel * 3) * 100))}%` }} />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[11px] text-white/55">
                        <span>Mic gain</span>
                        <span>{Math.round(micGain * 100)}%</span>
                      </div>
                      <input
                        title="Mic gain"
                        type="range"
                        min="0.5"
                        max="2"
                        step="0.01"
                        value={micGain}
                        onChange={(e) => setMicGain(Number(e.target.value))}
                        className="w-full accent-white/90"
                      />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setShowTimingTools((current) => !current)}
                        className="rounded-full px-3 py-1.5 text-xs transition-colors bg-white/10 text-white/80 hover:bg-white/20"
                      >
                        {showTimingTools ? 'Hide timing' : 'Timing'}
                      </button>
                      {mode === 'screen_cam' && (
                        <button
                          type="button"
                          onClick={() => setShowPipControls((current) => !current)}
                          className="rounded-full px-3 py-1.5 text-xs transition-colors bg-white/10 text-white/80 hover:bg-white/20"
                        >
                          {showPipControls ? 'Hide PiP' : 'PiP'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {warning ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-amber-800">Microphone warning</p>
                <p className="mt-1 text-sm text-amber-900">{warning}</p>
              </div>
            ) : null}

            {showTimingTools ? (
              <div className="space-y-3">
                <div className="rounded-2xl bg-white/5 px-3 py-3 flex items-center gap-3">
                  <div className="w-full space-y-3">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <p className="text-[11px] uppercase tracking-wide text-white/60">Tempo</p>
                        <p className="text-sm font-medium text-white">Dial in the click precisely on phone.</p>
                      </div>
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

                    <div className="rounded-2xl border border-white/10 bg-black/10 px-3 py-3 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => nudgeBpm(-5)}
                          className="rounded-xl px-3 py-2 text-sm bg-white/10 text-white/80 hover:bg-white/20 transition-colors"
                        >
                          -5
                        </button>
                        <button
                          type="button"
                          onClick={() => nudgeBpm(-1)}
                          className="rounded-xl px-3 py-2 text-sm bg-white/10 text-white/80 hover:bg-white/20 transition-colors"
                        >
                          -1
                        </button>
                        <div className="flex-1 min-w-[128px] text-center">
                          <label className="block text-[11px] uppercase tracking-wide text-white/50">BPM</label>
                          <input
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={bpmInput}
                            onChange={(e) => setBpmInput(e.target.value.replace(/[^0-9]/g, '').slice(0, 3))}
                            onBlur={() => updateBpm(bpmInput || bpm)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                updateBpm(bpmInput || bpm)
                              }
                            }}
                            className="mt-1 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-center text-xl font-semibold text-white focus:outline-none focus:border-white/30"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => nudgeBpm(1)}
                          className="rounded-xl px-3 py-2 text-sm bg-white/10 text-white/80 hover:bg-white/20 transition-colors"
                        >
                          +1
                        </button>
                        <button
                          type="button"
                          onClick={() => nudgeBpm(5)}
                          className="rounded-xl px-3 py-2 text-sm bg-white/10 text-white/80 hover:bg-white/20 transition-colors"
                        >
                          +5
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {BPM_PRESETS.map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => updateBpm(preset)}
                            className={`rounded-full px-3 py-1.5 text-xs transition-colors ${bpm === preset ? 'bg-white text-gray-900' : 'bg-white/10 text-white/80 hover:bg-white/20'}`}
                          >
                            {preset}
                          </button>
                        ))}
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-white/50">
                          <span>Fine tune</span>
                          <span>{bpm} BPM</span>
                        </div>
                        <input
                          type="range"
                          min={String(MIN_BPM)}
                          max={String(MAX_BPM)}
                          step="1"
                          value={bpm}
                          onChange={(e) => updateBpm(e.target.value)}
                          className="w-full"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl bg-white/5 px-3 py-3 space-y-3">
                  <div className="flex items-center justify-between gap-3">
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
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-[11px] uppercase tracking-wide text-white/60">Click volume</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="0"
                        max="2"
                        step="0.01"
                        value={clickGain}
                        onChange={(e) => setClickGain(Number(e.target.value))}
                        className="w-40"
                        aria-label="Click volume"
                      />
                      <span className="text-xs text-white/70 w-10 text-right">{Math.round(clickGain * 100)}%</span>
                    </div>
                  </div>
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

            {mode === 'screen_cam' && showPipControls ? (
              <div className="space-y-3">
                <div className="rounded-2xl bg-white/5 px-3 py-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-white/60">PiP position</p>
                    <p className="text-sm font-medium text-white">Drag overlay or quick-snap</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {['tl','tr','bl','br','center'].map((pos) => (
                      <button
                        key={pos}
                        onClick={() => {
                          const { width, height } = canvasSizeRef.current
                          const { wFrac } = pipStateRef.current
                          const pipW = width * wFrac
                          const pipH = pipW * (camAspectRef.current || 9/16)
                          const xFrac = pos === 'tr' || pos === 'br' ? (width - pipW) / width : pos === 'center' ? (width - pipW) / (2*width) : 0
                          const yFrac = pos === 'bl' || pos === 'br' ? (height - pipH) / height : pos === 'center' ? (height - pipH) / (2*height) : 0
                          pipStateRef.current = { ...pipStateRef.current, xFrac, yFrac }
                        }}
                        className="rounded-lg px-2 py-1 text-xs bg-white/10 text-white/80 hover:bg-white/20"
                      >
                        {pos.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl bg-white/5 px-3 py-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-white/60">PiP size</p>
                    <p className="text-sm font-medium text-white">Small / Medium / Large</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {[
                      {k:'S', v:0.16},
                      {k:'M', v:0.22},
                      {k:'L', v:0.3},
                    ].map(({k,v}) => (
                      <button key={k}
                        onClick={() => {
                          const { width, height } = canvasSizeRef.current
                          const wFrac = v
                          // Clamp position so PiP stays on-screen
                          const pipW = width * wFrac
                          const pipH = pipW * (camAspectRef.current || 9/16)
                          let { xFrac, yFrac } = pipStateRef.current
                          xFrac = Math.min(1 - pipW/width, Math.max(0, xFrac))
                          yFrac = Math.min(1 - pipH/height, Math.max(0, yFrac))
                          pipStateRef.current = { ...pipStateRef.current, wFrac, xFrac, yFrac }
                        }}
                        className="rounded-lg px-2 py-1 text-xs bg-white/10 text-white/80 hover:bg-white/20"
                      >{k}</button>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl bg-white/5 px-3 py-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-white/60">Roundness</p>
                    <p className="text-sm font-medium text-white">{Math.round((pipStateRef.current.radiusFrac || 0)*100)}%</p>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="0.25"
                    step="0.01"
                    defaultValue={pipStateRef.current.radiusFrac}
                    onChange={(e) => {
                      pipStateRef.current = { ...pipStateRef.current, radiusFrac: Number(e.target.value) }
                    }}
                    className="w-40"
                  />
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1 text-xs text-white/80">
                      <input type="checkbox" defaultChecked={pipStateRef.current.mirror}
                        onChange={(e) => { pipStateRef.current = { ...pipStateRef.current, mirror: e.target.checked } }} />
                      Mirror
                    </label>
                  </div>
                </div>
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

// Overlay component to drag/resize PiP when in screen+cam mode
function PiPOverlay({ videoContainerRef, pipStateRef, canvasSizeRef, camAspectRef, draggingRef }) {
  const [, force] = React.useReducer((x) => x + 1, 0)

  useEffect(() => {
    const onUp = () => { draggingRef.current = null }
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [draggingRef])

  const getCanvasPoint = (clientX, clientY) => {
    const el = videoContainerRef.current
    if (!el) return { x: 0, y: 0 }
    const rect = el.getBoundingClientRect()
    const { width: cw, height: ch } = canvasSizeRef.current
    const x = ((clientX - rect.left) / rect.width) * cw
    const y = ((clientY - rect.top) / rect.height) * ch
    return { x, y }
  }

  const onMove = (e) => {
    if (!draggingRef.current) return
    const { type, startX, startY, start } = draggingRef.current
    const { x, y } = getCanvasPoint(e.clientX, e.clientY)
    const { width, height } = canvasSizeRef.current
    const aspect = camAspectRef.current || 9/16
    const dx = x - startX
    const dy = y - startY
    if (type === 'move') {
      let xFrac = (start.xPx + dx) / width
      let yFrac = (start.yPx + dy) / height
      const pipW = width * start.wFrac
      const pipH = pipW * aspect
      xFrac = Math.min(1 - pipW / width, Math.max(0, xFrac))
      yFrac = Math.min(1 - pipH / height, Math.max(0, yFrac))
      pipStateRef.current = { ...pipStateRef.current, xFrac, yFrac }
      force()
    } else if (type === 'resize') {
      let wFrac = Math.max(0.08, Math.min(0.8, start.wFrac + dx / width))
      // Clamp position if new size would overflow
      const pipW = width * wFrac
      const pipH = pipW * aspect
      let xFrac = Math.min(1 - pipW / width, Math.max(0, start.xFrac))
      let yFrac = Math.min(1 - pipH / height, Math.max(0, start.yFrac))
      pipStateRef.current = { ...pipStateRef.current, wFrac, xFrac, yFrac }
      force()
    }
  }

  const startMove = (e) => {
    const { x, y } = getCanvasPoint(e.clientX, e.clientY)
    const { width, height } = canvasSizeRef.current
    const { xFrac, yFrac, wFrac } = pipStateRef.current
    draggingRef.current = {
      type: 'move',
      startX: x,
      startY: y,
      start: { xPx: xFrac * width, yPx: yFrac * height, wFrac },
    }
    window.addEventListener('pointermove', onMove)
  }

  const startResize = (e) => {
    const { x, y } = getCanvasPoint(e.clientX, e.clientY)
    const { xFrac, yFrac, wFrac } = pipStateRef.current
    draggingRef.current = { type: 'resize', startX: x, startY: y, start: { xFrac, yFrac, wFrac } }
    window.addEventListener('pointermove', onMove)
  }

  useEffect(() => {
    return () => { window.removeEventListener('pointermove', onMove) }
  }, [])

  // Render overlay box sized to PiP
  const el = videoContainerRef.current
  const rect = el?.getBoundingClientRect()
  const widthPx = rect?.width || 0
  const heightPx = rect?.height || 0
  const { xFrac, yFrac, wFrac } = pipStateRef.current
  const pipWidthPx = widthPx * wFrac
  const pipHeightPx = pipWidthPx * (camAspectRef.current || 9 / 16)
  const left = widthPx * xFrac
  const top = heightPx * yFrac

  return (
    <div className="absolute inset-0 pointer-events-none">
      <div
        className="absolute ring-1 ring-white/30 rounded-xl bg-black/10 pointer-events-auto"
        style={{ left, top, width: pipWidthPx, height: pipHeightPx, backdropFilter: 'saturate(120%)' }}
        onPointerDown={startMove}
      >
        {/* Resize handle (bottom-right) */}
        <button
          type="button"
          onPointerDown={(e) => { e.stopPropagation(); startResize(e) }}
          className="absolute -bottom-3 -right-3 w-7 h-7 rounded-full bg-white/80 text-gray-900 flex items-center justify-center shadow"
          title="Resize"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 20L20 4M10 20h10V10" />
          </svg>
        </button>
        {/* Drag affordance */}
        <div className="absolute left-1 top-1 px-2 py-0.5 text-[10px] rounded bg-white/80 text-gray-900">Drag</div>
      </div>
    </div>
  )
}
