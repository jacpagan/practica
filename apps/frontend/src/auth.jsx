import React, { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(() => localStorage.getItem('token'))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (token) {
      fetch('/api/auth/me/', {
        headers: { 'Authorization': `Token ${token}` },
      })
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(setUser)
        .catch(() => { setToken(null); localStorage.removeItem('token') })
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
    localStorage.setItem('token', data.token)
    setToken(data.token)
    setUser(data.user)
    return data.user
  }

  const register = async ({ username, password, role, display_name, invite_code }) => {
    const res = await fetch('/api/auth/register/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, role, display_name, invite_code }),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(Object.values(err).flat().join(', '))
    }
    const data = await res.json()
    localStorage.setItem('token', data.token)
    setToken(data.token)
    setUser(data.user)
    return data.user
  }

  const logout = () => {
    localStorage.removeItem('token')
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
