import React, { useState, useMemo } from 'react'

function VideoThumbnail({ video, className = "" }) {
  const [error, setError] = useState(false)

  const videoUrl = video.video_file?.startsWith('/media/')
    ? `http://localhost:8000${video.video_file}`
    : video.video_file

  return (
    <div className={`bg-gray-100 rounded-lg overflow-hidden ${className}`}>
      {videoUrl && !error ? (
        <video
          src={videoUrl}
          className="w-full h-full object-cover"
          muted
          preload="metadata"
          onError={() => setError(true)}
          onLoadedMetadata={(e) => { e.target.currentTime = 1 }}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-gray-300">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </div>
      )}
    </div>
  )
}

function VideoList({ videos, onVideoSelect, onUploadClick, onVideoDelete }) {
  const [searchTerm, setSearchTerm] = useState('')

  const filteredVideos = useMemo(() => {
    if (!searchTerm) return videos
    const term = searchTerm.toLowerCase()
    return videos.filter(v =>
      v.title.toLowerCase().includes(term) ||
      v.description.toLowerCase().includes(term) ||
      (v.tags && v.tags.toLowerCase().includes(term))
    )
  }, [videos, searchTerm])

  if (videos.length === 0) {
    return (
      <div className="px-4 py-20 text-center">
        <p className="text-gray-400 text-sm mb-6">No exercises yet</p>
        <button
          onClick={onUploadClick}
          className="text-sm font-medium text-gray-900 border border-gray-200 rounded-lg px-5 py-2.5 hover:border-gray-400 transition-colors"
        >
          Add your first exercise
        </button>
      </div>
    )
  }

  return (
    <div className="px-4 sm:px-6 py-4">
      {/* Search */}
      {videos.length > 3 && (
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search exercises..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 bg-white placeholder-gray-400"
          />
        </div>
      )}

      {/* Exercise list */}
      <div className="space-y-3">
        {filteredVideos.map(video => (
          <div
            key={video.id}
            className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer group"
            onClick={() => onVideoSelect(video)}
          >
            <VideoThumbnail
              video={video}
              className="w-20 h-14 flex-shrink-0 sm:w-28 sm:h-20"
            />
            <div className="flex-1 min-w-0 py-0.5">
              <h3 className="text-sm font-medium text-gray-900 truncate">
                {video.title}
              </h3>
              {video.description && (
                <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                  {video.description}
                </p>
              )}
              <div className="flex items-center gap-3 mt-1.5">
                <span className="text-xs text-gray-400">
                  {video.practice_threads?.length || 0} practices
                </span>
                <span className="text-xs text-gray-300">
                  {new Date(video.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation()
                if (confirm(`Delete "${video.title}"?`)) {
                  onVideoDelete(video.id)
                }
              }}
              className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-300 hover:text-red-400 transition-all flex-shrink-0"
              title="Delete"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      {filteredVideos.length === 0 && searchTerm && (
        <p className="text-center text-sm text-gray-400 py-8">
          No exercises matching "{searchTerm}"
        </p>
      )}
    </div>
  )
}

export default VideoList
