import React, { useState, useRef, useEffect } from 'react'

function SessionUpload({ token, onComplete, onCancel }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [videoFile, setVideoFile] = useState(null)
  const [isUploading, setIsUploading] = useState(false)
  const [recordingMode, setRecordingMode] = useState('file')
  const [isRecording, setIsRecording] = useState(false)
  const [recordedVideo, setRecordedVideo] = useState(null)
  const [mediaRecorder, setMediaRecorder] = useState(null)
  const chunksRef = useRef([])
  const blobUrlRef = useRef(null)
  const videoRef = useRef(null)
  const streamRef = useRef(null)

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
    chunksRef.current = []
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType })
      const file = new File([blob], `session-${Date.now()}.webm`, { type: mimeType })
      setRecordedVideo(file)
      setVideoFile(file)
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
      blobUrlRef.current = URL.createObjectURL(blob)
    }
    recorder.start(1000)
    setIsRecording(true)
  }

  const stopRecording = () => {
    if (mediaRecorder?.state === 'recording') mediaRecorder.stop()
    setIsRecording(false)
    stopWebcam()
  }

  useEffect(() => () => { stopWebcam(); if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current) }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!title.trim()) return alert('Please enter a title.')
    if (!videoFile) return alert('Please select or record a video.')
    setIsUploading(true)
    try {
      const fd = new FormData()
      fd.append('title', title.trim())
      fd.append('description', description.trim())
      fd.append('video_file', videoFile)
      const res = await fetch('/api/sessions/', {
        method: 'POST', body: fd,
        headers: token ? { 'Authorization': `Token ${token}` } : {},
      })
      if (res.ok) onComplete()
      else alert('Upload failed.')
    } catch { alert('Error uploading.') }
    finally { setIsUploading(false) }
  }

  return (
    <div className="px-4 sm:px-6 py-6">
      <div className="max-w-lg mx-auto">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">New session</h2>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm text-gray-600 mb-1.5">Title</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
              placeholder="e.g. Tuesday Practice - Week 12" required />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1.5">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 resize-none"
              placeholder="What did you work on?" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-2">Video</label>
            <div className="flex gap-2 mb-3">
              <button type="button" onClick={() => setRecordingMode('file')}
                className={`text-xs px-3 py-1.5 rounded-md transition-colors ${recordingMode === 'file' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}>
                Upload file</button>
              <button type="button" onClick={() => setRecordingMode('webcam')}
                className={`text-xs px-3 py-1.5 rounded-md transition-colors ${recordingMode === 'webcam' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}>
                Record</button>
            </div>
            {recordingMode === 'file' && (
              <input type="file" accept="video/*" onChange={(e) => setVideoFile(e.target.files[0])}
                className="w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-gray-100 file:text-gray-700" />
            )}
            {recordingMode === 'webcam' && (
              <div className="space-y-3">
                <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
                  <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover"
                    style={{ display: isRecording ? 'block' : 'none' }} />
                  {!isRecording && <div className="w-full h-full flex items-center justify-center"><p className="text-xs text-gray-400">Camera preview</p></div>}
                </div>
                <div className="flex justify-center">
                  {!isRecording
                    ? <button type="button" onClick={startRecording} className="flex items-center gap-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 px-4 py-2 rounded-lg"><span className="w-2 h-2 bg-white rounded-full"/>Record</button>
                    : <button type="button" onClick={stopRecording} className="flex items-center gap-2 text-sm font-medium text-gray-700 bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded-lg"><span className="w-2 h-2 bg-gray-700 rounded-sm"/>Stop</button>
                  }
                </div>
                {recordedVideo && (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <video src={blobUrlRef.current} controls className="w-full rounded-md" />
                    <p className="text-xs text-gray-400 mt-1">{(recordedVideo.size/1024/1024).toFixed(1)} MB</p>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onCancel} className="flex-1 text-sm text-gray-600 border border-gray-200 rounded-lg py-2.5 hover:bg-gray-50 transition-colors">Cancel</button>
            <button type="submit" disabled={isUploading} className="flex-1 text-sm font-medium text-white bg-gray-900 rounded-lg py-2.5 hover:bg-gray-800 disabled:opacity-40 transition-colors">
              {isUploading ? 'Uploading...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default SessionUpload
