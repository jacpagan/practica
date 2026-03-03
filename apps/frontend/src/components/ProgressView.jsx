import React, { useCallback, useEffect, useState } from 'react'
import SegmentPlayer from './SegmentPlayer'
import { authHeaders } from '../auth'
import { fmtTime, fmtDateLong, videoUrl, fmtDuration, parseTimeInput } from '../utils'

function ProgressView({ exercise, token, onBack }) {
  const [data, setData] = useState(null)
  const [compareLeft, setCompareLeft] = useState(null)
  const [compareRight, setCompareRight] = useState(null)
  const [selectedClipId, setSelectedClipId] = useState(null)
  const [clipFormOpen, setClipFormOpen] = useState(false)
  const [editingClipId, setEditingClipId] = useState(null)
  const [clipTitle, setClipTitle] = useState('')
  const [clipUrl, setClipUrl] = useState('')
  const [clipStart, setClipStart] = useState('0:00')
  const [clipEnd, setClipEnd] = useState('')
  const [clipNotes, setClipNotes] = useState('')
  const [clipBusy, setClipBusy] = useState(false)
  const [clipError, setClipError] = useState('')
  const [error, setError] = useState(null)

  const loadProgress = useCallback(async () => {
    try {
      const res = await fetch(`/api/exercises/${exercise.id}/progress/`, { headers: authHeaders(token) })
      if (!res.ok) throw new Error(`${res.status}`)
      const payload = await res.json()
      setData(payload)
      const clips = payload.reference_clips || []
      setSelectedClipId((prev) => {
        if (prev && clips.some((clip) => clip.id === prev)) return prev
        return clips[0]?.id || null
      })
    } catch (e) {
      setError(e.message)
    }
  }, [exercise.id, token])

  useEffect(() => {
    setData(null)
    setError(null)
    setClipFormOpen(false)
    setEditingClipId(null)
    setClipError('')
    loadProgress()
  }, [loadProgress])

  const resetClipForm = () => {
    setClipTitle('')
    setClipUrl('')
    setClipStart('0:00')
    setClipEnd('')
    setClipNotes('')
    setEditingClipId(null)
    setClipError('')
  }

  const openAddClip = () => {
    resetClipForm()
    setClipFormOpen(true)
  }

  const openEditClip = (clip) => {
    setClipTitle(clip.title || '')
    setClipUrl(clip.youtube_url || '')
    setClipStart(fmtTime(clip.start_seconds || 0))
    setClipEnd(clip.end_seconds == null ? '' : fmtTime(clip.end_seconds))
    setClipNotes(clip.notes || '')
    setEditingClipId(clip.id)
    setClipFormOpen(true)
    setClipError('')
  }

  const submitClip = async () => {
    const title = clipTitle.trim()
    const youtubeUrl = clipUrl.trim()
    if (!title) return setClipError('Title is required.')
    if (!youtubeUrl) return setClipError('YouTube URL is required.')

    const startSeconds = parseTimeInput(clipStart)
    if (startSeconds === null) return setClipError('Start time must be mm:ss or seconds.')

    let endSeconds = null
    if (clipEnd.trim()) {
      endSeconds = parseTimeInput(clipEnd)
      if (endSeconds === null) return setClipError('End time must be mm:ss or seconds.')
      if (endSeconds <= startSeconds) return setClipError('End time must be greater than start time.')
    }

    setClipBusy(true)
    setClipError('')
    try {
      const isEdit = Boolean(editingClipId)
      const endpoint = isEdit
        ? `/api/exercises/${exercise.id}/reference-clips/${editingClipId}/`
        : `/api/exercises/${exercise.id}/reference-clips/`
      const method = isEdit ? 'PATCH' : 'POST'
      const res = await fetch(endpoint, {
        method,
        headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          youtube_url: youtubeUrl,
          start_seconds: startSeconds,
          end_seconds: endSeconds,
          notes: clipNotes.trim(),
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        const message = body?.youtube_url?.[0] || body?.end_seconds?.[0] || body?.start_seconds?.[0] || body?.error || 'Could not save clip'
        throw new Error(message)
      }
      const saved = await res.json()
      setSelectedClipId(saved.id)
      setClipFormOpen(false)
      resetClipForm()
      await loadProgress()
    } catch (e) {
      setClipError(e.message || 'Could not save clip')
    } finally {
      setClipBusy(false)
    }
  }

  const deleteClip = async (clip) => {
    if (!window.confirm(`Delete "${clip.title}"?`)) return
    setClipBusy(true)
    setClipError('')
    try {
      const res = await fetch(`/api/exercises/${exercise.id}/reference-clips/${clip.id}/`, {
        method: 'DELETE',
        headers: authHeaders(token),
      })
      if (!res.ok) throw new Error('Could not delete clip')
      if (selectedClipId === clip.id) setSelectedClipId(null)
      await loadProgress()
    } catch (e) {
      setClipError(e.message || 'Could not delete clip')
    } finally {
      setClipBusy(false)
    }
  }

  if (error) return (
    <div className="px-4 py-12 text-center">
      <p className="text-sm text-gray-400 mb-3">Could not load progress</p>
      <button onClick={onBack} className="text-sm text-gray-500 underline">Go back</button>
    </div>
  )

  if (!data) return <div className="px-4 py-8 text-center text-sm text-gray-400">Loading...</div>

  const chapters = data.chapters || []
  const referenceClips = data.reference_clips || []
  const selectedClip = referenceClips.find((clip) => clip.id === selectedClipId) || null

  const handleChapterClick = (chapter) => {
    if (!compareLeft) {
      setCompareLeft(chapter)
    } else if (compareLeft.id === chapter.id) {
      setCompareLeft(null)
    } else if (!compareRight) {
      setCompareRight(chapter)
    } else if (compareRight.id === chapter.id) {
      setCompareRight(null)
    } else {
      setCompareLeft(compareRight)
      setCompareRight(chapter)
    }
  }

  const isComparing = compareLeft && compareRight

  return (
    <div className="px-4 sm:px-6 py-4">
      <div className="mb-5">
        <h1 className="text-lg font-semibold text-gray-900">{data.exercise.name}</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {chapters.length} {chapters.length === 1 ? 'entry' : 'entries'} across sessions
        </p>
      </div>

      <section className="mb-6 border border-gray-100 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-gray-900">Reference clips</h2>
          {!clipFormOpen && (
            <button
              onClick={openAddClip}
              className="text-xs text-gray-600 border border-gray-200 rounded-md px-2.5 py-1.5 hover:bg-gray-50"
            >
              + Add clip
            </button>
          )}
        </div>

        {selectedClip ? (
          <div className="mb-4">
            <div className="aspect-video bg-black rounded-lg overflow-hidden">
              <iframe
                src={selectedClip.embed_url}
                title={selectedClip.title}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-gray-900">{selectedClip.title}</p>
                <p className="text-xs text-gray-500">
                  {selectedClip.end_seconds != null
                    ? `${fmtTime(selectedClip.start_seconds)} - ${fmtTime(selectedClip.end_seconds)}`
                    : `${fmtTime(selectedClip.start_seconds)} - end`}
                </p>
                {selectedClip.notes && <p className="text-xs text-gray-500 mt-1">{selectedClip.notes}</p>}
              </div>
              <a
                href={selectedClip.watch_url_with_start}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-gray-600 underline"
              >
                Open on YouTube
              </a>
            </div>
          </div>
        ) : (
          <p className="text-xs text-gray-500 mb-4">No reference clip selected yet.</p>
        )}

        {referenceClips.length > 0 && (
          <div className="space-y-1 mb-3">
            {referenceClips.map((clip) => {
              const active = selectedClipId === clip.id
              return (
                <div
                  key={clip.id}
                  onClick={() => setSelectedClipId(clip.id)}
                  className={`rounded-lg px-3 py-2 border cursor-pointer transition-colors ${
                    active ? 'border-gray-300 bg-gray-50' : 'border-gray-100 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm text-gray-900 truncate">{clip.title}</p>
                      <p className="text-xs text-gray-500">
                        {clip.end_seconds != null
                          ? `${fmtTime(clip.start_seconds)} - ${fmtTime(clip.end_seconds)}`
                          : `${fmtTime(clip.start_seconds)} - end`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); openEditClip(clip) }}
                        className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1"
                      >
                        Edit
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteClip(clip) }}
                        className="text-xs text-gray-400 hover:text-red-500 px-2 py-1"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {clipFormOpen && (
          <div className="border border-gray-100 rounded-lg p-3 space-y-2">
            <p className="text-xs font-medium text-gray-700">
              {editingClipId ? 'Edit reference clip' : 'New reference clip'}
            </p>
            <input
              type="text"
              value={clipTitle}
              onChange={(e) => setClipTitle(e.target.value)}
              placeholder="Title (e.g. Circle Hands - Main phrase)"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
            />
            <input
              type="url"
              value={clipUrl}
              onChange={(e) => setClipUrl(e.target.value)}
              placeholder="YouTube URL"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={clipStart}
                onChange={(e) => setClipStart(e.target.value)}
                placeholder="Start (mm:ss)"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
              />
              <input
                type="text"
                value={clipEnd}
                onChange={(e) => setClipEnd(e.target.value)}
                placeholder="End (optional)"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
              />
            </div>
            <input
              type="text"
              value={clipNotes}
              onChange={(e) => setClipNotes(e.target.value)}
              placeholder="Notes (optional)"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
            />
            {clipError && <p className="text-xs text-red-600">{clipError}</p>}
            <div className="flex items-center gap-2">
              <button
                onClick={submitClip}
                disabled={clipBusy}
                className="text-xs font-medium text-white bg-gray-900 px-3 py-1.5 rounded-md disabled:opacity-50"
              >
                {clipBusy ? 'Saving...' : 'Save clip'}
              </button>
              <button
                onClick={() => { setClipFormOpen(false); resetClipForm() }}
                className="text-xs text-gray-500 px-2 py-1.5"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>

      {isComparing && (
        <div className="mb-6 border border-gray-100 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-900">Comparing</h3>
            <button onClick={() => { setCompareLeft(null); setCompareRight(null) }}
              className="text-xs text-gray-400 hover:text-gray-600">Clear</button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[compareLeft, compareRight].map((ch, i) => (
              <div key={i}>
                <div className="aspect-video bg-black rounded-lg overflow-hidden">
                  <SegmentPlayer
                    src={videoUrl(ch.session_video)}
                    start={ch.timestamp_seconds}
                    end={ch.end_seconds}
                    className="w-full h-full"
                  />
                </div>
                <div className="mt-1.5">
                  <p className="text-xs font-medium text-gray-700">{ch.session_title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-400">{fmtDateLong(ch.session_date)}</span>
                    <span className="text-xs text-gray-300 font-mono">
                      {fmtTime(ch.timestamp_seconds)}
                      {ch.end_seconds && ` – ${fmtTime(ch.end_seconds)}`}
                    </span>
                  </div>
                  {ch.notes && <p className="text-xs text-gray-500 mt-1 italic">"{ch.notes}"</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {chapters.length >= 2 && !isComparing && (
        <p className="text-xs text-gray-400 mb-3">
          {compareLeft
            ? `Selected "${compareLeft.session_title}" — tap another to compare`
            : 'Tap any two entries to compare side by side'}
        </p>
      )}

      <div className="space-y-2">
        {chapters.map((chapter) => {
          const isSelected = compareLeft?.id === chapter.id || compareRight?.id === chapter.id
          return (
            <div
              key={chapter.id}
              onClick={() => handleChapterClick(chapter)}
              className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all group ${
                isSelected ? 'bg-gray-100 ring-1 ring-gray-300' : 'hover:bg-gray-50'
              }`}
            >
              <div className="w-20 h-14 sm:w-24 sm:h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 relative">
                <video
                  src={`${videoUrl(chapter.session_video)}#t=${chapter.timestamp_seconds}`}
                  className="w-full h-full object-cover"
                  muted preload="metadata"
                />
                {chapter.end_seconds && (
                  <div className="absolute bottom-0.5 right-0.5 bg-black/60 text-white text-[9px] font-mono px-1 py-0.5 rounded">
                    {fmtDuration(chapter.timestamp_seconds, chapter.end_seconds)}
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0 py-0.5">
                <h4 className="text-sm font-medium text-gray-900 truncate">{chapter.session_title}</h4>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-gray-400">{fmtDateLong(chapter.session_date)}</span>
                  <span className="text-xs text-gray-300 font-mono">
                    {fmtTime(chapter.timestamp_seconds)}
                    {chapter.end_seconds && ` – ${fmtTime(chapter.end_seconds)}`}
                  </span>
                </div>
                {chapter.notes && (
                  <p className="text-xs text-gray-500 mt-1 line-clamp-1 italic">"{chapter.notes}"</p>
                )}
              </div>

              {isSelected && <span className="w-2 h-2 bg-gray-900 rounded-full flex-shrink-0 mt-2" />}
            </div>
          )
        })}
      </div>

      {chapters.length === 0 && (
        <div className="text-center py-12">
          <p className="text-sm text-gray-400">No entries yet for this exercise</p>
        </div>
      )}
    </div>
  )
}

export default ProgressView
