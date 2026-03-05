import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { authHeaders } from '../auth'
import {
  fmtTime,
  preferredSessionVideoUrl,
  sessionThumbVttUrl,
} from '../utils'

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

const parseVttTime = (raw) => {
  const parts = String(raw || '').trim().split(':')
  if (!parts.length) return 0
  const [h, m, s] = parts.length === 3 ? parts : [0, parts[0], parts[1] || 0]
  return (Number(h) * 3600) + (Number(m) * 60) + Number(String(s).replace(',', '.'))
}

const parseThumbVtt = (text, vttUrl) => {
  const lines = String(text || '').split(/\r?\n/)
  const cues = []
  for (let i = 0; i < lines.length; i += 1) {
    const row = lines[i].trim()
    if (!row.includes('-->')) continue
    const [startRaw, endRaw] = row.split('-->').map((part) => part.trim())
    const payload = String(lines[i + 1] || '').trim()
    if (!payload) continue
    const [rawPath, fragment] = payload.split('#')
    let imageUrl = ''
    try {
      imageUrl = new URL(rawPath, vttUrl).toString()
    } catch {
      imageUrl = rawPath
    }
    let x = 0
    let y = 0
    let w = 160
    let h = 90
    if (fragment && fragment.startsWith('xywh=')) {
      const [px, py, pw, ph] = fragment.replace('xywh=', '').split(',').map((n) => Number(n || 0))
      x = px || 0
      y = py || 0
      w = pw || w
      h = ph || h
    }
    cues.push({
      start: parseVttTime(startRaw),
      end: parseVttTime(endRaw),
      imageUrl,
      x,
      y,
      w,
      h,
    })
  }
  return cues
}

