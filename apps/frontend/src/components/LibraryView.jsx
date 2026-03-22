import React, { useEffect, useMemo, useState } from 'react'
import { fmtDate } from '../utils'
import { useToast } from './Toast'

function InviteCodesPanel({ token }) {
  const toast = useToast()
  const [inviteCodes, setInviteCodes] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [label, setLabel] = useState('')

  const loadInviteCodes = async () => {
    if (!token) return
    setLoading(true)
    try {
      const res = await fetch('/api/invite-codes/', { headers: { Authorization: `Token ${token}` } })
      if (!res.ok) throw new Error('invite-codes')
      const data = await res.json()
      setInviteCodes(Array.isArray(data) ? data : [])
    } catch {
      setInviteCodes([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadInviteCodes()
  }, [token])

  const createInviteCode = async () => {
    if (!token) return
    setCreating(true)
    try {
      const res = await fetch('/api/invite-codes/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Token ${token}`,
        },
        body: JSON.stringify({ label: label.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Could not create invite code')
      setInviteCodes((current) => [data, ...current])
      setLabel('')
      try {
        await navigator.clipboard.writeText(data.code)
        toast.success('Invite code created and copied')
      } catch {
        toast.success('Invite code created')
      }
    } catch (error) {
      toast.error(error?.message || 'Could not create invite code')
    } finally {
      setCreating(false)
    }
  }

  const revokeInviteCode = async (inviteId) => {
    if (!token) return
    try {
      const res = await fetch(`/api/invite-codes/${inviteId}/`, {
        method: 'DELETE',
        headers: { Authorization: `Token ${token}` },
      })
      if (!res.ok) throw new Error('revoke-invite')
      setInviteCodes((current) => current.map((item) => (item.id === inviteId ? { ...item, is_active: false } : item)))
      toast.success('Invite code turned off')
    } catch {
      toast.error('Could not turn off invite code')
    }
  }

  const copyInviteCode = async (code) => {
    try {
      await navigator.clipboard.writeText(code)
      toast.success('Invite code copied')
    } catch {
      toast.error('Could not copy invite code')
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white px-4 py-4 space-y-4">
      <div>
        <p className="text-sm font-semibold text-gray-900">Invite someone</p>
        <p className="text-xs text-gray-500 mt-1">Create a single-use invite code for a trusted person.</p>
      </div>
      <div className="flex gap-2 flex-wrap">
        <input
          type="text"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="Optional label"
          className="flex-1 min-w-[180px] px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
        />
        <button
          type="button"
          onClick={createInviteCode}
          disabled={creating}
          className="rounded-full bg-gray-900 text-white px-4 py-2.5 text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors"
        >
          {creating ? 'Creating…' : 'Create invite code'}
        </button>
      </div>
      {loading ? (
        <p className="text-sm text-gray-500">Loading invite codes…</p>
      ) : inviteCodes.length === 0 ? (
        <p className="text-sm text-gray-500">No invite codes yet.</p>
      ) : (
        <div className="space-y-2">
          {inviteCodes.map((invite) => (
            <div key={invite.id} className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-gray-900 tracking-wide">{invite.code}</p>
                  <span className={`text-[11px] uppercase tracking-wide px-2 py-1 rounded-full ${invite.is_active && invite.redeemable ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                    {invite.is_active && invite.redeemable ? 'Active' : 'Inactive'}
                  </span>
                </div>
                {invite.label ? <p className="text-xs text-gray-500 mt-1">{invite.label}</p> : null}
                <p className="text-xs text-gray-400 mt-1">Uses {invite.use_count}/{invite.max_uses}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button type="button" onClick={() => copyInviteCode(invite.code)} className="text-xs text-gray-700 border border-gray-200 rounded-lg px-3 py-2 hover:bg-white transition-colors">
                  Copy
                </button>
                {invite.is_active ? (
                  <button type="button" onClick={() => revokeInviteCode(invite.id)} className="text-xs text-red-600 border border-red-200 rounded-lg px-3 py-2 hover:bg-red-50 transition-colors">
                    Turn off
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function LibraryView({ sessions = [], sessionsLoading = false, onOpenSession, onOpenSeries, onCreateVideo, token = '' }) {
  const ownSessions = useMemo(
    () => sessions
      .filter((session) => session.can_edit)
      .sort((left, right) => new Date(right.recorded_at || right.created_at) - new Date(left.recorded_at || left.created_at)),
    [sessions],
  )
  const seriesGroups = useMemo(() => {
    const groups = new Map()
    ownSessions.forEach((session) => {
      const seriesName = String(session.practice_series || '').trim()
      if (!seriesName) return
      if (!groups.has(seriesName)) groups.set(seriesName, [])
      groups.get(seriesName).push(session)
    })
    return Array.from(groups.entries())
      .map(([seriesName, items]) => ({ seriesName, items }))
      .sort((left, right) => new Date(right.items[0].recorded_at || right.items[0].created_at) - new Date(left.items[0].recorded_at || left.items[0].created_at))
  }, [ownSessions])
  const standaloneSessions = useMemo(
    () => ownSessions.filter((session) => !String(session.practice_series || '').trim()),
    [ownSessions],
  )
  const readyCount = ownSessions.filter((session) => session.processing_status === 'ready').length
  const feedbackCount = ownSessions.reduce((sum, session) => sum + (session.video_feedback_count || 0), 0)

  return (
    <div className="px-4 sm:px-6 py-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-3">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900 tracking-tight">Library</h2>
              <p className="text-sm text-gray-500 mt-1">Private by default.</p>
            </div>
            {!sessionsLoading ? (
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">{ownSessions.length} videos</span>
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">{readyCount} ready</span>
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">{feedbackCount} replies</span>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onCreateVideo}
            className="rounded-full bg-gray-900 text-white px-4 py-2.5 text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            New video
          </button>
        </div>

        {sessionsLoading ? (
          <div className="rounded-2xl border border-gray-200 px-4 py-8 text-center text-sm text-gray-500">Loading library…</div>
        ) : ownSessions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-10 text-center">
            <p className="text-sm text-gray-700">No videos yet.</p>
            <p className="text-xs text-gray-500 mt-1">Record or upload one to start your private library.</p>
            <button
              type="button"
              onClick={onCreateVideo}
              className="mt-4 rounded-full bg-gray-900 text-white px-4 py-2.5 text-sm font-medium hover:bg-gray-800 transition-colors"
            >
              New video
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <InviteCodesPanel token={token} />
            {seriesGroups.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Practice threads</p>
                {seriesGroups.map(({ seriesName, items }) => {
                  const latest = items[0]
                  return (
                    <button
                      key={seriesName}
                      type="button"
                      onClick={() => onOpenSeries?.(seriesName)}
                      className="w-full text-left rounded-2xl border border-gray-200 px-4 py-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-gray-900 line-clamp-1">{seriesName}</p>
                            <span className="text-[11px] uppercase tracking-wide bg-gray-100 text-gray-700 px-2 py-1 rounded-full">{items.length} takes</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">Latest {fmtDate(latest.recorded_at || latest.created_at)}</p>
                          <p className="text-xs text-gray-500 mt-2 line-clamp-2">Newest take: {latest.title}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs text-gray-500">{items.reduce((sum, item) => sum + (item.video_feedback_count || 0), 0)} replies</p>
                          <p className="text-xs text-gray-400 mt-2">Open thread</p>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            ) : null}

            {standaloneSessions.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Standalone videos</p>
                {standaloneSessions.map((session) => (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => onOpenSession?.(session, { view: 'library', sessionId: null, seriesName: '' })}
                    className="w-full text-left rounded-2xl border border-gray-200 px-4 py-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-gray-900 line-clamp-1">{session.title}</p>
                          <span className="text-[11px] uppercase tracking-wide bg-gray-100 text-gray-700 px-2 py-1 rounded-full">Private</span>
                          {session.processing_status === 'ready' ? <span className="text-[11px] uppercase tracking-wide bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">Ready</span> : null}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{fmtDate(session.recorded_at || session.created_at)}</p>
                        {session.description ? <p className="text-xs text-gray-500 mt-2 line-clamp-2">{session.description}</p> : null}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-gray-500">{session.video_feedback_count || 0} replies</p>
                        <p className="text-xs text-gray-400 mt-2">Open</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}

export default LibraryView
