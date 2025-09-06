import React, { useState, useRef, useEffect, useMemo } from 'react'

function VideoDetail({ video, onBack, onVideoUpdate, comparisonQueue = [], onComparisonQueueUpdate }) {
  const [practiceThreads, setPracticeThreads] = useState(video.practice_threads || [])
  const [showPracticeThreads, setShowPracticeThreads] = useState(false)
  const [showUploadForm, setShowUploadForm] = useState(false)
  const [editingVideo, setEditingVideo] = useState(false)
  const [editingThread, setEditingThread] = useState(null)
  const [videoData, setVideoData] = useState({
    title: video.title,
    description: video.description,
    tags: video.tags
  })
  const [newThread, setNewThread] = useState({ 
    title: '', 
    description: '', 
    video_file: null
  })
  const [isUploading, setIsUploading] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingMode, setRecordingMode] = useState('file') // 'file' or 'webcam'
  const [mediaRecorder, setMediaRecorder] = useState(null)
  const [recordedChunks, setRecordedChunks] = useState([])
  const [recordedVideo, setRecordedVideo] = useState(null)
  const recordedChunksRef = useRef([])
  const recordedVideoUrlRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentVideo, setCurrentVideo] = useState(null)
  const [comparisonMode, setComparisonMode] = useState(false)
  const [selectedThreadForComparison, setSelectedThreadForComparison] = useState(null)
  const [comparisonVideo, setComparisonVideo] = useState(null)
  const [syncMode, setSyncMode] = useState(false)
  const [isExercisePlaying, setIsExercisePlaying] = useState(false)
  const [isPracticePlaying, setIsPracticePlaying] = useState(false)
  const [leftVideo, setLeftVideo] = useState(null)
  const [rightVideo, setRightVideo] = useState(null)
  const [leftVideoType, setLeftVideoType] = useState('exercise') // 'exercise' or 'practice'
  const [rightVideoType, setRightVideoType] = useState('practice') // 'exercise' or 'practice'
  const [learningInsights, setLearningInsights] = useState([])
  const [learningProgress, setLearningProgress] = useState({})
  const [practiceSearchTerm, setPracticeSearchTerm] = useState('')
  const [practiceSortBy, setPracticeSortBy] = useState('recent') // recent, oldest, alphabetical, best
  const [practiceFilterBy, setPracticeFilterBy] = useState('all') // all, recent, detailed, short
  const [practiceViewMode, setPracticeViewMode] = useState('compact') // compact, detailed, timeline
  const [practicePage, setPracticePage] = useState(1)
  const [practicePerPage] = useState(20)
  const [practiceGroupBy, setPracticeGroupBy] = useState('none') // none, week, month, year
  
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const exerciseVideoRef = useRef(null)
  const practiceVideoRef = useRef(null)

  // Filter and sort practice sessions
  const filteredPracticeThreads = useMemo(() => {
    let filtered = practiceThreads.filter(thread => {
      // Search filter
      const matchesSearch = !practiceSearchTerm || 
        thread.title.toLowerCase().includes(practiceSearchTerm.toLowerCase()) ||
        thread.description.toLowerCase().includes(practiceSearchTerm.toLowerCase())
      
      // Category filter
      let matchesFilter = true
      if (practiceFilterBy === 'recent') {
        const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        matchesFilter = new Date(thread.created_at) > oneWeekAgo
      } else if (practiceFilterBy === 'detailed') {
        matchesFilter = thread.description && thread.description.length > 50
      } else if (practiceFilterBy === 'short') {
        matchesFilter = !thread.description || thread.description.length <= 50
      }
      
      return matchesSearch && matchesFilter
    })

    // Sort practice sessions
    switch (practiceSortBy) {
      case 'recent':
        filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        break
      case 'oldest':
        filtered.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
        break
      case 'alphabetical':
        filtered.sort((a, b) => a.title.localeCompare(b.title))
        break
      case 'best':
        filtered.sort((a, b) => (b.description?.length || 0) - (a.description?.length || 0))
        break
    }

    return filtered
  }, [practiceThreads, practiceSearchTerm, practiceSortBy, practiceFilterBy])

  // Group practice sessions
  const groupedPracticeThreads = useMemo(() => {
    if (practiceGroupBy === 'none') {
      return { 'All Sessions': filteredPracticeThreads }
    }

    const groups = {}
    filteredPracticeThreads.forEach(thread => {
      const date = new Date(thread.created_at)
      let groupKey = ''

      switch (practiceGroupBy) {
        case 'week':
          const weekStart = new Date(date)
          weekStart.setDate(date.getDate() - date.getDay())
          groupKey = `Week of ${weekStart.toLocaleDateString()}`
          break
        case 'month':
          groupKey = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
          break
        case 'year':
          groupKey = date.getFullYear().toString()
          break
      }

      if (!groups[groupKey]) {
        groups[groupKey] = []
      }
      groups[groupKey].push(thread)
    })

    return groups
  }, [filteredPracticeThreads, practiceGroupBy])

  // Paginate practice sessions
  const paginatedPracticeThreads = useMemo(() => {
    const allThreads = Object.values(groupedPracticeThreads).flat()
    const startIndex = (practicePage - 1) * practicePerPage
    return allThreads.slice(startIndex, startIndex + practicePerPage)
  }, [groupedPracticeThreads, practicePage, practicePerPage])

  const totalPracticePages = Math.ceil(Object.values(groupedPracticeThreads).flat().length / practicePerPage)

  const handleVideoInputChange = (e) => {
    const { name, value } = e.target
    setVideoData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleThreadInputChange = (e) => {
    const { name, value } = e.target
    if (editingThread) {
      setEditingThread(prev => ({
        ...prev,
        [name]: value
      }))
    } else {
    setNewThread(prev => ({
      ...prev,
      [name]: value
    }))
    }
  }

  const handleThreadFileChange = (e) => {
    setNewThread(prev => ({
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
      const videoFile = new File([blob], `practice-recording.${extension}`, { type: mimeType })
      setRecordedVideo(videoFile)
      setNewThread(prev => ({
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

  const playVideo = (videoFile) => {
    // Convert relative path to full URL
    const videoUrl = videoFile.startsWith('/media/') 
      ? `http://localhost:8000${videoFile}`
      : videoFile
    setCurrentVideo(videoUrl)
    setIsPlaying(true)
  }

  const pauseVideo = () => {
    setIsPlaying(false)
  }

  const stopVideo = () => {
    setIsPlaying(false)
    setCurrentVideo(null)
  }

  const startComparison = (thread) => {
    setSelectedThreadForComparison(thread)
    setComparisonMode(true)
    const practiceVideoUrl = thread.video_file.startsWith('/media/') 
      ? `http://localhost:8000${thread.video_file}`
      : thread.video_file
    setComparisonVideo(practiceVideoUrl)
    
    // Set up default comparison: Exercise (left) vs Practice (right)
    setLeftVideo({
      url: video.video_file.startsWith('/media/') 
        ? `http://localhost:8000${video.video_file}`
        : video.video_file,
      title: video.title,
      type: 'exercise'
    })
    setRightVideo({
      url: practiceVideoUrl,
      title: thread.title,
      type: 'practice',
      thread: thread
    })
    setLeftVideoType('exercise')
    setRightVideoType('practice')
  }

  const swapVideos = () => {
    const tempVideo = leftVideo
    const tempType = leftVideoType
    setLeftVideo(rightVideo)
    setRightVideo(tempVideo)
    setLeftVideoType(rightVideoType)
    setRightVideoType(tempType)
  }

  const setLeftVideoToExercise = () => {
    setLeftVideo({
      url: video.video_file.startsWith('/media/') 
        ? `http://localhost:8000${video.video_file}`
        : video.video_file,
      title: video.title,
      type: 'exercise'
    })
    setLeftVideoType('exercise')
  }

  const setRightVideoToExercise = () => {
    setRightVideo({
      url: video.video_file.startsWith('/media/') 
        ? `http://localhost:8000${video.video_file}`
        : video.video_file,
      title: video.title,
      type: 'exercise'
    })
    setRightVideoType('exercise')
  }

  const setLeftVideoToPractice = (thread) => {
    const practiceVideoUrl = thread.video_file.startsWith('/media/') 
      ? `http://localhost:8000${thread.video_file}`
      : thread.video_file
    setLeftVideo({
      url: practiceVideoUrl,
      title: thread.title,
      type: 'practice',
      thread: thread
    })
    setLeftVideoType('practice')
  }

  const setRightVideoToPractice = (thread) => {
    const practiceVideoUrl = thread.video_file.startsWith('/media/') 
      ? `http://localhost:8000${thread.video_file}`
      : thread.video_file
    setRightVideo({
      url: practiceVideoUrl,
      title: thread.title,
      type: 'practice',
      thread: thread
    })
    setRightVideoType('practice')
  }

  const stopComparison = () => {
    setComparisonMode(false)
    setSelectedThreadForComparison(null)
    setComparisonVideo(null)
    setIsExercisePlaying(false)
    setIsPracticePlaying(false)
    setLeftVideo(null)
    setRightVideo(null)
    setLeftVideoType('exercise')
    setRightVideoType('practice')
  }

  const updateVideo = async () => {
    setIsUpdating(true)
    try {
      let response
      
      // Check if we have a new video file to upload
      if (videoData.video_file && videoData.video_file instanceof File) {
        // Upload with file using FormData
        const formData = new FormData()
        formData.append('title', videoData.title)
        formData.append('description', videoData.description || '')
        formData.append('video_file', videoData.video_file)
        
        response = await fetch(`/api/videos/${video.id}/update_exercise/`, {
          method: 'PATCH',
          body: formData
        })
      } else {
        // Update without file using JSON
        response = await fetch(`/api/videos/${video.id}/update_exercise/`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: videoData.title,
            description: videoData.description
          })
        })
      }
      
      if (response.ok) {
        const updatedVideo = await response.json()
        onVideoUpdate(updatedVideo)
        setEditingVideo(false)
        setVideoData({ title: '', description: '', video_file: null })
        setRecordedVideo(null)
        if (recordedVideoUrlRef.current) {
          URL.revokeObjectURL(recordedVideoUrlRef.current)
          recordedVideoUrlRef.current = null
        }
      } else {
        const errorData = await response.json()
        console.error('Update failed:', errorData)
        alert(`Update failed: ${errorData.detail || 'Please check all fields and try again.'}`)
      }
    } catch (error) {
      console.error('Error updating video:', error)
      alert('Error updating video. Please try again.')
    } finally {
      setIsUpdating(false)
    }
  }

  const deleteVideo = async () => {
    if (!confirm(`Are you sure you want to delete "${video.title}"? This will also delete all associated practice sessions.`)) {
      return
    }
    
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/videos/${video.id}/delete_exercise/`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        onBack()
      } else {
        const errorData = await response.json()
        console.error('Delete failed:', errorData)
        alert(`Delete failed: ${errorData.detail || 'Please try again.'}`)
      }
    } catch (error) {
      console.error('Error deleting video:', error)
      alert('Error deleting video. Please try again.')
    } finally {
      setIsDeleting(false)
    }
  }

  const updateThread = async (threadId) => {
    // Validate input data
    if (!editingThread.title || editingThread.title.trim() === '') {
      alert('Please enter a title for the practice session.')
      return
    }
    
    setIsUpdating(true)
    try {
      const response = await fetch(`/api/videos/${video.id}/update_thread/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          thread_id: threadId,
          title: editingThread.title.trim(),
          description: editingThread.description.trim()
        })
      })
      
      if (response.ok) {
        const updatedVideo = await response.json()
        setPracticeThreads(updatedVideo.practice_threads || [])
        setEditingThread(null)
        // Show success message
        alert('Practice session updated successfully!')
      } else {
        const errorData = await response.json()
        console.error('Thread update failed:', errorData)
        alert(`Update failed: ${errorData.error || 'Please try again.'}`)
      }
    } catch (error) {
      console.error('Error updating thread:', error)
      alert('Error updating practice session. Please try again.')
    } finally {
      setIsUpdating(false)
    }
  }

  const deleteThread = async (threadId) => {
    if (!confirm('Are you sure you want to delete this practice session?')) {
      return
    }
    
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/videos/${video.id}/delete_thread/`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ thread_id: threadId })
      })
      
      if (response.ok) {
        const updatedVideo = await response.json()
        setPracticeThreads(updatedVideo.practice_threads || [])
        // Show success message
        alert('Practice session deleted successfully!')
      } else {
        const errorData = await response.json()
        console.error('Thread delete failed:', errorData)
        alert(`Delete failed: ${errorData.error || 'Please try again.'}`)
      }
    } catch (error) {
      console.error('Error deleting thread:', error)
      alert('Error deleting practice session. Please try again.')
    } finally {
      setIsDeleting(false)
    }
  }

  const validateVideoFile = (file) => {
    if (!file) return false
    if (file.size === 0) return false
    if (!file.type.startsWith('video/')) return false
    return true
  }

  const handleThreadSubmit = async (e) => {
    e.preventDefault()
    
    // Validate form
    if (!newThread.title.trim()) {
      alert('Please enter a title for your practice session.')
      return
    }
    
    if (!newThread.video_file) {
      alert('Please select or record a video file.')
      return
    }
    
    if (!validateVideoFile(newThread.video_file)) {
      alert('Invalid video file. Please record again or select a valid video file.')
      return
    }
    
    setIsUploading(true)

    try {
      const formDataToSend = new FormData()
      formDataToSend.append('title', newThread.title.trim())
      formDataToSend.append('description', newThread.description.trim())
      formDataToSend.append('video_file', newThread.video_file)

      const response = await fetch(`/api/videos/${video.id}/upload_thread/`, {
        method: 'POST',
        body: formDataToSend
      })

      if (response.ok) {
        const updatedVideo = await response.json()
        setPracticeThreads(updatedVideo.practice_threads || [])
        setShowUploadForm(false)
        setNewThread({ title: '', description: '', video_file: null })
        // Show success message
        alert('Practice session uploaded successfully!')
      } else {
        const errorData = await response.json()
        console.error('Thread upload failed:', errorData)
        alert(`Upload failed: ${errorData.error || 'Please try again.'}`)
      }
    } catch (error) {
      console.error('Error uploading practice thread:', error)
      alert('Error uploading practice session. Please try again.')
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

  // Calculate learning insights and comparison suggestions
  useEffect(() => {
    const insights = []
    
    // Practice frequency analysis
    const practiceCount = practiceThreads.length

    // Improvement patterns
    if (practiceThreads.length >= 3) {
      const recentPractices = practiceThreads.slice(-3)
      const improvementTrend = recentPractices.length >= 2 ? 'improving' : 'stable'
      
      insights.push({
        type: 'improvement_trend',
        title: '🎯 Improvement Trend',
        description: 'Your recent practice sessions show progress',
        value: improvementTrend,
        trend: improvementTrend,
        color: 'from-purple-50 to-pink-50',
        icon: '🎯'
      })
    }

    setLearningInsights(insights)

    // Calculate learning progress
    const progress = {
      totalPractices: practiceCount,
      recentPractices: practiceThreads.filter(thread => 
        new Date(thread.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      ).length
    }
    setLearningProgress(progress)
  }, [practiceThreads])

  return (
    <div className="max-w-6xl mx-auto">
      {/* Exercise Video Section - Always Visible */}
      <div className="bg-white rounded-lg shadow mb-6">
        {/* Header */}
        <div className="p-6 border-b">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              {editingVideo ? (
                <div className="space-y-6">
                  {/* Basic Information */}
                  <div className="space-y-4">
                    <input
                      type="text"
                      name="title"
                      value={videoData.title}
                      onChange={handleVideoInputChange}
                      className="w-full text-3xl font-bold text-gray-900 bg-transparent border-b-2 border-blue-500 focus:outline-none"
                      placeholder="Video Title"
                    />
                    <textarea
                      name="description"
                      value={videoData.description}
                      onChange={handleVideoInputChange}
                      rows={3}
                      className="w-full text-gray-600 bg-transparent border-b border-gray-300 focus:outline-none focus:border-blue-500"
                      placeholder="Video Description"
                    />
                    <input
                      type="text"
                      name="tags"
                      value={videoData.tags}
                      onChange={handleVideoInputChange}
                      className="w-full text-sm text-blue-600 bg-blue-100 px-2 py-1 rounded border-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Tags (comma separated)"
                    />
                  </div>

                  {/* Video File Update Section */}
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-800 mb-3">📹 Update Video File</h3>
                    <p className="text-sm text-gray-600 mb-4">You can upload a new video file or re-record using your webcam.</p>
                    
                    {/* Recording Mode Toggle */}
                    <div className="flex space-x-2 mb-4">
                      <button
                        onClick={() => setRecordingMode('file')}
                        className={`px-3 py-2 rounded text-sm transition-colors ${
                          recordingMode === 'file' 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        📁 Upload File
                      </button>
                      <button
                        onClick={() => setRecordingMode('webcam')}
                        className={`px-3 py-2 rounded text-sm transition-colors ${
                          recordingMode === 'webcam' 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        🎥 Record New Video
                      </button>
                    </div>

                    {/* File Upload */}
                    {recordingMode === 'file' && (
                      <div className="space-y-3">
                        <input
                          type="file"
                          accept="video/*"
                          onChange={(e) => {
                            const file = e.target.files[0]
                            if (file) {
                              setVideoData(prev => ({ ...prev, video_file: file }))
                              setRecordedVideo(null)
                              if (recordedVideoUrlRef.current) {
                                URL.revokeObjectURL(recordedVideoUrlRef.current)
                                recordedVideoUrlRef.current = null
                              }
                            }
                          }}
                          className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                        />
                        {videoData.video_file && (
                          <div className="p-3 bg-green-50 border border-green-200 rounded">
                            <p className="text-sm text-green-800">✓ New video file selected: {videoData.video_file.name}</p>
                            <p className="text-xs text-green-700">Size: {(videoData.video_file.size / 1024 / 1024).toFixed(2)} MB</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Webcam Recording */}
                    {recordingMode === 'webcam' && (
                      <div className="space-y-4">
                        {/* Camera Preview */}
                        <div className="relative">
                          <video
                            ref={videoRef}
                            autoPlay
                            muted
                            className="w-full max-w-md mx-auto rounded-lg shadow-md"
                            style={{ display: isRecording ? 'block' : 'none' }}
                          />
                          {!isRecording && (
                            <div className="w-full max-w-md mx-auto h-48 bg-gray-200 rounded-lg flex items-center justify-center">
                              <p className="text-gray-500">Camera preview will appear here</p>
                            </div>
                          )}
                        </div>

                        {/* Recording Controls */}
                        <div className="flex justify-center space-x-3">
                          {!isRecording ? (
                            <button
                              onClick={startRecording}
                              className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition-colors duration-200 flex items-center space-x-2"
                            >
                              <span>🎥</span>
                              <span>Start Recording</span>
                            </button>
                          ) : (
                            <button
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
                            <p className="text-sm text-green-800 mb-2">✓ Recording complete! Ready to update.</p>
                            <div className="mt-2">
                              <video src={recordedVideoUrlRef.current} controls className="w-full max-w-sm mx-auto rounded" />
                            </div>
                            <p className="text-xs text-green-700 mt-2">File: {recordedVideo.name} ({(recordedVideo.size / 1024 / 1024).toFixed(2)} MB)</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Current Video Info */}
                    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
                      <p className="text-sm text-blue-800"><strong>Current Video:</strong> {video.title}</p>
                      <p className="text-xs text-blue-700">Uploaded: {new Date(video.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex space-x-2">
                    <button
                      onClick={updateVideo}
                      disabled={isUpdating}
                      className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
                    >
                      {isUpdating ? 'Saving...' : 'Save Changes'}
                    </button>
                    <button
                      onClick={() => {
                        setEditingVideo(false)
                        setVideoData({
                          title: video.title,
                          description: video.description,
                          tags: video.tags,
                          video_file: null
                        })
                        setRecordedVideo(null)
                        if (recordedVideoUrlRef.current) {
                          URL.revokeObjectURL(recordedVideoUrlRef.current)
                          recordedVideoUrlRef.current = null
                        }
                        if (streamRef.current) {
                          streamRef.current.getTracks().forEach(track => track.stop())
                          streamRef.current = null
                        }
                        setIsRecording(false)
                      }}
                      className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{video.title}</h1>
              <p className="text-gray-600 mt-2">{video.description}</p>
              <div className="flex items-center mt-2 space-x-4">
                <span className="text-sm text-blue-600 bg-blue-100 px-2 py-1 rounded">
                  {video.tags}
                </span>
                <span className="text-sm text-gray-500">
                  {new Date(video.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
              )}
            </div>
            <div className="flex space-x-2 ml-4">
              {!editingVideo && (
                <>
                  <button
                    onClick={() => setEditingVideo(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                  >
                    ✏️ Edit
                  </button>
                  <button
                    onClick={deleteVideo}
                    disabled={isDeleting}
                    className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-50"
                  >
                    {isDeleting ? 'Deleting...' : '🗑️ Delete'}
                  </button>
                </>
              )}
            <button
              onClick={onBack}
              className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
            >
              ← Back to Videos
            </button>
            </div>
          </div>
        </div>

        {/* Learning Insights Panel */}
        <div className="bg-gradient-to-r from-blue-50 via-purple-50 to-pink-50 border-b border-gray-200">
        <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <span className="text-2xl">🧠</span>
                <div>
                  <h3 className="text-lg font-bold text-gray-800">Learning Insights</h3>
                  <p className="text-sm text-gray-600">Discover patterns in your practice journey</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {comparisonQueue.length > 0 && (
                  <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm">
                    📊 {comparisonQueue.length} in queue
                  </div>
                )}
              </div>
            </div>

            {/* Learning Progress */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 shadow-sm">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">📈</span>
                  <div>
                    <p className="text-sm text-gray-600">Total Practices</p>
                    <p className="text-2xl font-bold text-blue-600">{learningProgress.totalPractices || 0}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 shadow-sm">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">🔥</span>
                  <div>
                    <p className="text-sm text-gray-600">This Week</p>
                    <p className="text-2xl font-bold text-orange-600">{learningProgress.recentPractices || 0}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Learning Insights */}
            {learningInsights.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {learningInsights.map((insight, index) => (
                  <div key={index} className={`bg-gradient-to-r ${insight.color} rounded-xl p-4 border border-gray-200`}>
                    <div className="flex items-center space-x-3">
                      <span className="text-xl">{insight.icon}</span>
                      <div>
                        <h4 className="font-semibold text-gray-800">{insight.title}</h4>
                        <p className="text-sm text-gray-600">{insight.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

          </div>
        </div>

        {/* Exercise Video Player - Always Visible */}
        <div className="p-6">
          {comparisonMode ? (
            <div className="space-y-6">
              {/* Comparison Header */}
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center space-x-3">
                  <h3 className="text-xl font-semibold text-gray-900">📊 Video Comparison</h3>
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>Independent viewing</span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={swapVideos}
                    className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition-colors"
                  >
                    🔄 Swap
                  </button>
                  <button
                    onClick={stopComparison}
                    className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors duration-200"
                  >
                    Exit Comparison
                  </button>
                </div>
              </div>
              
              {/* Side-by-side Video Comparison */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {/* Left Video */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <h4 className="text-lg font-medium text-blue-700 flex items-center space-x-2">
                        <span>{leftVideoType === 'exercise' ? '📚' : '🎯'}</span>
                        <span>{leftVideo?.title || 'Select Video'}</span>
                      </h4>
                      {leftVideoType === 'exercise' && (
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">Original</span>
                      )}
                    </div>
                    {isExercisePlaying && (
                      <div className="flex items-center space-x-1 text-green-600">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="text-xs font-medium">Playing</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Quick Navigation for Left Video */}
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={setLeftVideoToExercise}
                      className={`px-2 py-1 rounded text-xs transition-colors ${
                        leftVideoType === 'exercise' 
                          ? 'bg-blue-100 text-blue-800 border border-blue-300' 
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      📚 Original Exercise
                    </button>
                    {practiceThreads.map((thread, index) => (
                      <button
                        key={thread.id || index}
                        onClick={() => setLeftVideoToPractice(thread)}
                        className={`px-2 py-1 rounded text-xs transition-colors ${
                          leftVideoType === 'practice' && leftVideo?.thread?.id === thread.id
                            ? 'bg-green-100 text-green-800 border border-green-300' 
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        🎯 {thread.title}
                      </button>
                    ))}
                  </div>
                  
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 shadow-sm">
                    {leftVideo ? (
                      <video
                        ref={exerciseVideoRef}
                        src={leftVideo.url}
                        controls
                        className="w-full rounded-lg shadow-md"
                        onPlay={() => setIsExercisePlaying(true)}
                        onPause={() => setIsExercisePlaying(false)}
                        onEnded={() => setIsExercisePlaying(false)}
                      />
                    ) : (
                      <div className="w-full h-48 bg-gray-200 rounded-lg flex items-center justify-center">
                        <p className="text-gray-500">Select a video to compare</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Video */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <h4 className="text-lg font-medium text-green-700 flex items-center space-x-2">
                        <span>{rightVideoType === 'exercise' ? '📚' : '🎯'}</span>
                        <span>{rightVideo?.title || 'Select Video'}</span>
                      </h4>
                      {rightVideoType === 'exercise' && (
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">Original</span>
                      )}
                    </div>
                    {isPracticePlaying && (
                      <div className="flex items-center space-x-1 text-green-600">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="text-xs font-medium">Playing</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Quick Navigation for Right Video */}
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={setRightVideoToExercise}
                      className={`px-2 py-1 rounded text-xs transition-colors ${
                        rightVideoType === 'exercise' 
                          ? 'bg-blue-100 text-blue-800 border border-blue-300' 
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      📚 Original Exercise
                    </button>
                    {practiceThreads.map((thread, index) => (
                      <button
                        key={thread.id || index}
                        onClick={() => setRightVideoToPractice(thread)}
                        className={`px-2 py-1 rounded text-xs transition-colors ${
                          rightVideoType === 'practice' && rightVideo?.thread?.id === thread.id
                            ? 'bg-green-100 text-green-800 border border-green-300' 
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        🎯 {thread.title}
                      </button>
                    ))}
                  </div>
                  
                  <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 shadow-sm">
                    {rightVideo ? (
                      <video
                        ref={practiceVideoRef}
                        src={rightVideo.url}
                        controls
                        className="w-full rounded-lg shadow-md"
                        onPlay={() => setIsPracticePlaying(true)}
                        onPause={() => setIsPracticePlaying(false)}
                        onEnded={() => setIsPracticePlaying(false)}
                      />
                    ) : (
                      <div className="w-full h-48 bg-gray-200 rounded-lg flex items-center justify-center">
                        <p className="text-gray-500">Select a video to compare</p>
                      </div>
                    )}
                  </div>
                  
                  {/* Video Details */}
                  {(rightVideo?.thread || rightVideoType === 'exercise') && (
                    <div className="bg-white rounded-lg p-3 shadow-sm border border-green-200">
                      <div className="text-sm text-gray-700 space-y-1">
                        {rightVideoType === 'exercise' ? (
                          <>
                            <p><strong className="text-blue-700">Type:</strong> Original Exercise</p>
                            <p><strong className="text-blue-700">Title:</strong> {video.title}</p>
                          </>
                        ) : (
                          <>
                            <p><strong className="text-green-700">Type:</strong> Practice Session</p>
                            <p><strong className="text-green-700">Session:</strong> {rightVideo?.thread?.title}</p>
                            <p><strong className="text-green-700">Date:</strong> {rightVideo?.thread ? new Date(rightVideo.thread.created_at).toLocaleDateString() : ''}</p>
                            {rightVideo?.thread?.description && (
                              <p><strong className="text-green-700">Notes:</strong> {rightVideo.thread.description}</p>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Access to Original Exercise */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">📚</span>
                    <div>
                      <h5 className="font-semibold text-blue-900">Quick Access to Original Exercise</h5>
                      <p className="text-sm text-blue-700">Always available for reference and comparison</p>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={setLeftVideoToExercise}
                      className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition-colors"
                    >
                      Set as Left
                    </button>
                    <button
                      onClick={setRightVideoToExercise}
                      className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition-colors"
                    >
                      Set as Right
                    </button>
                  </div>
                </div>
              </div>

            </div>
          ) : (
          <div className="bg-gray-100 rounded-lg p-8 text-center">
            {currentVideo ? (
              <div className="space-y-4">
                <video
                  ref={videoRef}
                  src={currentVideo}
                  controls
                    autoPlay
                    className="w-full max-w-4xl mx-auto rounded-lg"
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={() => setIsPlaying(false)}
                />
                  <div className="flex justify-center">
                  <button
                    onClick={stopVideo}
                    className="bg-gray-600 text-white px-6 py-2 rounded hover:bg-gray-700"
                  >
                      Close Video
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="text-gray-500 mb-4">
                  <svg className="w-16 h-16 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Exercise Video</h3>
                  <p className="text-gray-600 mb-4">Your exercise lesson video</p>
                <button
                  onClick={() => playVideo(video.video_file)}
                  className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
                >
                    ▶️ Play Exercise Video
                </button>
                </div>
              )}
              </div>
            )}
          </div>
        </div>

      {/* Practice Threads Section - Collapsible */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b">
          <div className="flex justify-between items-center mb-4">
            <button
              onClick={() => setShowPracticeThreads(!showPracticeThreads)}
              className="flex items-center space-x-2 text-left hover:text-blue-600 transition-colors"
            >
              <svg 
                className={`w-5 h-5 transform transition-transform ${showPracticeThreads ? 'rotate-90' : ''}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Practice Sessions</h2>
                <p className="text-sm text-gray-600">
                  {practiceThreads.length} sessions • {filteredPracticeThreads.length} shown
                </p>
              </div>
            </button>
            <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowUploadForm(!showUploadForm)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
                + Add Practice Session
            </button>
            </div>
          </div>

          {/* Practice Session Controls */}
          {showPracticeThreads && (
            <div className="space-y-4">
              {/* Search and Filter Controls */}
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                <div className="lg:col-span-2">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="🔍 Search practice sessions..."
                      value={practiceSearchTerm}
                      onChange={(e) => setPracticeSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <div className="absolute left-3 top-2.5 text-gray-400">🔍</div>
                  </div>
                </div>
                
                <div>
                  <select
                    value={practiceSortBy}
                    onChange={(e) => setPracticeSortBy(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="recent">📅 Most Recent</option>
                    <option value="oldest">📅 Oldest First</option>
                    <option value="alphabetical">🔤 A-Z</option>
                    <option value="best">⭐ Best First</option>
                  </select>
                </div>
                
                <div>
                  <select
                    value={practiceFilterBy}
                    onChange={(e) => setPracticeFilterBy(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">All Sessions</option>
                    <option value="recent">Recent (1 week)</option>
                    <option value="detailed">Detailed</option>
                    <option value="short">Short</option>
                  </select>
                </div>
                
                <div>
                  <select
                    value={practiceGroupBy}
                    onChange={(e) => setPracticeGroupBy(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="none">No Grouping</option>
                    <option value="week">By Week</option>
                    <option value="month">By Month</option>
                    <option value="year">By Year</option>
                  </select>
                </div>
              </div>

              {/* View Mode Toggle */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">View:</span>
                  <button
                    onClick={() => setPracticeViewMode('compact')}
                    className={`px-3 py-1 rounded text-sm ${
                      practiceViewMode === 'compact' 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                    }`}
                  >
                    ⊞ Compact
                  </button>
                  <button
                    onClick={() => setPracticeViewMode('detailed')}
                    className={`px-3 py-1 rounded text-sm ${
                      practiceViewMode === 'detailed' 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                    }`}
                  >
                    ☰ Detailed
                  </button>
                  <button
                    onClick={() => setPracticeViewMode('timeline')}
                    className={`px-3 py-1 rounded text-sm ${
                      practiceViewMode === 'timeline' 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                    }`}
                  >
                    📅 Timeline
                  </button>
                </div>
                
                <div className="text-sm text-gray-600">
                  Showing {paginatedPracticeThreads.length} of {filteredPracticeThreads.length} sessions
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Collapsible Content */}
        {showPracticeThreads && (
          <div className="p-6">
          {/* Upload Form */}
          {showUploadForm && (
            <div className="bg-gray-50 p-4 rounded-lg mb-6">
              <h3 className="text-lg font-medium mb-4">Upload Practice Session</h3>
              <form onSubmit={handleThreadSubmit} className="space-y-4">
                <div>
                  <label htmlFor="thread_title" className="block text-sm font-medium text-gray-700 mb-1">
                    Session Title *
                  </label>
                  <input
                    type="text"
                    id="thread_title"
                    name="title"
                    value={newThread.title}
                    onChange={handleThreadInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="e.g., Friday 4PM Practice - Basic Beats"
                  />
                </div>

                <div>
                  <label htmlFor="thread_description" className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    id="thread_description"
                    name="description"
                    value={newThread.description}
                    onChange={handleThreadInputChange}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="How did the practice go? What did you work on?"
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
                    <label htmlFor="thread_video_file" className="block text-sm font-medium text-gray-700 mb-1">
                        Video File *
                    </label>
                    <input
                      type="file"
                      id="thread_video_file"
                      name="video_file"
                      accept="video/*"
                        onChange={handleThreadFileChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
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

                <div className="flex space-x-4">
                  <button
                    type="submit"
                    disabled={isUploading}
                      className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 disabled:opacity-50"
                  >
                    {isUploading ? 'Uploading...' : 'Upload Practice Session'}
                  </button>
                  <button
                    type="button"
                      onClick={() => {
                        setShowUploadForm(false)
                        setNewThread({ title: '', description: '', video_file: null })
                        setRecordedVideo(null)
                        stopWebcam()
                      }}
                      className="bg-gray-300 text-gray-700 px-6 py-2 rounded hover:bg-gray-400"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

            {/* Practice Sessions Display */}
            {practiceViewMode === 'timeline' ? (
              /* Timeline View */
              <div className="space-y-6">
                {Object.entries(groupedPracticeThreads).map(([groupName, threads]) => (
                  <div key={groupName} className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2">
                      {groupName} ({threads.length})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {threads.map((thread, index) => (
                        <div
                          key={thread.id || index}
                          className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg p-4 border border-blue-200 hover:shadow-md transition-all duration-200"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-semibold text-gray-800 line-clamp-1">{thread.title}</h4>
                            <div className="text-xs text-gray-500 text-right">
                              <div>{new Date(thread.created_at).toLocaleDateString()}</div>
                              <div className="font-medium text-blue-600">🕐 {thread.time_of_day}</div>
                            </div>
                    </div>
                          <p className="text-sm text-gray-600 line-clamp-2 mb-3">{thread.description}</p>
                          <div className="flex space-x-2">
                    <button 
                      onClick={() => playVideo(thread.video_file)}
                              className="flex-1 bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600"
                            >
                              ▶️ Play
                            </button>
                            <button
                              onClick={() => startComparison(thread)}
                              className="bg-purple-500 text-white px-3 py-1 rounded text-sm hover:bg-purple-600"
                            >
                              📊 Compare
                    </button>
                  </div>
                </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : practiceViewMode === 'detailed' ? (
              /* Detailed List View */
              <div className="space-y-3">
                {paginatedPracticeThreads.map((thread, index) => (
                  <div
                    key={thread.id || index}
                    className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors"
                  >
                    {editingThread && editingThread.id === thread.id ? (
                      <div className="space-y-4">
                        <input
                          type="text"
                          name="title"
                          value={editingThread.title}
                          onChange={handleThreadInputChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                          placeholder="Practice Session Title"
                        />
                        <textarea
                          name="description"
                          value={editingThread.description}
                          onChange={handleThreadInputChange}
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                          placeholder="Practice Session Description"
                        />
                        <div className="flex space-x-2">
                          <button
                            onClick={() => updateThread(thread.id)}
                            disabled={isUpdating}
                            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
                          >
                            {isUpdating ? 'Saving...' : 'Save Changes'}
                          </button>
                          <button
                            onClick={() => setEditingThread(null)}
                            className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-3 mb-2">
                            <h4 className="font-semibold text-gray-800">{thread.title}</h4>
                            <div className="text-xs text-gray-500">
                              <div>{new Date(thread.created_at).toLocaleDateString()}</div>
                              <div className="font-medium text-blue-600">🕐 {thread.time_of_day}</div>
                            </div>
                            {thread.description && thread.description.length > 50 && (
                              <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                                Detailed
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 line-clamp-2">{thread.description}</p>
                        </div>
                        <div className="flex space-x-2 ml-4">
                          <button
                            onClick={() => playVideo(thread.video_file)}
                            className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600"
                          >
                            ▶️ Play
                          </button>
                          <button
                            onClick={() => startComparison(thread)}
                            className="bg-purple-500 text-white px-3 py-1 rounded text-sm hover:bg-purple-600"
                          >
                            📊 Compare
                          </button>
                          <button
                            onClick={() => setEditingThread({...thread})}
                            className="bg-yellow-500 text-white px-3 py-1 rounded text-sm hover:bg-yellow-600"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            onClick={() => deleteThread(thread.id)}
                            disabled={isDeleting}
                            className="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600 disabled:opacity-50"
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              /* Compact Grid View */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {paginatedPracticeThreads.map((thread, index) => (
                  <div
                    key={thread.id || index}
                    className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg p-3 border border-blue-200 hover:shadow-md transition-all duration-200"
                  >
                    {editingThread && editingThread.id === thread.id ? (
                      <div className="space-y-3">
                        <input
                          type="text"
                          name="title"
                          value={editingThread.title}
                          onChange={handleThreadInputChange}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-yellow-500"
                          placeholder="Session Title"
                        />
                        <textarea
                          name="description"
                          value={editingThread.description}
                          onChange={handleThreadInputChange}
                          rows={2}
                          className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-yellow-500"
                          placeholder="Session Description"
                        />
                        <div className="flex space-x-1">
                          <button
                            onClick={() => updateThread(thread.id)}
                            disabled={isUpdating}
                            className="flex-1 bg-green-500 text-white px-2 py-1 rounded text-xs hover:bg-green-600 disabled:opacity-50"
                          >
                            {isUpdating ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            onClick={() => setEditingThread(null)}
                            className="bg-gray-400 text-white px-2 py-1 rounded text-xs hover:bg-gray-500"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold text-gray-800 text-sm line-clamp-1">{thread.title}</h4>
                          <div className="text-xs text-gray-500 text-right">
                            <div>{new Date(thread.created_at).toLocaleDateString()}</div>
                            <div className="font-medium text-blue-600">🕐 {thread.time_of_day}</div>
                          </div>
                        </div>
                        <p className="text-xs text-gray-600 line-clamp-2">{thread.description}</p>
                        <div className="flex space-x-1">
                          <button
                            onClick={() => playVideo(thread.video_file)}
                            className="flex-1 bg-blue-500 text-white px-2 py-1 rounded text-xs hover:bg-blue-600"
                          >
                            ▶️
                          </button>
                          <button
                            onClick={() => startComparison(thread)}
                            className="bg-purple-500 text-white px-2 py-1 rounded text-xs hover:bg-purple-600"
                          >
                            📊
                          </button>
                          <button
                            onClick={() => setEditingThread({...thread})}
                            className="bg-yellow-500 text-white px-2 py-1 rounded text-xs hover:bg-yellow-600"
                          >
                            ✏️
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPracticePages > 1 && (
              <div className="flex justify-center items-center space-x-2 mt-8">
                <button
                  onClick={() => setPracticePage(Math.max(1, practicePage - 1))}
                  disabled={practicePage === 1}
                  className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ← Previous
                </button>
                
                {Array.from({ length: Math.min(5, totalPracticePages) }, (_, i) => {
                  const page = i + 1
                  return (
                    <button
                      key={page}
                      onClick={() => setPracticePage(page)}
                      className={`px-4 py-2 rounded-lg ${
                        practicePage === page
                          ? 'bg-blue-500 text-white'
                          : 'bg-white border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {page}
                    </button>
                  )
                })}
                
                <button
                  onClick={() => setPracticePage(Math.min(totalPracticePages, practicePage + 1))}
                  disabled={practicePage === totalPracticePages}
                  className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next →
                </button>
          </div>
            )}

            {/* Empty State */}
            {filteredPracticeThreads.length === 0 && (
              <div className="text-center py-8">
                <div className="text-4xl mb-2">🎯</div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">No Practice Sessions Found</h3>
                <p className="text-gray-600 mb-4">
                  {practiceSearchTerm || practiceFilterBy !== 'all' 
                    ? 'Try adjusting your search or filter criteria'
                    : 'Start your practice journey by recording your first session'
                  }
                </p>
                <button
                  onClick={() => setShowUploadForm(true)}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
                >
                  + Add Practice Session
                </button>
        </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default VideoDetail