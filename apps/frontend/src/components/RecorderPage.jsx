import React, { useEffect, useMemo, useRef, useState } from 'react'
import VideoRecorder from './VideoRecorder'
import { MAX_RECORDER_DURATION_SECONDS, createSessionUpload, uploadErrorMessage } from '../utils'
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
  const ownedPreviewUrlRef = useRef('')

  useEffect(() => () => {
    if (ownedPreviewUrlRef.current) {
      try { URL.revokeObjectURL(ownedPreviewUrlRef.current) } catch {}
      ownedPreviewUrlRef.current = ''
    }
  }, [])

  const defaultTitle = () => {
    const now = new Date()
    const pad = (n) => String(n).padStart(2, '0')
    return `video - ${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
  }

  const handleRecorded = (nextFile) => {
    setFile(nextFile)
    setTitle(defaultTitle())
    if (ownedPreviewUrlRef.current) {
      try { URL.revokeObjectURL(ownedPreviewUrlRef.current) } catch {}
    }
    ownedPreviewUrlRef.current = URL.createObjectURL(nextFile)
    setPreviewUrl(ownedPreviewUrlRef.current)
  }

  const handleSave = async () => {
    if (!file || !title.trim() || !token) return
    setIsUploading(true)
    setProgress(0)
    try {
      const res = await createSessionUpload({
        token,
        payload: { title: title.trim(), practice_series: '', description: '' },
        videoFile: file,
        onProgress: (p) => setProgress(p),
      })
      if (!res.ok) {
        toast.error(uploadErrorMessage(res))
        setIsUploading(false)
        setProgress(null)
        return
      }
      toast.success('Saved to your private library')
      try { onComplete?.(res.data) } catch {}
    } catch {
      toast.error('Upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white px-4 py-6 sm:px-6">
      <main className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Record</h1>
          <button type="button" onClick={onCancel} className="text-xs text-gray-500 hover:text-gray-900">Close</button>
        </div>

        {!file ? (
          <div className="rounded-[28px] overflow-hidden shadow-2xl border border-gray-200">
            <VideoRecorder
              onRecorded={(f) => handleRecorded(f)}
              onCancel={onCancel}
              maxDuration={MAX_RECORDER_DURATION_SECONDS}
              autoUseOnStop={true}
              minAutoUseSeconds={0}
              autoOpenOnMount={true}
            />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl overflow-hidden bg-black">
              <video src={previewUrl} controls playsInline className="w-full aspect-video" />
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1.5">Title</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400" />
              </div>
              <div className="flex items-center justify-between">
                <button type="button" onClick={() => setFile(null)} className="text-sm text-gray-600 hover:text-gray-900">Re-record</button>
                <button type="button" onClick={handleSave} disabled={isUploading || !title.trim()} className="text-sm font-medium text-white bg-gray-900 rounded-lg px-4 py-2 hover:bg-gray-800 disabled:opacity-50">{isUploading ? 'Saving…' : 'Save'}</button>
              </div>
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
