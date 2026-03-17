import React, { useState, useRef, useEffect } from 'react'
import { useToast } from './Toast'
import { createSessionUpload, uploadErrorMessage } from '../utils'

function SessionUpload({ token, onComplete, onCancel }) {
  const toast = useToast()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [videoFile, setVideoFile] = useState(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(null)
  const dropRef = useRef(null)
  const inputRef = useRef(null)

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
      setVideoFile(file)
      if (!title.trim()) setTitle(file.name.replace(/\.[^.]+$/, ''))
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
        onComplete(res.data)
      }
      else toast.error(uploadErrorMessage(res))
    } catch { toast.error('Error uploading') }
    finally {
      setIsUploading(false)
      if (!success) setUploadProgress(null)
    }
  }

  return (
    <div className="px-4 sm:px-6 py-6">
      <div className="max-w-lg mx-auto">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Upload your practice</h2>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm text-gray-600 mb-1.5">Title</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
              placeholder="What did you practice?" required />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1.5">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 resize-none"
              placeholder="What did you work on?" />
          </div>
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 space-y-3">
            <div>
              <p className="text-sm font-medium text-gray-900">Optional reference video</p>
              <p className="text-xs text-gray-500 mt-1">Paste the teacher or YouTube video you are following while you upload or record your attempt.</p>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1.5">Reference title</label>
              <input type="text" value={referenceTitle} onChange={(e) => setReferenceTitle(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
                placeholder="Dorothy Fitzer — Follow Along" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1.5">Reference URL</label>
              <input type="url" value={referenceUrl} onChange={(e) => setReferenceUrl(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
                placeholder="https://www.youtube.com/watch?..." />
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-2">Video</label>
            <div
              ref={dropRef}
              onClick={() => inputRef.current?.click()}
              className="cursor-pointer rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center hover:bg-gray-100 transition-colors"
            >
              <p className="text-sm font-medium text-gray-900">Drag & drop your video here</p>
              <p className="text-xs text-gray-500 mt-1">or click to choose a file (max 2GB)</p>
              {videoFile ? (
                <p className="text-xs text-gray-600 mt-3">Selected: {videoFile.name}</p>
              ) : null}
              <input
                ref={inputRef}
                type="file"
                accept="video/*"
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
                Upload in progress{uploadProgress !== null ? ` (${uploadProgress}%)` : ''}. Max file size is 2GB.
              </p>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}

export default SessionUpload
