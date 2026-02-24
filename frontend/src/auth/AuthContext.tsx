import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'
const TOKEN_STORAGE_KEY = 'langquiz.auth-token'
const LEGACY_CUSTOM_EXERCISES_KEY = 'langquiz.custom-exercises.v1'

export interface AuthUser {
  id: number
  email: string
  role: 'user' | 'admin'
}

function normalizeUser(user: Partial<AuthUser> & { id: number; email: string }): AuthUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role === 'admin' ? 'admin' : 'user',
  }
}

interface AuthContextValue {
  user: AuthUser | null
  token: string | null
  login(email: string, password: string): Promise<void>
  register(email: string, password: string): Promise<void>
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
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_STORAGE_KEY)
    if (!stored) {
      setIsLoading(false)
      return
    }
    fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${stored}` },
    })
      .then(async (res) => {
        if (!res.ok) {
          localStorage.removeItem(TOKEN_STORAGE_KEY)
          return
        }
        const data = (await res.json()) as Partial<AuthUser> & { id: number; email: string }
        setToken(stored)
        setUser(normalizeUser(data))
        await migrateLegacyExercises(stored)
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_STORAGE_KEY)
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
    localStorage.setItem(TOKEN_STORAGE_KEY, data.token)
    setToken(data.token)
    setUser(normalizeUser(data.user))
    await migrateLegacyExercises(data.token)
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
    localStorage.setItem(TOKEN_STORAGE_KEY, data.token)
    setToken(data.token)
    setUser(normalizeUser(data.user))
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY)
    setToken(null)
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
