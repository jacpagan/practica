import React, { useState, useRef, useEffect } from 'react'
import { useConfirm } from './ConfirmDialog'
import { useToast } from './Toast'
import { createSessionUpload, fmtDate, isLikelyVideoFile, uploadErrorMessage, videoFileAccept } from '../utils'
import VideoRecorder from './VideoRecorder'

function SessionUpload({
  token,
  onComplete,
  onCancel,
  currentStreakDays = 0,
}) {
  const toast = useToast()
  const confirm = useConfirm()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [videoFile, setVideoFile] = useState(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(null)
  const [showNotes, setShowNotes] = useState(false)
  const [showRecorder, setShowRecorder] = useState(false)
  const dropRef = useRef(null)
  const inputRef = useRef(null)
  const captureInputRef = useRef(null)
  const libraryInputRef = useRef(null)

  const defaultPracticeTitle = () => {
    const now = new Date()
    return `Practice ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
  }

  useEffect(() => {
    const el = dropRef.current
    if (!el) return
    const onDragOver = (e) => { e.preventDefault(); el.classList.add('ring-2', 'ring-gray-300') }
    const onDragLeave = () => { el.classList.remove('ring-2', 'ring-gray-300') }
    const onDrop = (e) => {
      e.preventDefault()
      el.classList.remove('ring-2', 'ring-gray-300')
      const file = e.dataTransfer?.files?.[0]
      if (file) {
        if (!isLikelyVideoFile(file)) {
          toast.error('Please choose a video file like .mov, .mp4, or .webm')
          return
        }
        setVideoFile(file)
        if (!title.trim()) setTitle(file.name.replace(/\.[^.]+$/, ''))
      }
    }
    el.addEventListener('dragover', onDragOver)
    el.addEventListener('dragleave', onDragLeave)
    el.addEventListener('drop', onDrop)
    return () => {
      el.removeEventListener('dragover', onDragOver)
      el.removeEventListener('dragleave', onDragLeave)
      el.removeEventListener('drop', onDrop)
    }
  }, [title])

  const handleFilePick = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      if (!isLikelyVideoFile(file)) {
        toast.error('Please choose a video file like .mov, .mp4, or .webm')
        e.target.value = ''
        return
      }
      setVideoFile(file)
      if (!title.trim()) setTitle(defaultPracticeTitle())
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!title.trim()) return toast.error('Please enter a title')
    if (!videoFile) return toast.error('Please select or record a video')
    setIsUploading(true)
    setUploadProgress(0)
    let success = false
    try {
      const res = await createSessionUpload({
        token,
        payload: {
          title: title.trim(),
          description: description.trim(),
        },
        videoFile,
        onProgress: (percent) => setUploadProgress(percent),
      })
      if (res.ok) {
        success = true
        toast.success('Session uploaded')
        if (res.data?.processing_status === 'failed' && res.data?.processing_error) {
          toast.error(res.data.processing_error)
        }
        onComplete(res.data)
      }
      else toast.error(uploadErrorMessage(res))
    } catch { toast.error('Error uploading') }
    finally {
      setIsUploading(false)
      if (!success) setUploadProgress(null)
    }
  }

  const openCamera = () => captureInputRef.current?.click()
  const openLibrary = () => libraryInputRef.current?.click()
  const openFiles = () => inputRef.current?.click()

  const startRecording = () => {
    if (typeof window !== 'undefined' && window.MediaRecorder && navigator.mediaDevices?.getUserMedia) {
      setShowRecorder(true)
      return
    }
    openCamera()
  }

  const handleRecorded = (file) => {
    setShowRecorder(false)
    if (!isLikelyVideoFile(file)) {
      toast.error('Recorded file is not in a supported video format')
      return
    }
    setVideoFile(file)
    if (!title.trim()) setTitle(defaultPracticeTitle())
  }

  const clearSelectedVideo = () => {
    setVideoFile(null)
  }

  return (
    <div className="px-4 sm:px-6 py-6">
      <div className="max-w-lg mx-auto">
        <div className="mb-6 space-y-3">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900 tracking-tight">Practice on your phone, fast</h2>
            <p className="text-sm text-gray-500 mt-1">Pick a video, keep the title simple, and share it for feedback when you’re ready.</p>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">Current streak</p>
            <p className="text-lg font-semibold text-emerald-900 mt-1">{currentStreakDays} day{currentStreakDays === 1 ? '' : 's'}</p>
            <p className="text-xs text-emerald-800 mt-1">Keep the loop going by sending today’s clip.</p>
          </div>
          <div className="rounded-3xl border border-gray-200 bg-gray-50 px-4 py-4">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Start here</p>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button type="button" onClick={startRecording} className="rounded-2xl bg-gray-900 text-white px-4 py-3 text-sm font-medium hover:bg-gray-800 transition-colors">
                Record now
              </button>
              <button type="button" onClick={openLibrary} className="rounded-2xl border border-gray-200 bg-white text-gray-900 px-4 py-3 text-sm font-medium hover:bg-gray-50 transition-colors">
                Choose from library
              </button>
              <button type="button" onClick={openFiles} className="rounded-2xl border border-gray-200 bg-white text-gray-900 px-4 py-3 text-sm font-medium hover:bg-gray-50 transition-colors">
                Browse files
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-3">Supports `.mov`, `.mp4`, and `.webm`. Large phone videos upload more reliably now.</p>
          </div>
        </div>

        {showRecorder ? (
          <div className="mb-5 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Record inside Practica</h3>
                <p className="text-xs text-gray-500 mt-1">Works best on phones and laptops with camera permission enabled.</p>
              </div>
              <button type="button" onClick={() => setShowRecorder(false)} className="text-xs text-gray-500 hover:text-gray-900 transition-colors">
                Close
              </button>
            </div>
            <VideoRecorder onRecorded={handleRecorded} onCancel={() => setShowRecorder(false)} maxDuration={300} />
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm text-gray-600 mb-1.5">Title</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
              placeholder={videoFile ? 'Auto-filled from your video, or rename it here' : 'Add a short title'} required />
          </div>
          <div>
            <button
              type="button"
              onClick={() => setShowNotes((current) => !current)}
              className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
            >
              {showNotes ? 'Hide note' : 'Add note (optional)'}
            </button>
            {showNotes ? (
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
                className="w-full mt-2 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 resize-none"
                placeholder="What did you work on?" />
            ) : null}
          </div>
          {/* Reference fields removed to keep upload flow focused */}
          <div>
            <label className="block text-sm text-gray-600 mb-2">Video</label>
            <div
              ref={dropRef}
              onClick={() => { if (!videoFile) openFiles() }}
              className={`rounded-2xl border ${videoFile ? 'border-gray-200 bg-white' : 'border-dashed border-gray-300 bg-gray-50 cursor-pointer hover:bg-gray-100'} p-6 text-center transition-colors`}
            >
              {videoFile ? (
                <div className="rounded-xl bg-white px-1 text-left">
                  <p className="text-xs text-gray-500">Selected video</p>
                  <p className="text-sm text-gray-900 font-medium mt-0.5 break-words">{videoFile.name}</p>
                  <div className="flex items-center gap-2 mt-3">
                    <button type="button" onClick={openFiles} className="text-xs text-gray-600 border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-50 transition-colors">
                      Replace
                    </button>
                    <button type="button" onClick={clearSelectedVideo} className="text-xs text-red-600 hover:text-red-700 transition-colors">
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm font-medium text-gray-900">Drag & drop your video here</p>
                  <p className="text-xs text-gray-500 mt-1">or tap to choose a file (supports .mov, .mp4, .webm; max 2GB)</p>
                </>
              )}
              <input
                ref={inputRef}
                type="file"
                accept={videoFileAccept()}
                className="hidden"
                onChange={handleFilePick}
              />
              <input
                ref={captureInputRef}
                type="file"
                accept={videoFileAccept()}
                capture="environment"
                className="hidden"
                onChange={handleFilePick}
              />
              <input
                ref={libraryInputRef}
                type="file"
                accept={videoFileAccept()}
                className="hidden"
                onChange={handleFilePick}
              />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onCancel} className="flex-1 text-sm text-gray-600 border border-gray-200 rounded-lg py-2.5 hover:bg-gray-50 transition-colors">Cancel</button>
            <button type="submit" disabled={isUploading} className="flex-1 text-sm font-medium text-white bg-gray-900 rounded-lg py-2.5 hover:bg-gray-800 disabled:opacity-40 transition-colors">
              {isUploading ? `Uploading${uploadProgress !== null ? ` ${uploadProgress}%` : '...'}` : 'Save'}
            </button>
          </div>
          {isUploading && (
            <div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gray-900 transition-all"
                  style={{ width: `${Math.max(uploadProgress ?? 5, 5)}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Uploading{uploadProgress !== null ? ` (${uploadProgress}%)` : ''}. Keep this tab open until it finishes.
              </p>
            </div>
          )}
        </form>

      </div>
    </div>
  )
}

export default SessionUpload
