import React, { useEffect, useMemo, useState } from 'react'
import { preferredSessionVideoUrl, parseTimeInput } from '../utils'

function ReviewPage() {
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
  const [timestamp, setTimestamp] = useState('')
  const [text, setText] = useState('')
  const [feedback, setFeedback] = useState([])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const res = await fetch(`/api/v1/review-links/${token}`)
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

  const loadFeedback = async () => {
    try {
      const res = await fetch(`/api/v1/review-links/${token}/feedback`)
      if (res.ok) setFeedback(await res.json())
    } catch {}
  }

  useEffect(() => { if (session) loadFeedback() }, [session])

  const submit = async (e) => {
    e.preventDefault()
    if (!text.trim()) return
    setSubmitting(true)
    try {
      const ts = parseTimeInput(timestamp)
      const res = await fetch(`/api/v1/review-links/${token}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), timestamp_seconds: ts, text: text.trim() }),
      })
      if (res.ok) {
        setText('')
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
            <video src={preferredSessionVideoUrl(session)} controls playsInline className="w-full h-full" />
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name (optional)"
                  className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400" />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (optional)"
                  className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400" />
                <input type="text" value={timestamp} onChange={(e) => setTimestamp(e.target.value)} placeholder="Timestamp (mm:ss)"
                  className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400" />
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
                    {typeof f.timestamp_seconds === 'number' ? <span className="text-gray-500"> · @{Math.floor(f.timestamp_seconds/60)}:{String(f.timestamp_seconds%60).padStart(2,'0')}</span> : null}
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

