import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useToast } from './Toast'
import TagInput from './TagInput'
import { fmtTimer, uploadErrorMessage, uploadFormData } from '../utils'

const STEPS = { IDLE: 'idle', PREVIEWING: 'previewing', RECORDING: 'recording', REVIEW: 'review' }

function ScreenRecord({ token, spaces = [], onComplete, onCancel }) {
  const toast = useToast()
  const [step, setStep] = useState(STEPS.IDLE)
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState([])
  const [selectedSpace, setSelectedSpace] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(null)
  const [recordedFile, setRecordedFile] = useState(null)
  const [showCamera, setShowCamera] = useState(true)

  const canvasRef = useRef(null)
  const screenVideoRef = useRef(null)
  const cameraVideoRef = useRef(null)
  const playbackRef = useRef(null)
  const screenStreamRef = useRef(null)
  const cameraStreamRef = useRef(null)
  const compositeStreamRef = useRef(null)
  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const animFrameRef = useRef(null)
  const blobUrlRef = useRef(null)

  // ── Cleanup ──
  const stopStreams = useCallback(() => {
    screenStreamRef.current?.getTracks().forEach(t => t.stop())
    cameraStreamRef.current?.getTracks().forEach(t => t.stop())
    screenStreamRef.current = null
    cameraStreamRef.current = null
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
  }, [])

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }, [])

  useEffect(() => () => {
    stopTimer()
    stopStreams()
    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
  }, [stopTimer, stopStreams])

  // ── Start screen + camera capture ──
  const startCapture = async () => {
    setError(null)
    try {
      // Request screen sharing
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: true, // system audio if available
      })
      screenStreamRef.current = screenStream

      // When user stops sharing via browser UI, handle it
      screenStream.getVideoTracks()[0].onended = () => {
        if (step === STEPS.RECORDING) stopRecording()
        else { stopStreams(); setStep(STEPS.IDLE) }
      }

      // Request camera (optional — might fail on desktop without webcam)
      try {
        const cameraStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 320 }, height: { ideal: 240 }, facingMode: 'user' },
          audio: true, // mic audio
        })
        cameraStreamRef.current = cameraStream
        if (cameraVideoRef.current) {
          cameraVideoRef.current.srcObject = cameraStream
          cameraVideoRef.current.play().catch(() => {})
        }
      } catch {
        setShowCamera(false)
      }

      // Set up screen video element
      if (screenVideoRef.current) {
        screenVideoRef.current.srcObject = screenStream
        screenVideoRef.current.play().catch(() => {})
      }

      setStep(STEPS.PREVIEWING)
    } catch (e) {
      if (e.name === 'NotAllowedError') {
        setError('Screen sharing was denied.')
      } else {
        setError('Could not start screen capture.')
      }
    }
  }

  // ── Canvas compositing: screen + camera overlay ──
  const startCompositing = () => {
    const canvas = canvasRef.current
    if (!canvas) return null

    const screenVideo = screenVideoRef.current
    const cameraVideo = cameraVideoRef.current
    const ctx = canvas.getContext('2d')

    canvas.width = 1920
    canvas.height = 1080

    const draw = () => {
      // Draw screen (full canvas)
      if (screenVideo && screenVideo.readyState >= 2) {
        ctx.drawImage(screenVideo, 0, 0, canvas.width, canvas.height)
      }

      // Draw camera overlay (bottom-right corner, rounded)
      if (showCamera && cameraVideo && cameraVideo.readyState >= 2 && cameraStreamRef.current) {
        const camW = 280
        const camH = 210
        const padding = 20
        const x = canvas.width - camW - padding
        const y = canvas.height - camH - padding
        const radius = 12

        ctx.save()
        // Rounded rectangle clip
        ctx.beginPath()
        ctx.moveTo(x + radius, y)
        ctx.lineTo(x + camW - radius, y)
        ctx.quadraticCurveTo(x + camW, y, x + camW, y + radius)
        ctx.lineTo(x + camW, y + camH - radius)
        ctx.quadraticCurveTo(x + camW, y + camH, x + camW - radius, y + camH)
        ctx.lineTo(x + radius, y + camH)
        ctx.quadraticCurveTo(x, y + camH, x, y + camH - radius)
        ctx.lineTo(x, y + radius)
        ctx.quadraticCurveTo(x, y, x + radius, y)
        ctx.closePath()
        ctx.clip()

        // Mirror the camera (selfie view)
        ctx.translate(x + camW, y)
        ctx.scale(-1, 1)
        ctx.drawImage(cameraVideo, 0, 0, camW, camH)
        ctx.restore()

        // Border
        ctx.strokeStyle = 'rgba(255,255,255,0.3)'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(x + radius, y)
        ctx.lineTo(x + camW - radius, y)
        ctx.quadraticCurveTo(x + camW, y, x + camW, y + radius)
        ctx.lineTo(x + camW, y + camH - radius)
        ctx.quadraticCurveTo(x + camW, y + camH, x + camW - radius, y + camH)
        ctx.lineTo(x + radius, y + camH)
        ctx.quadraticCurveTo(x, y + camH, x, y + camH - radius)
        ctx.lineTo(x, y + radius)
        ctx.quadraticCurveTo(x, y, x + radius, y)
        ctx.closePath()
        ctx.stroke()
      }

      animFrameRef.current = requestAnimationFrame(draw)
    }

    draw()

    // Create composite stream from canvas + audio
    const canvasStream = canvas.captureStream(30)

    // Mix audio: mic (camera stream) + system (screen stream)
    const audioCtx = new AudioContext()
    const dest = audioCtx.createMediaStreamDestination()

    if (cameraStreamRef.current?.getAudioTracks().length > 0) {
      const micSource = audioCtx.createMediaStreamSource(cameraStreamRef.current)
      micSource.connect(dest)
    }
    if (screenStreamRef.current?.getAudioTracks().length > 0) {
      const sysSource = audioCtx.createMediaStreamSource(screenStreamRef.current)
      sysSource.connect(dest)
    }

    // Combine canvas video + mixed audio
    const tracks = [...canvasStream.getVideoTracks(), ...dest.stream.getAudioTracks()]
    return new MediaStream(tracks)
  }

  // ── Recording ──
  const startRecording = () => {
    const compositeStream = startCompositing()
    if (!compositeStream) return

    compositeStreamRef.current = compositeStream

    let mimeType = 'video/webm;codecs=vp9'
    if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm'
    if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/mp4'

    const recorder = new MediaRecorder(compositeStream, { mimeType })
    recorderRef.current = recorder
    chunksRef.current = []
    setElapsed(0)

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType })
      const ext = mimeType.includes('webm') ? 'webm' : 'mp4'
      const file = new File([blob], `screen-${Date.now()}.${ext}`, { type: mimeType })
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
      blobUrlRef.current = URL.createObjectURL(blob)
      setRecordedFile(file)
      stopStreams()
      setStep(STEPS.REVIEW)
    }

    recorder.start(1000)
    setStep(STEPS.RECORDING)

    const startTime = Date.now()
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000))
    }, 250)
  }

  const stopRecording = () => {
    stopTimer()
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
  }

  // ── Save ──
  const saveSession = async () => {
    if (!recordedFile) return
    const now = new Date()
    const timeOfDay = now.getHours() < 12 ? 'Morning' : now.getHours() < 17 ? 'Afternoon' : 'Evening'
    const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
    const sessionTitle = title.trim() || `${timeOfDay} Screen Recording — ${dateStr}`

    setSaving(true)
    setUploadProgress(0)
    let success = false
    try {
      const fd = new FormData()
      fd.append('title', sessionTitle)
      fd.append('description', description.trim())
      fd.append('video_file', recordedFile)
      fd.append('duration_seconds', elapsed)
      if (tags.length > 0) fd.append('tags', tags.join(','))
      if (selectedSpace) fd.append('space', selectedSpace)

      const res = await uploadFormData({
        url: '/api/sessions/',
        formData: fd,
        token,
        onProgress: (percent) => setUploadProgress(percent),
      })
      if (res.ok) {
        success = true
        const session = res.data
        toast.success('Session saved')
        onComplete(session)
      } else {
        toast.error(uploadErrorMessage(res))
      }
    } catch { toast.error('Error saving') }
    finally {
      setSaving(false)
      if (!success) setUploadProgress(null)
    }
  }

  const handleDiscard = () => {
    if (!confirm('Discard this recording?')) return
    stopTimer()
    stopStreams()
    if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null }
    setRecordedFile(null)
    setElapsed(0)
    onCancel()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Hidden elements for capture */}
      <video ref={screenVideoRef} className="hidden" muted playsInline />
      <video ref={cameraVideoRef} className="hidden" muted playsInline />
      <canvas ref={canvasRef} className="hidden" />

      {/* ── IDLE — start screen share ── */}
      {step === STEPS.IDLE && (
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          {error ? (
            <>
              <p className="text-sm text-red-400 text-center mb-4">{error}</p>
              <button onClick={startCapture} className="text-sm text-white/60 underline">Try again</button>
              <button onClick={onCancel} className="text-sm text-white/40 mt-4">Cancel</button>
            </>
          ) : (
            <>
              <button
                onClick={startCapture}
                className="w-20 h-20 rounded-2xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all hover:scale-105 active:scale-95 mb-4"
              >
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
                </svg>
              </button>
              <p className="text-sm text-white/60 mb-1">Screen + Camera Recording</p>
              <p className="text-xs text-white/40 text-center max-w-[260px]">
                Captures your screen with camera overlay in the corner. Perfect for SUNO, tutorials, walkthroughs.
              </p>
              <button onClick={onCancel} className="text-sm text-white/30 mt-8">Cancel</button>
            </>
          )}
        </div>
      )}

      {/* ── PREVIEWING — screen shared, ready to record ── */}
      {step === STEPS.PREVIEWING && (
        <>
          <div className="flex-1 relative overflow-hidden bg-gray-950">
            <p className="absolute top-4 left-0 right-0 text-center text-xs text-white/50">
              Screen sharing active — tap Record to start
            </p>
          </div>
          <div className="bg-black px-4 pb-8 pt-6 safe-bottom">
            <div className="flex items-center justify-center gap-4">
              <button onClick={onCancel}
                className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <button onClick={startRecording}
                className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center active:scale-90 transition-transform">
                <div className="w-14 h-14 bg-red-500 rounded-full" />
              </button>
              <button onClick={() => setShowCamera(!showCamera)}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                  showCamera ? 'bg-white/20' : 'bg-white/5'
                }`}>
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
                </svg>
              </button>
            </div>
            <p className="text-center text-xs text-white/40 mt-3">
              {showCamera ? 'Camera on' : 'Camera off'} · Tap record to start
            </p>
          </div>
        </>
      )}

      {/* ── RECORDING ── */}
      {step === STEPS.RECORDING && (
        <>
          <div className="flex-1 relative overflow-hidden bg-gray-950 flex items-center justify-center">
            <div className="text-center">
              <div className="flex items-center gap-2 bg-red-500/20 rounded-full px-5 py-2.5 mb-3">
                <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                <span className="text-white font-mono text-lg font-medium">{fmtTimer(elapsed)}</span>
              </div>
              <p className="text-xs text-white/40">Recording screen{showCamera ? ' + camera' : ''}</p>
            </div>
          </div>
          <div className="bg-black px-4 pb-8 pt-6 safe-bottom">
            <div className="flex items-center justify-center">
              <button onClick={stopRecording}
                className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center active:scale-90 transition-transform">
                <div className="w-8 h-8 bg-red-500 rounded-md" />
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── REVIEW & SAVE ── */}
      {step === STEPS.REVIEW && recordedFile && (
        <div className="flex-1 flex flex-col">
          <div className="flex-1 relative bg-black">
            <video ref={playbackRef} src={blobUrlRef.current} controls playsInline
              className="absolute inset-0 w-full h-full object-contain" />
            <div className="absolute top-4 right-4 bg-black/50 backdrop-blur-sm text-white text-xs font-mono px-3 py-1.5 rounded-full">
              {fmtTimer(elapsed)}
            </div>
          </div>
          <div className="bg-white px-4 pt-5 pb-8 safe-bottom space-y-4">
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder={`${new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'} Screen Recording — ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}`}
              className="w-full px-0 py-2 text-base font-medium text-gray-900 placeholder-gray-300 border-b border-gray-200 focus:border-gray-900 focus:outline-none transition-colors"
              autoFocus />
            <textarea value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="What did you work on?" rows={2}
              className="w-full px-0 py-1 text-sm text-gray-700 placeholder-gray-300 border-b border-gray-100 focus:border-gray-400 focus:outline-none resize-none transition-colors" />
            {spaces.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {spaces.map(s => (
                  <button key={s.id} type="button" onClick={() => setSelectedSpace(selectedSpace === s.id ? '' : s.id)}
                    className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                      selectedSpace === s.id ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}>{s.name}</button>
                ))}
              </div>
            )}
            <TagInput value={tags} onChange={setTags} token={token} placeholder="e.g. SUNO, Songwriting" />
            {recordedFile && (
              <p className="text-xs text-gray-400">{fmtTimer(elapsed)} · {(recordedFile.size / 1024 / 1024).toFixed(1)} MB</p>
            )}
            {saving && (
              <div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gray-900 transition-all"
                    style={{ width: `${Math.max(uploadProgress ?? 5, 5)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Uploading{uploadProgress !== null ? ` ${uploadProgress}%` : '...'} · Max 2GB
                </p>
              </div>
            )}
            <div className="flex gap-3 pt-1">
              <button onClick={handleDiscard}
                className="flex-1 text-sm text-gray-500 border border-gray-200 rounded-xl py-3 hover:bg-gray-50 transition-colors">Discard</button>
              <button onClick={saveSession} disabled={saving}
                className="flex-1 text-sm font-medium text-white bg-gray-900 rounded-xl py-3 hover:bg-gray-800 disabled:opacity-40 transition-colors active:scale-[0.98]">
                {saving ? `Uploading${uploadProgress !== null ? ` ${uploadProgress}%` : '...'}` : 'Save & add chapters'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ScreenRecord
