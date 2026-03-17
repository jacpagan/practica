import React, { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)
const TOKEN_KEY = 'token'

const storage = () => {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

const readToken = () => {
  const store = storage()
  if (!store) return null
  try {
    return store.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

const persistToken = (token) => {
  const store = storage()
  if (!store) return
  try {
    if (!token) store.removeItem(TOKEN_KEY)
    else store.setItem(TOKEN_KEY, token)
  } catch {
    // Token still stays in memory for this session.
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(readToken)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (token) {
      fetch('/api/v1/auth/me', {
        headers: { 'Authorization': `Token ${token}` },
      })
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(setUser)
        .catch(() => { setToken(null); persistToken(null) })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [token])

  const login = async (email, password) => {
    const res = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    if (!res.ok) throw new Error('Invalid credentials')
    const data = await res.json()
    persistToken(data.token)
    setToken(data.token)
    setUser(data.user)
    return data.user
  }

  const loginWithInvite = async (email, password, inviteSlug) => {
    const loginRes = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    if (!loginRes.ok) throw new Error('Invalid credentials')
    const loginData = await loginRes.json()

    const joinRes = await fetch(`/api/join/${inviteSlug}/`, {
      method: 'POST',
      headers: { Authorization: `Token ${loginData.token}` },
    })
    if (!joinRes.ok) {
      const joinError = await joinRes.json().catch(() => ({}))
      throw new Error(joinError.error || 'Could not join this space')
    }

    persistToken(loginData.token)
    setToken(loginData.token)
    setUser(loginData.user)
    return loginData.user
  }

  const register = async ({ username, password, display_name, invite_code, invite_slug }) => {
    const body = { email: username, password, display_name, role: 'student' }
    if (invite_code) body.invite_code = invite_code
    if (invite_slug) body.invite_slug = invite_slug
    const res = await fetch('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(Object.values(err).flat().join(', '))
    }
    const data = await res.json()
    persistToken(data.token)
    setToken(data.token)
    setUser(data.user)
    return data.user
  }

  const logout = () => {
    persistToken(null)
    setToken(null)
    setUser(null)
  }

  const refreshUser = async () => {
    if (!token) return
    try {
      const res = await fetch('/api/v1/auth/me', { headers: { 'Authorization': `Token ${token}` } })
      if (res.ok) setUser(await res.json())
    } catch {}
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, loginWithInvite, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

export const authHeaders = (token) => token
  ? { 'Authorization': `Token ${token}` }
  : {}
