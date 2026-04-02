import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useToast } from './Toast'

// Lightweight in-app bell that polls for new feedback for the signed-in member (student/owner role).
// It shows a subtle badge in the header and a dropdown list to open recent items.
// This avoids heavy infra (no push/SSE) and keeps privacy by default.

const STORAGE_KEY = 'practica.notifications.seenIds.v1'
const STORAGE_PAUSED_KEY = 'practica.notifications.paused.v1'

function BellIcon({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V4a2 2 0 10-4 0v1.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  )
}

export default function NotificationsBell({ token, onOpenReviewRequest, onOpenPrivacy }) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [paused, setPaused] = useState(false)
  const pollRef = useRef(null)
  const firstLoadRef = useRef(true)

  const authHeaders = useMemo(() => (token ? { Authorization: `Token ${token}` } : {}), [token])

  // Load persisted paused state
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_PAUSED_KEY)
      setPaused(raw === '1')
    } catch {}
  }, [])

  const loadSeen = () => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      const parsed = JSON.parse(raw || '[]')
      return Array.isArray(parsed) ? new Set(parsed.map(Number).filter(Boolean)) : new Set()
    } catch {
      return new Set()
    }
  }

  const saveSeen = (idsSet) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(idsSet)))
    } catch {}
  }

  const fetchMemberFeedback = useCallback(async () => {
    if (!token) return []
    const res = await fetch('/api/review-requests/?role=owner', { headers: authHeaders })
    if (!res.ok) throw new Error('review-requests')
    const data = await res.json()
    const list = Array.isArray(data) ? data : (Array.isArray(data?.results) ? data.results : [])
    // Only items where the reviewer has responded and the member hasn’t marked viewed yet.
    const responded = list.filter((r) => String(r?.status || '').toLowerCase() === 'responded')
    // Sort newest first.
    responded.sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at))
    return responded
  }, [authHeaders, token])

  const load = useCallback(async () => {
    if (!token) return
    if (paused) return
    if (typeof document !== 'undefined' && document.hidden) return
    setLoading(true)
    try {
      const responded = await fetchMemberFeedback()
      setItems(responded)

      // Notify only on truly new IDs after the first load.
      const seen = loadSeen()
      const incomingIds = responded.map((r) => Number(r.id)).filter(Boolean)

      if (!firstLoadRef.current && !(typeof document !== 'undefined' && document.hidden) && !paused) {
        const newOnes = incomingIds.filter((id) => !seen.has(id))
        if (newOnes.length > 0) {
          const newest = responded.find((r) => Number(r.id) === newOnes[0])
          const who = newest?.reviewer?.display_name || newest?.teacher?.display_name || newest?.reviewer?.username || newest?.teacher?.username || 'Your reviewer'
          const what = newest?.session?.title || 'your video'
          toast.success(`New feedback from ${who} on “${what}”.`)
        }
      }

      // Mark all currently visible responded items as seen to avoid repeat toasts next poll.
      const nextSeen = new Set(seen)
      incomingIds.forEach((id) => nextSeen.add(id))
      saveSeen(nextSeen)
      firstLoadRef.current = false
    } catch {
      // ignore — do not spam errors in bell
    } finally {
      setLoading(false)
    }
  }, [fetchMemberFeedback, paused, toast, token])

  useEffect(() => {
    if (!token) return () => {}
    const start = () => {
      if (pollRef.current) { try { clearInterval(pollRef.current) } catch {} }
      // Initial load + poll every 45s when visible and not paused
      load()
      pollRef.current = setInterval(load, 45000)
    }
    const stop = () => {
      if (pollRef.current) { try { clearInterval(pollRef.current) } catch {} ; pollRef.current = null }
    }

    if (typeof document !== 'undefined') {
      const onVisibility = () => {
        if (document.hidden || paused) stop()
        else start()
      }
      document.addEventListener('visibilitychange', onVisibility)
      onVisibility()
      return () => { document.removeEventListener('visibilitychange', onVisibility); stop() }
    }
    start()
    return () => stop()
  }, [load, paused, token])

  const togglePaused = () => {
    const next = !paused
    setPaused(next)
    try { window.localStorage.setItem(STORAGE_PAUSED_KEY, next ? '1' : '0') } catch {}
    if (next && pollRef.current) { try { clearInterval(pollRef.current) } catch {}; pollRef.current = null }
    if (!next && typeof document !== 'undefined' && !document.hidden) {
      // kick a refresh immediately when resuming
      load()
    }
  }

  const unreadCount = items.length

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={unreadCount > 0 ? `Notifications: ${unreadCount} new` : 'Notifications'}
        onClick={() => setOpen((s) => !s)}
        className={`relative p-2 rounded-full border ${open ? 'border-gray-300 bg-white' : 'border-gray-200 hover:border-gray-300'} ${paused ? 'opacity-60' : ''} transition-colors`}
      >
        <BellIcon className="w-5 h-5 text-gray-600" />
        {unreadCount > 0 ? (
          <span className="absolute -top-0.5 -right-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        ) : null}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 rounded-xl border border-gray-200 bg-white shadow-lg z-20">
          <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold text-gray-900">Feedback</p>
              <button
                type="button"
                onClick={() => { onOpenPrivacy?.(); setOpen(false) }}
                className="text-[11px] text-gray-600 border border-gray-200 rounded-md px-2 py-1 hover:bg-gray-50"
              >
                Notifications settings
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={togglePaused}
                className="text-[11px] text-gray-600 border border-gray-200 rounded-md px-2 py-1 hover:bg-gray-50"
              >
                {paused ? 'Resume notifications' : 'Pause notifications'}
              </button>
              {loading ? <span className="text-[10px] text-gray-400">Updating…</span> : null}
            </div>
          </div>
          <div className="max-h-80 overflow-auto p-2 space-y-2">
            {items.length === 0 ? (
              <p className="px-2 py-4 text-xs text-gray-500 text-center">No new feedback.</p>
            ) : items.map((r) => (
              <div key={r.id} className="rounded-lg border border-gray-200 p-3">
                <p className="text-sm font-medium text-gray-900 line-clamp-1">{r.session?.title || 'Feedback'}</p>
                <p className="text-xs text-gray-500 mt-0.5">{r.reviewer?.display_name || r.teacher?.display_name || r.reviewer?.username || r.teacher?.username || 'Reviewer'}</p>
                <div className="mt-2 flex gap-2 justify-end">
                  <button
                    type="button"
                    className="text-xs rounded-md bg-gray-900 text-white px-3 py-1.5 hover:bg-gray-800 transition-colors"
                    onClick={async () => {
                      // Mark viewed before navigating
                      try {
                        if (r?.id) {
                          await fetch(`/api/review-requests/${r.id}/mark-viewed/`, { method: 'POST', headers: authHeaders })
                        }
                      } catch {}
                      onOpenReviewRequest?.(r)
                      setOpen(false)
                    }}
                  >
                    Open
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
