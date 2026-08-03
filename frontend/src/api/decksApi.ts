import type { Deck } from '../types/deck'
import { AUTH_TOKEN_KEY, LEGACY_AUTH_TOKEN_KEY, readWithLegacyFallback } from '../lib/storageKeys'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

function authHeaders(): Record<string, string> {
  const token = readWithLegacyFallback(AUTH_TOKEN_KEY, LEGACY_AUTH_TOKEN_KEY)
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function fetchDecks(): Promise<Deck[]> {
  const res = await fetch(`${BASE_URL}/api/decks`, { headers: authHeaders() })
  if (!res.ok) throw new Error(`GET /api/decks failed: ${res.status}`)
  return res.json() as Promise<Deck[]>
}

export async function fetchDeckBySlug(slug: string): Promise<Deck | null> {
  const res = await fetch(`${BASE_URL}/api/decks/${encodeURIComponent(slug)}`, { headers: authHeaders() })
  // A missing deck is an expected, legitimate outcome here (e.g. a stale bookmark or typo'd
  // slug) — callers render a not-found state rather than an error, unlike other api/*.ts
  // functions that throw uniformly on any non-ok response.
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`GET /api/decks/${slug} failed: ${res.status}`)
  return res.json() as Promise<Deck>
}
