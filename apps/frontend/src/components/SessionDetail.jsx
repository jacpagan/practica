import React, { useEffect, useMemo, useState } from 'react'
import { preferredSessionVideoUrl, videoUrl } from '../utils'
import { useToast } from './Toast'

function SessionDetail({ session: initialSession, spaces = [], token, onBack, onSessionUpdate }) {
  const toast = useToast()
  const [session, setSession] = useState(initialSession)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editReferenceTitle, setEditReferenceTitle] = useState('')
  const [editReferenceUrl, setEditReferenceUrl] = useState('')
  const [editSpace, setEditSpace] = useState('')

  const authHeaders = useMemo(() => (token ? { Authorization: `Token ${token}` } : {}), [token])

  useEffect(() => {
    setSession(initialSession)
  }, [initialSession])

  const canEdit = Boolean(session?.can_edit)

  const startEditing = () => {
    setEditTitle(session.title || '')
    setEditDescription(session.description || '')
    setEditReferenceTitle(session.reference_title || '')
    setEditReferenceUrl(session.reference_url || '')
    setEditSpace(session.space_id || '')
    setEditing(true)
  }

  const cancelEditing = () => setEditing(false)

  const saveEdits = async () => {
    if (!editTitle.trim()) {
      toast.error('Title is required')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/sessions/${session.id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          title: editTitle.trim(),
          description: editDescription.trim(),
          reference_title: editReferenceTitle.trim(),
          reference_url: editReferenceUrl.trim(),
          space: editSpace || null,
        }),
      })
      if (!res.ok) throw new Error('save')
      const data = await res.json()
      setSession(data)
      onSessionUpdate?.(data)
      setEditing(false)
      toast.success('Journal entry updated')
    } catch {
      toast.error('Could not save changes')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="px-4 sm:px-6 py-4 max-w-3xl mx-auto">
      <div className="mb-4">
        <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-900 transition-colors">← Back to practice</button>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
        <div className="aspect-video bg-black">
          <video src={preferredSessionVideoUrl(session)} controls playsInline className="w-full h-full" />
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          {editing ? (
            <div className="space-y-4">
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full text-lg font-semibold text-gray-900 border-b border-gray-200 focus:border-gray-400 focus:outline-none pb-1"
              />
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={3}
                placeholder="Notes about this attempt"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 resize-none"
              />
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 space-y-3">
                <p className="text-sm font-medium text-gray-900">Reference video</p>
                <input
                  type="text"
                  value={editReferenceTitle}
                  onChange={(e) => setEditReferenceTitle(e.target.value)}
                  placeholder="Dorothy Fitzer — 8 Brocades"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
                />
                <input
                  type="url"
                  value={editReferenceUrl}
                  onChange={(e) => setEditReferenceUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?..."
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
                />
              </div>
              {spaces.length > 0 ? (
                <div>
                  <label className="block text-xs text-gray-500 mb-2">Space</label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setEditSpace('')}
                      className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${!editSpace ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                      None
                    </button>
                    {spaces.map((space) => (
                      <button
                        key={space.id}
                        type="button"
                        onClick={() => setEditSpace(space.id)}
                        className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${editSpace === space.id ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                      >
                        {space.name}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="flex gap-2">
                <button onClick={saveEdits} disabled={saving} className="text-sm font-medium text-white bg-gray-900 rounded-lg px-4 py-2.5 hover:bg-gray-800 disabled:opacity-50 transition-colors">
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button onClick={cancelEditing} className="text-sm text-gray-500 border border-gray-200 rounded-lg px-4 py-2.5 hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h1 className="text-lg font-semibold text-gray-900">{session.title}</h1>
                  <p className="text-xs text-gray-400 mt-1">{session.owner?.display_name || 'You'}{session.space_name ? ` · ${session.space_name}` : ''}</p>
                </div>
                {canEdit ? (
                  <button onClick={startEditing} className="text-xs text-gray-500 hover:text-gray-900 transition-colors">Edit</button>
                ) : null}
              </div>

              {session.description ? <p className="text-sm text-gray-600">{session.description}</p> : null}

              {(session.reference_title || session.reference_url) ? (
                <div className="rounded-xl bg-gray-50 px-3 py-3">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Reference video</p>
                  {session.reference_title ? <p className="text-sm font-medium text-gray-900 mt-1">{session.reference_title}</p> : null}
                  {session.reference_url ? (
                    <a
                      href={session.reference_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex mt-1 text-sm text-blue-600 hover:text-blue-700 break-all"
                    >
                      {videoUrl(session.reference_url) || session.reference_url}
                    </a>
                  ) : null}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                {session.recorded_at ? <span>Recorded {new Date(session.recorded_at).toLocaleString()}</span> : null}
                {session.duration_seconds ? <span>{Math.round(session.duration_seconds / 60)} min</span> : null}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default SessionDetail
