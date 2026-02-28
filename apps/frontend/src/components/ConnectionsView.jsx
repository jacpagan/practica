import React, { useState } from 'react'
import { authHeaders } from '../auth'
import { useToast } from './Toast'

function ConnectionsView({ spaces = [], token, onSpacesChange }) {
  const toast = useToast()
  const [inviteCodes, setInviteCodes] = useState({})
  const [renamingSpace, setRenamingSpace] = useState(null)
  const [enterCode, setEnterCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [showCreateSpace, setShowCreateSpace] = useState(false)
  const [newSpaceName, setNewSpaceName] = useState('')

  const headers = { ...authHeaders(token), 'Content-Type': 'application/json' }

  const generateCode = async (spaceId) => {
    try {
      const res = await fetch(`/api/spaces/${spaceId}/invite/`, { method: 'POST', headers })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        return toast.error(err.error || 'Failed to generate code')
      }
      const data = await res.json()
      setInviteCodes(prev => ({ ...prev, [spaceId]: data.code }))
    } catch {
      toast.error('Failed to generate code')
    }
  }

  const acceptCode = async () => {
    if (!enterCode.trim()) return
    setLoading(true)
    try {
      const res = await fetch('/api/invite/accept/', {
        method: 'POST',
        headers,
        body: JSON.stringify({ code: enterCode.trim() }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(data.space ? `Joined ${data.space}` : 'Connected')
        setEnterCode('')
        onSpacesChange()
        window.dispatchEvent(new CustomEvent('user-updated'))
      } else {
        toast.error(data.error || 'Invalid code')
      }
    } catch {
      toast.error('Connection error')
    } finally {
      setLoading(false)
    }
  }

  const removeMember = async (spaceId, userId) => {
    if (!confirm('Remove this member from the space?')) return
    try {
      const res = await fetch(`/api/spaces/${spaceId}/members/${userId}/`, {
        method: 'DELETE',
        headers: authHeaders(token),
      })
      if (res.ok) {
        onSpacesChange()
        toast.success('Member removed')
      } else {
        toast.error('Could not remove member')
      }
    } catch {
      toast.error('Error removing member')
    }
  }

  const createSpace = async () => {
    if (!newSpaceName.trim()) return
    try {
      const name = newSpaceName.trim()
      const res = await fetch('/api/spaces/', {
        method: 'POST',
        headers,
        body: JSON.stringify({ name }),
      })
      if (res.ok) {
        setNewSpaceName('')
        setShowCreateSpace(false)
        onSpacesChange()
        toast.success(`Space "${name}" created`)
      } else {
        toast.error('Could not create space')
      }
    } catch {
      toast.error('Error creating space')
    }
  }

  const renameSpace = async (spaceId, newName) => {
    if (!newName.trim()) return
    try {
      const res = await fetch(`/api/spaces/${spaceId}/`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ name: newName.trim() }),
      })
      if (res.ok) {
        onSpacesChange()
        toast.success('Space renamed')
      } else {
        toast.error('Could not rename space')
      }
    } catch {
      toast.error('Error renaming space')
    }
  }

  const deleteSpace = async (spaceId, name) => {
    if (!confirm(`Delete "${name}"? Sessions in this space will become unassigned.`)) return
    try {
      const res = await fetch(`/api/spaces/${spaceId}/`, {
        method: 'DELETE',
        headers: authHeaders(token),
      })
      if (res.ok) {
        onSpacesChange()
        toast.success(`"${name}" deleted`)
      } else {
        toast.error('Could not delete space')
      }
    } catch {
      toast.error('Error deleting space')
    }
  }

  const copyCode = async (code) => {
    try {
      await navigator.clipboard?.writeText(code)
      toast.success('Code copied')
    } catch {
      toast.error('Could not copy code')
    }
  }

  return (
    <div className="px-4 sm:px-6 py-6">
      <div className="max-w-lg mx-auto">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Spaces</h2>
        <p className="text-sm text-gray-500 mb-6">Spaces organize practice and feedback with invited members.</p>

        {spaces.map(space => (
          <div key={space.id} className="mb-4 p-4 rounded-xl border border-gray-200">
            <div className="flex items-center justify-between mb-3 gap-3">
              {renamingSpace?.id === space.id ? (
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="text"
                    value={renamingSpace.name}
                    onChange={(e) => setRenamingSpace(prev => ({ ...prev, name: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        renameSpace(space.id, renamingSpace.name)
                        setRenamingSpace(null)
                      }
                    }}
                    className="flex-1 px-2 py-1 text-sm font-semibold border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
                    autoFocus
                  />
                  <button
                    onClick={() => {
                      renameSpace(space.id, renamingSpace.name)
                      setRenamingSpace(null)
                    }}
                    className="text-xs font-medium text-white bg-gray-900 px-2 py-1 rounded-md"
                  >
                    Save
                  </button>
                  <button onClick={() => setRenamingSpace(null)} className="text-xs text-gray-400">Cancel</button>
                </div>
              ) : (
                <>
                  <h3 className="text-sm font-semibold text-gray-900">{space.name}</h3>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-gray-400">{space.session_count} sessions</span>
                    {space.is_owner && (
                      <>
                        <button
                          onClick={() => setRenamingSpace({ id: space.id, name: space.name })}
                          className="text-xs text-gray-400 hover:text-gray-600"
                        >
                          Rename
                        </button>
                        <button
                          onClick={() => deleteSpace(space.id, space.name)}
                          className="text-xs text-gray-400 hover:text-red-500"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>

            {space.members.length > 0 && (
              <div className="mb-3">
                <p className="text-xs text-gray-500 mb-1.5">Members</p>
                <div className="space-y-1.5">
                  {space.members.map(member => (
                    <div key={member.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-[10px] font-semibold flex items-center justify-center">
                          {member.display_name[0].toUpperCase()}
                        </div>
                        <span className="text-sm text-gray-700 truncate">{member.display_name}</span>
                      </div>
                      {space.is_owner && (
                        <button
                          onClick={() => removeMember(space.id, member.id)}
                          className="text-xs text-gray-400 hover:text-red-500"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {space.is_owner && (
              <div>
                {inviteCodes[space.id] ? (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-50 rounded-lg px-3 py-2 text-center">
                      <span className="text-sm font-mono font-bold tracking-widest">{inviteCodes[space.id]}</span>
                    </div>
                    <button
                      onClick={() => copyCode(inviteCodes[space.id])}
                      className="text-xs text-gray-500 hover:text-gray-900 px-2"
                    >
                      Copy
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => generateCode(space.id)}
                    className="w-full text-xs font-medium text-gray-600 border border-gray-200 rounded-lg py-2 hover:bg-gray-50 transition-colors"
                  >
                    Generate invite code for {space.name}
                  </button>
                )}
              </div>
            )}
          </div>
        ))}

        <div className="mb-4">
          {showCreateSpace ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={newSpaceName}
                onChange={(e) => setNewSpaceName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && createSpace()}
                placeholder="e.g. Drumming, Cooking"
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
                autoFocus
              />
              <button onClick={createSpace} className="text-xs font-medium text-white bg-gray-900 px-3 py-2 rounded-lg">Create</button>
              <button
                onClick={() => {
                  setShowCreateSpace(false)
                  setNewSpaceName('')
                }}
                className="text-xs text-gray-400 px-2"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowCreateSpace(true)}
              className="w-full text-sm text-gray-500 border border-dashed border-gray-200 rounded-xl py-3 hover:border-gray-400 transition-colors"
            >
              + Create new space
            </button>
          )}
        </div>

        <div className="p-4 rounded-xl border border-gray-200">
          <h3 className="text-sm font-medium text-gray-900 mb-1">Join with invite code</h3>
          <p className="text-xs text-gray-500 mb-3">Use a code shared by a space owner.</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={enterCode}
              onChange={(e) => setEnterCode(e.target.value.toUpperCase())}
              placeholder="ABCD1234"
              maxLength={8}
              className="flex-1 px-3 py-2 text-sm font-mono text-center uppercase tracking-widest border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
            />
            <button
              onClick={acceptCode}
              disabled={!enterCode.trim() || loading}
              className="text-sm font-medium text-white bg-gray-900 rounded-lg px-4 py-2 hover:bg-gray-800 disabled:opacity-40 transition-colors"
            >
              {loading ? '...' : 'Join'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ConnectionsView
