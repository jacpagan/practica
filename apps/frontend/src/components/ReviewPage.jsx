import React, { useEffect, useMemo, useRef, useState } from 'react'
import { fmtTimer, preferredSessionVideoUrl } from '../utils'

function ReviewPage() {
  const videoRef = useRef(null)
  const token = useMemo(() => {
    const m = window.location.pathname.match(/^\/r\/(.+)$/)
    return m ? m[1] : ''
  }, [])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [session, setSession] = useState(null)
  const [link, setLink] = useState(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [currentTime, setCurrentTime] = useState(0)
  const [durationSeconds, setDurationSeconds] = useState(0)
  const [selectedTimestampSeconds, setSelectedTimestampSeconds] = useState(null)
  const [text, setText] = useState('')
  const [feedback, setFeedback] = useState([])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const res = await fetch(`/api/review/${token}/`)
        if (!res.ok) throw new Error('invalid')
        const data = await res.json()
        if (!cancelled) {
          setSession(data.session)
          setLink(data.link)
        }
      } catch {
        if (!cancelled) setError('This link is invalid or has expired.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [token])

  useEffect(() => {
    const knownDuration = Math.round(Number(session?.duration_seconds || 0))
    if (knownDuration > 0) setDurationSeconds(knownDuration)
  }, [session?.duration_seconds])

  const useCurrentVideoTime = () => {
    const nextValue = Math.max(0, Math.min(durationSeconds || Math.round(currentTime), Math.round(currentTime)))
    setSelectedTimestampSeconds(nextValue)
  }

  const clearTimestamp = () => setSelectedTimestampSeconds(null)

  const loadFeedback = async () => {
    try {
      const res = await fetch(`/api/review/${token}/feedback/`)
      if (res.ok) setFeedback(await res.json())
    } catch {}
  }

  useEffect(() => { if (session) loadFeedback() }, [session])

  const submit = async (e) => {
    e.preventDefault()
    if (!text.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/review/${token}/feedback/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          timestamp_seconds: typeof selectedTimestampSeconds === 'number' ? selectedTimestampSeconds : null,
          text: text.trim(),
        }),
      })
      if (res.ok) {
        setText('')
        clearTimestamp()
        await loadFeedback()
      }
    } catch {}
    finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Loading…</div>
  if (error) return <div className="min-h-screen flex items-center justify-center text-sm text-gray-500">{error}</div>

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-100 px-4 py-3 sm:px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="text-lg font-semibold text-gray-900 tracking-tight">Practica Review</div>
          <div className="text-xs text-gray-400">Expires {new Date(link.expires_at).toLocaleString()}</div>
        </div>
      </header>
      <main className="max-w-4xl mx-auto p-4 sm:p-6 space-y-4">
        <div className="rounded-2xl border border-gray-200 overflow-hidden">
          <div className="aspect-video bg-black">
            <video
              ref={videoRef}
              src={preferredSessionVideoUrl(session)}
              controls
              playsInline
              className="w-full h-full"
              onTimeUpdate={(e) => setCurrentTime(Math.round(e.currentTarget.currentTime || 0))}
              onLoadedMetadata={(e) => {
                const duration = Math.round(e.currentTarget.duration || 0)
                if (Number.isFinite(duration) && duration > 0) {
                  setDurationSeconds(duration)
                  setSelectedTimestampSeconds((current) => (
                    typeof current === 'number' ? Math.min(current, duration) : current
                  ))
                }
              }}
            />
          </div>
        </div>

        <div className="space-y-1">
          <h1 className="text-lg font-semibold text-gray-900">{session.title}</h1>
          {session.description ? <p className="text-sm text-gray-600">{session.description}</p> : null}
        </div>

        {link.allow_comments ? (
          <div className="rounded-xl border border-gray-200 p-4 space-y-3">
            <p className="text-sm font-semibold text-gray-900">Leave feedback</p>
            <form onSubmit={submit} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name (optional)"
                  className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400" />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (optional)"
                  className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400" />
              </div>
              <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-3 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Timestamp</p>
                    <p className="text-sm text-gray-700 mt-1">
                      {typeof selectedTimestampSeconds === 'number' ? `Comment at ${fmtTimer(selectedTimestampSeconds)}` : 'No timestamp attached'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={useCurrentVideoTime}
                      className="text-xs text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-white transition-colors"
                    >
                      Use current time
                    </button>
                    <button
                      type="button"
                      onClick={clearTimestamp}
                      className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {durationSeconds > 0 ? (
                  <div>
                    <input
                      type="range"
                      min="0"
                      max={durationSeconds}
                      step="1"
                      value={typeof selectedTimestampSeconds === 'number' ? selectedTimestampSeconds : 0}
                      onChange={(e) => setSelectedTimestampSeconds(Number(e.target.value))}
                      className="w-full"
                    />
                    <div className="flex items-center justify-between text-[11px] text-gray-400 mt-1">
                      <span>0:00</span>
                      <span>Now: {fmtTimer(currentTime)}</span>
                      <span>{fmtTimer(durationSeconds)}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">Play the video to pick a time, or leave the feedback without a timestamp.</p>
                )}
              </div>
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="Your feedback"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 resize-none" />
              <div className="flex justify-end">
                <button type="submit" disabled={submitting}
                  className="text-sm font-medium text-white bg-gray-900 rounded-lg px-4 py-2.5 hover:bg-gray-800 disabled:opacity-50">
                  {submitting ? 'Sending…' : 'Send feedback'}
                </button>
              </div>
            </form>
          </div>
        ) : null}

        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Feedback</p>
          {feedback.length === 0 ? (
            <p className="text-sm text-gray-500">No feedback yet.</p>
          ) : (
            <div className="space-y-2">
              {feedback.map((f) => (
                <div key={f.id} className="rounded-xl bg-gray-50 px-3 py-3">
                  <div className="text-sm text-gray-900">
                    <span className="font-medium">{f.name || 'Anonymous'}</span>
                    {typeof f.timestamp_seconds === 'number' ? <span className="text-gray-500"> · @{fmtTimer(f.timestamp_seconds)}</span> : null}
                  </div>
                  <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{f.text}</p>
                  <p className="text-xs text-gray-400 mt-1">{new Date(f.created_at).toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default ReviewPage
