import React, { useEffect, useMemo, useState } from 'react'
import { authHeaders } from '../auth'
import {
  deleteSavedSpaceReference,
  fmtDate,
  readSavedSpaceReferences,
  saveSavedSpaceReference,
  writeReferenceAttemptDraft,
} from '../utils'
import { useToast } from './Toast'

function TodayView({
  token,
  user,
  spaces = [],
  initialSpaceId = null,
  onOpenSession,
  onUploadProof,
  onQuickRecordProof,
  onScreenRecordProof,
}) {
  const toast = useToast()
  const [selectedSpaceId, setSelectedSpaceId] = useState(initialSpaceId || spaces[0]?.id || null)
  const [loading, setLoading] = useState(false)
  const [sessions, setSessions] = useState([])
  const [referenceTitle, setReferenceTitle] = useState('')
  const [referenceUrl, setReferenceUrl] = useState('')
  const [referenceNotes, setReferenceNotes] = useState('')
  const [savedReferences, setSavedReferences] = useState([])

  useEffect(() => {
    if (!spaces.length) {
      setSelectedSpaceId(null)
      return
    }
    if (!selectedSpaceId || !spaces.some((space) => space.id === selectedSpaceId)) {
      setSelectedSpaceId(initialSpaceId || spaces[0].id)
    }
  }, [spaces, selectedSpaceId, initialSpaceId])

  useEffect(() => {
    setSavedReferences(readSavedSpaceReferences(selectedSpaceId))
  }, [selectedSpaceId])

  const selectedSpace = useMemo(
    () => spaces.find((space) => space.id === selectedSpaceId) || null,
    [spaces, selectedSpaceId],
  )

  useEffect(() => {
    if (!selectedSpaceId) {
      setSessions([])
      return
    }

    let cancelled = false
    const loadSessions = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/sessions/?space=${selectedSpaceId}`, { headers: authHeaders(token) })
        if (!res.ok) throw new Error('sessions')
        const data = await res.json()
        const items = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : []
        if (!cancelled) setSessions(items)
      } catch {
        if (!cancelled) toast.error('Could not load practice journal')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadSessions()
    return () => { cancelled = true }
  }, [selectedSpaceId, token, toast])

  const launchAttempt = (launcher, override = null) => {
    const nextTitle = String(override?.title ?? referenceTitle).trim()
    const nextUrl = String(override?.reference_url ?? referenceUrl).trim()
    const nextNotes = String(override?.notes ?? referenceNotes).trim()
    if (!nextUrl) {
      toast.error('Paste a YouTube link first')
      return
    }
    writeReferenceAttemptDraft({
      reference_title: nextTitle,
      reference_url: nextUrl,
      notes: nextNotes,
      space_id: selectedSpaceId || null,
    })
    setReferenceTitle(nextTitle)
    setReferenceUrl(nextUrl)
    setReferenceNotes(nextNotes)
    launcher?.(selectedSpaceId)
  }

  const saveReference = () => {
    if (!selectedSpaceId || !referenceUrl.trim()) {
      toast.error('Paste a YouTube link first')
      return
    }
    const next = saveSavedSpaceReference(selectedSpaceId, {
      title: referenceTitle.trim() || referenceUrl.trim(),
      reference_url: referenceUrl.trim(),
      notes: referenceNotes.trim(),
    })
    setSavedReferences(next)
    toast.success('Saved link')
  }

  const removeReference = (referenceId) => {
    const next = deleteSavedSpaceReference(selectedSpaceId, referenceId)
    setSavedReferences(next)
  }

  if (!spaces.length) {
    return (
      <div className="px-4 sm:px-6 pt-6">
        <div className="rounded-2xl border border-dashed border-gray-200 p-6 text-center">
          <h2 className="text-sm font-semibold text-gray-900">No spaces yet</h2>
          <p className="text-sm text-gray-500 mt-2">Create or join a space first. After that, this becomes a simple practice journal.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 sm:px-6 pt-4 space-y-4">
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {spaces.map((space) => (
          <button
            key={space.id}
            onClick={() => setSelectedSpaceId(space.id)}
            className={`text-xs px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${selectedSpaceId === space.id ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            {space.name}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 space-y-5">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-400">Practice Journal</p>
          <h2 className="text-lg font-semibold text-gray-900 mt-1">{selectedSpace?.name}</h2>
          <p className="text-sm text-gray-500 mt-1">Paste a YouTube practice video, record your attempt, and keep a simple accountability log.</p>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 space-y-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">Start from a YouTube reference</p>
            <p className="text-xs text-gray-500 mt-1">Perfect for Dorothy Fitzer or any other teacher-led qigong/tai chi follow-along.</p>
          </div>
          <input
            type="text"
            value={referenceTitle}
            onChange={(e) => setReferenceTitle(e.target.value)}
            placeholder="Dorothy Fitzer — 8 Brocades"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 bg-white"
          />
          <input
            type="url"
            value={referenceUrl}
            onChange={(e) => setReferenceUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?..."
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 bg-white"
          />
          <textarea
            value={referenceNotes}
            onChange={(e) => setReferenceNotes(e.target.value)}
            rows={2}
            placeholder="Optional note to yourself or your coach"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 bg-white resize-none"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => launchAttempt(onQuickRecordProof)}
              className="text-xs font-medium text-white bg-gray-900 rounded-lg px-3 py-2 hover:bg-gray-800 transition-colors"
            >
              Record attempt
            </button>
            <button
              type="button"
              onClick={() => launchAttempt(onUploadProof)}
              className="text-xs font-medium text-gray-700 border border-gray-200 rounded-lg px-3 py-2 hover:bg-white transition-colors"
            >
              Upload attempt
            </button>
            {onScreenRecordProof ? (
              <button
                type="button"
                onClick={() => launchAttempt(onScreenRecordProof)}
                className="text-xs font-medium text-gray-700 border border-gray-200 rounded-lg px-3 py-2 hover:bg-white transition-colors"
              >
                Screen record
              </button>
            ) : null}
            <button
              type="button"
              onClick={saveReference}
              className="text-xs font-medium text-gray-700 border border-gray-200 rounded-lg px-3 py-2 hover:bg-white transition-colors"
            >
              Save link
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Saved links on this device</p>
          {savedReferences.length === 0 ? (
            <p className="text-sm text-gray-500">Save your favorite reference links once, then relaunch attempts with one tap.</p>
          ) : (
            <div className="space-y-2">
              {savedReferences.map((reference) => (
                <div key={reference.id} className="rounded-xl bg-gray-50 px-3 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900">{reference.title}</p>
                      {reference.notes ? <p className="text-xs text-gray-500 mt-1">{reference.notes}</p> : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeReference(reference.id)}
                      className="text-xs text-gray-400 hover:text-red-500 flex-shrink-0"
                    >
                      Delete
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <button
                      type="button"
                      onClick={() => {
                        setReferenceTitle(reference.title || '')
                        setReferenceUrl(reference.reference_url || '')
                        setReferenceNotes(reference.notes || '')
                      }}
                      className="text-xs font-medium text-gray-700 border border-gray-200 rounded-lg px-3 py-2 hover:bg-white transition-colors"
                    >
                      Use
                    </button>
                    <a
                      href={reference.reference_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-medium text-gray-700 border border-gray-200 rounded-lg px-3 py-2 hover:bg-white transition-colors"
                    >
                      Open
                    </a>
                    <button
                      type="button"
                      onClick={() => launchAttempt(onQuickRecordProof, reference)}
                      className="text-xs font-medium text-white bg-gray-900 rounded-lg px-3 py-2 hover:bg-gray-800 transition-colors"
                    >
                      Record
                    </button>
                    <button
                      type="button"
                      onClick={() => launchAttempt(onUploadProof, reference)}
                      className="text-xs font-medium text-gray-700 border border-gray-200 rounded-lg px-3 py-2 hover:bg-white transition-colors"
                    >
                      Upload
                    </button>
                    {onScreenRecordProof ? (
                      <button
                        type="button"
                        onClick={() => launchAttempt(onScreenRecordProof, reference)}
                        className="text-xs font-medium text-gray-700 border border-gray-200 rounded-lg px-3 py-2 hover:bg-white transition-colors"
                      >
                        Screen
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-gray-900">Recent journal entries</p>
              <p className="text-xs text-gray-500 mt-1">Each entry is a practice attempt your coach can review.</p>
            </div>
            {loading ? <span className="text-xs text-gray-400">Loading…</span> : null}
          </div>

          {sessions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 px-4 py-5 text-sm text-gray-500">
              No attempts yet. Start from a YouTube link above.
            </div>
          ) : (
            <div className="space-y-2">
              {sessions.map((session) => (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => onOpenSession?.(session)}
                  className="w-full text-left rounded-2xl border border-gray-200 px-4 py-3 hover:border-gray-300 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{session.title}</p>
                      <p className="text-xs text-gray-500 mt-1">{session.owner_name || 'You'} · {fmtDate(session.recorded_at || session.created_at)}</p>
                      {session.reference_title ? <p className="text-xs text-blue-700 mt-2 truncate">Reference: {session.reference_title}</p> : null}
                      {session.description ? <p className="text-xs text-gray-500 mt-2 line-clamp-2">{session.description}</p> : null}
                    </div>
                    <span className="text-xs text-gray-400 flex-shrink-0">Open</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default TodayView
