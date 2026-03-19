import React, { useState, useRef, useEffect } from 'react'
import { useToast } from './Toast'
import { createSessionUpload, isLikelyVideoFile, uploadErrorMessage, videoFileAccept } from '../utils'
import VideoRecorder from './VideoRecorder'

function SessionUpload({
  token,
  onComplete,
  onCancel,
  initialRecorderOpen = false,
  onRecorderOpenHandled,
}) {
  const toast = useToast()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [videoFile, setVideoFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(null)
  const [showNotes, setShowNotes] = useState(false)
  const [showRecorder, setShowRecorder] = useState(false)
  const dropRef = useRef(null)
  const inputRef = useRef(null)
  const captureInputRef = useRef(null)
  const libraryInputRef = useRef(null)
  const ownedPreviewUrlRef = useRef('')

  const replaceOwnedPreviewUrl = (nextUrl = '') => {
    if (ownedPreviewUrlRef.current) {
      try { URL.revokeObjectURL(ownedPreviewUrlRef.current) } catch {}
      ownedPreviewUrlRef.current = ''
    }
    if (nextUrl) ownedPreviewUrlRef.current = nextUrl
    setPreviewUrl(nextUrl)
  }

  useEffect(() => () => replaceOwnedPreviewUrl(''), [])

  const defaultPracticeTitle = () => {
    const now = new Date()
    return `Video ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
  }

  useEffect(() => {
    if (!initialRecorderOpen) return
    setShowRecorder(true)
    onRecorderOpenHandled?.()
  }, [initialRecorderOpen, onRecorderOpenHandled])

  useEffect(() => {
    const el = dropRef.current
    if (!el) return undefined
    const onDragOver = (event) => { event.preventDefault(); el.classList.add('ring-2', 'ring-gray-300') }
    const onDragLeave = () => { el.classList.remove('ring-2', 'ring-gray-300') }
    const onDrop = (event) => {
      event.preventDefault()
      el.classList.remove('ring-2', 'ring-gray-300')
      const file = event.dataTransfer?.files?.[0]
      if (!file) return
      if (!isLikelyVideoFile(file)) {
        toast.error('Please choose a video file like .mov, .mp4, or .webm')
        return
      }
      setVideoFile(file)
      if (!title.trim()) setTitle(file.name.replace(/\.[^.]+$/, '') || defaultPracticeTitle())
      replaceOwnedPreviewUrl(URL.createObjectURL(file))
    }

    el.addEventListener('dragover', onDragOver)
    el.addEventListener('dragleave', onDragLeave)
    el.addEventListener('drop', onDrop)
    return () => {
      el.removeEventListener('dragover', onDragOver)
      el.removeEventListener('dragleave', onDragLeave)
      el.removeEventListener('drop', onDrop)
    }
  }, [title, toast])

  const handleFilePick = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!isLikelyVideoFile(file)) {
      toast.error('Please choose a video file like .mov, .mp4, or .webm')
      event.target.value = ''
      return
    }
    setVideoFile(file)
    if (!title.trim()) setTitle(defaultPracticeTitle())
    replaceOwnedPreviewUrl(URL.createObjectURL(file))
  }

  const handleRecorded = (file) => {
    setShowRecorder(false)
    if (!isLikelyVideoFile(file)) {
      toast.error('Recorded file is not in a supported video format')
      return
    }
    setVideoFile(file)
    if (!title.trim()) setTitle(defaultPracticeTitle())
    replaceOwnedPreviewUrl(URL.createObjectURL(file))
  }

  const clearSelectedVideo = () => {
    setVideoFile(null)
    replaceOwnedPreviewUrl('')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
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
      if (!res.ok) {
        toast.error(uploadErrorMessage(res))
        return
      }

      success = true
      toast.success('Saved to your private library')
      onComplete?.({ ...res.data, local_preview_url: previewUrl || '' })
    } catch {
      toast.error('Error uploading')
    } finally {
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

  return (
    <div className="px-4 sm:px-6 py-6">
      <div className="max-w-lg mx-auto">
        <div className="mb-6 space-y-3">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900 tracking-tight">Record a private video</h2>
            <p className="text-sm text-gray-500 mt-1">Record or upload now. It stays in your private library until you share a private feedback link.</p>
          </div>

          <div className="rounded-3xl border border-gray-900 bg-gray-900 text-white px-4 py-4">
            <p className="text-xs font-medium uppercase tracking-wide text-white/70">Next action</p>
            <p className="text-lg font-semibold mt-1">Record or upload your video</p>
            <p className="text-sm mt-2 text-white/75">You can watch it immediately, keep it private, and request personalized video feedback later.</p>
            <button
              type="button"
              onClick={startRecording}
              className="mt-4 w-full rounded-2xl py-3 text-sm font-medium bg-white text-gray-900 hover:bg-gray-100 transition-colors"
            >
              Start recording
            </button>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-gray-50 px-4 py-4">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Choose a source</p>
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
            <p className="text-xs text-gray-500 mt-3">Supports `.mov`, `.mp4`, and `.webm`.</p>
          </div>
        </div>

        {showRecorder ? (
          <div className="mb-5 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Record inside Practica</h3>
                <p className="text-xs text-gray-500 mt-1">You should be able to watch this recording immediately before saving it.</p>
              </div>
              <button type="button" onClick={() => setShowRecorder(false)} className="text-xs text-gray-500 hover:text-gray-900 transition-colors">
                Close
              </button>
            </div>
            <VideoRecorder onRecorded={handleRecorded} onCancel={() => setShowRecorder(false)} maxDuration={300} />
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-5">
          {previewUrl ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Preview</h3>
                  <p className="text-xs text-gray-500 mt-1">Watch your video here before saving it.</p>
                </div>
                {videoFile ? (
                  <button type="button" onClick={clearSelectedVideo} className="text-xs text-red-600 hover:text-red-700 transition-colors">
                    Remove
                  </button>
                ) : null}
              </div>
              <div className="rounded-2xl overflow-hidden bg-black">
                <video src={previewUrl} controls playsInline className="w-full aspect-video bg-black" />
              </div>
            </div>
          ) : null}

          <div>
            <label className="block text-sm text-gray-600 mb-1.5">Title</label>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
              placeholder={videoFile ? 'Rename your video here if you want' : 'Add a short title'}
              required
            />
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
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
                className="w-full mt-2 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 resize-none"
                placeholder="What do you want feedback on?"
              />
            ) : null}
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-2">Video file</label>
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
                  <p className="text-xs text-gray-500 mt-1">or tap to choose a file</p>
                </>
              )}
              <input ref={inputRef} type="file" accept={videoFileAccept()} className="hidden" onChange={handleFilePick} />
              <input ref={captureInputRef} type="file" accept={videoFileAccept()} capture="environment" className="hidden" onChange={handleFilePick} />
              <input ref={libraryInputRef} type="file" accept={videoFileAccept()} className="hidden" onChange={handleFilePick} />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onCancel} className="flex-1 text-sm text-gray-600 border border-gray-200 rounded-lg py-2.5 hover:bg-gray-50 transition-colors">Cancel</button>
            <button type="submit" disabled={isUploading} className="flex-1 text-sm font-medium text-white bg-gray-900 rounded-lg py-2.5 hover:bg-gray-800 disabled:opacity-40 transition-colors">
              {isUploading ? `Saving${uploadProgress !== null ? ` ${uploadProgress}%` : '...'}` : 'Save to library'}
            </button>
          </div>

          {isUploading ? (
            <div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-gray-900 transition-all" style={{ width: `${Math.max(uploadProgress ?? 5, 5)}%` }} />
              </div>
              <p className="text-xs text-gray-500 mt-1">Saving video{uploadProgress !== null ? ` (${uploadProgress}%)` : ''}. Keep this tab open until it finishes.</p>
            </div>
          ) : null}
        </form>
      </div>
    </div>
  )
}

export default SessionUpload
