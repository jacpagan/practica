import React, { useState, useRef, useEffect, useCallback } from 'react'
import { authHeaders } from '../auth'
import { useToast } from './Toast'
import TagInput from './TagInput'
import { fmtTimer } from '../utils'

const STEPS = { CAMERA: 'camera', RECORDING: 'recording', REVIEW: 'review', SAVE: 'save' }

function QuickRecord({ token, exercises, onComplete, onCancel }) {
  const toast = useToast()
  const [step, setStep] = useState(STEPS.CAMERA)
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState([])
  const [saving, setSaving] = useState(false)
  const [recordedFile, setRecordedFile] = useState(null)
  const [facing, setFacing] = useState('environment') // 'environment' (back) or 'user' (front)

  const liveRef = useRef(null)
  const playbackRef = useRef(null)
  const streamRef = useRef(null)
  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const blobUrlRef = useRef(null)
  const facingRef = useRef('environment')

  const headers = authHeaders(token)

  // ── Cleanup ──
  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    if (liveRef.current) liveRef.current.srcObject = null
  }, [])

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }, [])

  useEffect(() => () => {
    stopTimer()
    stopStream()
    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
  }, [stopTimer, stopStream])

  // ── Camera ──
  const openCamera = async (mode) => {
    const facingMode = mode || facingRef.current
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1920 }, height: { ideal: 1080 }, facingMode },
        audio: true,
      })
      streamRef.current = stream
      facingRef.current = facingMode
      setFacing(facingMode)
      if (liveRef.current) {
        liveRef.current.srcObject = stream
        await liveRef.current.play()
      }
      if (step !== STEPS.RECORDING) setStep(STEPS.CAMERA)
    } catch (e) {
      setError(e.name === 'NotAllowedError'
        ? 'Camera permission denied. Please allow access.'
        : 'Could not access camera.')
    }
  }

  const flipCamera = async () => {
    const newFacing = facingRef.current === 'environment' ? 'user' : 'environment'

    if (step === STEPS.RECORDING && recorderRef.current?.state === 'recording') {
      // Mid-recording flip: get new camera stream, replace video track
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1920 }, height: { ideal: 1080 }, facingMode: newFacing },
          audio: false, // keep existing audio track
        })
        const newVideoTrack = newStream.getVideoTracks()[0]

        // Replace video track in the live preview
        if (liveRef.current?.srcObject) {
          const oldVideoTrack = liveRef.current.srcObject.getVideoTracks()[0]
          if (oldVideoTrack) oldVideoTrack.stop()
          liveRef.current.srcObject.removeTrack(oldVideoTrack)
          liveRef.current.srcObject.addTrack(newVideoTrack)
        }

        // Replace video track in the recorder's stream
        if (streamRef.current) {
          const oldVideoTrack = streamRef.current.getVideoTracks()[0]
          if (oldVideoTrack) oldVideoTrack.stop()
          streamRef.current.removeTrack(oldVideoTrack)
          streamRef.current.addTrack(newVideoTrack)
        }

        facingRef.current = newFacing
        setFacing(newFacing)
      } catch {
        toast.error('Could not switch camera')
      }
    } else {
      // Not recording: just reopen camera
      stopStream()
      await openCamera(newFacing)
    }
  }

  // Auto-open on mount
  useEffect(() => { openCamera('environment') }, [])

  // ── Recording ──
  const startRecording = () => {
    if (!streamRef.current) return

    let mimeType = 'video/webm;codecs=vp9'
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
      const file = new File([blob], `practice-${Date.now()}.${ext}`, { type: mimeType })
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
      blobUrlRef.current = URL.createObjectURL(blob)
      setRecordedFile(file)
      stopStream()
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
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
  }

  // ── Save ──
  const saveSession = async () => {
    if (!recordedFile) return
    const now = new Date()
    const timeOfDay = now.getHours() < 12 ? 'Morning' : now.getHours() < 17 ? 'Afternoon' : 'Evening'
    const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
    const sessionTitle = title.trim() || `${timeOfDay} Practice — ${dateStr}`

    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('title', sessionTitle)
      fd.append('description', description.trim())
      fd.append('video_file', recordedFile)
      fd.append('duration_seconds', elapsed)
      if (tags.length > 0) fd.append('tags', tags.join(','))

      const res = await fetch('/api/sessions/', { method: 'POST', body: fd, headers })
      if (res.ok) {
        const session = await res.json()
        toast.success('Session saved')
        onComplete(session)
      } else {
        toast.error('Failed to save session')
      }
    } catch { toast.error('Error saving') }
    finally { setSaving(false) }
  }

  const handleDiscard = () => {
    if (!confirm('Discard this recording?')) return
    stopTimer()
    stopStream()
    if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null }
    setRecordedFile(null)
    setElapsed(0)
    onCancel()
  }

  const isFront = facing === 'user'

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">

      {/* ── CAMERA / RECORDING ── */}
      {(step === STEPS.CAMERA || step === STEPS.RECORDING) && (
        <>
          <div className="flex-1 relative overflow-hidden">
            <video
              ref={liveRef}
              autoPlay muted playsInline
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-200"
              style={isFront ? { transform: 'scaleX(-1)' } : undefined}
            />

            {error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 px-6">
                <p className="text-sm text-red-400 text-center mb-4">{error}</p>
                <button onClick={() => openCamera()} className="text-sm text-white/60 underline">Try again</button>
              </div>
            )}

            {/* Top bar */}
            <div className="absolute top-0 left-0 right-0 safe-top">
              <div className="flex items-center justify-between px-4 pt-4">
                <button onClick={step === STEPS.RECORDING ? stopRecording : onCancel}
                  className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>

                {step === STEPS.RECORDING && (
                  <div className="flex items-center gap-2 bg-black/40 backdrop-blur-sm rounded-full px-4 py-2">
                    <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                    <span className="text-white font-mono text-sm font-medium">{fmtTimer(elapsed)}</span>
                  </div>
                )}

                {/* Flip camera button */}
                <button
                  onClick={flipCamera}
                  className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center active:scale-90 transition-transform"
                  aria-label="Flip camera"
                >
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M20.016 4.656v4.992" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Bottom controls */}
          <div className="bg-black px-4 pb-8 pt-6 safe-bottom">
            <div className="flex items-center justify-center">
              {step === STEPS.CAMERA && !error && (
                <button
                  onClick={startRecording}
                  className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center active:scale-90 transition-transform"
                >
                  <div className="w-14 h-14 bg-red-500 rounded-full" />
                </button>
              )}

              {step === STEPS.RECORDING && (
                <button
                  onClick={stopRecording}
                  className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center active:scale-90 transition-transform"
                >
                  <div className="w-8 h-8 bg-red-500 rounded-md" />
                </button>
              )}
            </div>

            {step === STEPS.CAMERA && !error && (
              <p className="text-center text-xs text-white/40 mt-3">Tap to start recording</p>
            )}
          </div>
        </>
      )}

      {/* ── REVIEW & SAVE ── */}
      {(step === STEPS.REVIEW || step === STEPS.SAVE) && (
        <div className="flex-1 flex flex-col">
          <div className="flex-1 relative bg-black">
            <video
              ref={playbackRef}
              src={blobUrlRef.current}
              controls playsInline
              className="absolute inset-0 w-full h-full object-contain"
            />
            <div className="absolute top-4 right-4 bg-black/50 backdrop-blur-sm text-white text-xs font-mono px-3 py-1.5 rounded-full">
              {fmtTimer(elapsed)}
            </div>
          </div>

          <div className="bg-white px-4 pt-5 pb-8 safe-bottom space-y-4">
            <div>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={`${new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'} Practice — ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}`}
                className="w-full px-0 py-2 text-base font-medium text-gray-900 placeholder-gray-300 border-b border-gray-200 focus:border-gray-900 focus:outline-none transition-colors"
                autoFocus
              />
            </div>

            <div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What did you work on?"
                rows={2}
                className="w-full px-0 py-1 text-sm text-gray-700 placeholder-gray-300 border-b border-gray-100 focus:border-gray-400 focus:outline-none resize-none transition-colors"
              />
            </div>

            <div>
              <TagInput value={tags} onChange={setTags} token={token} placeholder="e.g. Drumming, Production" />
            </div>

            {recordedFile && (
              <p className="text-xs text-gray-400">
                {fmtTimer(elapsed)} · {(recordedFile.size / 1024 / 1024).toFixed(1)} MB
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                onClick={handleDiscard}
                className="flex-1 text-sm text-gray-500 border border-gray-200 rounded-xl py-3 hover:bg-gray-50 transition-colors"
              >
                Discard
              </button>
              <button
                onClick={saveSession}
                disabled={saving}
                className="flex-1 text-sm font-medium text-white bg-gray-900 rounded-xl py-3 hover:bg-gray-800 disabled:opacity-40 transition-colors active:scale-[0.98]"
              >
                {saving ? 'Saving...' : 'Save & add chapters'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default QuickRecord
