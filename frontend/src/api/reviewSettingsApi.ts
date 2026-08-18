import { AUTH_TOKEN_KEY, LEGACY_AUTH_TOKEN_KEY, REPS_AUTH_TOKEN_KEY, readWithLegacyFallback } from '../lib/storageKeys'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

function authHeaders(): Record<string, string> {
  const token = readWithLegacyFallback(AUTH_TOKEN_KEY, REPS_AUTH_TOKEN_KEY, LEGACY_AUTH_TOKEN_KEY)
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export interface ReviewSettings {
  interval_multiplier: number
  min_interval_multiplier: number
  max_interval_multiplier: number
}

export async function fetchReviewSettings(): Promise<ReviewSettings> {
  const res = await fetch(`${BASE_URL}/api/review-settings`, { headers: authHeaders() })
  if (!res.ok) throw new Error(`GET /api/review-settings failed: ${res.status}`)
  return res.json() as Promise<ReviewSettings>
}

export async function updateReviewSettings(intervalMultiplier: number): Promise<{ interval_multiplier: number }> {
  const res = await fetch(`${BASE_URL}/api/review-settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ interval_multiplier: intervalMultiplier }),
  })
  if (!res.ok) throw new Error(`PUT /api/review-settings failed: ${res.status}`)
  return res.json() as Promise<{ interval_multiplier: number }>
}
