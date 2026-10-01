import { AUTH_TOKEN_KEY, LEGACY_AUTH_TOKEN_KEY, REPS_AUTH_TOKEN_KEY, readWithLegacyFallback } from '../lib/storageKeys'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

function authHeaders(): Record<string, string> {
  const token = readWithLegacyFallback(AUTH_TOKEN_KEY, REPS_AUTH_TOKEN_KEY, LEGACY_AUTH_TOKEN_KEY)
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export interface StudySettings {
  dailyReviewLimit: number
  dailyNewLimit: number
}

/** Today's limits and how much of them is used, in the browser's time zone. */
export interface StudyToday extends StudySettings {
  day: string
  reviewedToday: number
  newToday: number
  reviewsRemaining: number
  newRemaining: number
}

export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

export async function fetchStudyToday(): Promise<StudyToday> {
  const res = await fetch(`${BASE_URL}/api/study/today?tz=${encodeURIComponent(browserTimeZone())}`, {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error(`GET /api/study/today failed: ${res.status}`)
  return res.json() as Promise<StudyToday>
}

export async function saveStudySettings(settings: StudySettings): Promise<StudySettings> {
  const res = await fetch(`${BASE_URL}/api/study/settings`, {
    method: 'PUT',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  })
  if (!res.ok) throw new Error(`PUT /api/study/settings failed: ${res.status}`)
  return res.json() as Promise<StudySettings>
}

export interface SchedulerStatus {
  personalized: boolean
  computedAt: string | null
  reviewsUsed: number | null
  availableReviews: number
  requiredReviews: number
}

export async function fetchSchedulerStatus(): Promise<SchedulerStatus> {
  const res = await fetch(`${BASE_URL}/api/study/scheduler`, { headers: authHeaders() })
  if (!res.ok) throw new Error(`GET /api/study/scheduler failed: ${res.status}`)
  return res.json() as Promise<SchedulerStatus>
}

/** Fits the scheduler to the user's history. Throws with the server's message on 422. */
export async function optimizeScheduler(): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/study/scheduler/optimize`, { method: 'POST', headers: authHeaders() })
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? `POST /api/study/scheduler/optimize failed: ${res.status}`)
  }
}
