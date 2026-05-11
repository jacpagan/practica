import React, { useState } from 'react'
import { useAuth } from '../auth'
import { reportClientError } from '../utils'
import { useToast } from './Toast'

function AuthForm({
  initialMode = 'login',
  prefilledInviteCode = '',
  contextTitle = '',
  contextSubtitle = '',
  inviteCodeLocked = false,
  inviteContext = '',
  embedded = false,
}) {
  const { login, register } = useAuth()
  const toast = useToast()
  const normalizedInitialMode = initialMode === 'register' ? 'register' : 'login'
  const [mode, setMode] = useState(normalizedInitialMode)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [inviteCode, setInviteCode] = useState(prefilledInviteCode)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const title = contextTitle || 'Practica'
  const subtitle = contextSubtitle || 'A private evidence archive for self-led learning.'

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'login') {
        await login(username, password)
      } else {
        await register({
          username, password,
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

  const reportProblem = () => {
    try {
      const path = (window.location && (window.location.pathname + (window.location.search || ''))) || '/'
      reportClientError({ source: 'UserReport', message: 'user_report', extra: { note: 'User pressed report', path } })
      toast?.success?.('Thanks for the report')
    } catch {}
  }

  return (
    <div className={embedded ? 'w-full' : 'min-h-screen bg-white flex items-center justify-center px-4'}>
      <div className={`w-full max-w-sm ${embedded ? 'rounded-2xl border border-gray-200 bg-white px-6 py-6 shadow-sm' : ''}`}>
        <h1 className="text-2xl font-semibold text-gray-900 text-center mb-1">{title}</h1>

        <p className="text-sm text-gray-400 text-center mb-8">{subtitle}</p>
        {inviteCodeLocked && inviteCode ? (
          <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-left">
            <p className="text-xs font-medium uppercase tracking-wide text-emerald-800">
              Private invite
            </p>
              <p className="text-sm text-emerald-900 mt-1">
              {mode === 'register'
                ? 'Create your account once and this invite will connect you to the private archive automatically.'
                : 'Already have an account? Log in and we will connect this invite to your account automatically.'}
              </p>
          </div>
        ) : null}
        <div className="flex items-center justify-center gap-3 mb-6">
          <a href="/privacy" className="text-xs text-gray-500 hover:text-gray-900 transition-colors">Privacy</a>
          <button type="button" onClick={reportProblem} className="text-xs text-gray-500 hover:text-gray-900 transition-colors">Report a problem</button>
        </div>

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
          <div>
            <label className="block text-xs text-gray-500 mb-1">Username</label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
              required autoFocus />
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

          {mode === 'register' && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">Invite code</label>
              {inviteCodeLocked && inviteCode ? (
                <div className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-700">
                  {inviteCode}
                </div>
              ) : (
                <input type="text" value={inviteCode} onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
                  placeholder="Enter your invite code"
                  required />
              )}
            </div>
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
