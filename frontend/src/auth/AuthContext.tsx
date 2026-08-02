import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { maybeTrackDay7Retained, trackEvent } from '../analytics/client'
import {
  AUTH_TOKEN_KEY,
  LEGACY_AUTH_TOKEN_KEY,
  LEGACY_CUSTOM_EXERCISES_KEY,
  readWithLegacyFallback,
} from '../lib/storageKeys'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

interface AuthUser {
  id: number
  email: string
  role: 'user' | 'admin'
  createdAt?: string
}

function normalizeUser(user: Partial<AuthUser> & { id: number; email: string }): AuthUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role === 'admin' ? 'admin' : 'user',
    createdAt: user.createdAt,
  }
}

interface AuthContextValue {
  user: AuthUser | null
  token: string | null
  isGuest: boolean
  login(email: string, password: string): Promise<void>
  register(email: string, password: string): Promise<void>
  continueAsGuest(): void
  logout(): void
  isLoading: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function extractErrorMessage(res: Response, fallback: string): Promise<string> {
  const contentType = res.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    try {
      const data = (await res.json()) as { error?: string }
      if (data?.error) return data.error
    } catch {
      // ignore and fallback below
    }
  }

  try {
    const text = await res.text()
    if (text.includes('<!DOCTYPE')) {
      return 'Server returned HTML instead of API JSON. Check VITE_API_URL points to backend.'
    }
    if (text.trim().length > 0) return text.slice(0, 200)
  } catch {
    // ignore and fallback below
  }

  return fallback
}

async function migrateLegacyExercises(token: string): Promise<void> {
  const raw = localStorage.getItem(LEGACY_CUSTOM_EXERCISES_KEY)
  if (!raw) return
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed) || parsed.length === 0) {
      localStorage.removeItem(LEGACY_CUSTOM_EXERCISES_KEY)
      return
    }
    await fetch(`${BASE_URL}/api/user-exercises`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(parsed),
    })
    localStorage.removeItem(LEGACY_CUSTOM_EXERCISES_KEY)
  } catch {
    // Migration is best-effort; don't block login
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isGuest, setIsGuest] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const stored = readWithLegacyFallback(AUTH_TOKEN_KEY, LEGACY_AUTH_TOKEN_KEY)
    if (!stored) {
      setIsLoading(false)
      return
    }
    fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${stored}` },
    })
      .then(async (res) => {
        if (!res.ok) {
          localStorage.removeItem(AUTH_TOKEN_KEY)
          localStorage.removeItem(LEGACY_AUTH_TOKEN_KEY)
          return
        }
        const data = (await res.json()) as Partial<AuthUser> & { id: number; email: string }
        setToken(stored)
        setIsGuest(false)
        const nextUser = normalizeUser(data)
        setUser(nextUser)
        await migrateLegacyExercises(stored)
        maybeTrackDay7Retained({ userId: nextUser.id, createdAt: nextUser.createdAt })
      })
      .catch(() => {
        localStorage.removeItem(AUTH_TOKEN_KEY)
        localStorage.removeItem(LEGACY_AUTH_TOKEN_KEY)
      })
      .finally(() => setIsLoading(false))
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    if (!res.ok) {
      throw new Error(await extractErrorMessage(res, 'Login failed.'))
    }
    const data = (await res.json()) as {
      token: string
      user: Partial<AuthUser> & { id: number; email: string }
    }
    localStorage.setItem(AUTH_TOKEN_KEY, data.token)
    setToken(data.token)
    setIsGuest(false)
    const nextUser = normalizeUser(data.user)
    setUser(nextUser)
    await migrateLegacyExercises(data.token)
    void trackEvent('auth_login_success', {
      user_id: nextUser.id,
      properties: { role: nextUser.role },
    })
    maybeTrackDay7Retained({ userId: nextUser.id, createdAt: nextUser.createdAt })
  }, [])

  const register = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    if (!res.ok) {
      throw new Error(await extractErrorMessage(res, 'Registration failed.'))
    }
    const data = (await res.json()) as {
      token: string
      user: Partial<AuthUser> & { id: number; email: string }
    }
    localStorage.setItem(AUTH_TOKEN_KEY, data.token)
    setToken(data.token)
    setIsGuest(false)
    const nextUser = normalizeUser(data.user)
    setUser(nextUser)
    void trackEvent('auth_signup_success', {
      user_id: nextUser.id,
      properties: { role: nextUser.role },
    })
  }, [])

  const continueAsGuest = useCallback(() => {
    localStorage.removeItem(AUTH_TOKEN_KEY)
    localStorage.removeItem(LEGACY_AUTH_TOKEN_KEY)
    setToken(null)
    setUser(null)
    setIsGuest(true)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(AUTH_TOKEN_KEY)
    localStorage.removeItem(LEGACY_AUTH_TOKEN_KEY)
    setToken(null)
    setUser(null)
    setIsGuest(false)
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, isGuest, login, register, continueAsGuest, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