function SpaceCompareView({ token, spaceId, initialSessionId = null, onBack }) {
  const [space, setSpace] = useState(null)
  const [sessions, setSessions] = useState([])
  const [selectedSessionId, setSelectedSessionId] = useState(initialSessionId)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [offsetSeconds, setOffsetSeconds] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [timelineTime, setTimelineTime] = useState(0)
  const [timelineDuration, setTimelineDuration] = useState(0)
  const [audioFocus, setAudioFocus] = useState('main')
  const [thumbCues, setThumbCues] = useState([])
  const [preview, setPreview] = useState(null)

  const mainVideoRef = useRef(null)
  const selectedVideoRef = useRef(null)
  const dragRef = useRef(false)

  const mainSession = useMemo(
    () => sessions.find((session) => session.id === space?.main_session_id) || null,
    [sessions, space?.main_session_id]
  )

  const selectableSessions = useMemo(
    () => sessions.filter((session) => session.id !== space?.main_session_id),
    [sessions, space?.main_session_id]
  )

  const selectedSession = useMemo(
    () => selectableSessions.find((session) => session.id === selectedSessionId) || selectableSessions[0] || null,
    [selectableSessions, selectedSessionId]
  )

  const syncAt = useCallback((baseTime) => {
    const main = mainVideoRef.current
    const right = selectedVideoRef.current
    if (!main || !right) return

    const nextMain = clamp(baseTime, 0, Number.isFinite(main.duration) ? main.duration : baseTime)
    const nextSelected = clamp(nextMain + offsetSeconds, 0, Number.isFinite(right.duration) ? right.duration : nextMain + offsetSeconds)

    if (Math.abs(main.currentTime - nextMain) > 0.04) main.currentTime = nextMain
    if (Math.abs(right.currentTime - nextSelected) > 0.04) right.currentTime = nextSelected
    setTimelineTime(nextMain)
  }, [offsetSeconds])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const [spaceRes, sessionsRes] = await Promise.all([
          fetch(`/api/spaces/${spaceId}/`, { headers: authHeaders(token) }),
          fetch(`/api/sessions/?space=${spaceId}`, { headers: authHeaders(token) }),
        ])
        if (!spaceRes.ok || !sessionsRes.ok) throw new Error('Could not load compare data')
        const [spaceData, sessionsPayload] = await Promise.all([spaceRes.json(), sessionsRes.json()])
        const nextSessions = Array.isArray(sessionsPayload?.results) ? sessionsPayload.results : (sessionsPayload || [])
        setSpace(spaceData)
        setSessions(nextSessions)
        const fallback = nextSessions.find((session) => session.id !== spaceData.main_session_id)?.id || null
        setSelectedSessionId((prev) => prev || initialSessionId || fallback)
      } catch (e) {
        setError(e.message || 'Could not load compare data')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [spaceId, token, initialSessionId])

  useEffect(() => {
    const loadThumbs = async () => {
      setThumbCues([])
      if (!mainSession) return
      const vttUrl = sessionThumbVttUrl(mainSession)
      if (!vttUrl) return
      try {
        const res = await fetch(vttUrl)
        if (!res.ok) return
        const text = await res.text()
        setThumbCues(parseThumbVtt(text, vttUrl))
      } catch {
        // Preview is optional.
      }
    }
    loadThumbs()
  }, [mainSession])

  useEffect(() => {
    const main = mainVideoRef.current
    const right = selectedVideoRef.current
    if (!main || !right) return
    main.muted = audioFocus !== 'main'
    right.muted = audioFocus !== 'selected'
  }, [audioFocus, selectedSession?.id, mainSession?.id])

  useEffect(() => {
    if (!mainSession || !selectedSession) return
    syncAt(0)
    setTimelineTime(0)
    setIsPlaying(false)
  }, [mainSession?.id, selectedSession?.id, offsetSeconds, syncAt])

  useEffect(() => {
    if (!isPlaying) return
    const main = mainVideoRef.current
    const right = selectedVideoRef.current
    if (!main || !right) return

    let rafId = null
    let rvfcId = null

    const tick = () => {
      const base = main.currentTime
      setTimelineTime(base)
      const desired = base + offsetSeconds
      const drift = right.currentTime - desired
      if (Math.abs(drift) > 0.10) {
        right.currentTime = clamp(desired, 0, Number.isFinite(right.duration) ? right.duration : desired)
      }
    }

    const onFrame = () => {
      tick()
      rvfcId = main.requestVideoFrameCallback(onFrame)
    }
    const onRaf = () => {
      tick()
      rafId = requestAnimationFrame(onRaf)
    }

    if (typeof main.requestVideoFrameCallback === 'function') rvfcId = main.requestVideoFrameCallback(onFrame)
    else rafId = requestAnimationFrame(onRaf)

    return () => {
      if (rvfcId !== null && typeof main.cancelVideoFrameCallback === 'function') main.cancelVideoFrameCallback(rvfcId)
      if (rafId !== null) cancelAnimationFrame(rafId)
    }
  }, [isPlaying, offsetSeconds, mainSession?.id, selectedSession?.id])

  const handlePlayPause = async () => {
    const main = mainVideoRef.current
    const right = selectedVideoRef.current
    if (!main || !right) return
    if (isPlaying) {
      main.pause()
      right.pause()
      setIsPlaying(false)
      return
    }
    syncAt(timelineTime)
    await Promise.allSettled([main.play(), right.play()])
    setIsPlaying(true)
  }

  const handleLoadedMetadata = () => {
    const main = mainVideoRef.current
    if (!main || !Number.isFinite(main.duration)) return
    setTimelineDuration(main.duration)
  }

  const handleScrub = (value, pct = null) => {
    const nextTime = Number(value || 0)
    syncAt(nextTime)
    if (pct == null || !thumbCues.length) {
      setPreview(null)
      return
    }
    const cue = thumbCues.find((item) => nextTime >= item.start && nextTime <= item.end) || null
    if (!cue) {
      setPreview(null)
      return
    }
    setPreview({ ...cue, pct, at: nextTime })
  }

  if (loading) return <div className="px-4 py-10 text-sm text-gray-400">Loading compare view...</div>
  if (error) {
    return (
      <div className="px-4 py-10">
        <p className="text-sm text-red-500 mb-3">{error}</p>
        <button onClick={onBack} className="text-sm text-gray-500 underline">Back</button>
      </div>
    )
  }
  if (!mainSession) {
    return (
      <div className="px-4 py-10">
        <p className="text-sm text-gray-500">Set a MAIN session in this space first.</p>
      </div>
    )
  }
  if (!selectedSession) {
    return (
      <div className="px-4 py-10">
        <p className="text-sm text-gray-500">Add another session in this space to compare with MAIN.</p>
      </div>
    )
  }

  const mainSrc = preferredSessionVideoUrl(mainSession)
  const selectedSrc = preferredSessionVideoUrl(selectedSession)
  const rangeMax = Math.max(0, timelineDuration || 0)
  const rangePct = rangeMax > 0 ? (timelineTime / rangeMax) * 100 : 0

  return (
    <div className="px-4 sm:px-6 py-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Compare</h1>
          <p className="text-xs text-gray-500">{space?.name || 'Space'}</p>
        </div>
        <button onClick={onBack} className="text-xs text-gray-500 hover:text-gray-700">Back</button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="text-xs text-gray-500">Compare MAIN with</label>
        <select
          value={selectedSession.id}
          onChange={(event) => setSelectedSessionId(Number(event.target.value))}
          className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-gray-400"
        >
          {selectableSessions.map((session) => (
            <option key={session.id} value={session.id}>{session.title}</option>
          ))}
        </select>
        <label className="text-xs text-gray-500 ml-2">Offset</label>
        <input
          type="range"
          min={-5}
          max={5}
          step={0.05}
          value={offsetSeconds}
          onChange={(event) => setOffsetSeconds(Number(event.target.value))}
        />
        <span className="text-xs font-mono text-gray-500">{offsetSeconds.toFixed(2)}s</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        <div>
          <p className="text-xs text-gray-500 mb-1">MAIN · {mainSession.title}</p>
          <div className="aspect-video bg-black rounded-lg overflow-hidden">
            <video
              ref={mainVideoRef}
              src={mainSrc}
              className="w-full h-full"
              preload="metadata"
              onLoadedMetadata={handleLoadedMetadata}
              onPause={() => setIsPlaying(false)}
              onPlay={() => setIsPlaying(true)}
              controls={false}
            />
          </div>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Selected · {selectedSession.title}</p>
          <div className="aspect-video bg-black rounded-lg overflow-hidden">
            <video
              ref={selectedVideoRef}
              src={selectedSrc}
              className="w-full h-full"
              preload="metadata"
              controls={false}
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 p-3">
        <div className="flex items-center gap-3 mb-2">
          <button
            onClick={handlePlayPause}
            className="text-xs font-medium text-white bg-gray-900 rounded-md px-3 py-1.5"
          >
            {isPlaying ? 'Pause' : 'Play'}
          </button>
          <button
            onClick={() => setAudioFocus((prev) => (prev === 'main' ? 'selected' : 'main'))}
            className="text-xs text-gray-600 border border-gray-200 rounded-md px-3 py-1.5"
          >
            Audio: {audioFocus === 'main' ? 'MAIN' : 'Selected'}
          </button>
          <span className="text-xs font-mono text-gray-500">
            {fmtTime(timelineTime)} / {fmtTime(rangeMax || 0)}
          </span>
        </div>

        <div className="relative pt-2">
          {preview && (
            <div
              className="absolute -top-28 z-10"
              style={{ left: `calc(${preview.pct}% - 64px)` }}
            >
              <div className="w-32 h-20 bg-black rounded overflow-hidden border border-gray-700">
                <div
                  className="w-full h-full bg-no-repeat"
                  style={{
                    backgroundImage: `url(${preview.imageUrl})`,
                    backgroundPosition: `-${preview.x}px -${preview.y}px`,
                    width: `${preview.w}px`,
                    height: `${preview.h}px`,
                    transform: `scale(${Math.min(1, 128 / preview.w)})`,
                    transformOrigin: 'top left',
                  }}
                />
              </div>
              <p className="text-[10px] text-gray-600 text-center mt-1">{fmtTime(preview.at)}</p>
            </div>
          )}
          <input
            type="range"
            min={0}
            max={rangeMax || 0}
            step={0.01}
            value={timelineTime}
            onMouseDown={() => { dragRef.current = true }}
            onTouchStart={() => { dragRef.current = true }}
            onMouseUp={() => { dragRef.current = false; setPreview(null) }}
            onTouchEnd={() => { dragRef.current = false; setPreview(null) }}
            onChange={(event) => {
              const next = Number(event.target.value)
              const pct = rangeMax > 0 ? (next / rangeMax) * 100 : 0
              handleScrub(next, pct)
            }}
            className="w-full"
          />
          <div className="text-[10px] text-gray-400 mt-1">{Math.round(rangePct)}%</div>
        </div>
      </div>
    </div>
  )
}

export default SpaceCompareView
