import React, { useState, useRef, useEffect } from 'react'
import { useConfirm } from './ConfirmDialog'
import { useToast } from './Toast'
import { createSessionUpload, fmtDate, isLikelyVideoFile, uploadErrorMessage, videoFileAccept } from '../utils'

function SessionUpload({
  token,
  onComplete,
  onCancel,
  sessions = [],
  sessionsLoading = false,
  sessionsLoadingMore = false,
  hasMoreSessions = false,
  onLoadMoreSessions,
  onOpenSession,
  onDeleteSession,
}) {
  const toast = useToast()
  const confirm = useConfirm()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [videoFile, setVideoFile] = useState(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(null)
  const [deletingSessionId, setDeletingSessionId] = useState(null)
  const [showNotes, setShowNotes] = useState(false)
  const dropRef = useRef(null)
  const inputRef = useRef(null)
  const captureInputRef = useRef(null)
  const libraryInputRef = useRef(null)

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

  const handleDeleteSession = async (session) => {
    if (!session?.id || !session?.can_edit || !token) return
    const accepted = await confirm?.({
      title: 'Delete practice entry?',
      message: 'This permanently deletes the video and its session details. This cannot be undone.',
      confirmLabel: 'Delete',
      cancelLabel: 'Keep',
      tone: 'danger',
    })
    if (!accepted) return

    setDeletingSessionId(session.id)
    try {
      const res = await fetch(`/api/sessions/${session.id}/`, {
        method: 'DELETE',
        headers: { Authorization: `Token ${token}` },
      })
      if (!res.ok) throw new Error('delete')
      toast.success('Practice entry deleted')
      onDeleteSession?.(session.id)
    } catch {
      toast.error('Could not delete practice entry')
    } finally {
      setDeletingSessionId(null)
    }
  }

  return (
    <div className="px-4 sm:px-6 py-6">
      <div className="max-w-lg mx-auto">
        <div className="mb-6 space-y-3">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900 tracking-tight">Practice on your phone, fast</h2>
            <p className="text-sm text-gray-500 mt-1">Pick a video, keep the title simple, and share it for feedback when you’re ready.</p>
          </div>
          <div className="rounded-3xl border border-gray-200 bg-gray-50 px-4 py-4">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Start here</p>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button type="button" onClick={openCamera} className="rounded-2xl bg-gray-900 text-white px-4 py-3 text-sm font-medium hover:bg-gray-800 transition-colors">
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
              onClick={openFiles}
              className="cursor-pointer rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center hover:bg-gray-100 transition-colors"
            >
              <p className="text-sm font-medium text-gray-900">Drag & drop your video here</p>
              <p className="text-xs text-gray-500 mt-1">or click to choose a file (supports .mov, .mp4, .webm; max 2GB)</p>
              {videoFile ? (
                <div className="mt-3 rounded-xl bg-white border border-gray-200 px-3 py-2 text-left">
                  <p className="text-xs text-gray-500">Selected video</p>
                  <p className="text-sm text-gray-900 font-medium mt-0.5 truncate">{videoFile.name}</p>
                </div>
              ) : null}
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

        <div className="mt-8 border-t border-gray-100 pt-6">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Practice entries</h3>
              <p className="text-xs text-gray-400 mt-1">Open, edit, or delete entries you created.</p>
            </div>
            {sessionsLoading ? <span className="text-xs text-gray-400">Loading…</span> : null}
          </div>

          {sessions.length ? (
            <div className="space-y-2">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="rounded-xl border border-gray-200 px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <button type="button" onClick={() => onOpenSession?.(session)} className="flex-1 text-left min-w-0">
                      <p className="text-sm font-medium text-gray-900 line-clamp-1">{session.title}</p>
                      <p className="text-xs text-gray-500 mt-1">{fmtDate(session.recorded_at || session.created_at)}</p>
                    </button>
                    <div className="flex items-center gap-2 pl-2">
                      <span className="text-[11px] uppercase tracking-wide text-gray-400">
                        {session.processing_status === 'ready' ? 'Ready' : session.processing_status || 'Saved'}
                      </span>
                      <button type="button" onClick={() => onOpenSession?.(session)} className="text-xs text-gray-500 hover:text-gray-900 transition-colors">
                        Open
                      </button>
                      {session.can_edit ? (
                        <button
                          type="button"
                          onClick={() => handleDeleteSession(session)}
                          disabled={deletingSessionId === session.id}
                          className="text-xs text-red-600 hover:text-red-700 disabled:opacity-50 transition-colors"
                        >
                          {deletingSessionId === session.id ? 'Deleting…' : 'Delete'}
                        </button>
                      ) : null}
                    </div>
                  </div>
                  {session.description ? (
                    <p className="text-xs text-gray-500 mt-2 line-clamp-2">{session.description}</p>
                  ) : null}
                  {session.processing_status === 'failed' && session.processing_error ? (
                    <p className="text-xs text-red-600 mt-2 line-clamp-2">{session.processing_error}</p>
                  ) : null}
                </div>
              ))}
              {hasMoreSessions ? (
                <button
                  type="button"
                  onClick={() => onLoadMoreSessions?.()}
                  disabled={sessionsLoadingMore}
                  className="w-full text-sm text-gray-600 border border-gray-200 rounded-xl py-2.5 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  {sessionsLoadingMore ? 'Loading…' : 'Load more'}
                </button>
              ) : null}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-5 text-center">
              <p className="text-sm text-gray-600">No practice entries yet.</p>
              <p className="text-xs text-gray-400 mt-1">Upload your first video to start a simple review-ready journal.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default SessionUpload
