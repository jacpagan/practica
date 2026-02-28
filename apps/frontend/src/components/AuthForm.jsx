import React, { useState } from 'react'
import { useAuth } from '../auth'

function AuthForm() {
  const { login, register } = useAuth()
  const [mode, setMode] = useState('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Check if URL has an invite slug (e.g. /join/abc123)
  const pathMatch = window.location.pathname.match(/^\/join\/(.+)$/)
  const [inviteSlug] = useState(pathMatch ? pathMatch[1] : '')
  const [spaceInfo, setSpaceInfo] = useState(null)

  // Fetch space info if we have a slug
  useState(() => {
    if (inviteSlug) {
      fetch(`/api/space-info/${inviteSlug}/`)
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data) { setSpaceInfo(data); setMode('register') } })
        .catch(() => {})
    }
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'login') {
        await login(username, password)
        if (inviteSlug) {
          // After login, join the space
          const token = localStorage.getItem('token')
          await fetch(`/api/join/${inviteSlug}/`, {
            method: 'POST',
            headers: { 'Authorization': `Token ${token}` },
          })
        }
      } else {
        await register({
          username, password,
          display_name: displayName || username,
          invite_code: inviteCode,
          invite_slug: inviteSlug,
        })
      }
      // Redirect to home after join
      if (inviteSlug) window.history.replaceState(null, '', '/')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold text-gray-900 text-center mb-1">Practica</h1>

        {spaceInfo ? (
          <p className="text-sm text-gray-500 text-center mb-8">
            Join <span className="font-medium text-gray-900">{spaceInfo.owner}</span>'s <span className="font-medium text-gray-900">{spaceInfo.name}</span> space
          </p>
        ) : (
          <p className="text-sm text-gray-400 text-center mb-8">Your practice, tracked.</p>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-gray-100">
          <button onClick={() => { setMode('login'); setError('') }}
            className={`flex-1 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              mode === 'login' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400'
            }`}>Log in</button>
          <button onClick={() => { setMode('register'); setError('') }}
            className={`flex-1 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              mode === 'register' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400'
            }`}>Sign up</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && !inviteSlug && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">Invite code</label>
              <input type="text" value={inviteCode} onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                placeholder="Enter your invite code"
                className="w-full px-3 py-2 text-sm font-mono text-center uppercase tracking-widest border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
                required={!inviteSlug} maxLength={8} />
              <p className="text-xs text-gray-400 mt-1">Ask the person who invited you</p>
            </div>
          )}

          <div>
            <label className="block text-xs text-gray-500 mb-1">Username</label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
              required autoFocus={mode === 'login' || inviteSlug} />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
              required minLength={6} />
          </div>

          {mode === 'register' && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">Your name</label>
              <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
                placeholder="How others see you" />
            </div>
          )}

          {error && <p className="text-xs text-red-500">{error}</p>}

          <button type="submit" disabled={loading}
            className="w-full text-sm font-medium text-white bg-gray-900 rounded-lg py-2.5 hover:bg-gray-800 disabled:opacity-40 transition-colors">
            {loading ? 'Loading...' : mode === 'login' ? 'Log in' : inviteSlug ? `Join ${spaceInfo?.name || 'space'}` : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default AuthForm
