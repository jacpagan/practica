import React, { useState, useRef, useEffect } from 'react'

function VideoUpload({ onUploadComplete, onCancel }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    tags: '',
    video_file: null
  })
  const [isUploading, setIsUploading] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingMode, setRecordingMode] = useState('file')
  const [mediaRecorder, setMediaRecorder] = useState(null)
  const [recordedVideo, setRecordedVideo] = useState(null)
  const recordedChunksRef = useRef([])
  const recordedVideoUrlRef = useRef(null)
  const videoRef = useRef(null)
  const streamRef = useRef(null)

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleFileChange = (e) => {
    setFormData(prev => ({ ...prev, video_file: e.target.files[0] }))
  }

  const startWebcam = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Webcam not supported')
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: true
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
    } catch (error) {
      alert('Could not access camera. Please check permissions.')
    }
  }

  const stopWebcam = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) videoRef.current.srcObject = null
  }

  const startRecording = async () => {
    if (!streamRef.current) await startWebcam()
    if (!window.MediaRecorder) {
      alert('Recording not supported in this browser.')
      return
    }

    let mimeType = 'video/webm;codecs=vp9'
    if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm;codecs=vp8'
    if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm'
    if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/mp4'

    const recorder = new MediaRecorder(streamRef.current, { mimeType })
    setMediaRecorder(recorder)
    recordedChunksRef.current = []

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) recordedChunksRef.current.push(event.data)
    }

    recorder.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: mimeType })
      const videoFile = new File([blob], `recording-${Date.now()}.webm`, { type: mimeType })
      setRecordedVideo(videoFile)
      setFormData(prev => ({ ...prev, video_file: videoFile }))
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

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.title.trim()) return alert('Please enter a title.')
    if (!formData.video_file) return alert('Please select or record a video.')

    setIsUploading(true)
    try {
      const uploadData = new FormData()
      uploadData.append('title', formData.title.trim())
      uploadData.append('description', formData.description.trim())
      uploadData.append('tags', formData.tags.trim())
      uploadData.append('video_file', formData.video_file)

      const response = await fetch('/api/videos/upload/', { method: 'POST', body: uploadData })
      if (response.ok) {
        onUploadComplete()
      } else {
        const err = await response.json()
        alert(`Upload failed: ${err.error || 'Please try again.'}`)
      }
    } catch (error) {
      alert('Error uploading. Please check your connection.')
    } finally {
      setIsUploading(false)
    }
  }

  useEffect(() => {
    return () => {
      stopWebcam()
      if (recordedVideoUrlRef.current) URL.revokeObjectURL(recordedVideoUrlRef.current)
    }
  }, [])

  return (
    <div className="px-4 sm:px-6 py-6">
      <div className="max-w-lg mx-auto">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">New exercise</h2>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm text-gray-600 mb-1.5">Title</label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
              placeholder="e.g. Tai Chi — Cloud Hands"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1.5">Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 resize-none"
              placeholder="What are you practicing?"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1.5">Tags</label>
            <input
              type="text"
              name="tags"
              value={formData.tags}
              onChange={handleInputChange}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
              placeholder="e.g. tai chi, form, beginner"
            />
          </div>

          {/* Source toggle */}
          <div>
            <label className="block text-sm text-gray-600 mb-2">Video</label>
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => setRecordingMode('file')}
                className={`text-xs px-3 py-1.5 rounded-md transition-colors ${
                  recordingMode === 'file'
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Upload file
              </button>
              <button
                type="button"
                onClick={() => setRecordingMode('webcam')}
                className={`text-xs px-3 py-1.5 rounded-md transition-colors ${
                  recordingMode === 'webcam'
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Record
              </button>
            </div>

            {recordingMode === 'file' && (
              <input
                type="file"
                accept="video/*"
                onChange={handleFileChange}
                className="w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
              />
            )}

            {recordingMode === 'webcam' && (
              <div className="space-y-3">
                <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                    style={{ display: isRecording || streamRef.current ? 'block' : 'none' }}
                  />
                  {!isRecording && !streamRef.current && (
                    <div className="w-full h-full flex items-center justify-center">
                      <p className="text-xs text-gray-400">Camera preview</p>
                    </div>
                  )}
                </div>

                <div className="flex justify-center">
                  {!isRecording ? (
                    <button
                      type="button"
                      onClick={startRecording}
                      className="flex items-center gap-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 px-4 py-2 rounded-lg transition-colors"
                    >
                      <span className="w-2 h-2 bg-white rounded-full" />
                      Record
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={stopRecording}
                      className="flex items-center gap-2 text-sm font-medium text-gray-700 bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded-lg transition-colors"
                    >
                      <span className="w-2 h-2 bg-gray-700 rounded-sm" />
                      Stop
                    </button>
                  )}
                </div>

                {recordedVideo && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <video src={recordedVideoUrlRef.current} controls className="w-full rounded-md" />
                    <p className="text-xs text-gray-400 mt-2">
                      {(recordedVideo.size / 1024 / 1024).toFixed(1)} MB
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 text-sm text-gray-600 border border-gray-200 rounded-lg py-2.5 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUploading}
              className="flex-1 text-sm font-medium text-white bg-gray-900 rounded-lg py-2.5 hover:bg-gray-800 disabled:opacity-40 transition-colors"
            >
              {isUploading ? 'Uploading...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default VideoUpload
