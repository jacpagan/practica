import React, { useState, useEffect } from 'react'
import VideoList from './components/VideoList'
import VideoUpload from './components/VideoUpload'
import VideoDetail from './components/VideoDetail'

function App() {
  const [videos, setVideos] = useState([])
  const [currentView, setCurrentView] = useState('list')
  const [selectedVideo, setSelectedVideo] = useState(null)
  const [comparisonQueue, setComparisonQueue] = useState([])

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
      const response = await fetch(`/api/videos/${videoId}/`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setVideos(prevVideos => prevVideos.filter(video => video.id !== videoId))
        if (selectedVideo && selectedVideo.id === videoId) {
          setCurrentView('list')
          setSelectedVideo(null)
        }
      } else {
        alert('Failed to delete video. Please try again.')
      }
    } catch (error) {
      console.error('Error deleting video:', error)
      alert('Error deleting video. Please check your connection.')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-blue-600 text-white p-4">
        <h1 className="text-2xl font-bold">Practica - Your Personal Practice Tracking</h1>
        <p className="text-blue-100">Upload exercise videos, record practice sessions, track your progress</p>
      </header>
      
      <main className="container mx-auto p-4">
        {currentView === 'list' && (
          <VideoList 
            videos={videos} 
            onVideoSelect={handleVideoSelect}
            onUploadClick={() => setCurrentView('upload')}
            onVideoDelete={handleVideoDelete}
            comparisonQueue={comparisonQueue}
            onComparisonQueueUpdate={setComparisonQueue}
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
            comparisonQueue={comparisonQueue}
            onComparisonQueueUpdate={setComparisonQueue}
          />
        )}
      </main>
    </div>
  )
}

export default App