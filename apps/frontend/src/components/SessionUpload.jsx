import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useToast } from './Toast'
import { createSessionUpload, isLikelyVideoFile, MAX_RECORDER_DURATION_SECONDS, MAX_VIDEO_UPLOAD_BYTES, uploadErrorMessage, videoFileAccept } from '../utils'
import VideoRecorder from './VideoRecorder'
import { useConfirm } from './ConfirmDialog'
import PracticeThreadField from './PracticeThreadField'

const LAST_SERIES_KEY = 'practica.last_series.v1'

function SessionUpload({
  token,
  onComplete,
  onCancel,
  initialRecorderOpen = false,
  initialPracticeSeries = '',
  practiceThreadOptions = [],
  onPracticeSeriesHandled,
  onRecorderOpenHandled,
  onUploadGuardChange,
}) {
  const toast = useToast()
  const confirm = useConfirm()
  const [title, setTitle] = useState('')
  const [titleManuallyEdited, setTitleManuallyEdited] = useState(false)
  const [practiceSeries, setPracticeSeries] = useState('')
  const [description, setDescription] = useState('')
  const [videoFile, setVideoFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(null)
  const [showNotes, setShowNotes] = useState(false)
  const [showVideoDetails, setShowVideoDetails] = useState(false)
  const [showRecorder, setShowRecorder] = useState(false)
  const dropRef = useRef(null)
  const inputRef = useRef(null)
  const captureInputRef = useRef(null)
  const ownedPreviewUrlRef = useRef('')
  const abortControllerRef = useRef(null)
  const abortRequestedRef = useRef(false)

  const replaceOwnedPreviewUrl = (nextUrl = '') => {
    if (ownedPreviewUrlRef.current) {
      try { URL.revokeObjectURL(ownedPreviewUrlRef.current) } catch {}
      ownedPreviewUrlRef.current = ''
    }
    if (nextUrl) ownedPreviewUrlRef.current = nextUrl
    setPreviewUrl(nextUrl)
  }

  useEffect(() => () => replaceOwnedPreviewUrl(''), [])

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(LAST_SERIES_KEY)
      if (saved) setPracticeSeries(saved)
    } catch {}
  }, [])

  useEffect(() => {
    if (!initialPracticeSeries) return
    setPracticeSeries(initialPracticeSeries)
    setShowVideoDetails(true)
    onPracticeSeriesHandled?.()
  }, [initialPracticeSeries, onPracticeSeriesHandled])

  const requestUploadAbort = useCallback(() => {
    abortRequestedRef.current = true
    abortControllerRef.current?.abort()
  }, [])

  useEffect(() => {
    onUploadGuardChange?.({
      active: isUploading,
      abort: isUploading ? requestUploadAbort : null,
    })
  }, [isUploading, onUploadGuardChange, requestUploadAbort])

  useEffect(() => () => {
    onUploadGuardChange?.({ active: false, abort: null })
  }, [onUploadGuardChange])

  const defaultPracticeTitle = () => {
    const now = new Date()
    return `Video ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
  }

  const seriesBasedTitle = (seriesName = '') => {
    const normalizedSeries = String(seriesName || '').trim()
    if (!normalizedSeries) return defaultPracticeTitle()
    const now = new Date()
    return `${normalizedSeries} ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
  }

  useEffect(() => {
    if (titleManuallyEdited || videoFile) return
    setTitle(seriesBasedTitle(practiceSeries))
  }, [practiceSeries, titleManuallyEdited, videoFile])

  useEffect(() => {
    if (!initialRecorderOpen) return
    setShowRecorder(true)
    onRecorderOpenHandled?.()
  }, [initialRecorderOpen, onRecorderOpenHandled])

  useEffect(() => {
    if (videoFile || description.trim() || practiceSeries.trim() || titleManuallyEdited) {
      setShowVideoDetails(true)
    }
  }, [description, practiceSeries, titleManuallyEdited, videoFile])

  useEffect(() => {
    const el = dropRef.current
    if (!el) return undefined
    const onDragOver = (event) => { event.preventDefault(); el.classList.add('ring-2', 'ring-gray-300') }
    const onDragLeave = () => { el.classList.remove('ring-2', 'ring-gray-300') }
    const onDrop = (event) => {
      event.preventDefault()
      el.classList.remove('ring-2', 'ring-gray-300')
      if (isUploading) return
      const file = event.dataTransfer?.files?.[0]
      if (!file) return
      if (!isLikelyVideoFile(file)) {
        toast.error('Please choose a video file like .mov, .mp4, or .webm')
        return
      }
      setVideoFile(file)
      if (!titleManuallyEdited) setTitle(file.name.replace(/\.[^.]+$/, '') || defaultPracticeTitle())
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
  }, [isUploading, title, toast])

  const handleFilePick = (event) => {
    if (isUploading) {
      event.target.value = ''
      return
    }
    const file = event.target.files?.[0]
    if (!file) return
    if (!isLikelyVideoFile(file)) {
      toast.error('Please choose a video file like .mov, .mp4, or .webm')
      event.target.value = ''
      return
    }
    setVideoFile(file)
    if (!titleManuallyEdited) setTitle(file.name.replace(/\.[^.]+$/, '') || defaultPracticeTitle())
    replaceOwnedPreviewUrl(URL.createObjectURL(file))
  }

  const handleRecorded = (file) => {
    if (isUploading) return
    setShowRecorder(false)
    if (!isLikelyVideoFile(file)) {
      toast.error('Recorded file is not in a supported video format')
      return
    }
    setVideoFile(file)
    if (!titleManuallyEdited) setTitle(seriesBasedTitle(practiceSeries))
    replaceOwnedPreviewUrl(URL.createObjectURL(file))
  }

  const clearSelectedVideo = () => {
    if (isUploading) return
    setVideoFile(null)
    if (!titleManuallyEdited) setTitle(seriesBasedTitle(practiceSeries))
    replaceOwnedPreviewUrl('')
  }

  const handleCancel = async () => {
    if (!isUploading) {
      onCancel?.()
      return
    }

    const accepted = await confirm({
      title: 'Abort upload?',
      message: 'This video is still saving. If you leave now, the upload will be aborted and you will need to start again.',
      confirmLabel: 'Abort upload',
      cancelLabel: 'Keep uploading',
      tone: 'danger',
    })
    if (!accepted) return

    requestUploadAbort()
    onUploadGuardChange?.({ active: false, abort: null })
    onCancel?.({ bypassUploadGuard: true })
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!title.trim()) return toast.error('Please enter a title')
    if (!videoFile) return toast.error('Please select or record a video')

    setIsUploading(true)
    setUploadProgress(0)
    abortRequestedRef.current = false
    abortControllerRef.current = new AbortController()
    let success = false
    try {
      const res = await createSessionUpload({
        token,
        payload: {
          title: title.trim(),
          practice_series: practiceSeries.trim(),
          description: description.trim(),
        },
        videoFile,
        onProgress: (percent) => setUploadProgress(percent),
        signal: abortControllerRef.current.signal,
      })
      if (!res.ok) {
        if (res?.data?.code === 'upload_aborted') return
        toast.error(uploadErrorMessage(res))
        return
      }

      success = true
      try {
        if (practiceSeries.trim()) window.localStorage.setItem(LAST_SERIES_KEY, practiceSeries.trim())
      } catch {}
      onUploadGuardChange?.({ active: false, abort: null })
      toast.success('Saved to your private library')
      onComplete?.({ ...res.data, local_preview_url: previewUrl || '' })
    } catch {
      if (abortRequestedRef.current) return
      toast.error('Error uploading')
    } finally {
      abortControllerRef.current = null
      setIsUploading(false)
      if (!success) setUploadProgress(null)
    }
  }

  const openCamera = () => captureInputRef.current?.click()
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
            <h2 className="text-2xl font-semibold text-gray-900 tracking-tight">New video</h2>
            <p className="text-sm text-gray-500 mt-1">Record or upload.</p>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-gray-50 px-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button type="button" onClick={startRecording} disabled={isUploading} className="rounded-2xl bg-gray-900 text-white px-4 py-3 text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors">
                Record
              </button>
              <button type="button" onClick={openFiles} disabled={isUploading} className="rounded-2xl border border-gray-200 bg-white text-gray-900 px-4 py-3 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors">
                Upload file
              </button>
            </div>
            <div className="mt-3 space-y-1">
              <p className="text-xs text-gray-500">Supports `.mov`, `.mp4`, `.m4v`, `.webm`, `.avi`, `.mkv`, `.3gp`, and `.3gpp`.</p>
              <p className="text-xs text-gray-500">Built-in recording is limited to {Math.round(MAX_RECORDER_DURATION_SECONDS / 60)} minutes. File uploads are limited to {Math.round(MAX_VIDEO_UPLOAD_BYTES / (1024 * 1024 * 1024))}GB.</p>
              <p className="text-xs text-gray-500">Playback may take a moment to prepare.</p>
              <p className="text-xs text-gray-500">Camera and mic access are used only while the recorder is open.</p>
            </div>
          </div>
        </div>

        {showRecorder ? (
          <div className="mb-5 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Recorder</h3>
                <p className="text-xs text-gray-500 mt-1">Record, then save. Camera/mic are active only while this recorder is open.</p>
              </div>
              <button type="button" onClick={() => setShowRecorder(false)} disabled={isUploading} className="text-xs text-gray-500 hover:text-gray-900 disabled:opacity-50 transition-colors">
                Close
              </button>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-amber-800">Recorder limits</p>
              <p className="text-sm text-amber-900 mt-1">You can record up to {Math.round(MAX_RECORDER_DURATION_SECONDS / 60)} minutes in Practica’s built-in recorder.</p>
            </div>
            <VideoRecorder onRecorded={handleRecorded} onCancel={() => setShowRecorder(false)} maxDuration={MAX_RECORDER_DURATION_SECONDS} />
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-5">
          {previewUrl ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Preview</h3>
                  <p className="text-xs text-gray-500 mt-1">Watch before saving.</p>
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

          <details className="rounded-2xl border border-gray-200 bg-white px-4 py-4" open={showVideoDetails}>
            <summary onClick={() => setShowVideoDetails((current) => !current)} className="cursor-pointer list-none flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">Video details</p>
                <p className="text-xs text-gray-500 mt-1">Optional.</p>
              </div>
              <span className="text-xs text-gray-500">{showVideoDetails ? 'Hide' : 'Show'}</span>
            </summary>
            <div className="space-y-4 pt-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1.5">Practice thread</label>
                <PracticeThreadField
                  value={practiceSeries}
                  onChange={setPracticeSeries}
                  options={practiceThreadOptions}
                  disabled={isUploading}
                  placeholder="Choose a thread or create a new one"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1.5">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(event) => {
                    setTitle(event.target.value)
                    setTitleManuallyEdited(true)
                  }}
                  disabled={isUploading}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
                  placeholder={videoFile ? 'Give it a name' : 'Title'}
                  required
                />
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => setShowNotes((current) => !current)}
                  disabled={isUploading}
                  className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
                >
                  {showNotes ? 'Hide note' : 'Add note (optional)'}
                </button>
                {showNotes ? (
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    disabled={isUploading}
                    rows={3}
                    className="w-full mt-2 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 resize-none"
                    placeholder="Optional note"
                  />
                ) : null}
              </div>
            </div>
          </details>

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
                    <button type="button" onClick={openFiles} disabled={isUploading} className="text-xs text-gray-600 border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-50 disabled:opacity-50 transition-colors">
                      Replace
                    </button>
                    <button type="button" onClick={clearSelectedVideo} disabled={isUploading} className="text-xs text-red-600 hover:text-red-700 disabled:opacity-50 transition-colors">
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm font-medium text-gray-900">Drop a video here</p>
                  <p className="text-xs text-gray-500 mt-1">or tap to choose one</p>
                </>
              )}
              <input ref={inputRef} type="file" accept={videoFileAccept()} className="hidden" onChange={handleFilePick} />
              <input ref={captureInputRef} type="file" accept={videoFileAccept()} capture="environment" className="hidden" onChange={handleFilePick} />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={handleCancel} className="flex-1 text-sm text-gray-600 border border-gray-200 rounded-lg py-2.5 hover:bg-gray-50 transition-colors">{isUploading ? 'Abort upload' : 'Cancel'}</button>
            <button type="submit" disabled={isUploading} className="flex-1 text-sm font-medium text-white bg-gray-900 rounded-lg py-2.5 hover:bg-gray-800 disabled:opacity-40 transition-colors">
              {isUploading ? `Saving${uploadProgress !== null ? ` ${uploadProgress}%` : '...'}` : 'Save to library'}
            </button>
          </div>

          {isUploading ? (
            <div className="space-y-2">
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-gray-900 transition-all" style={{ width: `${Math.max(uploadProgress ?? 5, 5)}%` }} />
              </div>
              <p className="text-xs text-gray-500 mt-1">Saving video{uploadProgress !== null ? ` (${uploadProgress}%)` : ''}. Keep this tab open until it finishes.</p>
              <p className="text-xs text-amber-700">Stay on this page until the upload finishes.</p>
            </div>
          ) : null}
        </form>
      </div>
    </div>
  )
}

export default SessionUpload
