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
      fetch('/api/auth/me/', {
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

  const login = async (username, password) => {
    const res = await fetch('/api/auth/login/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    if (!res.ok) throw new Error('Invalid credentials')
    const data = await res.json()
    persistToken(data.token)
    setToken(data.token)
    setUser(data.user)
    return data.user
  }

  const register = async ({ username, password, display_name }) => {
    const body = { username, password, display_name }
    const res = await fetch('/api/auth/register/', {
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
      const res = await fetch('/api/auth/me/', { headers: { 'Authorization': `Token ${token}` } })
      if (res.ok) setUser(await res.json())
    } catch {}
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

export const authHeaders = (token) => token
  ? { 'Authorization': `Token ${token}` }
  : {}
