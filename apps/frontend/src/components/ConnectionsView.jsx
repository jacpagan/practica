import React, { useState } from 'react'
import { useAuth, authHeaders } from '../auth'

function ConnectionsView({ onBack }) {
  const { user, token, login, logout } = useAuth()
  const [inviteCode, setInviteCode] = useState(null)
  const [enterCode, setEnterCode] = useState('')
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const headers = { ...authHeaders(token), 'Content-Type': 'application/json' }

  const isTeacher = user?.role === 'teacher'
  const linked = isTeacher ? (user?.linked_students || []) : (user?.linked_teachers || [])

  const generateCode = async () => {
    setError(null)
    setMessage(null)
    try {
      const res = await fetch('/api/invite/create/', { method: 'POST', headers })
      if (res.ok) {
        const data = await res.json()
        setInviteCode(data.code)
      }
    } catch { setError('Failed to generate code') }
  }

  const submitCode = async () => {
    if (!enterCode.trim()) return
    setLoading(true)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch('/api/invite/accept/', {
        method: 'POST', headers,
        body: JSON.stringify({ code: enterCode.trim() }),
      })
      const data = await res.json()
      if (res.ok) {
        setMessage(`Linked with ${data.teacher || data.student}!`)
        setEnterCode('')
        refreshUser()
      } else {
        setError(data.error || 'Invalid code')
      }
    } catch { setError('Connection error') }
    finally { setLoading(false) }
  }

  const unlinkUser = async (userId) => {
    if (!confirm('Remove this connection?')) return
    try {
      const res = await fetch(`/api/link/${userId}/remove/`, { method: 'DELETE', headers })
      if (res.ok) refreshUser()
    } catch { setError('Failed to remove link') }
  }

  const refreshUser = async () => {
    try {
      const res = await fetch('/api/auth/me/', { headers: authHeaders(token) })
      if (res.ok) {
        const data = await res.json()
        window.dispatchEvent(new CustomEvent('user-updated', { detail: data }))
      }
    } catch {}
  }

  const copyCode = () => {
    navigator.clipboard?.writeText(inviteCode)
    setMessage('Copied to clipboard')
    setTimeout(() => setMessage(null), 2000)
  }

  return (
    <div className="px-4 sm:px-6 py-6">
      <div className="max-w-md mx-auto">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Connections</h2>
        <p className="text-sm text-gray-500 mb-6">
          {isTeacher
            ? 'Link with students to see their practice sessions and give feedback.'
            : 'Link with your teacher so they can see your sessions and give feedback.'}
        </p>

        {/* Current connections */}
        {linked.length > 0 && (
          <div className="mb-6">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
              {isTeacher ? 'Your students' : 'Your teachers'}
            </h3>
            <div className="space-y-2">
              {linked.map(person => (
                <div key={person.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${
                      person.role === 'teacher' ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'
                    }`}>
                      {person.display_name[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{person.display_name}</p>
                      <p className="text-xs text-gray-400">{person.role}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => unlinkUser(person.id)}
                    className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Generate invite code */}
        <div className="mb-6 p-4 rounded-xl border border-gray-200">
          <h3 className="text-sm font-medium text-gray-900 mb-1">Share your invite code</h3>
          <p className="text-xs text-gray-500 mb-3">
            {isTeacher
              ? 'Give this code to a student to link with you.'
              : 'Give this code to your teacher to link with you.'}
          </p>

          {inviteCode ? (
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-gray-50 rounded-lg px-4 py-3 text-center">
                <span className="text-lg font-mono font-bold text-gray-900 tracking-widest">{inviteCode}</span>
              </div>
              <button onClick={copyCode}
                className="text-xs text-gray-500 hover:text-gray-900 px-3 py-3 rounded-lg hover:bg-gray-50 transition-colors">
                Copy
              </button>
            </div>
          ) : (
            <button onClick={generateCode}
              className="w-full text-sm font-medium text-white bg-gray-900 rounded-lg py-2.5 hover:bg-gray-800 transition-colors">
              Generate code
            </button>
          )}
        </div>

        {/* Enter invite code */}
        <div className="p-4 rounded-xl border border-gray-200">
          <h3 className="text-sm font-medium text-gray-900 mb-1">Enter an invite code</h3>
          <p className="text-xs text-gray-500 mb-3">
            {isTeacher
              ? 'Enter a code from a student to link with them.'
              : 'Enter a code from your teacher to link with them.'}
          </p>
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
              onClick={submitCode}
              disabled={!enterCode.trim() || loading}
              className="text-sm font-medium text-white bg-gray-900 rounded-lg px-4 py-2 hover:bg-gray-800 disabled:opacity-40 transition-colors"
            >
              {loading ? '...' : 'Link'}
            </button>
          </div>
        </div>

        {/* Messages */}
        {message && <p className="text-xs text-green-600 mt-3 text-center">{message}</p>}
        {error && <p className="text-xs text-red-500 mt-3 text-center">{error}</p>}

        {/* Empty state */}
        {linked.length === 0 && (
          <div className="text-center py-6">
            <p className="text-xs text-gray-400">
              No connections yet. Generate a code or enter one to get started.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default ConnectionsView
