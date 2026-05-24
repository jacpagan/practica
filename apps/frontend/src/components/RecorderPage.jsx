import React, { useEffect, useMemo, useRef, useState } from 'react'
import VideoRecorder from './VideoRecorder'
import { MAX_RECORDER_DURATION_SECONDS, createSessionUpload, isLikelyVideoFile, uploadErrorMessage, videoFileAccept } from '../utils'
import { useAuth } from '../auth'
import { useToast } from './Toast'

export default function RecorderPage({ onCancel, onComplete }) {
  const { token } = useAuth()
  const toast = useToast()
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [title, setTitle] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState(null)
  const [saveError, setSaveError] = useState('')
  const ownedPreviewUrlRef = useRef('')
  const shouldAutoSaveRef = useRef(false)
  const timingMetadataRef = useRef(null)
  const fileInputRef = useRef(null)

  useEffect(() => () => {
    if (ownedPreviewUrlRef.current) {
      try { URL.revokeObjectURL(ownedPreviewUrlRef.current) } catch {}
      ownedPreviewUrlRef.current = ''
    }
  }, [])

  const defaultTitle = () => {
    const now = new Date()
    const pad = (n) => String(n).padStart(2, '0')
    return `proof - ${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
  }

  const handleRecorded = (nextFile, _blobUrl, timingMetadata) => {
    timingMetadataRef.current = timingMetadata || null
    setFile(nextFile)
    setTitle(defaultTitle())
    setSaveError('')
    shouldAutoSaveRef.current = true
    if (ownedPreviewUrlRef.current) {
      try { URL.revokeObjectURL(ownedPreviewUrlRef.current) } catch {}
    }
    ownedPreviewUrlRef.current = URL.createObjectURL(nextFile)
    setPreviewUrl(ownedPreviewUrlRef.current)
  }

  const handlePickedFile = (event) => {
    const nextFile = event.target?.files?.[0]
    event.target.value = ''
    if (!nextFile) return
    if (!isLikelyVideoFile(nextFile)) {
      toast.error('Please choose a video file.')
      return
    }
    handleRecorded(nextFile)
  }

  const handleSave = async ({ auto = false } = {}) => {
    if (!file || !title.trim() || !token) return
    setIsUploading(true)
    setProgress(0)
    setSaveError('')
    try {
      const res = await createSessionUpload({
        token,
        payload: {
          title: title.trim(),
          practice_series: '',
          description: '',
          timing_metadata: timingMetadataRef.current,
        },
        videoFile: file,
        onProgress: (p) => setProgress(p),
      })
      if (!res.ok) {
        const message = uploadErrorMessage(res)
        setSaveError(message)
        toast.error(message)
        setIsUploading(false)
        setProgress(null)
        return
      }
      if (!auto) toast.success('Saved to your private archive')
      try { onComplete?.(res.data) } catch {}
    } catch {
      const message = 'Upload failed'
      setSaveError(message)
      toast.error(message)
    } finally {
      setIsUploading(false)
    }
  }

  useEffect(() => {
    if (!file || !title.trim() || !token) return
    if (!shouldAutoSaveRef.current) return
    shouldAutoSaveRef.current = false
    handleSave({ auto: true })
  }, [file, title, token])

  return (
    <div className="min-h-screen bg-gray-950 text-white sm:bg-white sm:text-gray-900 px-0 sm:px-6 sm:py-6">
      <main className="w-full sm:max-w-3xl sm:mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="hidden sm:block text-2xl font-semibold text-gray-900 tracking-tight">Record</h1>
          <button type="button" onClick={onCancel} className="fixed top-[max(0.75rem,env(safe-area-inset-top))] left-4 z-40 text-xs text-white/85 rounded-full border border-white/25 bg-black/45 px-3 py-1.5 backdrop-blur sm:static sm:rounded-none sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none sm:text-gray-500 sm:hover:text-gray-900">Close</button>
        </div>

        {!file ? (
          <div className="space-y-3">
            <div className="fixed top-[max(0.75rem,env(safe-area-inset-top))] right-4 z-40 sm:static sm:flex sm:justify-end">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs text-white/85 border border-white/25 rounded-full bg-black/45 px-3 py-1.5 backdrop-blur hover:bg-black/55 sm:text-gray-600 sm:border-gray-200 sm:rounded-lg sm:bg-transparent sm:hover:bg-gray-50 sm:backdrop-blur-none"
              >
                Upload video
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept={videoFileAccept()}
                className="hidden"
                onChange={handlePickedFile}
              />
            </div>
            <div className="overflow-hidden sm:rounded-[28px] sm:shadow-2xl sm:border sm:border-gray-200">
              <VideoRecorder
                onRecorded={(f, blobUrl, timingMetadata) => handleRecorded(f, blobUrl, timingMetadata)}
                onCancel={onCancel}
                maxDuration={MAX_RECORDER_DURATION_SECONDS}
                autoUseOnStop={true}
                minAutoUseSeconds={0}
                autoOpenOnMount={true}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4 px-4 sm:px-0 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-0">
            <div className="overflow-hidden bg-black sm:rounded-2xl">
              <video src={previewUrl} controls playsInline className="w-full h-[100dvh] object-cover sm:h-auto sm:aspect-video" />
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-white/75 sm:text-gray-600 mb-1.5">Title</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-3 py-2 text-sm border border-white/20 bg-black/30 text-white rounded-lg focus:outline-none focus:border-white/40 sm:border-gray-200 sm:bg-white sm:text-gray-900 sm:focus:border-gray-400" />
              </div>
              <div className="flex items-center justify-between">
                <button type="button" onClick={() => { shouldAutoSaveRef.current = false; setSaveError(''); setFile(null) }} className="text-sm text-white/80 hover:text-white sm:text-gray-600 sm:hover:text-gray-900">Re-record</button>
                <button type="button" onClick={handleSave} disabled={isUploading || !title.trim()} className="text-sm font-medium text-white bg-gray-900 rounded-lg px-4 py-2 hover:bg-gray-800 disabled:opacity-50">{isUploading ? 'Saving…' : 'Save'}</button>
              </div>
              {saveError ? <p className="text-sm text-red-600">{saveError}</p> : null}
              {isUploading ? (
                <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
                  <div className="h-full bg-gray-900 transition-all" style={{ width: `${Math.max(5, progress || 0)}%` }} />
                </div>
              ) : null}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
