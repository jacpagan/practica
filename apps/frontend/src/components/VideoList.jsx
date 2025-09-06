import React, { useState, useEffect, useMemo } from 'react'

function VideoList({ videos, onVideoSelect, onUploadClick, onVideoDelete, comparisonQueue = [], onComparisonQueueUpdate }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedTags, setSelectedTags] = useState([])
  const [sortBy, setSortBy] = useState('recent') // recent, popular, alphabetical, practice_count
  const [viewMode, setViewMode] = useState('grid') // grid, list, discovery
  const [discoveryMode, setDiscoveryMode] = useState(false)
  const [learningInsights, setLearningInsights] = useState([])
  const [currentPage, setCurrentPage] = useState(1)
  const videosPerPage = 12

  // Extract all unique tags from videos
  const allTags = useMemo(() => {
    const tagSet = new Set()
    videos.forEach(video => {
      if (video.tags) {
        video.tags.split(',').forEach(tag => {
          tagSet.add(tag.trim())
        })
      }
    })
    return Array.from(tagSet).sort()
  }, [videos])

  // Calculate learning insights
  useEffect(() => {
    const insights = []
    
    // Most practiced exercises
    const mostPracticed = videos
      .map(video => ({
        ...video,
        practiceCount: video.practice_threads?.length || 0
      }))
      .sort((a, b) => b.practiceCount - a.practiceCount)
      .slice(0, 5)
    
    if (mostPracticed.length > 0) {
      insights.push({
        type: 'most_practiced',
        title: '🔥 Your Most Practiced Exercises',
        description: 'Exercises you\'ve been working on most',
        videos: mostPracticed,
        color: 'from-red-50 to-orange-50',
        icon: '🔥'
      })
    }

    // Recent discoveries
    const recentVideos = videos
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 5)
    
    if (recentVideos.length > 0) {
      insights.push({
        type: 'recent',
        title: '✨ Recent Discoveries',
        description: 'Your newest exercise videos',
        videos: recentVideos,
        color: 'from-blue-50 to-purple-50',
        icon: '✨'
      })
    }

    // Underpracticed exercises
    const underpracticed = videos
      .filter(video => (video.practice_threads?.length || 0) < 3)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      .slice(0, 5)
    
    if (underpracticed.length > 0) {
      insights.push({
        type: 'underpracticed',
        title: '🌱 Underpracticed Exercises',
        description: 'Exercises that need more attention',
        videos: underpracticed,
        color: 'from-green-50 to-emerald-50',
        icon: '🌱'
      })
    }

    // Tag clusters
    const tagClusters = allTags.slice(0, 3).map(tag => {
      const tagVideos = videos.filter(video => 
        video.tags && video.tags.includes(tag)
      ).slice(0, 4)
      
      return {
        type: 'tag_cluster',
        title: `🏷️ ${tag} Collection`,
        description: `Exercises tagged with ${tag}`,
        videos: tagVideos,
        color: 'from-purple-50 to-pink-50',
        icon: '🏷️',
        tag: tag
      }
    })

    insights.push(...tagClusters)
    setLearningInsights(insights)
  }, [videos, allTags])

  // Filter and sort videos
  const filteredVideos = useMemo(() => {
    let filtered = videos.filter(video => {
      const matchesSearch = video.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           video.description.toLowerCase().includes(searchTerm.toLowerCase())
      
      const matchesTags = selectedTags.length === 0 || 
        selectedTags.some(tag => video.tags && video.tags.includes(tag))
      
      return matchesSearch && matchesTags
    })

    // Sort videos
    switch (sortBy) {
      case 'recent':
        filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        break
      case 'popular':
        filtered.sort((a, b) => (b.practice_threads?.length || 0) - (a.practice_threads?.length || 0))
        break
      case 'alphabetical':
        filtered.sort((a, b) => a.title.localeCompare(b.title))
        break
      case 'practice_count':
        filtered.sort((a, b) => (b.practice_threads?.length || 0) - (a.practice_threads?.length || 0))
        break
    }

    return filtered
  }, [videos, searchTerm, selectedTags, sortBy])

  // Pagination
  const paginatedVideos = useMemo(() => {
    const startIndex = (currentPage - 1) * videosPerPage
    return filteredVideos.slice(startIndex, startIndex + videosPerPage)
  }, [filteredVideos, currentPage])

  const totalPages = Math.ceil(filteredVideos.length / videosPerPage)

  // Add to comparison queue
  const addToComparison = (video) => {
    if (comparisonQueue.length < 4 && !comparisonQueue.find(v => v.id === video.id)) {
      onComparisonQueueUpdate([...comparisonQueue, video])
    }
  }

  // Remove from comparison queue
  const removeFromComparison = (videoId) => {
    onComparisonQueueUpdate(comparisonQueue.filter(v => v.id !== videoId))
  }

  // Start comparison
  const startComparison = () => {
    if (comparisonQueue.length >= 2) {
      // For now, just select the first video and let the detail view handle comparison
      onVideoSelect(comparisonQueue[0])
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
      {/* Header with Feng Shui Elements */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center space-x-4">
              <div className="text-4xl">🧘</div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Practice Sanctuary
                </h1>
                <p className="text-gray-600">Discover • Compare • Learn • Grow</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button 
                onClick={onUploadClick}
                className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-4 py-2 rounded-full hover:from-blue-600 hover:to-cyan-600 transition-all duration-300 shadow-lg hover:shadow-xl"
              >
                ✨ Add Exercise
              </button>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
            <div className="lg:col-span-2">
              <div className="relative">
                <input
                  type="text"
                  placeholder="🔍 Search exercises, descriptions, or tags..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white/70 backdrop-blur-sm"
                />
                <div className="absolute left-3 top-3.5 text-gray-400">🔍</div>
              </div>
            </div>
            
            <div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white/70 backdrop-blur-sm"
              >
                <option value="recent">📅 Most Recent</option>
                <option value="popular">🔥 Most Popular</option>
                <option value="alphabetical">🔤 A-Z</option>
                <option value="practice_count">📈 Practice Count</option>
              </select>
            </div>
            
            <div>
              <select
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white/70 backdrop-blur-sm"
              >
                <option value="grid">⊞ Grid View</option>
                <option value="list">☰ List View</option>
                <option value="discovery">🔮 Discovery Mode</option>
              </select>
            </div>
          </div>

          {/* Tag Filters */}
          {allTags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-6">
              <span className="text-sm text-gray-600 mr-2">Filter by tags:</span>
              {allTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => {
                    if (selectedTags.includes(tag)) {
                      setSelectedTags(selectedTags.filter(t => t !== tag))
                    } else {
                      setSelectedTags([...selectedTags, tag])
                    }
                  }}
                  className={`px-3 py-1 rounded-full text-sm transition-all duration-200 ${
                    selectedTags.includes(tag)
                      ? 'bg-blue-500 text-white shadow-md'
                      : 'bg-white/70 text-gray-700 hover:bg-blue-100'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}

          {/* Comparison Queue */}
          {comparisonQueue.length > 0 && (
            <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-xl p-4 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="text-lg">📊</span>
                  <div>
                    <h3 className="font-semibold text-gray-800">Practice Thread Queue ({comparisonQueue.length}/4)</h3>
                    <p className="text-sm text-gray-600">Select practice sessions to compare within this exercise</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="flex space-x-2">
                    {comparisonQueue.map(thread => (
                      <div key={thread.id} className="flex items-center space-x-2 bg-white rounded-lg px-3 py-2 shadow-sm">
                        <span className="text-sm font-medium">{thread.title}</span>
                        <button
                          onClick={() => removeFromComparison(thread.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={startComparison}
                    disabled={comparisonQueue.length < 2}
                    className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Compare ({comparisonQueue.length})
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {viewMode === 'discovery' ? (
          /* Discovery Mode - Learning Insights */
          <div className="space-y-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-2">🔮 Discovery Mode</h2>
              <p className="text-gray-600">Let the system surprise you with learning insights</p>
            </div>
            
            {learningInsights.map((insight, index) => (
              <div key={index} className={`bg-gradient-to-r ${insight.color} border border-gray-200 rounded-2xl p-6 shadow-lg`}>
                <div className="flex items-center space-x-3 mb-4">
                  <span className="text-2xl">{insight.icon}</span>
                  <div>
                    <h3 className="text-xl font-bold text-gray-800">{insight.title}</h3>
                    <p className="text-gray-600">{insight.description}</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                  {insight.videos.map(video => (
                    <div
                      key={video.id}
                      className="bg-white/80 backdrop-blur-sm rounded-xl p-4 shadow-md hover:shadow-lg transition-all duration-300 cursor-pointer group"
                      onClick={() => onVideoSelect(video)}
                    >
                      <div className="aspect-video bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg mb-3 flex items-center justify-center">
                        <span className="text-2xl">🎥</span>
                      </div>
                      <h4 className="font-semibold text-gray-800 group-hover:text-blue-600 transition-colors line-clamp-2">
                        {video.title}
                      </h4>
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                        {video.description}
                      </p>
                      <div className="flex items-center justify-between mt-3">
                        <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
                          {video.practice_threads?.length || 0} practices
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Grid/List View */
          <div className="space-y-6">
            {/* Results Summary */}
            <div className="flex justify-between items-center">
              <p className="text-gray-600">
                Showing {paginatedVideos.length} of {filteredVideos.length} exercises
                {searchTerm && ` matching "${searchTerm}"`}
                {selectedTags.length > 0 && ` tagged with ${selectedTags.join(', ')}`}
              </p>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-500">View:</span>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded ${viewMode === 'grid' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'}`}
                >
                  ⊞
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded ${viewMode === 'list' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'}`}
                >
                  ☰
                </button>
              </div>
            </div>

            {/* Video Grid/List */}
            <div className={viewMode === 'grid' 
              ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
              : 'space-y-4'
            }>
              {paginatedVideos.map(video => (
                <div
                  key={video.id}
                  className={`bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 group ${
                    viewMode === 'list' ? 'flex items-center space-x-4 p-4' : 'p-6'
                  }`}
                >
                  {viewMode === 'grid' ? (
                    <>
                      <div className="aspect-video bg-gradient-to-br from-blue-100 to-purple-100 rounded-xl mb-4 flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
                        <span className="text-4xl">🎥</span>
                      </div>
                      <div className="space-y-3">
                        <h3 className="font-bold text-lg text-gray-800 group-hover:text-blue-600 transition-colors line-clamp-2">
                          {video.title}
                        </h3>
                        <p className="text-gray-600 text-sm line-clamp-3">
                          {video.description}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
                            {video.practice_threads?.length || 0} practices
                          </span>
                          <div className="text-xs text-gray-500 text-right">
                            <div>{new Date(video.created_at).toLocaleDateString()}</div>
                            <div className="font-medium text-blue-600">🕐 {video.time_of_day}</div>
                          </div>
                        </div>
                        {video.tags && (
                          <div className="flex flex-wrap gap-1">
                            {video.tags.split(',').slice(0, 3).map(tag => (
                              <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                                {tag.trim()}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="flex space-x-2 pt-2">
                          <button
                            onClick={() => onVideoSelect(video)}
                            className="flex-1 bg-blue-500 text-white px-3 py-2 rounded-lg hover:bg-blue-600 transition-colors text-sm"
                          >
                            🎯 Practice
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-24 h-16 bg-gradient-to-br from-blue-100 to-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <span className="text-xl">🎥</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-lg text-gray-800 group-hover:text-blue-600 transition-colors">
                          {video.title}
                        </h3>
                        <p className="text-gray-600 text-sm line-clamp-2">
                          {video.description}
                        </p>
                        <div className="flex items-center space-x-4 mt-2">
                          <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
                            {video.practice_threads?.length || 0} practices
                          </span>
                          <div className="text-xs text-gray-500">
                            <div>{new Date(video.created_at).toLocaleDateString()}</div>
                            <div className="font-medium text-blue-600">🕐 {video.time_of_day}</div>
                          </div>
                          {video.tags && (
                            <span className="text-xs text-gray-500">
                              {video.tags.split(',').slice(0, 2).join(', ')}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => onVideoSelect(video)}
                          className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors text-sm"
                        >
                          🎯 Practice
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center space-x-2 mt-8">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ← Previous
                </button>
                
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const page = i + 1
                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`px-4 py-2 rounded-lg ${
                        currentPage === page
                          ? 'bg-blue-500 text-white'
                          : 'bg-white border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {page}
                    </button>
                  )
                })}
                
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Empty State */}
      {videos.length === 0 && (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">🧘</div>
          <h3 className="text-2xl font-bold text-gray-800 mb-2">Your Practice Journey Begins</h3>
          <p className="text-gray-600 mb-8">Upload your first exercise video to start your comparative learning adventure</p>
          <button 
            onClick={onUploadClick}
            className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-8 py-4 rounded-full hover:from-blue-600 hover:to-purple-600 transition-all duration-300 shadow-lg hover:shadow-xl text-lg"
          >
            ✨ Upload Your First Exercise
          </button>
        </div>
      )}
    </div>
  )
}

export default VideoList