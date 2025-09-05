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
  const [recordingMode, setRecordingMode] = useState('file') // 'file' or 'webcam'
  const [mediaRecorder, setMediaRecorder] = useState(null)
  const [recordedChunks, setRecordedChunks] = useState([])
  const [recordedVideo, setRecordedVideo] = useState(null)
  const recordedChunksRef = useRef([])
  const recordedVideoUrlRef = useRef(null)
  
  const videoRef = useRef(null)
  const streamRef = useRef(null)

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleFileChange = (e) => {
    setFormData(prev => ({
      ...prev,
      video_file: e.target.files[0]
    }))
  }

  const startWebcam = async () => {
    try {
      // Check if getUserMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Webcam not supported in this browser')
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        }, 
        audio: true 
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
    } catch (error) {
      console.error('Error accessing webcam:', error)
      let errorMessage = 'Could not access webcam. '
      if (error.name === 'NotAllowedError') {
        errorMessage += 'Please allow camera and microphone permissions.'
      } else if (error.name === 'NotFoundError') {
        errorMessage += 'No camera found. Please connect a camera.'
      } else if (error.name === 'NotSupportedError') {
        errorMessage += 'Webcam not supported in this browser.'
      } else {
        errorMessage += 'Please check your camera and try again.'
      }
      alert(errorMessage)
    }
  }

  const stopWebcam = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }

  const startRecording = async () => {
    if (!streamRef.current) {
      await startWebcam()
    }

    // Check MediaRecorder support
    if (!window.MediaRecorder) {
      alert('MediaRecorder not supported in this browser. Please use a modern browser.')
      return
    }

    // Get supported MIME types
    const options = { mimeType: 'video/webm;codecs=vp9' }
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options.mimeType = 'video/webm;codecs=vp8'
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = 'video/webm'
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
          options.mimeType = 'video/mp4'
        }
      }
    }

    const mediaRecorder = new MediaRecorder(streamRef.current, options)
    setMediaRecorder(mediaRecorder)
    recordedChunksRef.current = []
    setRecordedChunks([])

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunksRef.current.push(event.data)
        setRecordedChunks(prev => [...prev, event.data])
      }
    }

    mediaRecorder.onstop = () => {
      const mimeType = options.mimeType.includes('webm') ? 'video/webm' : 'video/mp4'
      const blob = new Blob(recordedChunksRef.current, { type: mimeType })
      
      // Clean up previous URL
      if (recordedVideoUrlRef.current) {
        URL.revokeObjectURL(recordedVideoUrlRef.current)
      }
      
      // Create new blob URL
      const blobUrl = URL.createObjectURL(blob)
      recordedVideoUrlRef.current = blobUrl
      
      const extension = mimeType.includes('webm') ? 'webm' : 'mp4'
      const videoFile = new File([blob], `webcam-recording.${extension}`, { type: mimeType })
      setRecordedVideo(videoFile)
      setFormData(prev => ({
        ...prev,
        video_file: videoFile
      }))
    }

    mediaRecorder.start(1000) // Record in 1-second chunks
    setIsRecording(true)
  }

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop()
      setIsRecording(false)
      stopWebcam()
    }
  }

  const validateVideoFile = (file) => {
    if (!file) return false
    if (file.size === 0) return false
    if (!file.type.startsWith('video/')) return false
    return true
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Validate form
    if (!formData.title.trim()) {
      alert('Please enter a title for your video.')
      return
    }
    
    if (!formData.video_file) {
      alert('Please select or record a video file.')
      return
    }
    
    if (!validateVideoFile(formData.video_file)) {
      alert('Invalid video file. Please record again or select a valid video file.')
      return
    }
    
    setIsUploading(true)

    try {
      const formDataToSend = new FormData()
      formDataToSend.append('title', formData.title)
      formDataToSend.append('description', formData.description)
      formDataToSend.append('tags', formData.tags)
      formDataToSend.append('video_file', formData.video_file)

      console.log('Uploading video:', {
        title: formData.title,
        description: formData.description,
        tags: formData.tags,
        videoFile: formData.video_file,
        videoFileName: formData.video_file?.name,
        videoFileSize: formData.video_file?.size,
        videoFileType: formData.video_file?.type
      })

      const response = await fetch('/api/videos/upload/', {
        method: 'POST',
        body: formDataToSend
      })

      if (response.ok) {
        onUploadComplete()
      } else {
        const errorData = await response.json()
        console.error('Upload failed:', errorData)
        alert(`Upload failed: ${errorData.detail || 'Please check all fields and try again.'}`)
      }
    } catch (error) {
      console.error('Error uploading video:', error)
      alert('Error uploading video. Please check your connection.')
    } finally {
      setIsUploading(false)
    }
  }

  useEffect(() => {
    return () => {
      stopWebcam()
      if (recordedVideoUrlRef.current) {
        URL.revokeObjectURL(recordedVideoUrlRef.current)
      }
    }
  }, [])

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-2xl font-bold mb-6">Upload Exercise Video</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
              Video Title *
            </label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Friday Drum Lesson - Basic Beats"
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Describe what you learned in this lesson..."
            />
          </div>

          <div>
            <label htmlFor="tags" className="block text-sm font-medium text-gray-700 mb-1">
              Tags
            </label>
            <input
              type="text"
              id="tags"
              name="tags"
              value={formData.tags}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., drums, basic-beats, rhythm"
            />
          </div>

          {/* Recording Mode Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Video Source
            </label>
            <div className="flex space-x-4 mb-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="recordingMode"
                  value="file"
                  checked={recordingMode === 'file'}
                  onChange={(e) => setRecordingMode(e.target.value)}
                  className="mr-2"
                />
                Upload File
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="recordingMode"
                  value="webcam"
                  checked={recordingMode === 'webcam'}
                  onChange={(e) => setRecordingMode(e.target.value)}
                  className="mr-2"
                />
                Record with Webcam
              </label>
            </div>
            {recordingMode === 'webcam' && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
                <p className="text-sm text-blue-800">
                  <strong>Webcam Recording:</strong> Works best in Chrome, Firefox, Safari, and Edge. 
                  Make sure to allow camera and microphone permissions when prompted.
                </p>
              </div>
            )}
          </div>

          {/* File Upload Mode */}
          {recordingMode === 'file' && (
            <div>
              <label htmlFor="video_file" className="block text-sm font-medium text-gray-700 mb-1">
                Video File *
              </label>
              <input
                type="file"
                id="video_file"
                name="video_file"
                onChange={handleFileChange}
                accept="video/*"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-sm text-gray-500 mt-1">
                Upload your 60-minute drum lesson video
              </p>
            </div>
          )}

          {/* Webcam Recording Mode */}
          {recordingMode === 'webcam' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Webcam Recording
              </label>
              
              {/* Video Preview */}
              <div className="mb-4">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  className="w-full max-w-md mx-auto rounded-lg border"
                  style={{ display: streamRef.current ? 'block' : 'none' }}
                />
                                      {!streamRef.current && (
                        <div className="w-full max-w-md mx-auto h-48 bg-gray-100 rounded-lg flex items-center justify-center">
                          <p className="text-gray-500">Click "Start Recording" to begin</p>
                        </div>
                      )}
              </div>

              {/* Recording Controls */}
              <div className="flex space-x-4 mb-4">
                {!isRecording ? (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!streamRef.current) {
                        await startWebcam()
                      }
                      startRecording()
                    }}
                    className="bg-red-600 text-white px-6 py-2 rounded hover:bg-red-700"
                  >
                    🎥 Start Recording
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      stopRecording()
                      stopWebcam()
                    }}
                    className="bg-gray-600 text-white px-6 py-2 rounded hover:bg-gray-700"
                  >
                    ⏹️ Stop Recording
                  </button>
                )}
              </div>

              {/* Recording Status */}
              {isRecording && (
                <div className="flex items-center space-x-2 text-red-600">
                  <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse"></div>
                  <span className="text-sm font-medium">Recording...</span>
                </div>
              )}

                                  {recordedVideo && (
                      <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded">
                        <p className="text-sm text-green-800 mb-2">
                          ✓ Recording complete! Ready to upload.
                        </p>
                        <div className="mt-2">
                          <video
                            src={recordedVideoUrlRef.current}
                            controls
                            className="w-full max-w-sm mx-auto rounded"
                          />
                        </div>
                        <p className="text-xs text-green-700 mt-2">
                          File: {recordedVideo.name} ({(recordedVideo.size / 1024 / 1024).toFixed(2)} MB)
                        </p>
                      </div>
                    )}
            </div>
          )}

          <div className="flex space-x-4 pt-4">
            <button
              type="submit"
              disabled={isUploading || !formData.video_file}
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploading ? 'Uploading...' : 'Upload Video'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default VideoUpload
