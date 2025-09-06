import React, { useState, useRef, useEffect } from 'react'

// Metronome Component
function Metronome({ isEnabled, tempo, onTempoChange, isPlaying }) {
  const [audioContext, setAudioContext] = useState(null)
  const [oscillator, setOscillator] = useState(null)
  const [intervalId, setIntervalId] = useState(null)
  const [isMetronomePlaying, setIsMetronomePlaying] = useState(false)
  
  // Initialize audio context
  useEffect(() => {
    if (isEnabled && !audioContext) {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      setAudioContext(ctx)
    }
  }, [isEnabled, audioContext])

  // Play metronome click
  const playClick = () => {
    if (!audioContext) return
    
    const osc = audioContext.createOscillator()
    const gainNode = audioContext.createGain()
    
    osc.connect(gainNode)
    gainNode.connect(audioContext.destination)
    
    osc.frequency.setValueAtTime(800, audioContext.currentTime) // High pitch for click
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1)
    
    osc.start(audioContext.currentTime)
    osc.stop(audioContext.currentTime + 0.1)
  }

  // Start metronome
  const startMetronome = () => {
    if (!audioContext || isMetronomePlaying) return
    
    setIsMetronomePlaying(true)
    const interval = setInterval(playClick, 60000 / tempo) // Convert BPM to milliseconds
    setIntervalId(interval)
  }

  // Stop metronome
  const stopMetronome = () => {
    if (intervalId) {
      clearInterval(intervalId)
      setIntervalId(null)
    }
    setIsMetronomePlaying(false)
  }

  // Auto-start/stop based on recording state
  useEffect(() => {
    if (isEnabled && isPlaying) {
      startMetronome()
    } else {
      stopMetronome()
    }
    
    return () => stopMetronome()
  }, [isEnabled, isPlaying, tempo])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopMetronome()
      if (audioContext) {
        audioContext.close()
      }
    }
  }, [audioContext])

  if (!isEnabled) return null

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-blue-800 flex items-center">
          🎵 Metronome
          {isMetronomePlaying && (
            <span className="ml-2 text-green-600 animate-pulse">●</span>
          )}
        </h3>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-blue-600">BPM:</span>
          <input
            type="number"
            min="40"
            max="200"
            value={tempo}
            onChange={(e) => onTempoChange(parseInt(e.target.value))}
            className="w-20 px-2 py-1 border border-blue-300 rounded text-center text-sm font-medium"
            disabled={isMetronomePlaying}
            placeholder="120"
          />
          <div className="flex flex-col space-y-1">
            <button
              onClick={() => onTempoChange(Math.min(200, tempo + 5))}
              disabled={isMetronomePlaying}
              className="w-6 h-4 bg-blue-100 hover:bg-blue-200 text-blue-600 text-xs rounded flex items-center justify-center disabled:opacity-50"
            >
              +
            </button>
            <button
              onClick={() => onTempoChange(Math.max(40, tempo - 5))}
              disabled={isMetronomePlaying}
              className="w-6 h-4 bg-blue-100 hover:bg-blue-200 text-blue-600 text-xs rounded flex items-center justify-center disabled:opacity-50"
            >
              −
            </button>
          </div>
        </div>
      </div>
      
      <div className="flex items-center justify-between">
        <div className="text-sm text-blue-600">
          {isMetronomePlaying ? `Playing at ${tempo} BPM` : `Ready at ${tempo} BPM`}
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={isMetronomePlaying ? stopMetronome : startMetronome}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              isMetronomePlaying
                ? 'bg-red-500 text-white hover:bg-red-600'
                : 'bg-green-500 text-white hover:bg-green-600'
            }`}
          >
            {isMetronomePlaying ? '⏹️ Stop' : '▶️ Play'}
          </button>
        </div>
      </div>
      
      {/* Visual metronome indicator */}
      {isMetronomePlaying && (
        <div className="mt-3 flex justify-center">
          <div className="w-4 h-4 bg-blue-500 rounded-full animate-pulse"></div>
        </div>
      )}
    </div>
  )
}

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
  
  // Metronome state
  const [metronomeEnabled, setMetronomeEnabled] = useState(false)
  const [metronomeTempo, setMetronomeTempo] = useState(120) // Default 120 BPM
  
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

    const recorder = new MediaRecorder(streamRef.current, options)
    setMediaRecorder(recorder)
    setRecordedChunks([])
    recordedChunksRef.current = []

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunksRef.current.push(event.data)
        setRecordedChunks(prev => [...prev, event.data])
      }
    }

    recorder.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: options.mimeType })
      const videoFile = new File([blob], `recording-${Date.now()}.webm`, { type: options.mimeType })
      setRecordedVideo(videoFile)
      setFormData(prev => ({ ...prev, video_file: videoFile }))
      
      // Create URL for preview
      if (recordedVideoUrlRef.current) {
        URL.revokeObjectURL(recordedVideoUrlRef.current)
      }
      recordedVideoUrlRef.current = URL.createObjectURL(blob)
    }

    recorder.start(1000) // Record in 1-second chunks
    setIsRecording(true)
  }

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop()
    }
    setIsRecording(false)
    stopWebcam()
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!formData.title.trim()) {
      alert('Please enter a title for your video.')
      return
    }
    
    if (!formData.video_file) {
      alert('Please select or record a video file.')
      return
    }

    setIsUploading(true)

    try {
      const uploadData = new FormData()
      uploadData.append('title', formData.title.trim())
      uploadData.append('description', formData.description.trim())
      uploadData.append('tags', formData.tags.trim())
      uploadData.append('video_file', formData.video_file)

      const response = await fetch('/api/videos/upload/', {
        method: 'POST',
        body: uploadData
      })

      if (response.ok) {
        const result = await response.json()
        alert('Video uploaded successfully!')
        onUploadComplete()
      } else {
        const errorData = await response.json()
        console.error('Upload failed:', errorData)
        alert(`Upload failed: ${errorData.error || 'Please try again.'}`)
      }
    } catch (error) {
      console.error('Error uploading video:', error)
      alert('Error uploading video. Please check your connection and try again.')
    } finally {
      setIsUploading(false)
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopWebcam()
      if (recordedVideoUrlRef.current) {
        URL.revokeObjectURL(recordedVideoUrlRef.current)
      }
    }
  }, [])

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Upload Exercise Video</h2>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Form Fields */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Title *
          </label>
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter exercise title"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description
          </label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Describe your exercise"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tags
          </label>
          <input
            type="text"
            name="tags"
            value={formData.tags}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., guitar, scales, beginner"
          />
        </div>

        {/* Recording Mode Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Recording Method
          </label>
          <div className="flex space-x-4">
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
        </div>

        {/* Metronome Settings - Only show for webcam recording */}
        {recordingMode === 'webcam' && (
          <>
            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-800">Metronome Settings</h3>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={metronomeEnabled}
                    onChange={(e) => setMetronomeEnabled(e.target.checked)}
                    className="mr-2"
                  />
                  Enable Metronome
                </label>
              </div>
              
              {metronomeEnabled && (
                <Metronome
                  isEnabled={metronomeEnabled}
                  tempo={metronomeTempo}
                  onTempoChange={setMetronomeTempo}
                  isPlaying={isRecording}
                />
              )}
            </div>
          </>
        )}

        {/* File Upload */}
        {recordingMode === 'file' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Video File *
            </label>
            <input
              type="file"
              accept="video/*"
              onChange={handleFileChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required={recordingMode === 'file'}
            />
          </div>
        )}

        {/* Webcam Recording */}
        {recordingMode === 'webcam' && (
          <div>
            <div className="mb-4">
              <video
                ref={videoRef}
                className="w-full max-w-md mx-auto rounded-lg border"
                autoPlay
                muted
                playsInline
              />
            </div>
            
            <div className="flex justify-center space-x-4">
              {!isRecording ? (
                <button
                  type="button"
                  onClick={startRecording}
                  className="bg-red-500 text-white px-6 py-3 rounded-lg hover:bg-red-600 transition-colors duration-200 flex items-center space-x-2"
                >
                  <span>🎥</span>
                  <span>Start Recording</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopRecording}
                  className="bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition-colors duration-200 flex items-center space-x-2"
                >
                  <span>⏹️</span>
                  <span>Stop Recording</span>
                </button>
              )}
            </div>

            {/* Recorded Video Preview */}
            {recordedVideo && (
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded">
                <p className="text-sm text-green-800 mb-2">✓ Recording complete! Ready to upload.</p>
                <div className="mt-2">
                  <video src={recordedVideoUrlRef.current} controls className="w-full max-w-sm mx-auto rounded" />
                </div>
                <p className="text-xs text-green-700 mt-2">File: {recordedVideo.name} ({(recordedVideo.size / 1024 / 1024).toFixed(2)} MB)</p>
              </div>
            )}
          </div>
        )}

        {/* Submit Buttons */}
        <div className="flex justify-end space-x-4 pt-6 border-t">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isUploading}
            className="px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isUploading ? 'Uploading...' : 'Upload Video'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default VideoUpload