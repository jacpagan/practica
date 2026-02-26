import React, { useState } from 'react'
import { useAuth } from '../auth'

function AuthForm() {
  const { login, register } = useAuth()
  const [mode, setMode] = useState('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [role, setRole] = useState('teacher')
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'login') {
        await login(username, password)
      } else {
        await register({
          username, password, role,
          display_name: displayName || username,
          invite_code: inviteCode,
        })
      }
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
        <p className="text-sm text-gray-400 text-center mb-8">Your practice, tracked.</p>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-gray-100">
          <button
            onClick={() => { setMode('login'); setError('') }}
            className={`flex-1 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              mode === 'login' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400'
            }`}
          >Log in</button>
          <button
            onClick={() => { setMode('register'); setError('') }}
            className={`flex-1 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              mode === 'register' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400'
            }`}
          >Sign up</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">Invite code</label>
              <input type="text" value={inviteCode} onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                placeholder="Enter your invite code"
                className="w-full px-3 py-2 text-sm font-mono text-center uppercase tracking-widest border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
                required maxLength={8} autoFocus />
              <p className="text-xs text-gray-400 mt-1">Ask the person who invited you for this code</p>
            </div>
          )}

          <div>
            <label className="block text-xs text-gray-500 mb-1">Username</label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
              required autoFocus={mode === 'login'} />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
              required minLength={6} />
          </div>

          {mode === 'register' && (
            <>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Display name</label>
                <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
                  placeholder="How others see you" />
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-2">I am a</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setRole('student')}
                    className={`flex-1 text-sm py-2 rounded-lg transition-colors ${
                      role === 'student' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'
                    }`}>Student</button>
                  <button type="button" onClick={() => setRole('teacher')}
                    className={`flex-1 text-sm py-2 rounded-lg transition-colors ${
                      role === 'teacher' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'
                    }`}>Teacher</button>
                </div>
              </div>
            </>
          )}

          {error && <p className="text-xs text-red-500">{error}</p>}

          <button type="submit" disabled={loading}
            className="w-full text-sm font-medium text-white bg-gray-900 rounded-lg py-2.5 hover:bg-gray-800 disabled:opacity-40 transition-colors">
            {loading ? 'Loading...' : mode === 'login' ? 'Log in' : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default AuthForm
