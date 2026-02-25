import React, { useState, useRef, useEffect } from 'react'

const formatDate = (dateStr) => {
  const d = new Date(dateStr)
  const now = new Date()
  const diff = now - d
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const formatTime = (timeStr) => {
  if (!timeStr) return ''
  try {
    const timePart = timeStr.split('.')[0]
    const t = new Date(`2000-01-01T${timePart}`)
    return t.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  } catch { return '' }
}

const videoUrl = (path) =>
  path?.startsWith('/media/') ? `http://localhost:8000${path}` : path

function VideoDetail({ video, onBack, onVideoUpdate, onVideoDelete }) {
  const [threads, setThreads] = useState(video.practice_threads || [])
  const [showUpload, setShowUpload] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editData, setEditData] = useState({ title: video.title, description: video.description, tags: video.tags })

  // Comparison state
  const [compareLeft, setCompareLeft] = useState(null)
  const [compareRight, setCompareRight] = useState(null)

  // Upload state
  const [newThread, setNewThread] = useState({ title: '', description: '', video_file: null })
  const [isUploading, setIsUploading] = useState(false)
  const [recordingMode, setRecordingMode] = useState('file')
  const [isRecording, setIsRecording] = useState(false)
  const [mediaRecorder, setMediaRecorder] = useState(null)
  const [recordedVideo, setRecordedVideo] = useState(null)
  const recordedChunksRef = useRef([])
  const recordedVideoUrlRef = useRef(null)
  const videoRef = useRef(null)
  const streamRef = useRef(null)

  // Webcam helpers
  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: true
      })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
    } catch { alert('Could not access camera.') }
  }

  const stopWebcam = () => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }

  const startRecording = async () => {
    if (!streamRef.current) await startWebcam()
    let mimeType = 'video/webm;codecs=vp9'
    if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm'
    if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/mp4'

    const recorder = new MediaRecorder(streamRef.current, { mimeType })
    setMediaRecorder(recorder)
    recordedChunksRef.current = []

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunksRef.current.push(e.data)
    }
    recorder.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: mimeType })
      const file = new File([blob], `practice-${Date.now()}.webm`, { type: mimeType })
      setRecordedVideo(file)
      setNewThread(prev => ({ ...prev, video_file: file }))
      if (recordedVideoUrlRef.current) URL.revokeObjectURL(recordedVideoUrlRef.current)
      recordedVideoUrlRef.current = URL.createObjectURL(blob)
    }
    recorder.start(1000)
    setIsRecording(true)
  }

  const stopRecording = () => {
    if (mediaRecorder?.state === 'recording') mediaRecorder.stop()
    setIsRecording(false)
    stopWebcam()
  }

  useEffect(() => () => {
    stopWebcam()
    if (recordedVideoUrlRef.current) URL.revokeObjectURL(recordedVideoUrlRef.current)
  }, [])

  // CRUD
  const saveEdit = async () => {
    try {
      const res = await fetch(`/api/videos/${video.id}/update_exercise/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editData.title, description: editData.description })
      })
      if (res.ok) {
        const updated = await res.json()
        onVideoUpdate(updated)
        setEditing(false)
      }
    } catch { alert('Error saving.') }
  }

  const uploadThread = async (e) => {
    e.preventDefault()
    if (!newThread.title.trim()) return alert('Please enter a title.')
    if (!newThread.video_file) return alert('Please select or record a video.')

    setIsUploading(true)
    try {
      const fd = new FormData()
      fd.append('title', newThread.title.trim())
      fd.append('description', newThread.description.trim())
      fd.append('video_file', newThread.video_file)

      const res = await fetch(`/api/videos/${video.id}/upload_thread/`, { method: 'POST', body: fd })
      if (res.ok) {
        const updated = await res.json()
        setThreads(updated.practice_threads || [])
        onVideoUpdate(updated)
        setShowUpload(false)
        setNewThread({ title: '', description: '', video_file: null })
        setRecordedVideo(null)
      } else {
        alert('Upload failed.')
      }
    } catch { alert('Error uploading.') }
    finally { setIsUploading(false) }
  }

  const deleteThread = async (threadId) => {
    if (!confirm('Delete this practice session?')) return
    try {
      const res = await fetch(`/api/videos/${video.id}/delete_thread/`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thread_id: threadId })
      })
      if (res.ok) {
        const updated = await res.json()
        setThreads(updated.practice_threads || [])
        if (compareLeft?.id === threadId) setCompareLeft(null)
        if (compareRight?.id === threadId) setCompareRight(null)
      }
    } catch { alert('Error deleting.') }
  }

  // Comparison helpers
  const handleThreadClick = (thread) => {
    if (!compareLeft) {
      setCompareLeft(thread)
    } else if (compareLeft.id === thread.id) {
      setCompareLeft(null)
    } else if (!compareRight) {
      setCompareRight(thread)
    } else if (compareRight.id === thread.id) {
      setCompareRight(null)
    } else {
      setCompareLeft(compareRight)
      setCompareRight(thread)
    }
  }

  const clearComparison = () => {
    setCompareLeft(null)
    setCompareRight(null)
  }

  const isComparing = compareLeft && compareRight

  return (
    <div className="px-4 sm:px-6 py-4">
      {/* Exercise header */}
      <div className="mb-6">
        {editing ? (
          <div className="space-y-3">
            <input
              type="text"
              value={editData.title}
              onChange={(e) => setEditData(p => ({ ...p, title: e.target.value }))}
              className="w-full text-lg font-semibold text-gray-900 border-b border-gray-200 focus:border-gray-400 focus:outline-none pb-1"
            />
            <textarea
              value={editData.description}
              onChange={(e) => setEditData(p => ({ ...p, description: e.target.value }))}
              rows={2}
              className="w-full text-sm text-gray-600 border-b border-gray-200 focus:border-gray-400 focus:outline-none resize-none"
            />
            <div className="flex gap-2">
              <button onClick={saveEdit} className="text-xs font-medium text-white bg-gray-900 px-3 py-1.5 rounded-md">Save</button>
              <button onClick={() => { setEditing(false); setEditData({ title: video.title, description: video.description, tags: video.tags }) }} className="text-xs text-gray-500 px-3 py-1.5">Cancel</button>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h1 className="text-lg font-semibold text-gray-900">{video.title}</h1>
                {video.description && (
                  <p className="text-sm text-gray-500 mt-0.5">{video.description}</p>
                )}
                {video.tags && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {video.tags.split(',').map(tag => (
                      <span key={tag.trim()} className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded">
                        {tag.trim()}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button onClick={() => setEditing(true)} className="text-xs text-gray-400 hover:text-gray-600 p-1.5">Edit</button>
                <button
                  onClick={() => { if (confirm(`Delete "${video.title}"?`)) onVideoDelete(video.id) }}
                  className="text-xs text-gray-400 hover:text-red-500 p-1.5"
                >Delete</button>
              </div>
            </div>

            {/* Exercise video */}
            <div className="mt-4 aspect-video bg-gray-100 rounded-lg overflow-hidden">
              <video
                src={videoUrl(video.video_file)}
                controls
                className="w-full h-full object-contain"
                preload="metadata"
              />
            </div>
          </div>
        )}
      </div>

      {/* Comparison viewer */}
      {isComparing && (
        <div className="mb-6 border border-gray-100 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-900">Comparing</h3>
            <button onClick={clearComparison} className="text-xs text-gray-400 hover:text-gray-600">
              Clear
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
                <video src={videoUrl(compareLeft.video_file)} controls className="w-full h-full object-contain" />
              </div>
              <p className="text-xs text-gray-500 mt-1.5 truncate">{compareLeft.title}</p>
              <p className="text-xs text-gray-400">{formatDate(compareLeft.created_at)}</p>
            </div>
            <div>
              <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
                <video src={videoUrl(compareRight.video_file)} controls className="w-full h-full object-contain" />
              </div>
              <p className="text-xs text-gray-500 mt-1.5 truncate">{compareRight.title}</p>
              <p className="text-xs text-gray-400">{formatDate(compareRight.created_at)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Practice sessions header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-gray-900">
          Practice sessions
          {threads.length > 0 && <span className="text-gray-400 font-normal ml-1">({threads.length})</span>}
        </h2>
        <button
          onClick={() => setShowUpload(!showUpload)}
          className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
        >
          {showUpload ? 'Cancel' : '+ Record'}
        </button>
      </div>

      {/* Comparison hint */}
      {threads.length >= 2 && !isComparing && (
        <p className="text-xs text-gray-400 mb-3">
          {compareLeft
            ? `"${compareLeft.title}" selected — tap another to compare`
            : 'Tap any two sessions to compare side by side'}
        </p>
      )}

      {/* Upload form */}
      {showUpload && (
        <form onSubmit={uploadThread} className="mb-6 p-4 bg-gray-50 rounded-xl space-y-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Title</label>
            <input
              type="text"
              value={newThread.title}
              onChange={(e) => setNewThread(p => ({ ...p, title: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 bg-white"
              placeholder="e.g. Morning practice"
              required
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Notes</label>
            <textarea
              value={newThread.description}
              onChange={(e) => setNewThread(p => ({ ...p, description: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 bg-white resize-none"
              placeholder="How did it go?"
            />
          </div>

          <div>
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => setRecordingMode('file')}
                className={`text-xs px-3 py-1.5 rounded-md transition-colors ${
                  recordingMode === 'file' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200'
                }`}
              >Upload file</button>
              <button
                type="button"
                onClick={() => setRecordingMode('webcam')}
                className={`text-xs px-3 py-1.5 rounded-md transition-colors ${
                  recordingMode === 'webcam' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200'
                }`}
              >Record</button>
            </div>

            {recordingMode === 'file' && (
              <input
                type="file"
                accept="video/*"
                onChange={(e) => setNewThread(p => ({ ...p, video_file: e.target.files[0] }))}
                className="w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-white file:text-gray-700"
              />
            )}

            {recordingMode === 'webcam' && (
              <div className="space-y-3">
                <div className="aspect-video bg-gray-200 rounded-lg overflow-hidden">
                  <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" style={{ display: isRecording ? 'block' : 'none' }} />
                  {!isRecording && (
                    <div className="w-full h-full flex items-center justify-center">
                      <p className="text-xs text-gray-400">Camera preview</p>
                    </div>
                  )}
                </div>
                <div className="flex justify-center">
                  {!isRecording ? (
                    <button type="button" onClick={startRecording} className="flex items-center gap-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 px-4 py-2 rounded-lg">
                      <span className="w-2 h-2 bg-white rounded-full" />Record
                    </button>
                  ) : (
                    <button type="button" onClick={stopRecording} className="flex items-center gap-2 text-sm font-medium text-gray-700 bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded-lg">
                      <span className="w-2 h-2 bg-gray-700 rounded-sm" />Stop
                    </button>
                  )}
                </div>
                {recordedVideo && (
                  <div className="bg-white rounded-lg p-3">
                    <video src={recordedVideoUrlRef.current} controls className="w-full rounded-md" />
                    <p className="text-xs text-gray-400 mt-1">{(recordedVideo.size / 1024 / 1024).toFixed(1)} MB</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={() => { setShowUpload(false); setRecordedVideo(null); stopWebcam() }}
              className="flex-1 text-sm text-gray-600 border border-gray-200 rounded-lg py-2 hover:bg-white transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={isUploading}
              className="flex-1 text-sm font-medium text-white bg-gray-900 rounded-lg py-2 hover:bg-gray-800 disabled:opacity-40 transition-colors">
              {isUploading ? 'Uploading...' : 'Save practice'}
            </button>
          </div>
        </form>
      )}

      {/* Chronological practice sessions */}
      <div className="space-y-2">
        {threads
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          .map((thread) => {
            const isSelected = compareLeft?.id === thread.id || compareRight?.id === thread.id
            return (
              <div
                key={thread.id}
                onClick={() => handleThreadClick(thread)}
                className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all group ${
                  isSelected
                    ? 'bg-gray-100 ring-1 ring-gray-300'
                    : 'hover:bg-gray-50'
                }`}
              >
                {/* Thumbnail */}
                <div className="w-20 h-14 sm:w-24 sm:h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                  <video
                    src={videoUrl(thread.video_file)}
                    className="w-full h-full object-cover"
                    muted
                    preload="metadata"
                    onLoadedMetadata={(e) => { e.target.currentTime = 1 }}
                  />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 py-0.5">
                  <h4 className="text-sm font-medium text-gray-900 truncate">{thread.title}</h4>
                  {thread.description && (
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{thread.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-400">{formatDate(thread.created_at)}</span>
                    <span className="text-xs text-gray-300">{formatTime(thread.time_of_day)}</span>
                  </div>
                </div>

                {/* Selection indicator */}
                <div className="flex items-center gap-1 flex-shrink-0 pt-1">
                  {isSelected && (
                    <span className="w-2 h-2 bg-gray-900 rounded-full" />
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteThread(thread.id) }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-red-400 transition-all"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            )
          })}
      </div>

      {/* Empty state */}
      {threads.length === 0 && !showUpload && (
        <div className="text-center py-12">
          <p className="text-sm text-gray-400 mb-4">No practice sessions yet</p>
          <button
            onClick={() => setShowUpload(true)}
            className="text-sm font-medium text-gray-900 border border-gray-200 rounded-lg px-5 py-2 hover:border-gray-400 transition-colors"
          >
            Record your first practice
          </button>
        </div>
      )}
    </div>
  )
}

export default VideoDetail
