import React, { useState, useEffect } from 'react'
import VideoList from './components/VideoList'
import VideoUpload from './components/VideoUpload'
import VideoDetail from './components/VideoDetail'

function App() {
  const [videos, setVideos] = useState([])
  const [currentView, setCurrentView] = useState('list')
  const [selectedVideo, setSelectedVideo] = useState(null)

  useEffect(() => {
    fetchVideos()
  }, [])

  const fetchVideos = async () => {
    try {
      const response = await fetch('/api/videos/')
      const data = await response.json()
      setVideos(data)
    } catch (error) {
      console.error('Error fetching videos:', error)
    }
  }

  const handleVideoSelect = (video) => {
    setSelectedVideo(video)
    setCurrentView('detail')
  }

  const handleBackToList = () => {
    setCurrentView('list')
    setSelectedVideo(null)
    fetchVideos()
  }

  const handleVideoUpdate = (updatedVideo) => {
    setVideos(prevVideos =>
      prevVideos.map(video =>
        video.id === updatedVideo.id ? updatedVideo : video
      )
    )
    setSelectedVideo(updatedVideo)
  }

  const handleVideoDelete = async (videoId) => {
    try {
      const response = await fetch(`/api/videos/${videoId}/delete_exercise/`, {
        method: 'DELETE'
      })
      if (response.ok) {
        setVideos(prevVideos => prevVideos.filter(video => video.id !== videoId))
        if (selectedVideo && selectedVideo.id === videoId) {
          setCurrentView('list')
          setSelectedVideo(null)
        }
      }
    } catch (error) {
      console.error('Error deleting video:', error)
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-100 px-4 py-3 sm:px-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <button
            onClick={handleBackToList}
            className="text-lg font-semibold text-gray-900 tracking-tight"
          >
            Practica
          </button>
          {currentView === 'list' && (
            <button
              onClick={() => setCurrentView('upload')}
              className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              + New exercise
            </button>
          )}
          {currentView !== 'list' && (
            <button
              onClick={handleBackToList}
              className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
            >
              Back
            </button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto">
        {currentView === 'list' && (
          <VideoList
            videos={videos}
            onVideoSelect={handleVideoSelect}
            onUploadClick={() => setCurrentView('upload')}
            onVideoDelete={handleVideoDelete}
          />
        )}

        {currentView === 'upload' && (
          <VideoUpload
            onUploadComplete={() => {
              fetchVideos()
              setCurrentView('list')
            }}
            onCancel={() => setCurrentView('list')}
          />
        )}

        {currentView === 'detail' && selectedVideo && (
          <VideoDetail
            video={selectedVideo}
            onBack={handleBackToList}
            onVideoUpdate={handleVideoUpdate}
            onVideoDelete={handleVideoDelete}
          />
        )}
      </main>
    </div>
  )
}

export default App
